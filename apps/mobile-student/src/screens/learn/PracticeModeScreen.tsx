/**
 * PracticeModeScreen — low-stakes drill over a story point's questions.
 *
 * Lyceum learning-journey port (UI-3): ONE QUESTION AT A TIME with a
 * status-colored numbered navigator (jump anywhere), a solved tally, warm
 * growth-framed feedback, retry-as-many-times-as-you-like, and full-width
 * stacked actions. Shares the item-render kit (QuestionView) + lyceum
 * primitives with the content viewer.
 *
 * Data: useItems (questions only) + useRecordItemAttempt (server-authoritative
 * scoring — the answer key never reaches the device).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEvaluationConfig, useItems, useRecordItemAttempt } from "@levelup/query";
import { asItemId, asSpaceId, asStoryPointId } from "@levelup/domain";

import {
  Breadcrumb,
  Button,
  Card,
  FeedbackPanel,
  Icon,
  IconButton,
  ItemNavigatorRow,
  ProgressBar,
  QuestionNavBar,
  QuestionView,
  Screen,
  Skeleton,
  colors,
  getPrompt,
  getQuestionData,
  toFeedbackProps,
  type FeedbackVerdict,
  type NavNodeState,
} from "../../components";
import {
  AiAnswerSurface,
  EvaluatingState,
  EvaluationFailed,
  buildHyeModel,
  capabilityFor,
  readWireAnswer,
  type AnswerPart,
} from "../../components/ai-question";
import { FeedbackResult, toStoredEvaluation } from "../../components/ai-question/feedback";
import { asApiError } from "@levelup/query";
import { routes } from "../../lib/routes";
import { ErrorState } from "./_shared/states";
import { asArray, byOrder, isQuestion, questionTypeOf } from "./_shared/normalize";
import type { ItemView } from "./_shared/types";

/** Rebuild read-only AnswerParts from a wire answer's storagePaths (evaluating preview). */
function partsFromWire(value: unknown): AnswerPart[] {
  const { mediaUrls } = readWireAnswer(value);
  return mediaUrls.map((path, i) => ({
    id: `wire-${i}`,
    kind: /\.(m4a|caf|wav|mp3|aac|ogg)(\?|$)/i.test(path) ? "audio" : "image",
    storagePath: path,
    mimeType: "",
    status: "ready" as const,
  }));
}

type PracticeOutcome = { verdict: FeedbackVerdict; raw: unknown };

function outcomeOf(data: unknown): PracticeOutcome {
  const d = (data ?? {}) as {
    completed?: boolean;
    progress?: { questionData?: { status?: string } };
  };
  const status = d.progress?.questionData?.status;
  const verdict: FeedbackVerdict =
    status === "partial"
      ? "partial"
      : status === "correct" || (Boolean(d.completed) && !status)
        ? "correct"
        : "incorrect";
  return { verdict, raw: data };
}

