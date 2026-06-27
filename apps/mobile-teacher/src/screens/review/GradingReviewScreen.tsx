/**
 * GradingReviewScreen — the confidence-routed human-review queue for one exam.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/exams/grading-review.card.html
 * Data:   useExamGradingOverview(examId) → { exam, submissions, analytics }. The
 *         per-submission bundle (useGradingReviewBundle) is a submissionId read, so
 *         it's bound on SubmissionDetail; here we route at the EXAM level — which
 *         submissions need a human vs. were auto-graded with high confidence.
 *
 * NOTE: the BUILD-CONTRACT lists `useGradingReviewBundle(examId)` but the shipped
 * hook keys on submissionId; the exam-level overview is the correct read for an
 * exam-scoped queue. Reads examId from the route. Defensive states throughout.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useExamGradingOverview } from "@levelup/query";

import { Badge, Button, Card, Chip, EmptyState, Icon, ListRow, Screen } from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  ErrorCard,
  ListSkeleton,
  MissingParam,
  examStatus,
  num,
  scoreFrac,
  subStatus,
} from "./_shared";

interface SubRow {
  id?: string;
  studentName?: string;
  rollNumber?: string;
  pipelineStatus?: string;
  resultsReleased?: boolean;
  summary?: { totalScore?: number; maxScore?: number; percentage?: number; grade?: string };
}

type Lane = "review" | "auto" | "released";
function laneOf(s: SubRow): Lane {
  if (s.resultsReleased || s.pipelineStatus === "reviewed") return "released";
  const ss = subStatus(s.pipelineStatus);
  if (ss.needsReview || ss.failed) return "review";
  return "auto";
}

export default function GradingReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ examId?: string }>();
  const examId = typeof params.examId === "string" ? params.examId : undefined;
  const [tab, setTab] = useState<"review" | "auto" | "released" | "all">("review");

  const overview = useExamGradingOverview(examId ?? "");
  const data = overview.data as
    | { exam?: { title?: string; status?: string }; submissions?: SubRow[] }
    | undefined;

  const { lanes, counts } = useMemo(() => {
    const subs = data?.submissions ?? [];
    const l: Record<Lane, SubRow[]> = { review: [], auto: [], released: [] };
    for (const s of subs) l[laneOf(s)].push(s);
    return {
      lanes: l,
      counts: { review: l.review.length, auto: l.auto.length, released: l.released.length },
    };
  }, [data]);

  if (!examId) return <MissingParam what="exam" />;
  if (overview.isLoading) return <ListSkeleton />;
  if (isHardError(overview)) return <ErrorCard onRetry={() => void overview.refetch()} />;

  const st = examStatus(data?.exam?.status);
  const shown = tab === "all" ? [...lanes.review, ...lanes.auto, ...lanes.released] : lanes[tab];
  const allGraded = counts.review === 0 && counts.auto + counts.released > 0;

  return (
    <Screen className="bg-canvas" contentClassName="gap-4 p-4">
      <Card className="gap-2">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="font-display text-text-primary flex-1 text-lg" numberOfLines={2}>
            {data?.exam?.title ?? "Grading review"}
          </Text>
          <Badge variant={st.variant} dot>
            {st.label}
          </Badge>
        </View>
        <Text className="text-text-muted text-xs">
          {counts.review} to review · {counts.auto} auto-graded · {counts.released} released
        </Text>
        {allGraded ? (
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Icon name="send" size={15} />}
            onPress={() => router.push(routes.resultsRelease(examId))}
          >
            Review &amp; release results
          </Button>
        ) : null}
      </Card>

      <View className="flex-row flex-wrap gap-2">
        {(
          [
            { k: "review", label: `Needs review (${counts.review})` },
            { k: "auto", label: `Auto-graded (${counts.auto})` },
            { k: "released", label: `Released (${counts.released})` },
            { k: "all", label: "All" },
          ] as const
        ).map((t) => (
          <Chip key={t.k} active={tab === t.k} onPress={() => setTab(t.k)}>
            {t.label}
          </Chip>
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Icon name="check-circle-2" size={26} color="#2F7D5B" />}
          title={tab === "review" ? "Nothing to review" : "Nothing here"}
          body={
            tab === "review"
              ? "High-confidence submissions were auto-graded. Switch tabs to inspect them."
              : "No submissions in this lane yet."
          }
        />
      ) : (
        <View className="gap-2">
          {shown.map((s, i) => {
            const ss = subStatus(s.pipelineStatus);
            const lane = laneOf(s);
            return (
              <ListRow
                key={s.id ?? i}
                title={s.studentName ?? "Student"}
                subtitle={
                  <View className="flex-row items-center gap-2">
                    <Badge
                      variant={
                        lane === "review" ? "warning" : lane === "released" ? "success" : "info"
                      }
                    >
                      {ss.label}
                    </Badge>
                    {s.summary?.grade ? (
                      <Text className="text-2xs text-text-muted">Grade {s.summary.grade}</Text>
                    ) : null}
                  </View>
                }
                trailing={
                  <View className="items-end">
                    <Text className="text-text-secondary font-mono text-xs">
                      {scoreFrac(s.summary?.totalScore, s.summary?.maxScore)}
                    </Text>
                    {typeof s.summary?.percentage === "number" ? (
                      <Text className="text-2xs text-text-muted">
                        {Math.round(num(s.summary.percentage))}%
                      </Text>
                    ) : null}
                  </View>
                }
                onPress={() => s.id && router.push(routes.submissionDetail(examId, s.id))}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}
