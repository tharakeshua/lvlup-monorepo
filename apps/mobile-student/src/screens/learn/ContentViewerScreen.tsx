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
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
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
  Icon,
  MaterialBlock,
  ProgressBar,
  QuestionView,
  Screen,
  Skeleton,
  TextField,
} from "../../components";
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
  const progress = (d.progress ?? {}) as {
    questionData?: { status?: "correct" | "incorrect" | "partial" };
    lastEvaluation?: { feedback?: string };
    feedback?: string;
  };
  const status = progress.questionData?.status;
  const feedback = progress.lastEvaluation?.feedback ?? progress.feedback;
  return { status, completed: Boolean(d.completed), feedback, raw: data };
}

function FeedbackBanner({ outcome }: { outcome: AttemptOutcome }) {
  const good = outcome.status === "correct" || (outcome.completed && !outcome.status);
  const partial = outcome.status === "partial";
  const variant = good ? "success" : partial ? "warning" : "error";
  const title = good
    ? "Nice — that's right."
    : partial
      ? "You're close. Let's look again."
      : "Not quite yet — let's work through it.";
  const icon = good ? "check-circle" : partial ? "alert-triangle" : "rotate-ccw";
  return (
    <Alert variant={variant} title={title} icon={<Icon name={icon} size={18} />}>
      {outcome.feedback ??
        (good
          ? "Great work — on to the next one."
          : "Re-check your reasoning, then try again. The tutor can help.")}
    </Alert>
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
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorDraft, setTutorDraft] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const startRef = useRef<number>(Date.now());

  const item = items[current];
  const itemId = item?.id ?? "";
  const outcome = outcomes[itemId];
  const submitted = Boolean(outcome);

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
      if (!item) return;
      const timeSpent = Math.round((Date.now() - startRef.current) / 1000);
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
    setAnswers((m) => ({ ...m, [itemId]: undefined }));
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

  return (
    <Screen className="bg-canvas" contentClassName="p-5 gap-4">
      <Breadcrumb
        items={[
          { label: "Spaces", onPress: () => router.push(routes.spaces()) },
          { label: spTitle, onPress: () => router.push(routes.space(spaceId)) },
        ]}
      />

      <View className="flex-row items-center">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Icon name="chevron-left" size={16} />}
          onPress={() => router.push(routes.space(spaceId))}
        >
          Back
        </Button>
      </View>

      {/* header */}
      <View className="gap-1">
        <Text className="font-display text-text-primary text-2xl">{spTitle}</Text>
        <Text className="text-text-secondary text-sm leading-5">
          Work through each piece at your own pace. Every attempt counts — mistakes are just the
          next step.
        </Text>
      </View>

      {/* SP progress + sibling rail */}
      <View className="gap-2">
        <ProgressBar value={overall} variant="spark" />
        <View className="flex-row items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Icon name="chevron-left" size={16} />}
            disabled={!prevSp}
            onPress={() => prevSp && router.push(routes.spaceContent(spaceId, prevSp.id))}
          >
            Prev SP
          </Button>
          {siblings.length > 0 ? (
            <Text className="text-text-muted text-xs">
              {spIndex >= 0 ? spIndex + 1 : 1} / {siblings.length}
            </Text>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<Icon name="chevron-right" size={16} />}
            disabled={!nextSp}
            onPress={() => nextSp && router.push(routes.spaceContent(spaceId, nextSp.id))}
          >
            Next SP
          </Button>
        </View>
      </View>

      {/* practice CTA */}
      <Button
        variant="secondary"
        block
        leadingIcon={<Icon name="target" size={16} />}
        onPress={() => router.push(routes.practice(spaceId, storyPointId))}
      >
        Practice this story point
      </Button>

      {/* numbered item navigator */}
      <AttemptBar items={barItems} current={current} onSelect={goTo} />

      {/* current item */}
      <Card className="gap-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <View className="flex-row items-center gap-1">
            <Icon name={isMaterial(item) ? "book-open" : "circle-help"} size={13} color="#756E61" />
            <Text className="text-2xs text-text-muted uppercase tracking-wide">
              Item {current + 1} of {items.length}
            </Text>
          </View>
          <Chip active={isMaterial(item)}>{itemKindLabel(item)}</Chip>
          {sectionTitle ? <Chip>{sectionTitle}</Chip> : null}
          {item?.difficulty ? <Chip>{`Difficulty: ${item.difficulty}`}</Chip> : null}
        </View>

        {item?.title ? (
          <Text className="font-display text-text-primary text-lg">{item.title}</Text>
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
          <>
            <QuestionView
              item={item}
              spaceId={spaceId}
              storyPointId={storyPointId}
              value={answers[itemId]}
              onChange={(v: unknown) => setAnswers((m) => ({ ...m, [itemId]: v }))}
              disabled={submitted}
              showResult={submitted}
              result={
                outcome
                  ? {
                      correct:
                        outcome.status === "correct" || (outcome.completed && !outcome.status),
                      feedback: outcome.feedback,
                    }
                  : undefined
              }
            />

            {submitted ? <FeedbackBanner outcome={outcome} /> : null}

            <View className="flex-row flex-wrap items-center gap-2">
              {!submitted ? (
                <Button
                  variant="spark"
                  leadingIcon={<Icon name="send" size={16} />}
                  disabled={answers[itemId] == null || recordAttempt.isPending}
                  loading={recordAttempt.isPending}
                  onPress={() => submit(answers[itemId])}
                >
                  {recordAttempt.isPending ? "Reading your answer…" : "Submit answer"}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  leadingIcon={<Icon name="rotate-ccw" size={16} />}
                  onPress={tryAgain}
                >
                  Try again
                </Button>
              )}
              <Button
                variant="ghost"
                leadingIcon={<Icon name="sparkles" size={16} />}
                onPress={() => setTutorOpen(true)}
              >
                Ask the tutor
              </Button>
              <Button
                variant="ghost"
                leadingIcon={<Icon name="history" size={16} />}
                onPress={() => setShowHistory((v) => !v)}
              >
                History
              </Button>
            </View>

            {showHistory ? (
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

      {/* per-item prev/next */}
      <View className="flex-row items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<Icon name="chevron-left" size={16} />}
          disabled={current === 0}
          onPress={() => goTo(Math.max(0, current - 1))}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          trailingIcon={<Icon name="chevron-right" size={16} />}
          disabled={current === items.length - 1}
          onPress={() => goTo(Math.min(items.length - 1, current + 1))}
        >
          Next
        </Button>
      </View>

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
              router.push(routes.tutor());
            }}
          >
            Continue in tutor chat
          </Button>
        </View>
      </Drawer>
    </Screen>
  );
}
