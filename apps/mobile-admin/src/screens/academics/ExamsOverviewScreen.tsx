/**
 * ExamsOverviewScreen — exams list + grading posture.
 *
 * Design: docs/rebuild-spec/design/build/prototypes/admin/exams-overview.card.html
 * Route:  /admin/academics/exams
 * Data:   useExams() (infinite — data.pages[].items) + useExamGradingOverview()
 *         for the active grading exam's submission queue (soft-misses to empty).
 *
 * Desktop table → stacked rows with the real ExamStatus enum badge. Defensive:
 * infinite-query data is read via the {pages:[{items}]} shape (see mobile memory).
 */
import { useMemo } from "react";
import { View } from "react-native";

import { useExams, useExamGradingOverview } from "@levelup/query";

import {
  Badge,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  SectionHeader,
  Skeleton,
  StatTile,
  TopBar,
} from "../../components";
import { isHardError } from "../../lib/query-status";
import { fmtDate, listOf, num, statusBadge, str } from "./_shared";

interface ExamRow {
  id?: string;
  title?: string;
  subject?: string;
  status?: string;
  examDate?: unknown;
  totalMarks?: number;
  questionCount?: number;
  stats?: { submissionCount?: number; gradedCount?: number };
}

export default function ExamsOverviewScreen() {
  const examsQ = useExams({});

  const exams = useMemo(() => listOf<ExamRow>(examsQ.data), [examsQ.data]);

  const grading = exams.filter((e) => str(e.status) === "grading");
  const released = exams.filter((e) => str(e.status).includes("released")).length;
  const published = exams.filter((e) => str(e.status) === "published").length;

  // Grading-queue summary for the first in-flight grading exam (empty → soft miss).
  const activeGradingId = str(grading[0]?.id);
  const gradingQ = useExamGradingOverview(activeGradingId);
  const gradingQueue = listOf((gradingQ.data as { submissions?: unknown[] })?.submissions);

  return (
    <Screen scroll>
      <TopBar title="Exams" subtitle="Assessments & grading" />

      <View className="flex-row flex-wrap gap-3">
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Exams"
            value={examsQ.isLoading ? "…" : String(exams.length)}
            icon="file-check"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Grading"
            value={examsQ.isLoading ? "…" : String(grading.length)}
            icon="loader"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Published"
            value={examsQ.isLoading ? "…" : String(published)}
            icon="calendar-check"
          />
        </View>
        <View className="min-w-[46%] flex-1">
          <StatTile
            label="Released"
            value={examsQ.isLoading ? "…" : String(released)}
            icon="check-circle"
          />
        </View>
      </View>

      {/* grading queue summary (only when there's an active grading exam) */}
      {activeGradingId !== "" && (
        <Card className="gap-2">
          <SectionHeader title="Grading queue" subtitle={str(grading[0]?.title)} />
          <ListRow
            title="Submissions to grade"
            leading={<Icon name="loader" size={18} />}
            trailing={
              <Badge variant="warning">
                {gradingQ.isLoading
                  ? "…"
                  : String(gradingQueue.length || num(grading[0]?.stats?.submissionCount, 0))}
              </Badge>
            }
            chevron={false}
          />
        </Card>
      )}

      <Card className="gap-1">
        <SectionHeader
          title="All exams"
          subtitle={exams.length ? `${exams.length} total` : undefined}
        />

        {examsQ.isLoading ? (
          <View className="gap-2 py-2">
            <Skeleton variant="rect" />
            <Skeleton variant="rect" />
            <Skeleton variant="rect" />
          </View>
        ) : isHardError(examsQ) ? (
          <EmptyState
            icon="alert-triangle"
            title="Couldn't load exams"
            body="Something went wrong reading the exam list."
          />
        ) : exams.length === 0 ? (
          <EmptyState
            icon="file-check"
            title="No exams yet"
            body="Exams created for your classes will appear here."
          />
        ) : (
          exams.map((e, i) => {
            const sb = statusBadge(e.status ?? "draft");
            const meta = [
              e.subject,
              fmtDate(e.examDate),
              e.totalMarks != null && `${num(e.totalMarks)} marks`,
            ]
              .filter(Boolean)
              .join("  ·  ");
            return (
              <ListRow
                key={str(e.id) || String(i)}
                title={str(e.title, "Untitled exam")}
                subtitle={meta}
                leading={<Icon name="file-check" size={18} />}
                trailing={<Badge variant={sb.variant}>{sb.label}</Badge>}
                chevron={false}
              />
            );
          })
        )}
      </Card>
    </Screen>
  );
}
