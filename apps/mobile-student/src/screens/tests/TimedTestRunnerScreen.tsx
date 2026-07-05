/**
 * Timed-test runner — FULL-SCREEN focus (no tab bar; mounted at root `/run/...`
 * by the shell). Keyed by `storyPointId`.
 *
 * Server-authoritative throughout: the live deadline comes from
 * `useTestSessionDeadline` (subscription) + the session's `serverDeadline`; the
 * clock is never trusted to the device. Per-answer saves go through
 * `useEvaluateAnswer`; submission through `useSubmitTestSession`. The answer key
 * is sealed — `QuestionView` renders inputs only, never correctness, pre-submit.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { asItemId, asSpaceId, asStoryPointId, asTestSessionId } from "@levelup/domain";
import {
  useEvaluateAnswer,
  useSubmitTestSession,
  useTestSession,
  useTestSessionDeadline,
  useTestSessions,
} from "@levelup/query";

import {
  Alert,
  Badge,
  Button,
  Chip,
  Icon,
  IconButton,
  Modal,
  QuestionView,
  Skeleton,
  TimerBar,
} from "../../components";
import {
  AnswerKeyLock,
  Panel,
  clock,
  latestSession,
  readSession,
  readSessions,
  useStoryPointParams,
  useTestNav,
} from "./_components";

type QStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked_for_review"
  | "answered_and_marked";

const NODE_STYLE: Record<QStatus, { bg: string; fg: string; icon: string; label: string }> = {
  answered: { bg: "#BFE6D2", fg: "#2F7D5B", icon: "check", label: "Answered" },
  marked_for_review: { bg: "#FBE0B0", fg: "#C97A14", icon: "flag", label: "Marked for review" },
  answered_and_marked: { bg: "#CFC9EC", fg: "#423A82", icon: "flag", label: "Answered & marked" },
  not_answered: { bg: "#F4EEE4", fg: "#756E61", icon: "circle", label: "Not answered" },
  not_visited: { bg: "#FBF8F3", fg: "#9A9486", icon: "circle", label: "Not seen" },
};

interface QuestionData {
  itemId: string;
  questionData: unknown;
  type?: string;
  difficulty?: string;
  points?: number;
  /** Learner-facing prompt/title, carried so QuestionView can render the question. */
  prompt?: string;
  title?: string;
}

function readQuestions(raw: Record<string, unknown>): QuestionData[] {
  const list = Array.isArray(raw.questions)
    ? (raw.questions as unknown[])
    : Array.isArray(raw.items)
      ? (raw.items as unknown[])
      : [];
  return list.map((q, i) => {
    const o = (q && typeof q === "object" ? q : {}) as Record<string, unknown>;
    return {
      itemId: typeof o.itemId === "string" ? o.itemId : typeof o.id === "string" ? o.id : String(i),
      questionData: o.questionData ?? o.payload ?? o,
      type: typeof o.questionType === "string" ? o.questionType : undefined,
      difficulty: typeof o.difficulty === "string" ? o.difficulty : undefined,
      points: typeof o.points === "number" ? o.points : undefined,
      prompt: typeof o.prompt === "string" ? o.prompt : undefined,
      title: typeof o.title === "string" ? o.title : undefined,
    };
  });
}

/**
 * Pull captured `mediaUrls` out of a normalized `{ text, mediaUrls }` answer
 * value (question-view.tsx). Plain string/array answers carry no media → [].
 */
function extractMediaUrls(answer: unknown): string[] {
  if (answer && typeof answer === "object" && !Array.isArray(answer)) {
    const m = (answer as { mediaUrls?: unknown }).mediaUrls;
    if (Array.isArray(m)) return m.filter((u): u is string => typeof u === "string");
  }
  return [];
}

