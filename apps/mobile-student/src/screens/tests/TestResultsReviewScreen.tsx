/**
 * Test results review — the server-graded verdict + per-question feedback.
 *
 * Keyed by `storyPointId`. Resolves the latest completed session
 * (`useTestSessions({ storyPointId, latestOnly })`) then reads its full detail
 * (`useTestSession`) for score, breakdowns, adaptive progression and per-question
 * submissions. The answer key is never shown — only the student's own answer and
 * the grader's feedback/rubric (sanitized projection).
 */
import { useMemo, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { asStoryPointId, asTestSessionId } from "@levelup/domain";
import { useTestSession, useTestSessions } from "@levelup/query";

import {
  Accordion,
  Alert,
  Badge,
  Button,
  Chip,
  ContentRenderer,
  EmptyState,
  Icon,
  ProgressRing,
  Screen,
  Skeleton,
} from "../../components";
import {
  AnswerKeyLock,
  BreakdownRows,
  ConfidenceBadge,
  InsightCard,
  Panel,
  type ReviewQuestionVM,
  RubricBreakdown,
  latestSession,
  readAnalytics,
  readReviewQuestions,
  readSession,
  readSessions,
  useStoryPointParams,
  useTestNav,
} from "./_components";

function QuestionReview({ q }: { q: ReviewQuestionVM }) {
  return (
    <View className="gap-4">
      {q.prompt ? <ContentRenderer math>{q.prompt}</ContentRenderer> : null}

      <View className="border-border-subtle bg-surface-sunken gap-1.5 rounded-md border p-3">
        <Text className="text-2xs text-text-muted uppercase">Your answer</Text>
        <Text className="text-text-primary text-sm">{q.your}</Text>
      </View>

      <View
        className={`gap-2 rounded-md border p-3 ${
          q.correct ? "border-success/40 bg-green-200/30" : "border-warning/40 bg-marigold-50"
        }`}
      >
        <View className="flex-row items-center gap-2">
          <Icon
            name={q.correct ? "check-circle" : "compass"}
            size={18}
            color={q.correct ? "#2F7D5B" : "#B7791F"}
          />
          <Text className="text-text-primary font-semibold">
            {q.correct ? "Correct" : "Let's look at this one again"}
          </Text>
        </View>
        {q.feedback ? <ContentRenderer math>{q.feedback}</ContentRenderer> : null}
        {q.ai && q.confidence ? (
          <View className="mt-1 flex-row items-center gap-2">
            <ConfidenceBadge
              level={q.confidence}
              value={
                q.confidence === "high"
                  ? "High confidence"
                  : q.confidence === "med"
                    ? "Medium confidence"
                    : "Low confidence"
              }
            />
            {q.confidence === "low" ? (
              <Text className="text-text-muted text-xs">
                A teacher will take a second look at this one.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {q.rubric ? (
        <View className="gap-2">
          <Text className="text-2xs text-text-muted uppercase">Rubric breakdown</Text>
          <RubricBreakdown criteria={q.rubric} />
        </View>
      ) : null}

      <AnswerKeyLock title="Answer keys stay sealed —">
        your feedback above shows what to improve.
      </AnswerKeyLock>
    </View>
  );
}

export default function TestResultsReviewScreen() {
  const nav = useTestNav();
  const { storyPointId } = useStoryPointParams();
  const list = useTestSessions({ storyPointId: asStoryPointId(storyPointId), latestOnly: true });
  const latestId = useMemo(() => latestSession(readSessions(list.data))?.id ?? "", [list.data]);
  const detailQ = useTestSession(asTestSessionId(latestId));
  const reviewRef = useRef<ScrollView>(null);

  const session = useMemo(() => readSession(detailQ.data), [detailQ.data]);
  const analytics = useMemo(() => readAnalytics(detailQ.data), [detailQ.data]);
  const questions = useMemo(() => readReviewQuestions(detailQ.data), [detailQ.data]);

  if (list.isLoading || (latestId && detailQ.isLoading)) {
    return (
      <Screen>
        <View className="gap-4 px-4 py-4">
          <View className="flex-row items-center gap-4">
            <Skeleton width={96} height={96} variant="circle" />
            <View className="flex-1 gap-2">
              <Skeleton width="50%" height={14} />
              <Skeleton width="70%" height={26} />
              <Skeleton width="60%" height={13} />
            </View>
          </View>
          <Skeleton width="100%" height={90} radius={12} />
          <Skeleton width="100%" height={90} radius={12} />
        </View>
      </Screen>
    );
  }

  if (list.isError || detailQ.isError) {
    return (
      <Screen>
        <View className="px-4 py-8">
          <EmptyState
            icon="cloud-off"
            title="We couldn't load your results right now"
            body="Something hiccuped on our end. Your grade is safe — give it another go."
            action={
              <Button
                variant="primary"
                leadingIcon={<Icon name="rotate-ccw" size={16} />}
                onPress={() => detailQ.refetch()}
              >
                Try again
              </Button>
            }
          />
        </View>
      </Screen>
    );
  }

  if (!latestId) {
    return (
      <Screen>
        <View className="px-4 py-8">
          <EmptyState
            icon="clipboard-list"
            title="No results yet"
            body="You haven't finished this test. Ready when you are."
            action={
              <Button
                variant="primary"
                trailingIcon={<Icon name="arrow-right" size={16} />}
                onPress={() => nav.toGate(storyPointId)}
              >
                Start the test
              </Button>
            }
          />
        </View>
      </Screen>
    );
  }

  const percentage = session.percentage ?? 0;
  const passMark = session.passMark ?? 70;
  const passed = session.passed ?? percentage >= passMark;
  const marks = session.marksEarned ?? session.pointsEarned;
  const totalMarks = session.totalMarks ?? session.totalPoints;

  return (
    <Screen>
      <ScrollView ref={reviewRef} contentContainerClassName="gap-5 px-4 py-4">
        <Pressable
          className="flex-row items-center gap-1"
          onPress={nav.toTests}
          accessibilityRole="button"
        >
          <Icon name="arrow-left" size={16} color="#423A82" />
          <Text className="text-brand text-sm">Back to tests</Text>
        </Pressable>

        <Text className="font-display text-text-primary text-lg font-semibold">
          {session.title}
        </Text>

        {/* Verdict hero */}
        <Panel>
          <View className="items-center gap-4">
            <ProgressRing
              value={percentage}
              size={132}
              color={passed ? "#2F7D5B" : "#B7791F"}
              label={`${percentage}%`}
            />
            <View className="items-center gap-2">
              <Badge
                variant={passed ? "success" : "warning"}
                icon={<Icon name={passed ? "check-circle" : "compass"} size={14} />}
              >
                {passed ? "Passed" : "Not yet passed"}
              </Badge>
              <Text className="font-display text-text-primary text-center text-xl font-semibold">
                {passed ? "Nice work — you passed!" : "Good effort — let's close the gap."}
              </Text>
              <Text className="text-text-muted text-center text-sm">
                {percentage}%
                {marks != null && totalMarks != null ? ` · ${marks} / ${totalMarks} marks` : ""} ·
                Pass mark {passMark}%
              </Text>
            </View>
            <View className="w-full flex-row flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<Icon name="list-checks" size={16} />}
                onPress={() => reviewRef.current?.scrollToEnd()}
              >
                Review answers
              </Button>
              <Button
                variant="spark"
                size="sm"
                trailingIcon={<Icon name="arrow-right" size={16} />}
                onPress={() => nav.toAnalytics(storyPointId)}
              >
                Practice weak topics
              </Button>
            </View>
            <AnswerKeyLock title="Answer keys stay sealed">
              your feedback shows what to improve.
            </AnswerKeyLock>
          </View>
        </Panel>

        {/* Breakdown grid */}
        {analytics.difficulty.length ||
        analytics.bloom.length ||
        analytics.section.length ||
        analytics.topic.length ? (
          <View className="gap-3">
            {analytics.difficulty.length ? (
              <Panel title="By difficulty">
                <BreakdownRows rows={analytics.difficulty} icon="bar-chart-3" passMark={passMark} />
              </Panel>
            ) : null}
            {analytics.bloom.length ? (
              <Panel title="By Bloom's level">
                <BreakdownRows rows={analytics.bloom} icon="brain" passMark={passMark} />
              </Panel>
            ) : null}
            {analytics.section.length ? (
              <Panel title="By section">
                <BreakdownRows rows={analytics.section} icon="folder" passMark={passMark} />
              </Panel>
            ) : null}
            {analytics.topic.length ? (
              <Panel title="By topic">
                <BreakdownRows rows={analytics.topic} icon="tag" passMark={passMark} />
              </Panel>
            ) : null}
          </View>
        ) : null}

        {/* Adaptive progression */}
        {analytics.progression.length ? (
          <Panel title="Difficulty progression — the adaptive path">
            <View className="flex-row flex-wrap gap-2">
              {analytics.progression.map((s) => (
                <View key={s.q} className="items-center gap-1">
                  <View
                    className="h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: s.correct ? "#BFE6D2" : "#FBE0B0" }}
                  >
                    <Icon
                      name={s.correct ? "check" : "rotate-ccw"}
                      size={14}
                      color={s.correct ? "#2F7D5B" : "#C97A14"}
                    />
                  </View>
                  <Text className="text-2xs text-text-muted font-mono">Q{s.q}</Text>
                </View>
              ))}
            </View>
          </Panel>
        ) : null}

        {/* What to review next */}
        <InsightCard icon="compass" title="Keep building on this.">
          <View className="gap-3">
            <Text className="text-text-secondary text-sm">
              A few minutes of focused practice on your weak areas will help it click.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button
                variant="spark"
                size="sm"
                trailingIcon={<Icon name="arrow-right" size={14} />}
                onPress={() => nav.toAnalytics(storyPointId)}
              >
                See your progress
              </Button>
            </View>
          </View>
        </InsightCard>

        {/* Per-question review */}
        {questions.length ? (
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="font-display text-text-primary text-base font-semibold">
                Per-question review
              </Text>
              <Text className="text-2xs text-text-muted font-mono">
                {questions.length} questions · feedback only
              </Text>
            </View>
            <Accordion
              defaultOpen={0}
              items={questions.map((q) => ({
                title: (
                  <View className="flex-1 flex-row items-center justify-between gap-2 pr-2">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-text-muted font-mono text-xs">Q{q.n}</Text>
                      {q.correct ? (
                        <Badge variant="success" icon={<Icon name="check" size={12} />}>
                          Correct
                        </Badge>
                      ) : (
                        <Badge variant="warning" icon={<Icon name="compass" size={12} />}>
                          Look again
                        </Badge>
                      )}
                    </View>
                    {q.section ? <Chip>{q.section}</Chip> : null}
                  </View>
                ),
                content: <QuestionReview q={q} />,
              }))}
            />
          </View>
        ) : (
          <Alert variant="info" title="Per-question feedback is on its way">
            Your overall score is final. Detailed feedback for each question will appear here
            shortly.
          </Alert>
        )}

        <Button
          variant="primary"
          block
          trailingIcon={<Icon name="check" size={16} />}
          onPress={nav.toTests}
        >
          Done
        </Button>
      </ScrollView>
    </Screen>
  );
}
