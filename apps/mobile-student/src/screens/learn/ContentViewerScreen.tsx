/**
 * ContentViewerScreen — the ITEM VIEWER (the richest Learn screen).
 *
 * Design: docs/rebuild-spec/design/build/app/mobile-family/_build/learning-content-view.viewjs
 * Data:   useItems (answer-stripped items) + useStoryPointProgress (per-item
 *         progress) + useStoryPoints (SP title + sibling rail) and the
 *         useRecordItemAttempt mutation (authoritative {progress, completed}).
 *
 * Flow: a numbered AttemptBar over all items in the story point → the current
 * item rendered as a MaterialBlock (mark-as-read) or a QuestionView (all 15
 * question types) → submit records an attempt → server-returned feedback (the
 * answer key is never on the device) → prev/next.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useEvaluationConfig,
  useItems,
  useRecordItemAttempt,
  useStoryPointProgress,
  useStoryPoints,
} from "@levelup/query";
import { asItemId, asSpaceId, asStoryPointId } from "@levelup/domain";

import {
  Alert,
  AttemptBar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Chip,
  Drawer,
  FeedbackPanel,
  Icon,
  IconButton,
  MaterialBlock,
  ProgressBar,
  QuestionNavBar,
  QuestionView,
  Screen,
  Skeleton,
  TextField,
  colors,
  getPrompt,
  getQuestionData,
  toFeedbackProps,
  type FeedbackVerdict,
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
import { AttemptHistorySheet } from "../../components/ai-question/history";
import { FeedbackResult, toStoredEvaluation } from "../../components/ai-question/feedback";
import { asApiError } from "@levelup/query";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { ErrorState } from "./_shared/states";
import {
  asArray,
  byOrder,
  isMaterial,
  isQuestion,
  itemKindLabel,
  itemStatusOf,
  pct,
  questionTypeOf,
  type ItemStatus,
} from "./_shared/normalize";
import type { ItemView, StoryPointProgressView, StoryPointView } from "./_shared/types";

type AttemptOutcome = {
  status?: "correct" | "incorrect" | "partial";
  completed: boolean;
  feedback?: string;
  raw: unknown;
};

/** Pull a friendly outcome from the authoritative recordItemAttempt result. */
function toOutcome(data: unknown): AttemptOutcome {
  const d = (data ?? {}) as { completed?: boolean; progress?: Record<string, unknown> };
  // The authoritative shape is `progress.evaluation` (StoredEvaluation) plus the
  // top-level `solved`/`percentage` roll-ups — NOT `questionData`/`lastEvaluation`
  // (those were a stale guess that made every AI grade render as a blank
  // "incorrect"). Verdict is derived from correctness/solved so a partial score
  // reads as partial, not a flat wrong.
  const progress = (d.progress ?? {}) as {
    solved?: boolean;
    percentage?: number;
    evaluation?: {
      correctness?: number;
      percentage?: number;
      summary?: { keyTakeaway?: string; overallComment?: string };
    } | null;
  };
  const ev = progress.evaluation ?? undefined;
  const correctness = typeof ev?.correctness === "number" ? ev.correctness : undefined;
  const percentage =
    typeof ev?.percentage === "number"
      ? ev.percentage
      : typeof progress.percentage === "number"
        ? progress.percentage
        : undefined;
  const status: AttemptOutcome["status"] =
    progress.solved === true || (correctness != null && correctness >= 1)
      ? "correct"
      : (correctness != null && correctness > 0) || (percentage != null && percentage > 0)
        ? "partial"
        : ev
          ? "incorrect"
          : undefined;
  const feedback = ev?.summary?.overallComment ?? ev?.summary?.keyTakeaway;
  return { status, completed: Boolean(d.completed), feedback, raw: data };
}

/**
 * Derive a submitted outcome from the PERSISTED per-item progress entry so a
 * result that landed while the student was away (evaluating is backgroundable —
 * commit-once, owner decision) renders on re-entry. Reads the same authoritative
 * `evaluation` StoredEvaluation the mutation returns, re-wrapped into the raw
 * shape `toOutcome`/`toFeedbackProps` expect. Returns undefined when the item has
 * no result yet.
 */