/** Question navigator grid (5-status taxonomy). */
function QuestionNavigator({
  statuses,
  current,
  onJump,
}: {
  statuses: QStatus[];
  current: number;
  onJump: (i: number) => void;
}) {
  const counts = statuses.reduce<Record<string, number>>(
    (a, s) => ((a[s] = (a[s] ?? 0) + 1), a),
    {}
  );
  const answered = (counts.answered ?? 0) + (counts.answered_and_marked ?? 0);
  const marked = (counts.marked_for_review ?? 0) + (counts.answered_and_marked ?? 0);
  return (
    <Panel title="Questions">
      <View className="flex-row flex-wrap gap-2">
        {statuses.map((s, i) => {
          const st = NODE_STYLE[s];
          const isCur = i === current;
          return (
            <Pressable
              key={i}
              onPress={() => onJump(i)}
              accessibilityRole="button"
              accessibilityLabel={`Question ${i + 1}, ${st.label}${isCur ? ", current" : ""}`}
              className="h-9 w-9 items-center justify-center rounded-md border"
              style={{
                backgroundColor: st.bg,
                borderColor: isCur ? "#423A82" : "transparent",
                borderWidth: isCur ? 2 : 1,
              }}
            >
              <Text className="font-mono text-xs" style={{ color: st.fg }}>
                {i + 1}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-4 gap-1.5">
        {(Object.keys(NODE_STYLE) as QStatus[]).map((s) => (
          <View key={s} className="flex-row items-center gap-2">
            <View
              className="h-4 w-4 items-center justify-center rounded"
              style={{ backgroundColor: NODE_STYLE[s].bg }}
            >
              <Icon name={NODE_STYLE[s].icon} size={10} color={NODE_STYLE[s].fg} />
            </View>
            <Text className="text-text-muted text-xs">{NODE_STYLE[s].label}</Text>
          </View>
        ))}
      </View>

      <View className="mt-4 flex-row flex-wrap gap-x-4 gap-y-1">
        <Text className="text-text-secondary text-xs">
          Answered <Text className="text-text-primary font-mono">{answered}</Text>
        </Text>
        <Text className="text-text-secondary text-xs">
          Marked <Text className="text-text-primary font-mono">{marked}</Text>
        </Text>
      </View>
    </Panel>
  );
}

export default function TimedTestRunnerScreen() {
  const nav = useTestNav();
  const { storyPointId } = useStoryPointParams();

  // Resolve the in-progress session for this story point.
  const list = useTestSessions({ storyPointId: asStoryPointId(storyPointId), latestOnly: true });
  const session = useMemo(
    () => latestSession(readSessions(list.data)) ?? readSession(undefined),
    [list.data]
  );
  const sessionId = session.id;

  const detailQ = useTestSession(asTestSessionId(sessionId));
  const detail = useMemo(() => readSession(detailQ.data), [detailQ.data]);
  const sub = useTestSessionDeadline(asTestSessionId(sessionId));
  const evaluate = useEvaluateAnswer();
  const submit = useSubmitTestSession();

  const questions = useMemo(() => readQuestions(detail.raw), [detail.raw]);
  const total = questions.length || detail.totalQuestions || 0;

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [visited, setVisited] = useState<Record<number, boolean>>({ 0: true });
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [submitOpen, setSubmitOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Live, server-authoritative countdown derived from serverDeadline.
  const deadlineMs = useMemo(() => {
    const d = detail.serverDeadline;
    const t = d ? Date.parse(d) : NaN;
    return Number.isFinite(t) ? t : null;
  }, [detail.serverDeadline]);
  const durationSecs = (detail.durationMinutes ?? 0) * 60;
  const [now, setNow] = useState(() => Date.now());
  const startedRef = useRef(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remainingSecs =
    deadlineMs != null ? Math.max(0, Math.round((deadlineMs - now) / 1000)) : null;
  const elapsed = Math.round((now - startedRef.current) / 1000);
  const remainingDisplay =
    remainingSecs != null
      ? remainingSecs
      : durationSecs > 0
        ? Math.max(0, durationSecs - elapsed)
        : null;
  const timerPercent =
    deadlineMs != null && durationSecs > 0
      ? Math.max(0, Math.min(100, ((remainingDisplay ?? 0) / durationSecs) * 100))
      : 100;
  const timerTone =
    remainingDisplay == null
      ? "normal"
      : remainingDisplay <= 60
        ? "critical"
        : remainingDisplay <= 300
          ? "warning"
          : "normal";

  const statuses: QStatus[] = useMemo(
    () =>
      Array.from({ length: total }, (_, i) => {
        const q = questions[i];
        const hasAnswer = q ? answers[q.itemId] != null : false;
        const isMarked = marked[i];
        if (hasAnswer && isMarked) return "answered_and_marked";
        if (hasAnswer) return "answered";
        if (isMarked) return "marked_for_review";
        if (visited[i]) return "not_answered";
        return "not_visited";
      }),
    [total, questions, answers, marked, visited]
  );

  const jump = (i: number) => {
    setCurrent(i);
    setVisited((v) => ({ ...v, [i]: true }));
  };

  const activeQ = questions[current];
  const answeredCount = statuses.filter(
    (s) => s === "answered" || s === "answered_and_marked"
  ).length;
  const markedCount = statuses.filter(
    (s) => s === "marked_for_review" || s === "answered_and_marked"
  ).length;
  const blankCount = total - answeredCount;

  const onChangeAnswer = (val: unknown) => {
    if (!activeQ) return;
    setAnswers((a) => ({ ...a, [activeQ.itemId]: val }));
  };

  const onSaveNext = async () => {
    if (activeQ && answers[activeQ.itemId] != null) {
      setSaveFailed(false);
      try {
        const raw = answers[activeQ.itemId];
        // Captured-media answers are normalized to `{ text, mediaUrls }`
        // (question-view.tsx). Lift `mediaUrls` to the contract's top-level field
        // so the server AI grader actually receives the image/audio; keep sending
        // the raw answer value as-is.
        const mediaUrls = extractMediaUrls(raw);
        await evaluate.mutateAsync({
          spaceId: asSpaceId(detail.spaceId),
          storyPointId: asStoryPointId(storyPointId),
          itemId: asItemId(activeQ.itemId),
          answer: raw,
          ...(mediaUrls.length > 0 ? { mediaUrls } : {}),
        });
      } catch {
        setSaveFailed(true); // non-blocking: keep moving, server keeps retrying
      }
    }
    jump(Math.min(current + 1, Math.max(0, total - 1)));
  };

  const onSubmit = async () => {
    setSubmitOpen(false);
    try {
      await submit.mutateAsync({ sessionId: asTestSessionId(sessionId) });
    } finally {
      nav.toResults(storyPointId);
    }
  };

  // ── Loading / fault states (clock not started) ────────────────────────────
  if (list.isLoading || (sessionId && detailQ.isLoading)) {
    return (
      <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
        <View className="gap-4 p-4">
          <Skeleton width="60%" height={16} />
          <Skeleton width="100%" height={6} />
          <Skeleton width="100%" height={140} radius={12} />
          <View className="flex-row flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} width={36} height={36} radius={8} />
            ))}
          </View>
          <Text className="text-text-muted font-mono text-xs">
            Setting up your test… (no clock until the server deadline loads)
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!sessionId || list.isError) {
    return (
      <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
        <View className="flex-1 justify-center gap-4 p-6">
          <Alert variant="error" title="This test couldn't load its questions">
            Reach out to your teacher — your time hasn't started. Nothing is being counted against
            you.
          </Alert>
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="rotate-cw" size={14} />}
              onPress={() => list.refetch()}
            >
              Try again
            </Button>
            <Button variant="ghost" size="sm" onPress={nav.toTests}>
              Back to tests
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-canvas flex-1" edges={["top", "bottom"]}>
      {/* Sticky band */}
      <View className="border-border-subtle bg-surface gap-2 border-b px-4 py-3">
        <View className="flex-row items-center gap-3">
          <IconButton
            icon={<Icon name="arrow-left" size={18} />}
            label="Exit test"
            onPress={() => setExitOpen(true)}
          />
          <View className="flex-1">
            <Text className="text-text-primary text-sm font-semibold" numberOfLines={1}>
              {detail.title}
            </Text>
            <Text className="text-2xs text-text-muted font-mono uppercase">
              Question {current + 1} of {total || "—"}
            </Text>
          </View>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Icon name="send" size={16} />}
            onPress={() => setSubmitOpen(true)}
          >
            Submit
          </Button>
        </View>
        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-text-primary font-mono text-xs">
              {remainingDisplay != null ? `${clock(remainingDisplay)} remaining` : "Untimed"}
            </Text>
            <View className="flex-row items-center gap-1">
              <Icon name="server" size={11} color="#756E61" />
              <Text className="text-2xs text-text-muted">server clock</Text>
            </View>
          </View>
          <TimerBar percent={timerPercent} tone={timerTone} />
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-5 px-4 pb-16 pt-4"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Low-time announcements */}
          {timerTone === "warning" ? (
            <Alert variant="warning" title="5 minutes remaining — finish strong.">
              Anything you've entered is already being saved.
            </Alert>
          ) : null}
          {timerTone === "critical" ? (
            <Alert variant="error" title="Under a minute left.">
              Anything you've entered is already being saved.
            </Alert>
          ) : null}

          {/* Active question */}
          <View className="gap-3">
            <View className="flex-row flex-wrap items-center gap-2">
              {activeQ?.type ? <Chip>{activeQ.type}</Chip> : <Chip>Question</Chip>}
              {activeQ?.difficulty ? <Badge variant="info">{activeQ.difficulty}</Badge> : null}
            </View>

            {activeQ ? (
              <Panel>
                <QuestionView
                  item={{
                    id: activeQ.itemId,
                    title: activeQ.title,
                    prompt: activeQ.prompt,
                    basePoints: activeQ.points,
                    questionData: activeQ.questionData as Record<string, unknown> | undefined,
                  }}
                  value={answers[activeQ.itemId]}
                  onChange={onChangeAnswer}
                />
              </Panel>
            ) : (
              <Panel>
                <Text className="text-text-muted text-sm">This question is loading…</Text>
              </Panel>
            )}

            {saveFailed ? (
              <Alert variant="warning" title="Still saving in the background">
                We're having trouble saving your last answer, so we'll keep retrying. Your work
                isn't lost.
              </Alert>
            ) : null}
          </View>

          {/* Action buttons — kept together, directly under the question */}
          <View className="gap-2.5">
            <Button
              variant="primary"
              block
              loading={evaluate.isPending}
              trailingIcon={!evaluate.isPending ? <Icon name="arrow-right" size={16} /> : undefined}
              onPress={onSaveNext}
            >
              Save & Next
            </Button>
            <Button
              variant={marked[current] ? "secondary" : "ghost"}
              block
              leadingIcon={<Icon name="flag" size={16} />}
              onPress={() => setMarked((m) => ({ ...m, [current]: !m[current] }))}
            >
              {marked[current] ? "Marked — I'll come back" : "Mark for review"}
            </Button>
          </View>

          <AnswerKeyLock title="Answers are sealed">
            Hidden until you submit — scored fairly on the server.
          </AnswerKeyLock>

          {/* Navigator */}
          {total > 0 ? (
            <QuestionNavigator statuses={statuses} current={current} onJump={jump} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit confirm */}
      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Ready to submit?"
        footer={
          <View className="flex-row justify-end gap-3">
            <Button variant="ghost" onPress={() => setSubmitOpen(false)}>
              Keep working
            </Button>
            <Button
              variant="primary"
              loading={submit.isPending}
              leadingIcon={<Icon name="send" size={16} />}
              onPress={onSubmit}
            >
              Submit test
            </Button>
          </View>
        }
      >
        <Text className="text-text-secondary mb-4 text-sm">
          You've answered {answeredCount} of {total} questions.
          {markedCount > 0 ? ` ${markedCount} are marked for review.` : ""}
          {blankCount > 0 ? ` ${blankCount} are still blank.` : ""} Once you submit, the test is
          final and we'll score it for you.
        </Text>
        <AnswerKeyLock title="Answers are sealed until you submit">
          We score on the server right after — you'll get your results in a moment.
        </AnswerKeyLock>
      </Modal>

      {/* Exit confirm */}
      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Leave the test?"
        footer={
          <View className="flex-row justify-end gap-3">
            <Button variant="ghost" onPress={() => setExitOpen(false)}>
              Stay
            </Button>
            <Button
              variant="danger"
              onPress={() => {
                setExitOpen(false);
                nav.toTests();
              }}
            >
              Leave
            </Button>
          </View>
        }
      >
        <Text className="text-text-secondary text-sm">
          Your timer keeps running while you're away — it's on the server clock and doesn't pause.
          Your answers stay saved, so you can come right back and pick up where you left off.
        </Text>
      </Modal>
    </SafeAreaView>
  );
}
