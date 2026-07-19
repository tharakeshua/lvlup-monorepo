import { useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useExam, useSubmissions, useQuestionSubmissions } from "@levelup/query";
import { asExamId, asStudentId } from "@levelup/domain";
import type { QuestionSubmission, Submission, Exam } from "@levelup/shared-types";
import { practiceHref, spaceHref } from "../lib/space-paths";
import ProgressBar from "../components/common/ProgressBar";
import {
  Button,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@levelup/shared-ui";
import {
  Award,
  BarChart3,
  CheckCircle2,
  XCircle,
  Minus,
  FileText,
  BookOpen,
  ChevronLeft,
  RefreshCw,
} from "lucide-react";

function GradeBadge({ grade }: { grade: string }) {
  const colorMap: Record<string, string> = {
    "A+": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    A: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    "B+": "bg-primary/10 text-primary",
    B: "bg-primary/10 text-primary",
    "C+": "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    C: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    D: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    F: "bg-destructive/10 text-destructive",
  };
  const color = colorMap[grade] ?? "bg-muted text-muted-foreground";

  return <span className={`rounded-full px-3 py-1 text-sm font-bold ${color}`}>{grade}</span>;
}

function QuestionCard({ qs, index }: { qs: QuestionSubmission; index: number }) {
  const evaluation = qs.evaluation;
  const score = evaluation?.score ?? 0;
  const maxScore = evaluation?.maxScore ?? 0;
  const correctness = evaluation?.correctness;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {correctness != null && correctness >= 1 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : correctness != null && correctness === 0 ? (
            <XCircle className="text-destructive h-4 w-4" />
          ) : (
            <Minus className="h-4 w-4 text-yellow-500" />
          )}
          <span className="text-sm font-medium">Q{index + 1}</span>
        </div>
        <span className="text-sm font-bold">
          {score}/{maxScore}
        </span>
      </div>

      {/* Summary feedback */}
      {evaluation?.summary?.overallComment && (
        <div className="bg-muted/50 text-foreground mt-2 rounded p-3 text-xs">
          <p className="text-muted-foreground mb-1 font-medium">Feedback:</p>
          <p className="whitespace-pre-wrap">{evaluation.summary.overallComment}</p>
        </div>
      )}

      {evaluation?.strengths && evaluation.strengths.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Strengths:
          </p>
          <ul className="text-muted-foreground list-disc pl-4 text-xs">
            {evaluation.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation?.weaknesses && evaluation.weaknesses.length > 0 && (
        <div className="mt-2">
          <p className="text-destructive mb-1 text-xs font-medium">Areas to Improve:</p>
          <ul className="text-muted-foreground list-disc pl-4 text-xs">
            {evaluation.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ExamResultPage() {
  const { examId } = useParams<{ examId: string }>();
  const location = useLocation();
  const { user } = useAuthStore();
  const userId = user?.uid ?? null;

  const { data: exam } = useExam(examId ?? "");
  const examDetail = exam as Exam | undefined;
  const { data: submissionPages, isLoading: subsLoading } = useSubmissions({
    examId: asExamId(examId ?? ""),
    studentId: userId ? asStudentId(userId) : undefined,
  });

  // Flatten the infinite-query pages and use the most recent submission.
  const submission = useMemo<Submission | null>(() => {
    const pages =
      (submissionPages as { pages?: Array<{ items?: unknown[] }> } | undefined)?.pages ?? [];
    return (pages.flatMap((p) => p.items ?? [])[0] as Submission | undefined) ?? null;
  }, [submissionPages]);

  const { data: questionSubmissionsRaw, isLoading: qsLoading } = useQuestionSubmissions(
    submission?.id ?? ""
  );
  const questionSubmissions = questionSubmissionsRaw as QuestionSubmission[] | undefined;

  const isLoading = subsLoading || qsLoading;
  const summary = submission?.summary;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <FileText className="text-muted-foreground/30 mx-auto mb-3 h-10 w-10" />
        <p className="text-muted-foreground text-sm">No results found for this exam.</p>
        <Button variant="link" asChild className="mt-4">
          <Link to="/results" className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Back to Results
          </Link>
        </Button>
      </div>
    );
  }

  const percentage = summary?.percentage ?? 0;
  const grade = summary?.grade ?? "--";

  // Derive recommendations from weak topics using missingConcepts
  const weakTopics = (questionSubmissions ?? [])
    .filter((qs) => qs.evaluation && qs.evaluation.correctness < 0.5)
    .flatMap((qs) => qs.evaluation?.missingConcepts ?? []);
  const uniqueWeakTopics = [...new Set(weakTopics)];

  const practiceTarget =
    examDetail?.linkedSpaceId && examDetail.linkedStoryPointId
      ? practiceHref(location.pathname, examDetail.linkedSpaceId, examDetail.linkedStoryPointId)
      : null;
  const spaceOverviewTarget = examDetail?.linkedSpaceId
    ? spaceHref(location.pathname, examDetail.linkedSpaceId)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/results">Results</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{examDetail?.title ?? exam?.title ?? "Exam Results"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Result Summary */}
      <div className="bg-card rounded-lg border p-6 text-center">
        <Award
          className={`mx-auto mb-3 h-12 w-12 ${
            percentage >= 70
              ? "text-emerald-500"
              : percentage >= 40
                ? "text-yellow-500"
                : "text-destructive"
          }`}
        />
        <h1 className="mb-2 text-xl font-bold">
          {examDetail?.title ?? exam?.title ?? "Exam Results"}
        </h1>

        <div className="mb-4 flex items-center justify-center gap-4">
          <GradeBadge grade={grade} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <p className="text-3xl font-bold">{Math.round(percentage)}%</p>
            <p className="text-muted-foreground text-xs">Score</p>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {summary?.totalScore ?? 0}/{summary?.maxScore ?? 0}
            </p>
            <p className="text-muted-foreground text-xs">Marks</p>
          </div>
          <div>
            <p className="text-3xl font-bold">
              {summary?.questionsGraded ?? 0}/{summary?.totalQuestions ?? 0}
            </p>
            <p className="text-muted-foreground text-xs">Graded</p>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar
            value={percentage}
            max={100}
            color={percentage >= 70 ? "green" : percentage >= 40 ? "orange" : "red"}
          />
        </div>
      </div>

      {/* Per-Question Feedback */}
      {questionSubmissions && questionSubmissions.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" /> Per-Question Breakdown
          </h2>
          {questionSubmissions.map((qs, idx) => (
            <QuestionCard key={qs.id} qs={qs} index={idx} />
          ))}
        </div>
      )}

      {/* Recommendations — exam-level view; practice lives in the linked space */}
      {uniqueWeakTopics.length > 0 && (
        <div className="rounded-lg border bg-amber-500/10 p-4 dark:border-amber-800">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Recommended Practice
          </h3>
          <p className="text-muted-foreground mb-2 text-xs">
            You scored below 50% on these topics.
            {practiceTarget
              ? " Reattempt questions in the linked practice space."
              : " Consider practicing them when your teacher links a practice space."}
          </p>
          <div className="flex flex-wrap gap-2">
            {uniqueWeakTopics.map((topic) => (
              <span
                key={topic}
                className="bg-background rounded-full border border-amber-200 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-700 dark:text-amber-400"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {practiceTarget && (
        <div className="bg-card flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Practice &amp; reattempt</p>
            <p className="text-muted-foreground text-xs">
              Review each question with feedback, then reattempt in the exam&apos;s linked practice
              space. Your exam results stay on this page.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2">
              <Link to={practiceTarget}>
                <RefreshCw className="h-4 w-4" /> Reattempt questions
              </Link>
            </Button>
            {spaceOverviewTarget && (
              <Button variant="outline" asChild>
                <Link to={spaceOverviewTarget}>Open practice space</Link>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* PDF: print-only MVP — full per-student PDF assignment is TODO (see practice-from-mistakes stub) */}
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link to="/results">
            <ChevronLeft className="mr-1 inline h-4 w-4" />
            Back to Results
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <FileText className="h-4 w-4" /> Print Results
        </Button>
      </div>
    </div>
  );
}