export default function PracticeModeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string; storyPointId?: string }>();
  const spaceId = String(params.spaceId ?? "");
  const storyPointId = String(params.storyPointId ?? "");

  const itemsQ = useItems<unknown>(spaceId, storyPointId);
  const recordAttempt = useRecordItemAttempt();

  const questions = useMemo(
    () =>
      asArray<ItemView>(itemsQ.data)
        .slice()
        .sort(byOrder)
        .filter(isQuestion)
        // Agent assessments have their own conversational submission, never a
        // low-stakes `recordItemAttempt` practice path.
        .filter((item) => questionTypeOf(item) !== "chat_agent_question"),
    [itemsQ.data]
  );

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [outcomes, setOutcomes] = useState<Record<string, PracticeOutcome>>({});
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  const startRef = useRef<number>(Date.now());

  const item = questions[index];
  const itemId = item?.id ?? "";
  const outcome = outcomes[itemId];
  const submitError = submitErrors[itemId];
  const total = questions.length;
  const solved = questions.filter((q) => outcomes[q.id ?? ""]?.verdict === "correct").length;

  // ── AI unified composer (Surfaces A/C/D/E) ────────────────────────────────
  const qData = getQuestionData(item);
  const qType = questionTypeOf(item);
  const capConfig = capabilityFor(qType, qData ?? undefined);
  const isAiComposer = !!capConfig;
  const aiPrompt = getPrompt(item, qData ?? undefined);
  const evalConfigQ = useEvaluationConfig(spaceId, itemId, { enabled: isAiComposer });
  const hyeModel = useMemo(
    () => (isAiComposer ? buildHyeModel(evalConfigQ.data, item, qData) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, isAiComposer, evalConfigQ.data]
  );
  const isThisPending =
    recordAttempt.isPending &&
    (recordAttempt.variables as { itemId?: string } | undefined)?.itemId === itemId;

  const goTo = useCallback((i: number) => {
    setIndex(i);
    startRef.current = Date.now();
  }, []);

  const submit = useCallback(() => {
    if (!item || questionTypeOf(item) === "chat_agent_question") return;
    const timeSpent = Math.round((Date.now() - startRef.current) / 1000);
    // NOTE: the recordItemAttempt contract is `.strict()` with NO top-level
    // `mediaUrls` field; media answers ride inside `answer` as
    // `{ text, mediaUrls }` (question-view.tsx) and the server unwraps them.
    setSubmitErrors((m) => {
      if (!m[item.id]) return m;
      const next = { ...m };
      delete next[item.id];
      return next;
    });
    recordAttempt.mutate(
      {
        spaceId: asSpaceId(spaceId),
        storyPointId: asStoryPointId(storyPointId),
        itemId: asItemId(item.id),
        answer: answers[itemId],
        timeSpent,
      },
      {
        onSuccess: (data) => setOutcomes((m) => ({ ...m, [itemId]: outcomeOf(data) })),
        // Never fail silently — an honest retryable failure (mirrors the content
        // viewer's mob-eval-fix behaviour), surfaced as the warm recovery state.
        onError: (err) => {
          const e = asApiError(err);
          const message =
            e.code === "UNAUTHENTICATED"
              ? "Your session expired. Pull to refresh and try again."
              : "We couldn't check your answer just now. Please try again.";
          setSubmitErrors((m) => ({ ...m, [item.id]: message }));
        },
      }
    );
  }, [item, itemId, answers, recordAttempt, spaceId, storyPointId]);

  const tryAgain = useCallback(() => {
    if (!itemId) return;
    setOutcomes((m) => {
      const next = { ...m };
      delete next[itemId];
      return next;
    });
    setAnswers((m) => ({ ...m, [itemId]: undefined }));
    startRef.current = Date.now();
  }, [itemId]);

  // AI composer try-again PRE-FILLS the prior answer (owner decision): re-enable
  // the composer but KEEP answers[itemId] so the student edits and improves.
  const aiTryAgain = useCallback(() => {
    if (!itemId) return;
    setOutcomes((m) => {
      const next = { ...m };
      delete next[itemId];
      return next;
    });
    setSubmitErrors((m) => {
      if (!m[itemId]) return m;
      const next = { ...m };
      delete next[itemId];
      return next;
    });
    startRef.current = Date.now();
  }, [itemId]);

  if (itemsQ.isLoading)
    return (
      <Screen className="bg-canvas" contentClassName="p-5 gap-4">
        <Skeleton width="50%" height={22} />
        <Skeleton width="100%" height={12} radius={999} />
        <View className="flex-row gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={44} height={44} radius={10} />
          ))}
        </View>
        <Skeleton width="100%" height={280} radius={14} />
      </Screen>
    );
  if (itemsQ.isError)
    return <ErrorState title="We couldn't start practice" onRetry={() => itemsQ.refetch()} />;

  if (total === 0)
    return (
      <Screen className="bg-canvas" contentClassName="p-5 gap-4">
        <Breadcrumb
          items={[
            { label: "Spaces", onPress: () => router.push(routes.spaces()) },
            { label: "Practice", onPress: () => router.push(routes.space(spaceId)) },
          ]}
        />
        <Card className="items-center gap-2 py-8">
          <Icon name="dumbbell" size={28} color={colors.textMuted} />
          <Text className="font-display text-text-primary text-base">
            No practice questions here yet
          </Text>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => router.push(routes.spaceContent(spaceId, storyPointId))}
          >
            Back to lesson
          </Button>
        </Card>
      </Screen>
    );

  const navStates: NavNodeState[] = questions.map((q) => {
    const o = outcomes[q.id ?? ""];
    if (!o) return "idle";
    if (o.verdict === "correct") return "correct";
    if (o.verdict === "partial") return "partial";
    return "incorrect";
  });
  const allSolved = solved === total;

  return (
    <SafeAreaView edges={["top"]} className="bg-canvas flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-6 gap-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* header — identity left, solved tally right */}
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-3">
            <View className="bg-brand-subtle h-11 w-11 items-center justify-center rounded-lg">
              <Icon name="dumbbell" size={20} color={colors.brand} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="font-display text-text-primary text-xl" numberOfLines={1}>
                Practice
              </Text>
              <Text className="font-ui text-text-secondary text-xs">
                Retry as many times as you like.
              </Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-text-primary font-mono text-xl">
              {solved}
              <Text className="text-text-muted"> / {total}</Text>
            </Text>
            <Text className="font-ui text-text-muted tracking-caps text-2xs font-semibold uppercase">
              Solved
            </Text>
          </View>
        </View>

        <ProgressBar value={total ? (solved / total) * 100 : 0} variant="success" height={6} />

        {/* numbered navigator — jump anywhere */}
        <ItemNavigatorRow states={navStates} current={index} onSelect={goTo} />

        {allSolved ? (
          <Card className="items-center gap-3 py-8">
            <Icon name="award" size={32} color={colors.spark} />
            <Text className="font-display text-text-primary text-lg">Practice complete</Text>
            <Text className="font-ui text-text-secondary px-6 text-center text-sm">
              You solved all {total} — beautifully done. Come back any time to keep it sharp.
            </Text>
            <View className="flex-row gap-2">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Icon name="arrow-left" size={15} />}
                onPress={() => router.push(routes.spaceContent(spaceId, storyPointId))}
              >
                Back to lesson
              </Button>
              <Button
                variant="primary"
                size="sm"
                onPress={() => router.push(routes.space(spaceId))}
              >
                Done
              </Button>
            </View>
          </Card>
        ) : null}

        {/* current question — the immersive one-at-a-time card */}
        {item ? (
          <Card className="gap-4 p-5">
            <View className="border-border-subtle flex-row items-center justify-between border-b pb-3">
              <Text className="font-ui text-text-muted text-xs">
                Question{" "}
                <Text className="font-mono">
                  {index + 1} of {total}
                </Text>
              </Text>
              {outcome ? (
                outcome.verdict === "correct" ? (
                  <View className="flex-row items-center gap-1">
                    <Icon name="check-circle" size={14} color={colors.masteryMastered} />
                    <Text className="font-ui text-mastery-mastered text-xs font-medium">
                      Solved
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1">
                    <Icon name="circle-dot" size={14} color={colors.warning} />
                    <Text className="font-ui text-warning text-xs font-medium">
                      {outcome.verdict === "partial" ? "Almost there" : "Keep going"}
                    </Text>
                  </View>
                )
              ) : null}
            </View>

            {isAiComposer && capConfig ? (
              /* ── Surfaces A/C/D/E: unified multimodal composer ── */
              outcome && toStoredEvaluation(outcome.raw) ? (
                <FeedbackResult
                  evaluation={toStoredEvaluation(outcome.raw)!}
                  actions={{
                    onTryAgain: aiTryAgain,
                    onDiscuss: () =>
                      router.push(routes.tutor({ scope: "item", spaceId, storyPointId, itemId })),
                    onNext: index < total - 1 ? () => goTo(index + 1) : undefined,
                  }}
                />
              ) : outcome ? (
                <View className="gap-4">
                  <FeedbackPanel verdict={outcome.verdict} {...toFeedbackProps(outcome.raw)} />
                  <View className="gap-2">
                    <Button
                      variant="secondary"
                      block
                      leadingIcon={<Icon name="rotate-ccw" size={16} />}
                      onPress={aiTryAgain}
                    >
                      Try again
                    </Button>
                    {index < total - 1 ? (
                      <Button
                        variant="primary"
                        block
                        trailingIcon={<Icon name="arrow-right" size={16} />}
                        onPress={() => goTo(index + 1)}
                      >
                        Next question
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      block
                      leadingIcon={<Icon name="message-circle" size={16} />}
                      onPress={() =>
                        router.push(routes.tutor({ scope: "item", spaceId, storyPointId, itemId }))
                      }
                    >
                      Ask tutor
                    </Button>
                  </View>
                </View>
              ) : isThisPending ? (
                <EvaluatingState
                  hints={
                    hyeModel?.dimensions.length
                      ? hyeModel.dimensions.map((d) => d.name.toLowerCase())
                      : undefined
                  }
                  answerText={readWireAnswer(answers[itemId]).text}
                  answerParts={partsFromWire(answers[itemId])}
                />
              ) : submitError ? (
                <EvaluationFailed
                  onRetry={submit}
                  onBackToAnswer={() =>
                    setSubmitErrors((m) => {
                      const n = { ...m };
                      delete n[itemId];
                      return n;
                    })
                  }
                />
              ) : (
                <AiAnswerSurface
                  key={itemId}
                  qType={qType ?? ""}
                  config={capConfig}
                  prompt={aiPrompt}
                  data={qData ?? {}}
                  difficulty={typeof item?.difficulty === "string" ? item.difficulty : undefined}
                  hyeModel={hyeModel}
                  value={answers[itemId]}
                  onChange={(v: unknown) => setAnswers((m) => ({ ...m, [itemId]: v }))}
                  spaceId={spaceId}
                  scopeId={itemId}
                  submitting={isThisPending}
                  onSubmit={submit}
                  onDiscuss={() =>
                    router.push(routes.tutor({ scope: "item", spaceId, storyPointId, itemId }))
                  }
                />
              )
            ) : (
              <>
                <QuestionView
                  item={item}
                  spaceId={spaceId}
                  storyPointId={storyPointId}
                  value={answers[itemId]}
                  onChange={(v: unknown) => setAnswers((m) => ({ ...m, [itemId]: v }))}
                  disabled={outcome != null}
                  showResult={outcome != null}
                  hideBanner
                  result={outcome ? { correct: outcome.verdict === "correct" } : undefined}
                />

                {outcome ? (
                  <FeedbackPanel verdict={outcome.verdict} {...toFeedbackProps(outcome.raw)} />
                ) : null}

                {/* full-width stacked actions */}
                <View className="gap-2">
                  {!outcome ? (
                    <Button
                      variant="primary"
                      block
                      disabled={answers[itemId] == null || recordAttempt.isPending}
                      loading={recordAttempt.isPending}
                      onPress={submit}
                    >
                      {recordAttempt.isPending ? "Reading your answer…" : "Check answer"}
                    </Button>
                  ) : (
                    <>
                      {outcome.verdict !== "correct" ? (
                        <Button
                          variant="secondary"
                          block
                          leadingIcon={<Icon name="rotate-ccw" size={16} />}
                          onPress={tryAgain}
                        >
                          Try again
                        </Button>
                      ) : null}
                      {index < total - 1 ? (
                        <Button
                          variant="primary"
                          block
                          trailingIcon={<Icon name="arrow-right" size={16} />}
                          onPress={() => goTo(index + 1)}
                        >
                          Next question
                        </Button>
                      ) : null}
                    </>
                  )}
                  <Button
                    variant="ghost"
                    block
                    leadingIcon={<Icon name="message-circle" size={16} />}
                    onPress={() =>
                      router.push(
                        routes.tutor({
                          scope: "item",
                          spaceId,
                          storyPointId,
                          itemId,
                        })
                      )
                    }
                  >
                    Ask tutor
                  </Button>
                </View>
              </>
            )}
          </Card>
        ) : null}
      </ScrollView>

      {/* question-scoped bottom nav — stepping + back to the lesson */}
      <QuestionNavBar
        onBack={() => router.push(routes.space(spaceId))}
        prev={{ onPress: () => goTo(Math.max(0, index - 1)), disabled: index === 0 }}
        next={{ onPress: () => goTo(Math.min(total - 1, index + 1)), disabled: index >= total - 1 }}
        position={index + 1}
        total={total}
        actions={
          <IconButton
            icon="book-open"
            label="Back to lesson"
            variant="subtle"
            onPress={() => router.push(routes.spaceContent(spaceId, storyPointId))}
          />
        }
      />
    </SafeAreaView>
  );
}
