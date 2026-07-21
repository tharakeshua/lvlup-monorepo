import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useExam, useExamQuestions, useSubmissions, useQuestionSubmissions } from "@levelup/query";
import { asExamId, asStudentId } from "@levelup/domain";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { getFirebaseServices } from "../sdk/firebase";
import type { Exam, ExamQuestion, QuestionSubmission, Submission } from "@levelup/shared-types";
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
  MarkdownWithMath,
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
  Printer,
  ClipboardCheck,
  ImageIcon,
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

/** Resolve an exam's uploaded question-paper pages (Storage paths) to viewable URLs. */
function useQuestionPaperUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (paths.length === 0) return;
    const { storage } = getFirebaseServices();
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        paths.map(async (p) => {
          if (!p || urls[p] !== undefined) return;
          if (/^https?:\/\//.test(p)) {
            updates[p] = p;
            return;
          }
          try {
            updates[p] = await getDownloadURL(storageRef(storage, p));
          } catch {
            updates[p] = "";
          }
        })
      );
      if (!cancelled && Object.keys(updates).length > 0) {
        setUrls((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join("|")]);

  return urls;
}

function QuestionPaperGallery({ images }: { images: string[] }) {
  const urls = useQuestionPaperUrls(images);
  if (images.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <ImageIcon className="text-muted-foreground h-4 w-4" />
        <h2 className="text-sm font-semibold">Question Paper</h2>
        <span className="text-muted-foreground text-xs">
          {images.length} page{images.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((path, idx) => {
          const url = urls[path];
          const resolved = url === undefined ? null : url;
          return (
            <a
              key={path}
              href={resolved || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-muted group relative block aspect-[3/4] overflow-hidden rounded-md border"
              aria-label={`Question paper page ${idx + 1}`}
            >
              {resolved === null ? (
                <Skeleton className="h-full w-full" />
              ) : resolved === "" ? (
                <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[11px]">
                  Failed to load
                </div>
              ) : (
                <img
                  src={resolved}
                  alt={`Question paper page ${idx + 1}`}
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform group-hover:scale-[1.02]"
                />
              )}
              <span className="bg-background/80 absolute bottom-1 left-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium">
                {idx + 1}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Read-only rubric preview for a single question (no answer keys / evaluator guidance — the
 * server already strips those fields for non-authoring roles via projectRubric). */
function QuestionRubricPreview({ rubric }: { rubric: ExamQuestion["rubric"] | undefined }) {
  if (!rubric) return null;
  const { scoringMode, criteria, dimensions, holisticGuidance, holisticMaxScore, passingPercentage } =
    rubric;

  const showCriteria = criteria && criteria.length > 0;
  const showDimensions = dimensions && dimensions.length > 0;
  const showHolistic = Boolean(holisticGuidance);
  if (!showCriteria && !showDimensions && !showHolistic) return null;

  return (
    <div className="bg-muted/30 mt-3 rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="text-muted-foreground h-3.5 w-3.5" />
          <span className="text-xs font-semibold">Rubric</span>
          {scoringMode && (
            <span className="bg-background rounded-full px-2 py-0.5 text-[10px] font-medium capitalize">
              {scoringMode.replace(/_/g, " ")}
            </span>
          )}
        </div>
        {passingPercentage != null && (
          <span className="text-muted-foreground text-[11px]">Pass {passingPercentage}%</span>
        )}
      </div>

      {showCriteria && (
        <ul className="space-y-1.5">
          {criteria!.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 text-xs">
              <div>
                <span className="font-medium">{c.name}</span>
                {c.description && (
                  <p className="text-muted-foreground mt-0.5">{c.description}</p>
                )}
              </div>
              <span className="text-muted-foreground flex-shrink-0 font-mono">
                {c.maxScore ?? c.maxPoints}
              </span>
            </li>
          ))}
        </ul>
      )}

      {showDimensions && (
        <ul className="space-y-1.5">
          {dimensions!.map((d) => (
            <li key={d.id} className="text-xs">
              <span className="font-medium">{d.name}</span>
              {d.description && <p className="text-muted-foreground mt-0.5">{d.description}</p>}
            </li>
          ))}
        </ul>
      )}

      {showHolistic && (
        <div className="text-xs">
          <div className="text-muted-foreground mb-1 flex items-center justify-between">
            <span className="font-medium">Holistic guidance</span>
            {holisticMaxScore != null && <span>Max {holisticMaxScore}</span>}
          </div>
          <MarkdownWithMath text={holisticGuidance!} />
        </div>
      )}
    </div>
  );
}

function ExamQuestionPreviewCard({ question, index }: { question: ExamQuestion; index: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <span className="text-sm font-medium">Q{index + 1}</span>
        <span className="text-muted-foreground text-xs font-medium">
          {question.maxMarks} mark{question.maxMarks === 1 ? "" : "s"}
        </span>
      </div>
      <div className="text-sm">
        <MarkdownWithMath text={question.text} />
      </div>
      {question.imageUrls && question.imageUrls.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {question.imageUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Question ${index + 1} attachment ${i + 1}`}
              loading="lazy"
              className="aspect-[3/4] w-full rounded-md border object-contain"
            />
          ))}
        </div>
      )}
      <QuestionRubricPreview rubric={question.rubric} />
    </div>
  );
}

export default function ExamResultPage() {
  const { examId } = useParams<{ examId: string }>();
  const { user } = useAuthStore();
  const userId = user?.uid ?? null;

  const { data: examData, isLoading: examLoading } = useExam(examId ?? "");
  const exam = examData as Exam | undefined;
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

  // The exam's questions/rubrics are readable independently of a submission
  // (server-side `exam.read` only checks tenant membership) — always fetch them
  // so the exam paper still renders before/without a submission.
  const { data: examQuestionsRaw, isLoading: questionsLoading } = useExamQuestions(examId ?? "");
  const examQuestions = (examQuestionsRaw as ExamQuestion[] | undefined) ?? [];

  const isLoading = examLoading || subsLoading || (Boolean(submission) && qsLoading);
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
      <div className="mx-auto max-w-2xl space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/results">Results</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{exam?.title ?? "Exam"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="bg-card rounded-lg border p-6 text-center">
          <FileText className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
          <h1 className="mb-1 text-xl font-bold">{exam?.title ?? "Exam"}</h1>
          {exam?.subject && <p className="text-muted-foreground text-sm">{exam.subject}</p>}
          <p className="text-muted-foreground mt-3 text-sm">
            You haven't submitted this exam yet — no results to show.
          </p>
        </div>

        {exam?.questionPaper?.images && exam.questionPaper.images.length > 0 && (
          <QuestionPaperGallery images={exam.questionPaper.images} />
        )}

        {questionsLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : examQuestions.length > 0 ? (
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BarChart3 className="h-5 w-5" /> Questions
            </h2>
            {examQuestions
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((q, idx) => (
                <ExamQuestionPreviewCard key={q.id} question={q} index={idx} />
              ))}
          </div>
        ) : null}

        <Button variant="outline" asChild>
          <Link to="/results">
            <ChevronLeft className="mr-1 inline h-4 w-4" />
            Back to Results
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
            <BreadcrumbPage>{exam?.title ?? "Exam Results"}</BreadcrumbPage>
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
        <h1 className="mb-2 text-xl font-bold">{exam?.title ?? "Exam Results"}</h1>

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

      {/* Recommendations */}
      {uniqueWeakTopics.length > 0 && (
        <div className="rounded-lg border bg-amber-500/10 p-4 dark:border-amber-800">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Recommended Practice
          </h3>
          <p className="text-muted-foreground mb-2 text-xs">
            You scored below 50% on these topics. Consider practicing them:
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

      {/* PDF Download placeholder */}
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link to="/results">
            <ChevronLeft className="mr-1 inline h-4 w-4" />
            Back to Results
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print Results
        </Button>
      </div>
    </div>
  );
}
