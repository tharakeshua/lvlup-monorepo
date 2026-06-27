/**
 * ResultsReleaseScreen — approve + publish an exam's results (⚷ lifecycle, modal).
 *
 * Design: docs/rebuild-spec/design/build/prototypes/exams/results-release.card.html
 * Data:   useExam(examId) + useExamGradingOverview(examId) for the readiness check;
 *         useReleaseResults() to publish (server-authoritative lifecycle verb) and
 *         useRetryGrading() to re-run stuck submissions before releasing.
 *
 * Reads examId. Surfaces a readiness summary (graded vs needs-review vs failed),
 * blocks release behind an explicit confirm, and warns when submissions still need
 * a human. On success → back. Defensive reads; empty/loading/error states.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useExam,
  useExamGradingOverview,
  useReleaseResults,
  useRetryGrading,
} from "@levelup/query";

import { Alert, Badge, Button, Card, Icon, Screen } from "../../components";
import { isHardError } from "../../lib/query-status";
import { ErrorCard, ListSkeleton, MissingParam, ScoreBar, num, pct, subStatus } from "./_shared";

interface SubRow {
  id?: string;
  pipelineStatus?: string;
  resultsReleased?: boolean;
}

function ReadinessRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Icon name={icon} size={15} color={tone} />
        <Text className="text-text-secondary text-sm">{label}</Text>
      </View>
      <Text className="font-display text-text-primary text-base">{value}</Text>
    </View>
  );
}

export default function ResultsReleaseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ examId?: string }>();
  const examId = typeof params.examId === "string" ? params.examId : undefined;

  const exam = useExam(examId ?? "");
  const overview = useExamGradingOverview(examId ?? "");
  const release = useReleaseResults();
  const retry = useRetryGrading();
  const [confirmed, setConfirmed] = useState(false);

  const data = overview.data as
    | { exam?: { title?: string; status?: string }; submissions?: SubRow[] }
    | undefined;
  const examData = exam.data as { title?: string; status?: string } | undefined;

  const counts = useMemo(() => {
    const subs = data?.submissions ?? [];
    let graded = 0,
      needsReview = 0,
      failed = 0,
      released = 0;
    for (const s of subs) {
      if (s.resultsReleased) released++;
      const ss = subStatus(s.pipelineStatus);
      if (ss.failed) failed++;
      else if (ss.needsReview) needsReview++;
      else if (s.pipelineStatus === "grading_complete" || s.pipelineStatus === "reviewed") graded++;
    }
    return { total: subs.length, graded, needsReview, failed, released };
  }, [data]);

  if (!examId) return <MissingParam what="exam" />;
  if (overview.isLoading) return <ListSkeleton />;
  if (isHardError(overview)) return <ErrorCard onRetry={() => void overview.refetch()} />;

  const title = examData?.title ?? data?.exam?.title ?? "this exam";
  const alreadyReleased = (examData?.status ?? data?.exam?.status) === "results_released";
  const readyPct = counts.total > 0 ? (counts.graded / counts.total) * 100 : 0;
  const hasBlockers = counts.needsReview > 0 || counts.failed > 0;
  const canRelease = confirmed && counts.total > 0 && !release.isPending && !alreadyReleased;

  const doRelease = () => {
    if (!examId) return;
    release.mutate({ examId }, { onSuccess: () => router.back() });
  };

  return (
    <Screen className="bg-canvas" contentClassName="gap-4 p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-text-primary text-xl">Release results</Text>
        <Button variant="ghost" size="sm" onPress={() => router.back()}>
          Cancel
        </Button>
      </View>

      <Card className="gap-3">
        <Text className="text-text-secondary text-sm">
          Publish results for <Text className="text-text-primary font-semibold">{title}</Text>.
          Students will be able to see their scores and feedback.
        </Text>
        <View className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xs text-text-muted uppercase tracking-wide">Graded</Text>
            <Text className="text-2xs text-text-muted">
              {counts.graded}/{counts.total} · {pct(readyPct)}
            </Text>
          </View>
          <ScoreBar value={readyPct} tone={hasBlockers ? "#B7791F" : "#2F7D5B"} />
        </View>
      </Card>

      <Card className="gap-2.5">
        <ReadinessRow
          icon="check-circle-2"
          label="Ready to release"
          value={counts.graded}
          tone="#2F7D5B"
        />
        <ReadinessRow
          icon="clipboard-check"
          label="Still need review"
          value={counts.needsReview}
          tone="#B7791F"
        />
        <ReadinessRow
          icon="alert-triangle"
          label="Failed grading"
          value={counts.failed}
          tone="#B23A36"
        />
        {counts.released > 0 ? (
          <ReadinessRow
            icon="send"
            label="Already released"
            value={counts.released}
            tone="#2D6E8E"
          />
        ) : null}
      </Card>

      {alreadyReleased ? (
        <Alert
          variant="success"
          icon={<Icon name="check" size={16} />}
          title="Results already released"
        >
          These results are live for students.
        </Alert>
      ) : hasBlockers ? (
        <Alert
          variant="warning"
          icon={<Icon name="alert-triangle" size={16} />}
          title="Some submissions aren’t ready"
        >
          <View className="gap-2">
            <Text className="text-text-secondary text-xs">
              {counts.needsReview > 0 ? `${counts.needsReview} need review. ` : ""}
              {counts.failed > 0 ? `${counts.failed} failed grading. ` : ""}
              You can still release — unready submissions are held back.
            </Text>
            {counts.failed > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                loading={retry.isPending}
                leadingIcon={<Icon name="rotate-cw" size={14} />}
                onPress={() => {
                  const stuck = (data?.submissions ?? []).filter(
                    (s) => subStatus(s.pipelineStatus).failed
                  );
                  for (const s of stuck) if (s.id) retry.mutate({ submissionId: s.id });
                }}
              >
                Retry failed ({counts.failed})
              </Button>
            ) : null}
          </View>
        </Alert>
      ) : null}

      {!alreadyReleased ? (
        <>
          <Card
            interactive
            onPress={() => setConfirmed((c) => !c)}
            className="flex-row items-center gap-3"
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded-sm border ${
                confirmed ? "border-brand bg-brand" : "border-border-strong bg-surface"
              }`}
            >
              {confirmed ? <Icon name="check" size={13} color="#FFFDFA" /> : null}
            </View>
            <Text className="text-text-secondary flex-1 text-sm">
              I’ve reviewed the grading and approve releasing these results.
            </Text>
          </Card>

          {release.isError ? (
            <Text className="text-error text-xs">Couldn’t release results. Please try again.</Text>
          ) : null}

          <Button
            variant="primary"
            block
            disabled={!canRelease}
            loading={release.isPending}
            leadingIcon={<Icon name="send" size={16} />}
            onPress={doRelease}
          >
            Release results
          </Button>
        </>
      ) : null}
    </Screen>
  );
}
