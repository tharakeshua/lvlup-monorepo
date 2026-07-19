/**
 * Exams tab surface — the learner's physical / AutoGrade exams (B2B), one row per
 * exam with its own submission status.
 *
 * Data:
 *  - `useExams()` — the exams visible to this learner (server scopes to tenant +
 *    the learner's `classIds`). We surface only exams that have reached a
 *    learner-meaningful lifecycle (published → grading → results_released).
 *  - `useSubmissions({ examId })` per row — the learner's OWN submission
 *    (server-scoped, released-gated projection). Its `pipelineStatus` +
 *    `resultsReleased` drive a calm status chip; no score reaches the device
 *    until the teacher releases it.
 *
 * Released results open the existing `ExamResultsViewScreen` (keyed by examId).
 * Reads are defensive — the deployed backend's runtime shape drifts from the
 * `@levelup/domain` types (GATE-0: "types lie"), so every field is optional-read.
 */
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { useExams, useSubmissions } from "@levelup/query";

import {
  Badge,
  Button,
  EmptyState,
  GradePill,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
} from "../../components";
import { AnswerKeyLock, flattenPages, gradeFromPct, gradeTone, useTestNav } from "./_components";

type Dict = Record<string, unknown>;
const o = (v: unknown): Dict => (v && typeof v === "object" ? (v as Dict) : {});
const n = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const s = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function coerceDate(t: unknown): Date | null {
  if (!t) return null;
  const withToDate = t as { toDate?: () => Date };
  if (typeof withToDate.toDate === "function") return withToDate.toDate();
  if (typeof t === "string" || typeof t === "number") {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDate(d: Date | null): string | undefined {
  if (!d) return undefined;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

type BadgeVariant = "brand" | "neutral" | "success" | "warning" | "error" | "info" | "spark";
interface SubMeta {
  label: string;
  icon: string;
  badge: BadgeVariant;
  released: boolean;
}

/**
 * Learner-facing status for one exam, derived from the learner's own submission
 * (may be absent) + the exam lifecycle. Never alarms the student with raw
 * failure states — grading hiccups read as "being reviewed".
 */
function examSubmissionMeta(submission: Dict | undefined, examStatus: string | undefined): SubMeta {
  const released =
    submission?.resultsReleased === true ||
    n(submission?.percentage) != null ||
    n(o(submission?.summary).percentage) != null;
  if (released) {
    return { label: "Results ready", icon: "check-circle", badge: "success", released: true };
  }
  if (!submission) {
    return examStatus === "results_released"
      ? { label: "No submission", icon: "inbox", badge: "neutral", released: false }
      : { label: "Not submitted", icon: "inbox", badge: "neutral", released: false };
  }
  const status = s(submission.pipelineStatus) ?? "";
  if (["ready_for_review", "reviewed", "grading_complete"].includes(status)) {
    return { label: "Awaiting release", icon: "lock", badge: "warning", released: false };
  }
  if (
    [
      "failed",
      "scouting_failed",
      "grading_failed",
      "finalization_failed",
      "manual_review_needed",
    ].includes(status)
  ) {
    return { label: "Being reviewed", icon: "compass", badge: "info", released: false };
  }
  // uploaded · scouting · scouting_complete · grading · grading_partial
  return { label: "Grading in progress", icon: "clock", badge: "info", released: false };
}

interface ExamVM {
  id: string;
  title: string;
  subject: string;
  status: string;
  date?: string;
  totalMarks?: number;
}

function readExam(raw: unknown): ExamVM {
  const e = o(raw);
  return {
    id: s(e.id) ?? "",
    title: s(e.title) ?? s(e.name) ?? "Untitled exam",
    subject: s(e.subject) ?? "",
    status: s(e.status) ?? "",
    date: fmtDate(coerceDate(e.examDate ?? e.date)),
    totalMarks: n(e.totalMarks),
  };
}

/**
 * One exam row. Owns its own `useSubmissions({ examId })` read so status is
 * per-exam without an N+1 fan-out in the parent (one hook per mounted row).
 */
function ExamRow({ exam, onOpen }: { exam: ExamVM; onOpen: () => void }) {
  const subsQ = useSubmissions({ examId: exam.id } as never);
  const submission = useMemo(() => {
    const first = flattenPages(subsQ.data)[0];
    return first ? o(first) : undefined;
  }, [subsQ.data]);

  const meta = examSubmissionMeta(submission, exam.status);
  const percentage = n(submission?.percentage) ?? n(o(submission?.summary).percentage);
  const grade = s(submission?.grade) ?? s(o(submission?.summary).grade);

  const label = `${exam.title}${exam.subject ? `, ${exam.subject}` : ""}, ${meta.label}`;

  return (
    <Pressable
      onPress={meta.released ? onOpen : undefined}
      disabled={!meta.released}
      accessibilityRole={meta.released ? "button" : "summary"}
      accessibilityLabel={label}
      className={`border-border-subtle bg-surface gap-3 rounded-lg border p-4 ${
        meta.released ? "active:opacity-80" : ""
      }`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="font-display text-text-primary text-base font-semibold">
            {exam.title}
          </Text>
          <View className="mt-1 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {exam.subject ? <Text className="text-text-muted text-xs">{exam.subject}</Text> : null}
            {exam.totalMarks != null ? (
              <Text className="text-text-muted text-xs">· {exam.totalMarks} marks</Text>
            ) : null}
          </View>
        </View>
        <Badge variant={meta.badge} icon={<Icon name={meta.icon} size={12} />}>
          {meta.label}
        </Badge>
      </View>

      {exam.date ? (
        <View className="flex-row items-center gap-1.5">
          <Icon name="calendar-clock" size={13} color="#756E61" />
          <Text className="text-text-muted text-xs">{exam.date}</Text>
        </View>
      ) : null}

      {meta.released ? (
        <View className="flex-row items-center justify-between">
          {percentage != null ? (
            <View className="flex-row items-center gap-2">
              <Text className="text-text-secondary font-mono text-sm">
                {Math.round(percentage)}%
              </Text>
              <GradePill grade={grade ?? gradeFromPct(percentage)} tone={gradeTone(percentage)} />
            </View>
          ) : (
            <View />
          )}
          <View className="flex-row items-center gap-1">
            <Text className="text-brand text-sm">View results</Text>
            <Icon name="chevron-right" size={16} color="#423A82" />
          </View>
        </View>
      ) : (
        <Text className="text-text-muted text-xs">
          {meta.label === "Not submitted"
            ? "Your answer sheet hasn't been submitted yet."
            : meta.label === "No submission"
              ? "No submission was recorded for you on this exam."
              : "You'll be notified the moment your teacher releases the results."}
        </Text>
      )}
    </Pressable>
  );
}

function ListSkeleton() {
  return (
    <View className="gap-3">
      {[0, 1, 2].map((i) => (
        <View key={i} className="border-border-subtle bg-surface gap-3 rounded-lg border p-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 gap-2">
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={90} height={20} />
          </View>
          <Skeleton width="50%" height={12} />
        </View>
      ))}
    </View>
  );
}

/** Learner-meaningful lifecycle: hide drafts + pre-publish paper states. */
const VISIBLE_STATUSES = new Set(["published", "grading", "results_released", "archived"]);

export default function ExamsListScreen() {
  const nav = useTestNav();
  const query = useExams();

  const exams = useMemo(() => {
    const list = flattenPages(query.data).map(readExam);
    return list.filter((e) => e.id && (!e.status || VISIBLE_STATUSES.has(e.status)));
  }, [query.data]);

  return (
    <Screen>
      <View className="gap-5 px-4 py-4">
        {/* Header */}
        <View className="gap-1">
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={nav.back}
              accessibilityRole="button"
              accessibilityLabel="Back"
              className="active:opacity-70"
            >
              <Icon name="arrow-left" size={20} color="#423A82" />
            </Pressable>
            <Text className="font-display text-text-primary text-2xl font-bold">Exams</Text>
            {exams.length > 0 ? <Badge variant="brand">{exams.length}</Badge> : null}
          </View>
          <Text className="text-text-muted text-sm">
            Your written exams and their grading status. Results appear here once your teacher
            releases them.
          </Text>
        </View>

        {/* Body */}
        {query.isLoading ? (
          <ListSkeleton />
        ) : query.isError ? (
          <EmptyState
            icon="cloud-off"
            title="We couldn't load your exams"
            body="Check your connection and try again."
            action={
              <Button
                variant="ghost"
                leadingIcon={<Icon name="refresh-cw" size={16} />}
                onPress={() => query.refetch()}
              >
                Retry
              </Button>
            }
          />
        ) : exams.length === 0 ? (
          <EmptyState
            icon="graduation-cap"
            title="No exams yet"
            body="When your teacher schedules a written exam for your class, it'll appear here — along with its grading status and, once released, your results."
          />
        ) : (
          <View className="gap-3">
            {exams.map((e) => (
              <ExamRow key={e.id} exam={e} onOpen={() => nav.toExamResults(e.id)} />
            ))}
          </View>
        )}

        {exams.length > 0 ? (
          <>
            <SectionHeader title="Good to know" />
            <AnswerKeyLock title="Answer key never shown">
              This list shows each exam's status only. Your scanned answers, feedback and rubric
              appear on the released results surface — the answer key stays with your teacher.
            </AnswerKeyLock>
          </>
        ) : null}
      </View>
    </Screen>
  );
}
