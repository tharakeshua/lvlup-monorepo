/**
 * SubmissionDetailScreen — one student's graded submission, question by question.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/exams/submission-detail.card.html
 * Data:   useGradingReviewBundle(submissionId) → { submission, rows[] } (one batched
 *         read collapsing submission + per-question grading + questions), plus
 *         useGradingStatus(submissionId) for the live pipeline ticker.
 *
 * Reads examId + submissionId from the route. Per-question rows show the effective
 * score, confidence band and AI summary; failed questions offer a retry
 * (useRetryGrading). Footer jumps to manual override / rubric breakdown. Defensive:
 * the bundle / status reads can THROW or be empty under GATE-B.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGradingReviewBundle, useGradingStatus, useRetryGrading } from "@levelup/query";

import { Badge, Button, Card, Divider, GradePill, Icon, Screen } from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  ConfidenceBadge,
  ErrorCard,
  ListSkeleton,
  MissingParam,
  ScoreBar,
  num,
  pct,
  scoreFrac,
  subStatus,
  type Band,
} from "./_shared";

interface QRow {
  questionSubmission?: {
    id?: string;
    questionId?: string;
    gradingStatus?: string;
    gradingError?: string;
    evaluation?: {
      score?: number;
      maxScore?: number;
      confidence?: number;
      summary?: string;
      percentage?: number;
    } | null;
    manualOverride?: { score?: number; reason?: string } | null;
  };
  question?: { text?: string; maxMarks?: number; order?: number };
  effectiveScore?: number | null;
  confidenceBand?: Band;
}
interface Bundle {
  submission?: {
    studentName?: string;
    rollNumber?: string;
    pipelineStatus?: string;
    resultsReleased?: boolean;
    summary?: {
      totalScore?: number;
      maxScore?: number;
      percentage?: number;
      grade?: string;
      questionsGraded?: number;
      totalQuestions?: number;
    };
  };
  rows?: QRow[];
}

const Q_STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "error" | "info" | "neutral" | "brand"
> = {
  graded: "success",
  manual: "brand",
  overridden: "brand",
  needs_review: "warning",
  processing: "info",
  pending: "neutral",
  failed: "error",
};

function gradeTone(pctValue: number): "success" | "warning" | "error" | "neutral" {
  if (!Number.isFinite(pctValue)) return "neutral";
  if (pctValue >= 75) return "success";
  if (pctValue >= 40) return "warning";
  return "error";
}

function QuestionCard({
  row,
  index,
  onRetry,
  retrying,
}: {
  row: QRow;
  index: number;
  onRetry: () => void;
  retrying: boolean;
}) {
  const qs = row.questionSubmission;
  const status = String(qs?.gradingStatus ?? "");
  const failed = status === "failed";
  const overridden = Boolean(qs?.manualOverride) || status === "overridden" || status === "manual";
  const max = num(row.question?.maxMarks ?? qs?.evaluation?.maxScore);
  const earned = row.effectiveScore;
  const confidence = qs?.evaluation?.confidence;

  return (
    <Card className="gap-2.5">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="text-2xs text-text-muted uppercase tracking-wide">
            Question {num(row.question?.order, index + 1)}
          </Text>
          <Text className="text-text-secondary text-sm" numberOfLines={3}>
            {row.question?.text ?? "Question text unavailable"}
          </Text>
        </View>
        <Text className="font-display text-text-primary text-base">{scoreFrac(earned, max)}</Text>
      </View>

      {max > 0 ? (
        <ScoreBar value={(num(earned) / max) * 100} tone={earned == null ? "#D6C9B4" : "#423A82"} />
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        <Badge variant={Q_STATUS_VARIANT[status] ?? "neutral"}>
          {subStatus(status).label || status || "Pending"}
        </Badge>
        {overridden ? (
          <Badge variant="brand" icon={<Icon name="pencil" size={11} />}>
            Overridden
          </Badge>
        ) : null}
        {!overridden ? <ConfidenceBadge band={row.confidenceBand} score={confidence} /> : null}
      </View>

      {qs?.evaluation?.summary ? (
        <Text className="text-text-muted text-xs" numberOfLines={4}>
          {qs.evaluation.summary}
        </Text>
      ) : null}
      {qs?.manualOverride?.reason ? (
        <Text className="text-brand text-xs">Override: {qs.manualOverride.reason}</Text>
      ) : null}
      {failed ? (
        <View className="gap-2">
          {qs?.gradingError ? <Text className="text-2xs text-error">{qs.gradingError}</Text> : null}
          <Button
            variant="secondary"
            size="sm"
            loading={retrying}
            leadingIcon={<Icon name="rotate-cw" size={14} />}
            onPress={onRetry}
          >
            Retry grading
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

export default function SubmissionDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ examId?: string; submissionId?: string }>();
  const examId = typeof params.examId === "string" ? params.examId : undefined;
  const submissionId = typeof params.submissionId === "string" ? params.submissionId : undefined;

  const bundle = useGradingReviewBundle(submissionId ?? "");
  const live = useGradingStatus(submissionId ?? "");
  const retry = useRetryGrading();

  const data = bundle.data as Bundle | undefined;
  const rows = useMemo(() => data?.rows ?? [], [data]);

  if (!submissionId) return <MissingParam what="submission" />;
  if (bundle.isLoading) return <ListSkeleton />;
  if (isHardError(bundle)) return <ErrorCard onRetry={() => void bundle.refetch()} />;

  const sub = data?.submission;
  const summary = sub?.summary;
  const percentage = num(summary?.percentage);
  const tone = gradeTone(percentage);

  return (
    <Screen className="bg-canvas" contentClassName="gap-4 p-4">
      <Card className="gap-3">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1 gap-0.5">
            <Text className="font-display text-text-primary text-lg">
              {sub?.studentName ?? "Student"}
            </Text>
            {sub?.rollNumber ? (
              <Text className="text-text-muted text-xs">Roll {sub.rollNumber}</Text>
            ) : null}
          </View>
          <GradePill grade={summary?.grade ?? pct(summary?.percentage)} tone={tone} />
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="font-display text-text-primary text-2xl">
            {scoreFrac(summary?.totalScore, summary?.maxScore)}
          </Text>
          <Text className="text-text-muted text-xs">
            {num(summary?.questionsGraded)}/{num(summary?.totalQuestions)} graded ·{" "}
            {pct(summary?.percentage)}
          </Text>
        </View>
        {live.status === "live" ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="radio" size={12} color="#2D6E8E" />
            <Text className="text-2xs text-info">Live grading</Text>
          </View>
        ) : null}
        <Divider />
        <View className="flex-row gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            leadingIcon={<Icon name="pencil" size={14} />}
            onPress={() => examId && router.push(routes.manualOverride(examId, submissionId))}
          >
            Override
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            leadingIcon={<Icon name="list-checks" size={14} />}
            onPress={() => examId && router.push(routes.rubricBreakdown(examId, submissionId))}
          >
            Rubric
          </Button>
        </View>
      </Card>

      {rows.length === 0 ? (
        <Card className="items-center gap-2 py-8">
          <Icon name="hourglass" size={24} color="#756E61" />
          <Text className="font-display text-text-primary text-base">Not graded yet</Text>
          <Text className="text-text-muted px-6 text-center text-sm">
            Per-question results appear here as the pipeline completes.
          </Text>
        </Card>
      ) : (
        rows.map((row, i) => (
          <QuestionCard
            key={row.questionSubmission?.id ?? i}
            row={row}
            index={i}
            retrying={retry.isPending}
            onRetry={() =>
              retry.mutate({
                submissionId,
                ...(row.questionSubmission?.questionId
                  ? { questionIds: [row.questionSubmission.questionId] }
                  : {}),
              })
            }
          />
        ))
      )}
    </Screen>
  );
}
