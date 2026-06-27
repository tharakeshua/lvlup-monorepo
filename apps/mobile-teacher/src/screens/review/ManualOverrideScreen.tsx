/**
 * ManualOverrideScreen — modal to override one question's AI score (⚷ authority).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/exams/manual-override.card.html
 * Data:   useGradingReviewBundle(submissionId) to list questions + their current
 *         scores; useGradeManual() mutation to record the override (server owns
 *         score authority — round-trips + invalidates, no optimistic recipe).
 *
 * Reads examId + submissionId. Pick a question, enter the new score (clamped to the
 * question's max) and a reason, then save → back to the submission. Defensive reads
 * + disabled save until a valid score + reason are present.
 */
import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGradeManual, useGradingReviewBundle } from "@levelup/query";

import { Button, Card, Chip, Icon, Screen, TextField } from "../../components";
import { isHardError } from "../../lib/query-status";
import { ErrorCard, ListSkeleton, MissingParam, num, scoreFrac } from "./_shared";

interface QRow {
  questionSubmission?: {
    questionId?: string;
    evaluation?: { score?: number; maxScore?: number } | null;
    manualOverride?: { score?: number } | null;
  };
  question?: { text?: string; maxMarks?: number; order?: number };
  effectiveScore?: number | null;
}

function ScoreStepper({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(max, Math.round(v * 2) / 2));
  return (
    <View className="flex-row items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        onPress={() => onChange(clamp(value - 0.5))}
        leadingIcon={<Icon name="minus" size={16} />}
      >
        {""}
      </Button>
      <View className="min-w-[96px] items-center">
        <Text className="font-display text-text-primary text-2xl">
          {Number.isFinite(value) ? value : 0}
        </Text>
        <Text className="text-2xs text-text-muted">of {max}</Text>
      </View>
      <Button
        variant="secondary"
        size="sm"
        onPress={() => onChange(clamp(value + 0.5))}
        leadingIcon={<Icon name="plus" size={16} />}
      >
        {""}
      </Button>
    </View>
  );
}

export default function ManualOverrideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ examId?: string; submissionId?: string }>();
  const submissionId = typeof params.submissionId === "string" ? params.submissionId : undefined;

  const bundle = useGradingReviewBundle(submissionId ?? "");
  const grade = useGradeManual();
  const data = bundle.data as { rows?: QRow[] } | undefined;
  const rows = useMemo(() => data?.rows ?? [], [data]);

  const [selected, setSelected] = useState(0);
  const [score, setScore] = useState(0);
  const [reason, setReason] = useState("");

  const current = rows[selected];
  const max = num(current?.question?.maxMarks ?? current?.questionSubmission?.evaluation?.maxScore);
  const questionId = current?.questionSubmission?.questionId;

  // seed the score input from the current effective score when the selection changes
  useEffect(() => {
    setScore(num(current?.effectiveScore));
  }, [selected, current?.effectiveScore]);

  if (!submissionId) return <MissingParam what="submission" />;
  if (bundle.isLoading) return <ListSkeleton />;
  if (isHardError(bundle)) return <ErrorCard onRetry={() => void bundle.refetch()} />;

  const canSave =
    Boolean(questionId) && reason.trim().length >= 3 && Number.isFinite(score) && !grade.isPending;

  const save = () => {
    if (!questionId || !submissionId) return;
    grade.mutate(
      { submissionId, questionId, score, feedback: reason.trim() },
      { onSuccess: () => router.back() }
    );
  };

  return (
    <Screen className="bg-canvas" contentClassName="gap-4 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-text-primary text-xl">Manual override</Text>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          Cancel
        </Button>
      </View>

      {rows.length === 0 ? (
        <Card className="items-center gap-2 py-8">
          <Icon name="hourglass" size={24} color="#756E61" />
          <Text className="text-text-muted text-sm">No graded questions to override yet.</Text>
        </Card>
      ) : (
        <>
          <View className="gap-2">
            <Text className="text-2xs text-text-muted uppercase tracking-wide">Question</Text>
            <View className="flex-row flex-wrap gap-2">
              {rows.map((r, i) => (
                <Chip
                  key={r.questionSubmission?.questionId ?? i}
                  active={selected === i}
                  onPress={() => setSelected(i)}
                >
                  Q{num(r.question?.order, i + 1)}
                </Chip>
              ))}
            </View>
          </View>

          <Card className="gap-3">
            <Text className="text-text-secondary text-sm" numberOfLines={4}>
              {current?.question?.text ?? "Question text unavailable"}
            </Text>
            <Text className="text-text-muted text-xs">
              Current: {scoreFrac(current?.effectiveScore, max)}
            </Text>
            <View className="items-center py-2">
              <ScoreStepper value={score} onChange={setScore} max={max} />
            </View>
          </Card>

          <TextField
            label="Reason for override"
            required
            placeholder="Explain the adjustment (visible in the audit trail)…"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
          />

          {grade.isError ? (
            <Text className="text-error text-xs">
              Couldn’t save the override. Please try again.
            </Text>
          ) : null}

          <Button
            variant="primary"
            block
            disabled={!canSave}
            loading={grade.isPending}
            leadingIcon={<Icon name="check" size={16} />}
            onPress={save}
          >
            Save override
          </Button>
        </>
      )}
    </Screen>
  );
}