function outcomeFromEntry(entry: unknown): AttemptOutcome | undefined {
  const e = (entry ?? undefined) as
    | {
        completed?: boolean;
        correct?: boolean;
        percentage?: number;
        evaluation?: Record<string, unknown> | null;
        questionData?: { status?: string; solved?: boolean; percentage?: number };
      }
    | undefined;
  if (!e) return undefined;
  const ev = e.evaluation ?? undefined;
  const q = e.questionData;
  const hasResult = ev != null || q?.status != null || e.correct != null || e.completed === true;
  if (!hasResult) return undefined;
  const solved = e.correct ?? q?.solved ?? (q?.status === "correct" ? true : undefined);
  const percentage =
    (typeof ev?.percentage === "number" ? (ev.percentage as number) : undefined) ??
    e.percentage ??
    q?.percentage;
  const raw = {
    completed: e.completed ?? e.correct === true,
    progress: { evaluation: ev, solved, percentage },
  };
  return toOutcome(raw);
}

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

/** The warm growth-framed verdict, hydrated from the raw attempt result. */
function AttemptFeedback({ outcome }: { outcome: AttemptOutcome }) {
  const verdict: FeedbackVerdict =
    outcome.status === "partial"
      ? "partial"
      : outcome.status === "correct" || (outcome.completed && !outcome.status)
        ? "correct"
        : "incorrect";
  const rich = toFeedbackProps(outcome.raw);
  const fallback =
    verdict === "correct"
      ? "Great work — on to the next one."
      : "Re-check your reasoning, then try again. The tutor can help.";
  return (
    <FeedbackPanel
      verdict={verdict}
      {...rich}
      comment={rich.comment ?? outcome.feedback ?? fallback}
    />
  );
}

