/**
 * RubricBreakdownScreen — per-question rubric criteria for a submission (drawer).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/exams/subquestion-rubric.card.html
 * Data:   useGradingReviewBundle(submissionId) for the graded questions + their
 *         evaluation rubric breakdown; useRubricPresets() for reference presets.
 *
 * Reads examId + submissionId. Each question renders a RubricBreakdown (criteria
 * with earned/max + grader notes). Criteria come from the AI evaluation's
 * `rubricBreakdown`; falls back to the question's own rubric / sub-questions when
 * the evaluation hasn't populated one. Defensive throughout.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useGradingReviewBundle, useRubricPresets } from "@levelup/query";

import { Card, Icon, RubricBreakdown, Screen } from "../../components";
import type { RubricCriterion } from "../../components";
import { isHardError } from "../../lib/query-status";
import { ErrorCard, ListSkeleton, MissingParam, num, scoreFrac } from "./_shared";

interface EvalCriterion {
  criterionName?: string;
  score?: number;
  maxScore?: number;
  comment?: string;
}
interface RubricCriterionLike {
  label?: string;
  text?: string;
  maxMarks?: number;
  maxScore?: number;
  points?: number;
}
interface QRow {
  questionSubmission?: {
    questionId?: string;
    evaluation?: { rubricBreakdown?: EvalCriterion[]; maxScore?: number } | null;
  };
  question?: {
    text?: string;
    maxMarks?: number;
    order?: number;
    rubric?: { criteria?: RubricCriterionLike[] };
    subQuestions?: RubricCriterionLike[];
  };
  effectiveScore?: number | null;
}

function stateOf(earned: number, max: number): "met" | "partial" | "missed" {
  if (max <= 0) return "partial";
  if (earned >= max) return "met";
  if (earned <= 0) return "missed";
  return "partial";
}

function toCriteria(row: QRow): RubricCriterion[] {
  const evalRows = row.questionSubmission?.evaluation?.rubricBreakdown;
  if (Array.isArray(evalRows) && evalRows.length > 0) {
    return evalRows.map((c) => {
      const earned = num(c.score);
      const max = num(c.maxScore);
      return {
        label: c.criterionName ?? "Criterion",
        earned,
        max,
        note: c.comment,
        state: stateOf(earned, max),
      };
    });
  }
  // Fallback: the question's declared rubric criteria / sub-questions (ungraded view).
  const declared = row.question?.rubric?.criteria ?? row.question?.subQuestions ?? [];
  if (Array.isArray(declared) && declared.length > 0) {
    return declared.map((c) => ({
      label: c.label ?? c.text ?? "Criterion",
      max: num(c.maxMarks ?? c.maxScore ?? c.points),
    }));
  }
  return [];
}

export default function RubricBreakdownScreen() {
  const params = useLocalSearchParams<{ examId?: string; submissionId?: string }>();
  const submissionId = typeof params.submissionId === "string" ? params.submissionId : undefined;

  const bundle = useGradingReviewBundle(submissionId ?? "");
  // Reference presets (informational); failure is non-blocking.
  useRubricPresets();

  const data = bundle.data as { rows?: QRow[] } | undefined;
  const rows = useMemo(() => data?.rows ?? [], [data]);

  if (!submissionId) return <MissingParam what="submission" />;
  if (bundle.isLoading) return <ListSkeleton />;
  if (isHardError(bundle)) return <ErrorCard onRetry={() => void bundle.refetch()} />;

  return (
    <Screen className="bg-canvas" contentClassName="gap-4 p-4">
      <View className="gap-1">
        <Text className="font-display text-text-primary text-xl">Rubric breakdown</Text>
        <Text className="text-text-muted text-sm">Criteria-level scoring for each question.</Text>
      </View>

      {rows.length === 0 ? (
        <Card className="items-center gap-2 py-8">
          <Icon name="list-checks" size={24} color="#756E61" />
          <Text className="text-text-muted text-sm">No rubric detail available yet.</Text>
        </Card>
      ) : (
        rows.map((row, i) => {
          const max = num(row.question?.maxMarks ?? row.questionSubmission?.evaluation?.maxScore);
          const criteria = toCriteria(row);
          return (
            <Card key={row.questionSubmission?.questionId ?? i} className="gap-3">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-0.5">
                  <Text className="text-2xs text-text-muted uppercase tracking-wide">
                    Question {num(row.question?.order, i + 1)}
                  </Text>
                  <Text className="text-text-secondary text-sm" numberOfLines={3}>
                    {row.question?.text ?? "Question text unavailable"}
                  </Text>
                </View>
                <Text className="font-display text-text-primary text-base">
                  {scoreFrac(row.effectiveScore, max)}
                </Text>
              </View>
              {criteria.length > 0 ? (
                <RubricBreakdown criteria={criteria} totalMax={max} />
              ) : (
                <Text className="text-text-muted text-xs">
                  No criteria recorded for this question.
                </Text>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
