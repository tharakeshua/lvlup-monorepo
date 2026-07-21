import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExams, useSubmissions } from "@levelup/query";
import { Skeleton, Badge, Input } from "@levelup/shared-ui";
import {
  GraduationCap,
  Search,
  CalendarClock,
  ChevronRight,
  CheckCircle2,
  Lock,
  Clock,
  Inbox,
  Compass,
  CloudOff,
} from "lucide-react";

/**
 * Student Exams tab — the learner's written / AutoGrade exams (one card per exam
 * with its own grading status). Backed by the single `useExams()` query (server
 * scopes to tenant + the learner's classIds), so the list loads in ONE round-trip
 * rather than a per-space fan-out. Search + subject filter are client-side over
 * the loaded list. Released results deep-link to the existing `/exams/:id/results`
 * page. No score/answer-key reaches the client until the teacher releases results.
 */

type Dict = Record<string, unknown>;
const o = (v: unknown): Dict => (v && typeof v === "object" ? (v as Dict) : {});
const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function coerceDate(t: unknown): Date | null {
  if (!t) return null;
  const withToDate = t as { toDate?: () => Date; seconds?: number };
  if (typeof withToDate.toDate === "function") return withToDate.toDate();
  if (typeof withToDate.seconds === "number") return new Date(withToDate.seconds * 1000);
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

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
interface SubMeta {
  label: string;
  Icon: typeof CheckCircle2;
  variant: BadgeVariant;
  released: boolean;
}

/** Learner-facing status for one exam, derived from the learner's own submission
 * (may be absent) + the exam lifecycle. Never alarms the student with raw failure
 * states — grading hiccups read as "being reviewed". */
function examSubmissionMeta(submission: Dict | undefined, examStatus: string | undefined): SubMeta {
  const released =
    submission?.resultsReleased === true ||
    num(submission?.percentage) != null ||
    num(o(submission?.summary).percentage) != null;
  if (released) {
    return { label: "Results ready", Icon: CheckCircle2, variant: "default", released: true };
  }
  if (!submission) {
    return {
      label: examStatus === "results_released" ? "No submission" : "Not submitted",
      Icon: Inbox,
      variant: "outline",
      released: false,
    };
  }
  const status = str(submission.pipelineStatus) ?? "";
  if (["ready_for_review", "reviewed", "grading_complete"].includes(status)) {
    return { label: "Awaiting release", Icon: Lock, variant: "secondary", released: false };
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
    return { label: "Being reviewed", Icon: Compass, variant: "secondary", released: false };
  }
  return { label: "Grading in progress", Icon: Clock, variant: "secondary", released: false };
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
    id: str(e.id) ?? "",
    title: str(e.title) ?? str(e.name) ?? "Untitled exam",
    subject: str(e.subject) ?? "",
    status: str(e.status) ?? "",
    date: fmtDate(coerceDate(e.examDate ?? e.date)),
    totalMarks: num(e.totalMarks),
  };
}

/** One exam row. Owns its own `useSubmissions({ examId })` read so status is
 * per-exam without threading state through the parent. */
function ExamCard({
  exam,
  onOpenDetail,
  onOpenResults,
}: {
  exam: ExamVM;
  onOpenDetail: () => void;
  onOpenResults: () => void;
}) {
  const subsQ = useSubmissions({ examId: exam.id } as never);
  const submission = useMemo(() => {
    const first = (subsQ.data?.pages?.flatMap((p) => (p as { items?: unknown[] }).items ?? []) ??
      [])[0];
    return first ? o(first) : undefined;
  }, [subsQ.data]);

  const meta = examSubmissionMeta(submission, exam.status);
  const percentage = num(submission?.percentage) ?? num(o(submission?.summary).percentage);
  const StatusIcon = meta.Icon;

  return (
    <button
      type="button"
      onClick={() => (meta.released ? onOpenResults() : onOpenDetail())}
      className="bg-card flex w-full cursor-pointer flex-col gap-3 rounded-lg border p-4 text-left transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{exam.title}</h3>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {exam.subject ? <span>{exam.subject}</span> : null}
            {exam.totalMarks != null ? <span>· {exam.totalMarks} marks</span> : null}
          </div>
        </div>
        <Badge variant={meta.variant} className="flex shrink-0 items-center gap-1 text-xs">
          <StatusIcon className="h-3 w-3" />
          {meta.label}
        </Badge>
      </div>

      {exam.date ? (
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <CalendarClock className="h-3.5 w-3.5" />
          {exam.date}
        </div>
      ) : null}

      {meta.released ? (
        <div className="flex items-center justify-between">
          {percentage != null ? (
            <span className="font-mono text-sm">{Math.round(percentage)}%</span>
          ) : (
            <span />
          )}
          <span className="text-primary flex items-center gap-1 text-sm font-medium">
            View results <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            {meta.label === "Not submitted"
              ? "View the question paper and rubrics."
              : meta.label === "No submission"
                ? "View the question paper and rubrics."
                : "You'll be notified the moment your teacher releases the results."}
          </p>
          <span className="text-primary flex shrink-0 items-center gap-1 text-sm font-medium">
            Open <ChevronRight className="h-4 w-4" />
          </span>
        </div>
      )}
    </button>
  );
}

/** Learner-meaningful lifecycle: hide drafts + pre-publish paper states. */
const VISIBLE_STATUSES = new Set(["published", "grading", "results_released", "archived"]);

export default function ExamsPage() {
  const navigate = useNavigate();
  const query = useExams();
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");

  const exams = useMemo(() => {
    const list = (query.data?.pages?.flatMap((p) => (p as { items?: unknown[] }).items ?? []) ?? [])
      .map(readExam)
      .filter((e) => e.id && (!e.status || VISIBLE_STATUSES.has(e.status)));
    return list;
  }, [query.data]);

  const subjects = useMemo(
    () => [...new Set(exams.map((e) => e.subject).filter(Boolean))].sort(),
    [exams]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter(
      (e) =>
        (!subject || e.subject === subject) &&
        (!q || e.title.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q))
    );
  }, [exams, search, subject]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap className="text-primary h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Exams</h1>
          <p className="text-muted-foreground text-sm">
            Your written exams and their grading status. Results appear here once your teacher
            releases them.
          </p>
        </div>
      </div>

      {/* Search + subject filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams…"
            className="pl-9"
            aria-label="Search exams"
          />
        </div>
        {subjects.length > 0 && (
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Filter by subject"
            className="border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus:outline-none focus-visible:ring-2 sm:w-56"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Body */}
      {query.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="bg-muted/50 text-muted-foreground rounded-lg border p-8 text-center">
          <CloudOff className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">We couldn't load your exams.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="text-primary mt-2 text-sm font-medium hover:underline"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-muted/50 text-muted-foreground rounded-lg border p-8 text-center">
          <GraduationCap className="text-muted-foreground/30 mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">
            {exams.length === 0
              ? "No exams yet. When your teacher schedules a written exam for your class, it'll appear here."
              : "No exams match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              onOpenDetail={() => navigate(`/exams/${exam.id}`)}
              onOpenResults={() => navigate(`/exams/${exam.id}/results`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
