/**
 * ExamsOverviewScreen — the Review tab root: a teacher MONITOR of every exam.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/teacher/exams-overview.card.html
 *         (+ prototypes/exams/exams-list.card.html)
 * Data:   useExams() (paginated) + per-exam embedded `stats`. Live aggregate
 *         grading progress (useExamGradingProgress) is a per-exam subscription, so
 *         it's bound on the drill-in screens (grading queue / review), not per row.
 *
 * Each card → grading-review (confidence-routed) for that exam; a secondary action
 * jumps to exam analytics. Defensive throughout: reads can THROW / be empty under
 * GATE-B, so loading→skeleton, error→soft (NOT_FOUND/UNAUTH → empty), empty→card.
 */
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useExams } from "@levelup/query";

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Screen,
  TeacherPageHeader,
} from "../../components";
import { routes } from "../../lib/routes";
import { isHardError } from "../../lib/query-status";
import { ErrorCard, ListSkeleton, examStatus, flattenPages, num, pct } from "./_shared";

interface ExamRow {
  id?: string;
  title?: string;
  subject?: string;
  status?: string;
  classIds?: string[];
  totalMarks?: number;
  stats?: {
    totalSubmissions?: number;
    gradedSubmissions?: number;
    avgScore?: number;
    passRate?: number;
  };
}

const FILTERS: Array<{ key: string; label: string; match?: (s: string) => boolean }> = [
  { key: "all", label: "All" },
  { key: "grading", label: "Grading", match: (s) => s === "grading" },
  { key: "collecting", label: "Collecting", match: (s) => s === "published" },
  { key: "released", label: "Released", match: (s) => s === "results_released" },
  {
    key: "draft",
    label: "Drafts",
    match: (s) => s.startsWith("draft") || s.startsWith("question_paper"),
  },
];

function ExamCard({
  exam,
  onReview,
  onAnalytics,
}: {
  exam: ExamRow;
  onReview: () => void;
  onAnalytics: () => void;
}) {
  const st = examStatus(exam.status);
  const total = num(exam.stats?.totalSubmissions);
  const graded = num(exam.stats?.gradedSubmissions);
  const awaiting = Math.max(0, total - graded);
  const released = exam.status === "results_released";

  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="font-display text-text-primary text-base" numberOfLines={1}>
            {exam.title ?? "Untitled exam"}
          </Text>
          <Text className="text-text-muted text-xs">
            {exam.subject ?? "—"}
            {exam.classIds?.length ? ` · ${exam.classIds.slice(0, 2).join(", ")}` : ""}
          </Text>
        </View>
        <Badge variant={st.variant} dot>
          {st.label}
        </Badge>
      </View>

      <View className="flex-row flex-wrap gap-x-5 gap-y-1">
        <Stat label="Submitted" value={String(total)} />
        <Stat label="Graded" value={String(graded)} />
        <Stat
          label="Awaiting"
          value={String(awaiting)}
          tone={awaiting > 0 ? "text-warning" : "text-text-primary"}
        />
        <Stat label="Avg" value={pct(exam.stats?.avgScore)} />
        <Stat label="Pass" value={pct(exam.stats?.passRate)} />
      </View>

      <View className="flex-row gap-2">
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          leadingIcon={<Icon name="clipboard-check" size={15} />}
          onPress={onReview}
        >
          {awaiting > 0 ? `Review (${awaiting})` : "Review submissions"}
        </Button>
        {released ? (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="bar-chart-3" size={15} />}
            onPress={onAnalytics}
          >
            Analytics
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone = "text-text-primary",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <View>
      <Text className="text-2xs text-text-muted uppercase tracking-wide">{label}</Text>
      <Text className={`font-display text-sm ${tone}`}>{value}</Text>
    </View>
  );
}

export default function ExamsOverviewScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const query = useExams();

  const exams = useMemo(() => flattenPages<ExamRow>(query.data), [query.data]);
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    if (!f?.match) return exams;
    return exams.filter((e) => f.match!(String(e.status ?? "")));
  }, [exams, filter]);

  if (query.isLoading) return <ListSkeleton />;
  if (isHardError(query)) return <ErrorCard onRetry={() => void query.refetch()} />;

  return (
    <Screen className="bg-canvas" contentClassName="gap-4 p-4">
      <TeacherPageHeader
        eyebrow="Assessment desk"
        title="Review"
        subtitle="Move every exam from collection to confident release."
        action={
          <View className="bg-marigold-50 border-marigold-200 rounded-pill flex-row items-center gap-1.5 border px-3 py-2">
            <Icon name="files" size={14} color="#B7791F" />
            <Text className="text-warning font-mono text-xs">{exams.length}</Text>
          </View>
        }
      />

      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onPress={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </View>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Icon name="file-text" size={26} color="#756E61" />}
          title="No exams yet"
          body="Exams you create on the web appear here for monitoring and grading."
        />
      ) : (
        <View className="gap-3">
          {shown.map((exam, i) => (
            <ExamCard
              key={exam.id ?? i}
              exam={exam}
              onReview={() => exam.id && router.push(routes.gradingReview(exam.id))}
              onAnalytics={() => exam.id && router.push(routes.examAnalytics(exam.id))}
            />
          ))}
          {query.hasNextPage ? (
            <Button
              variant="ghost"
              size="sm"
              loading={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage()}
            >
              Load more
            </Button>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