export default function ContentViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string; storyPointId?: string }>();
  const spaceId = String(params.spaceId ?? "");
  const storyPointId = String(params.storyPointId ?? "");

  const itemsQ = useItems<unknown>(spaceId, storyPointId);
  const progressQ = useStoryPointProgress(asSpaceId(spaceId), asStoryPointId(storyPointId));
  const storyPointsQ = useStoryPoints<unknown>(spaceId);
  const recordAttempt = useRecordItemAttempt();

  const items = useMemo(() => asArray<ItemView>(itemsQ.data).slice().sort(byOrder), [itemsQ.data]);
  const progress = (progressQ.data ?? undefined) as StoryPointProgressView | undefined;
  const progressItems = progress?.items ?? {};

  // sibling story points → prev/next SP rail + current title
  const siblings = useMemo(
    () => asArray<StoryPointView>(storyPointsQ.data).slice().sort(byOrder),
    [storyPointsQ.data]
  );
  const spIndex = siblings.findIndex((s) => s.id === storyPointId);
  const currentSp = spIndex >= 0 ? siblings[spIndex] : undefined;
  const prevSp = spIndex > 0 ? siblings[spIndex - 1] : undefined;
  const nextSp = spIndex >= 0 && spIndex < siblings.length - 1 ? siblings[spIndex + 1] : undefined;

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [outcomes, setOutcomes] = useState<Record<string, AttemptOutcome>>({});
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorDraft, setTutorDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const startRef = useRef<number>(Date.now());

  const item = items[current];
  const itemId = item?.id ?? "";
  const outcome = outcomes[itemId];
  const submitError = submitErrors[itemId];
  const isAgentAssessment = questionTypeOf(item) === "chat_agent_question";
  // Conversational assessments have their own immutable submission path. They
  // must never become a generic item attempt just because this viewer renders
  // all question types in one place.
  const submitted = !isAgentAssessment && Boolean(outcome);

  // ── AI unified composer (Surfaces A/C/D/E) ────────────────────────────────
  // The 5 AI-composer types (text/paragraph/code/audio/image_evaluation) render
  // the redesigned multimodal composer; every other type keeps the generic
  // QuestionView. chat_agent_question stays on its conversational path.
  const qData = getQuestionData(item);
  const qType = questionTypeOf(item);
  const capConfig = capabilityFor(qType, qData ?? undefined);
  const isAiComposer = !!capConfig && !isAgentAssessment;
  const aiPrompt = getPrompt(item, qData ?? undefined);
  // getEvaluationConfig student projection — lights up the rich HYE (criteria
  // ladders + enabled-dimension chips + pass %). Degrades to the item.rubric
  // fallback while loading / when a leg resolves null.
  const evalConfigQ = useEvaluationConfig(spaceId, itemId, { enabled: isAiComposer });
  const hyeModel = useMemo(
    () => (isAiComposer ? buildHyeModel(evalConfigQ.data, item, qData) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, isAiComposer, evalConfigQ.data]
  );
  // Backgrounded / previously-answered result rehydrated from persisted progress.
  const persistedOutcome = isAiComposer ? outcomeFromEntry(progressItems[itemId]) : undefined;
  const aiOutcome = outcome ?? persistedOutcome;
  const aiSubmitted = isAiComposer && Boolean(aiOutcome);
  // W2 Surface G renders from the authoritative StoredEvaluation; null when the
  // completed attempt carries no rich eval (then we keep the warm fallback).
  const aiEval = aiOutcome ? toStoredEvaluation(aiOutcome.raw) : null;
  // Scope the pending/evaluating state to THIS item (the mutation is shared).
  const isThisPending =
    recordAttempt.isPending &&
    (recordAttempt.variables as { itemId?: string } | undefined)?.itemId === itemId;

  // AttemptBar status strip over all items (current item overrides to "current").
  const barItems = useMemo<{ status: ItemStatus }[]>(
    () =>
      items.map((it, i) => {
        if (i === current && !outcomes[it.id]) return { status: "current" as ItemStatus };
        const local = outcomes[it.id];
        if (local) {
          if (local.status === "correct" || (local.completed && !local.status))
            return { status: "mastered" };
          if (local.status === "partial") return { status: "partial" };
          if (local.status === "incorrect") return { status: "incorrect" };
        }
        return { status: itemStatusOf(progressItems[it.id]) };
      }),
    [items, current, outcomes, progressItems]
  );

  const goTo = useCallback((i: number) => {
    setCurrent(i);
    setShowHistory(false);
    startRef.current = Date.now();
  }, []);

  const submit = useCallback(
    (answer: unknown) => {
      if (!item || questionTypeOf(item) === "chat_agent_question") return;
      const timeSpent = Math.round((Date.now() - startRef.current) / 1000);
      // A fresh attempt clears any prior error banner for this item.
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
          answer,
          timeSpent,
        },
        {
          onSuccess: (data) => setOutcomes((m) => ({ ...m, [item.id]: toOutcome(data) })),
          // Never fail silently: surface an honest, retryable error card. A
          // grading error (or a response the client can't parse) used to render
          // as nothing at all — the learner tapped Check and saw no change.
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
    },
    [item, recordAttempt, spaceId, storyPointId]
  );

  const tryAgain = useCallback(() => {
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
    setAnswers((m) => ({ ...m, [itemId]: undefined }));
    startRef.current = Date.now();
  }, [itemId]);

  // AI composer try-again PRE-FILLS the prior answer bundle (owner decision):
  // clear the outcome/error to re-enable the composer but KEEP answers[itemId]
  // (text + ready media) so the student edits and improves rather than restarts.
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

  // ── states ────────────────────────────────────────────────────────────────
  if (itemsQ.isLoading) {
    return (
      <Screen className="bg-canvas" contentClassName="p-5 gap-4">
        <View className="flex-row gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={38} height={38} radius={999} />
          ))}
        </View>
        <Skeleton width="100%" height={180} radius={14} />
        <Skeleton width="60%" height={16} />
      </Screen>
    );
  }
  // Only a genuine failure shows the error state. A NOT_FOUND (empty story point)
  // or a pre-autologin UNAUTHENTICATED read falls through to the empty state
  // below. The per-item progress read (`progressQ`) is never gated on here — it
  // degrades to zero progress (`progress?.items ?? {}`), so a missing progress
  // doc on a not-yet-started story point can't crash or block the viewer.
  if (isHardError(itemsQ))
    return (
      <ErrorState
        title="We couldn't load this lesson"
        body="Something hiccuped on our end. Give it another go."
        onRetry={() => itemsQ.refetch()}
      />
    );

  const spTitle = currentSp?.title ?? "Lesson";

  if (items.length === 0) {
    return (
      <Screen className="bg-canvas" contentClassName="p-5 gap-4">
        <Breadcrumb
          items={[
            { label: "Spaces", onPress: () => router.push(routes.spaces()) },
            { label: spTitle, onPress: () => router.push(routes.space(spaceId)) },
          ]}
        />
        <View className="py-12">
          <Card className="items-center gap-2 py-8">
            <Icon name="inbox" size={28} color="#756E61" />
            <Text className="font-display text-text-primary text-base">Nothing here yet</Text>
            <Text className="text-text-muted px-6 text-center text-sm">
              This lesson doesn't have any content yet. We'll let you know when it's ready.
            </Text>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="arrow-left" size={15} />}
              onPress={() => router.push(routes.space(spaceId))}
            >
              Back to space
            </Button>
          </Card>
        </View>
      </Screen>
    );
  }

  const sectionTitle = currentSp?.sections?.find((s) => s.id === item?.sectionId)?.title;
  const overall = pct(progress?.percentage);

  // Bottom-bar stepping: within items first; at the boundary, cross lessons.
  const prevStep =
    current > 0
      ? { onPress: () => goTo(Math.max(0, current - 1)) }
      : prevSp
        ? { onPress: () => router.push(routes.spaceContent(spaceId, prevSp.id)), crossing: true }
        : { onPress: () => {}, disabled: true };
  const nextStep =
    current < items.length - 1
      ? { onPress: () => goTo(Math.min(items.length - 1, current + 1)) }
      : nextSp
        ? { onPress: () => router.push(routes.spaceContent(spaceId, nextSp.id)), crossing: true }
        : { onPress: () => {}, disabled: true };

  return (
    <SafeAreaView edges={["top"]} className="bg-canvas flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-6 gap-4"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* compact header: SP title + lesson counter + thin progress */}
        <View className="gap-2">
          <View className="flex-row items-baseline justify-between gap-2">
            <Text className="font-display text-text-primary flex-1 text-lg" numberOfLines={1}>
              {spTitle}
            </Text>
            {siblings.length > 0 ? (
              <Text className="text-text-muted text-xs">
                Lesson {spIndex >= 0 ? spIndex + 1 : 1} / {siblings.length}
              </Text>
            ) : null}
          </View>
          <ProgressBar value={overall} variant={overall >= 100 ? "success" : "brand"} height={6} />
        </View>

        {/* numbered item navigator */}
        <AttemptBar items={barItems} current={current} onSelect={goTo} />

        {/* current item — the immersive one-at-a-time card */}
        <Card className="gap-4 p-5">
          <View className="border-border-subtle flex-row items-center justify-between border-b pb-3">
            <View className="flex-row flex-wrap items-center gap-2">
              <View className="bg-brand-subtle h-7 w-7 items-center justify-center rounded-md">
                <Icon
                  name={isMaterial(item) ? "file-text" : "help-circle"}
                  size={14}
                  color={colors.brand}
                />
              </View>
              <Text className="font-ui text-text-muted text-xs">
                {itemKindLabel(item)}{" "}
                <Text className="font-mono">
                  {current + 1} of {items.length}
                </Text>
              </Text>
            </View>
            {/* difficulty renders inside QuestionView's chip row — no twin here */}
          </View>

          {sectionTitle ? <Chip className="px-2 py-0.5">{sectionTitle}</Chip> : null}

          {item?.title && !isAiComposer ? (
            <Text className="font-display text-text-primary text-lg leading-7">{item.title}</Text>
          ) : null}

          {/* MATERIAL */}
          {isMaterial(item) ? (
            <>
              <MaterialBlock item={item} />
              <View className="flex-row justify-start">
                {submitted ? (
                  <Badge variant="success" icon={<Icon name="check" size={12} />}>
                    Read
                  </Badge>
                ) : (
                  <Button
                    variant="spark"
                    size="sm"
                    leadingIcon={<Icon name="check" size={16} />}
                    loading={recordAttempt.isPending}
                    onPress={() => submit({ read: true })}
                  >
                    Mark as read
                  </Button>
                )}
              </View>
            </>
          ) : null}

          {/* QUESTION */}
          {isQuestion(item) ? (
            isAiComposer && capConfig ? (
              /* ── Surfaces A/C/D/E: unified multimodal composer ── */
              aiSubmitted && aiEval ? (
                <FeedbackResult
                  evaluation={aiEval}
                  actions={{
                    onTryAgain: aiTryAgain,
                    onDiscuss: () => setTutorOpen(true),
                    onHistory: () => setHistoryOpen(true),
                    onNext: nextStep.disabled ? undefined : nextStep.onPress,
                  }}
                />
              ) : aiSubmitted && aiOutcome ? (
                <View className="gap-4">
                  <AttemptFeedback outcome={aiOutcome} />
                  <View className="gap-2">
                    <Button
                      variant="secondary"
                      block
                      leadingIcon={<Icon name="rotate-ccw" size={16} />}
                      onPress={aiTryAgain}
                    >
                      Try again
                    </Button>
                    <View className="flex-row gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1"
                        leadingIcon={<Icon name="message-circle" size={16} />}
                        onPress={() => setTutorOpen(true)}
                      >
                        Ask tutor
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex-1"
                        leadingIcon={<Icon name="history" size={16} />}
                        onPress={() => setHistoryOpen(true)}
                      >
                        History
                      </Button>
                    </View>
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
                  onRetry={() => submit(answers[itemId])}
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
                  onSubmit={() => submit(answers[itemId])}
                  onDiscuss={() => setTutorOpen(true)}
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
                  disabled={submitted}
                  showResult={submitted}
                  hideBanner
                  result={
                    outcome
                      ? {
                          correct:
                            outcome.status === "correct" || (outcome.completed && !outcome.status),
                        }
                      : undefined
                  }
                />

                {submitted ? <AttemptFeedback outcome={outcome} /> : null}

                {/* AI grading can take several seconds — keep the wait honest and
                visible so the learner knows their answer is being read, not lost. */}
                {!submitted && !isAgentAssessment && recordAttempt.isPending ? (
                  <Alert
                    variant="brand"
                    title="Evaluating your answer…"
                    icon={<Icon name="sparkles" size={16} />}
                  >
                    Our AI tutor is reading your response. This usually takes a few seconds.
                  </Alert>
                ) : null}

                {/* Honest, retryable failure — never a silent no-op. */}
                {!submitted && !isAgentAssessment && submitError && !recordAttempt.isPending ? (
                  <Alert
                    variant="error"
                    title="That didn't go through"
                    icon={<Icon name="alert-circle" size={16} />}
                  >
                    <View className="gap-2">
                      <Text className="font-ui text-text-secondary text-sm">{submitError}</Text>
                      <Button
                        variant="secondary"
                        size="sm"
                        leadingIcon={<Icon name="rotate-ccw" size={15} />}
                        onPress={() => submit(answers[itemId])}
                      >
                        Retry
                      </Button>
                    </View>
                  </Alert>
                ) : null}

                {/* full-width stacked actions — big touch targets, one clear next step */}
                {isAgentAssessment ? (
                  <Alert
                    variant="info"
                    title="Interview submission"
                    icon={<Icon name="shield-check" size={16} />}
                  >
                    Use the conversation above and choose{" "}
                    <Text className="font-ui font-semibold">Finish interview</Text> when you are
                    ready. This assessment is not checked through the normal answer flow.
                  </Alert>
                ) : (
                  <View className="gap-2">
                    {!submitted ? (
                      <Button
                        variant="primary"
                        block
                        disabled={answers[itemId] == null || recordAttempt.isPending}
                        loading={recordAttempt.isPending}
                        onPress={() => submit(answers[itemId])}
                      >
                        {recordAttempt.isPending ? "Reading your answer…" : "Check answer"}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        block
                        leadingIcon={<Icon name="rotate-ccw" size={16} />}
                        onPress={tryAgain}
                      >
                        Try again
                      </Button>
                    )}
                    <View className="flex-row gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1"
                        leadingIcon={<Icon name="message-circle" size={16} />}
                        onPress={() => setTutorOpen(true)}
                      >
                        Ask tutor
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex-1"
                        leadingIcon={<Icon name="history" size={16} />}
                        onPress={() => setShowHistory((v) => !v)}
                      >
                        History
                      </Button>
                    </View>
                  </View>
                )}

                {showHistory && !isAgentAssessment ? (
                  <View className="border-border-subtle gap-1 border-t pt-3">
                    {(() => {
                      const attempts = (progressItems[itemId]?.attempts ?? []) as {
                        attemptNumber?: number;
                        score?: number;
                        maxScore?: number;
                      }[];
                      if (attempts.length === 0)
                        return (
                          <Text className="text-text-muted text-xs">
                            No attempts yet — give it a try when you're ready.
                          </Text>
                        );
                      return attempts.map((a, i) => (
                        <View key={i} className="flex-row items-center justify-between">
                          <Text className="text-text-muted text-xs">
                            Attempt {a.attemptNumber ?? i + 1}
                          </Text>
                          <Text className="text-text-secondary text-xs">
                            {typeof a.score === "number" ? `${a.score}/${a.maxScore ?? "—"}` : "—"}
                          </Text>
                        </View>
                      ));
                    })()}
                  </View>
                ) : null}
              </>
            )
          ) : null}

          {/* OTHER item types (interactive/assessment/discussion/project/checkpoint) */}
          {!isMaterial(item) && !isQuestion(item) ? (
            <View className="gap-3">
              {item?.content ? (
                <Text className="text-text-secondary text-sm leading-5">{item.content}</Text>
              ) : null}
              <Alert
                variant="info"
                title="Open this activity"
                icon={<Icon name="external-link" size={16} />}
              >
                This item type is best completed in the full activity view.
              </Alert>
              {submitted ? (
                <Badge variant="success" icon={<Icon name="check" size={12} />}>
                  Done
                </Badge>
              ) : (
                <Button
                  variant="spark"
                  size="sm"
                  leadingIcon={<Icon name="check" size={16} />}
                  loading={recordAttempt.isPending}
                  onPress={() => submit({ acknowledged: true })}
                >
                  Mark complete
                </Button>
              )}
            </View>
          ) : null}
        </Card>
      </ScrollView>

      {/* question-scoped bottom nav — stepping + quick practice, off the card */}
      <QuestionNavBar
        onBack={() => router.push(routes.space(spaceId))}
        prev={prevStep}
        next={nextStep}
        position={current + 1}
        total={items.length}
        actions={
          <IconButton
            icon="dumbbell"
            label="Practice this lesson"
            variant="subtle"
            onPress={() => router.push(routes.practice(spaceId, storyPointId))}
          />
        }
      />

      {/* Tutor drawer */}
      <Drawer open={tutorOpen} onClose={() => setTutorOpen(false)} title="Ask the tutor">
        <View className="gap-3 p-4">
          <View className="flex-row items-center gap-1">
            <Icon name="anchor" size={13} color="#756E61" />
            <Text className="text-2xs text-text-muted">
              Keyed to: Item {current + 1} — {itemKindLabel(item)}
            </Text>
          </View>
          <Card className="bg-brand-subtle">
            <Text className="text-text-secondary text-sm">
              Hi! Ask me anything about this item and I'll walk you through it — without giving away
              the answer.
            </Text>
          </Card>
          <TextField
            value={tutorDraft}
            onChangeText={setTutorDraft}
            placeholder="Ask anything about this item…"
            multiline
            label="Your message"
          />
          <Button
            variant="spark"
            block
            leadingIcon={<Icon name="send" size={16} />}
            onPress={() => {
              setTutorOpen(false);
              router.push(
                routes.tutor({
                  scope: "item",
                  spaceId,
                  storyPointId,
                  itemId,
                })
              );
            }}
          >
            Continue in tutor chat
          </Button>
        </View>
      </Drawer>

      {/* Surface H — attempt history (W5). Renders attempts[] when the writer
          persists them, else degrades to the single best-result row. */}
      <AttemptHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entry={progressItems[itemId]}
        promptText={aiPrompt || item?.title}
        onTryAgain={() => {
          setHistoryOpen(false);
          aiTryAgain();
        }}
      />
    </SafeAreaView>
  );
}
