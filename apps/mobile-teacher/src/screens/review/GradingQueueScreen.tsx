/**
 * GradingQueueScreen — the live PIPELINE monitor for one exam's submissions.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/exams/submissions-grading-queue.card.html
 * Data:   useExamGradingOverview(examId) → { exam, submissions, analytics } in one
 *         batched read, + useExamGradingProgress(examId) for the live aggregate
 *         ticker (subscription reconciled into the same cache).
 *
 * Reads `examId` from the route. When opened without one (the bare /teacher/grading
 * tab entry) it falls back to a picker of exams currently grading. Submissions are
 * bucketed by pipeline stage (attention → review → in-progress → done); each row
 * opens the submission detail. Defensive: empty/missing data → friendly states.
 */
import { useMemo } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useExamGradingOverview, useExamGradingProgress, useExams } from "@levelup/query";

import { Badge, Button, Card, EmptyState, Icon, ListRow, Screen } from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import {
  ErrorCard,
  ListSkeleton,
  Section,
  examStatus,
  flattenPages,
  num,
  scoreFrac,
  subStatus,
} from "./_shared";

interface SubRow {
  id?: string;
  studentName?: string;
  rollNumber?: string;
  pipelineStatus?: string;
  retryCount?: number;
  gradingProgress?: { graded?: number; total?: number };
  summary?: { totalScore?: number; maxScore?: number; percentage?: number; grade?: string };
}

type Bucket = "attention" | "review" | "progress" | "done";
const BUCKETS: Array<{ key: Bucket; title: string; icon: string }> = [
  { key: "attention", title: "Needs attention", icon: "alert-triangle" },
  { key: "review", title: "Needs review", icon: "clipboard-check" },
  { key: "progress", title: "In progress", icon: "loader" },
  { key: "done", title: "Graded", icon: "check-circle-2" },
];

function bucketOf(status: string): Bucket {
  const s = subStatus(status);
  if (s.failed) return "attention";
  if (s.needsReview) return "review";
  if (status === "grading_complete" || status === "reviewed") return "done";
  return "progress";
}

// ── examId present: the real pipeline monitor ───────────────────────────────
function ExamQueue({ examId }: { examId: string }) {
  const router = useRouter();
  const overview = useExamGradingOverview(examId);
  const live = useExamGradingProgress(examId);

  const data = overview.data as
    | { exam?: { title?: string; status?: string }; submissions?: SubRow[] }
    | undefined;
  const subs = useMemo(() => data?.submissions ?? [], [data]);

  const grouped = useMemo(() => {
    const g: Record<Bucket, SubRow[]> = { attention: [], review: [], progress: [], done: [] };
    for (const s of subs) g[bucketOf(String(s.pipelineStatus ?? ""))].push(s);
    return g;
  }, [subs]);

  if (overview.isLoading) return <ListSkeleton />;
  if (isHardError(overview)) return <ErrorCard onRetry={() => void overview.refetch()} />;

  const st = examStatus(data?.exam?.status);

  return (
    <Screen className="bg-canvas" contentClassName="gap-4 p-4">
      <Card className="gap-2">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="font-display text-text-primary flex-1 text-lg" numberOfLines={2}>
            {data?.exam?.title ?? "Grading queue"}
          </Text>
          <Badge variant={st.variant} dot>
            {st.label}
          </Badge>
        </View>
        <View className="flex-row items-center gap-2">
          <Icon name={live.status === "live" ? "radio" : "wifi-off"} size={13} color="#756E61" />
          <Text className="text-text-muted text-xs">
            {subs.length} submission{subs.length === 1 ? "" : "s"}
            {live.status === "live" ? " · live" : ""}
          </Text>
        </View>
      </Card>

      {subs.length === 0 ? (
        <EmptyState
          icon={<Icon name="inbox" size={26} color="#756E61" />}
          title="No submissions yet"
          body="Once answer sheets are uploaded, the grading pipeline appears here in real time."
        />
      ) : (
        BUCKETS.map((b) => {
          const rows = grouped[b.key];
          if (rows.length === 0) return null;
          return (
            <Section key={b.key} title={`${b.title} · ${rows.length}`}>
              <View className="gap-2">
                {rows.map((s, i) => {
                  const ss = subStatus(s.pipelineStatus);
                  const gp = s.gradingProgress;
                  const prog =
                    gp && num(gp.total) > 0
                      ? `${num(gp.graded)}/${num(gp.total)} graded`
                      : undefined;
                  return (
                    <ListRow
                      key={s.id ?? i}
                      title={s.studentName ?? "Student"}
                      subtitle={
                        <View className="flex-row items-center gap-2">
                          <Badge variant={ss.variant}>{ss.label}</Badge>
                          {prog ? <Text className="text-2xs text-text-muted">{prog}</Text> : null}
                          {num(s.retryCount) > 0 ? (
                            <Text className="text-2xs text-warning">
                              retry ×{num(s.retryCount)}
                            </Text>
                          ) : null}
                        </View>
                      }
                      trailing={
                        <Text className="text-text-secondary font-mono text-xs">
                          {scoreFrac(s.summary?.totalScore, s.summary?.maxScore)}
                        </Text>
                      }
                      onPress={() => s.id && router.push(routes.submissionDetail(examId, s.id))}
                    />
                  );
                })}
              </View>
            </Section>
          );
        })
      )}
    </Screen>
  );
}

// ── no examId: pick an exam to monitor ──────────────────────────────────────
function ExamPicker() {
  const router = useRouter();
  const query = useExams();
  const exams = useMemo(
    () =>
      flattenPages<{ id?: string; title?: string; subject?: string; status?: string }>(
        query.data
      ).filter(
        (e) => e.status === "grading" || e.status === "published" || e.status === "results_released"
      ),
    [query.data]
  );

  if (query.isLoading) return <ListSkeleton />;
  if (isHardError(query)) return <ErrorCard onRetry={() => void query.refetch()} />;

  return (
    <Screen className="bg-canvas" contentClassName="gap-4 p-4">
      <View className="gap-1">
        <Text className="font-display text-text-primary text-2xl">Grading</Text>
        <Text className="text-text-muted text-sm">
          Pick an exam to monitor its grading pipeline.
        </Text>
      </View>
      {exams.length === 0 ? (
        <EmptyState
          icon={<Icon name="inbox" size={26} color="#756E61" />}
          title="Nothing in grading"
          body="Exams that are collecting or being graded show up here."
        />
      ) : (
        <View className="gap-2">
          {exams.map((e, i) => {
            const st = examStatus(e.status);
            return (
              <ListRow
                key={e.id ?? i}
                title={e.title ?? "Untitled exam"}
                subtitle={e.subject ?? "—"}
                trailing={<Badge variant={st.variant}>{st.label}</Badge>}
                onPress={() => e.id && router.push(routes.gradingReview(e.id))}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

export default function GradingQueueScreen() {
  const params = useLocalSearchParams<{ examId?: string }>();
  const examId = typeof params.examId === "string" ? params.examId : undefined;
  return examId ? <ExamQueue examId={examId} /> : <ExamPicker />;
}
