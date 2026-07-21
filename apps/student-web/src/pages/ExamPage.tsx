import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useExam, useExamQuestions, useSubmissions } from "@levelup/query";
import { asExamId, asStudentId } from "@levelup/domain";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { getFirebaseServices } from "../sdk/firebase";
import type { Exam, ExamQuestion, Submission } from "@levelup/shared-types";
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
  Badge,
} from "@levelup/shared-ui";
import {
  BarChart3,
  ChevronLeft,
  ClipboardCheck,
  FileText,
  GraduationCap,
  ImageIcon,
  Lock,
} from "lucide-react";

function useResolvedImageUrls(paths: string[]): Record<string, string> {
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
  const urls = useResolvedImageUrls(images);
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

function QuestionRubricPreview({ rubric }: { rubric: ExamQuestion["rubric"] | undefined }) {
  if (!rubric) return null;
  const {
    scoringMode,
    criteria,
    dimensions,
    holisticGuidance,
    holisticMaxScore,
    passingPercentage,
  } = rubric;

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
                {c.description && <p className="text-muted-foreground mt-0.5">{c.description}</p>}
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

function resultsReleased(submission: Submission | null): boolean {
  if (!submission) return false;
  if (submission.resultsReleased === true) return true;
  const pct = submission.percentage ?? submission.summary?.percentage;
  return typeof pct === "number" && Number.isFinite(pct);
}

export default function ExamPage() {
  const { examId } = useParams<{ examId: string }>();
  const { user } = useAuthStore();
  const userId = user?.uid ?? null;

  const { data: examData, isLoading: examLoading } = useExam(examId ?? "");
  const exam = examData as Exam | undefined;

  const { data: submissionPages, isLoading: subsLoading } = useSubmissions({
    examId: asExamId(examId ?? ""),
    studentId: userId ? asStudentId(userId) : undefined,
  });

  const submission = useMemo<Submission | null>(() => {
    const pages =
      (submissionPages as { pages?: Array<{ items?: unknown[] }> } | undefined)?.pages ?? [];
    return (pages.flatMap((p) => p.items ?? [])[0] as Submission | undefined) ?? null;
  }, [submissionPages]);

  const { data: examQuestionsRaw, isLoading: questionsLoading } = useExamQuestions(examId ?? "");
  const examQuestions = (examQuestionsRaw as ExamQuestion[] | undefined) ?? [];

  const released = resultsReleased(submission);
  const isLoading = examLoading || subsLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 text-center">
        <p className="text-muted-foreground text-sm">Exam not found.</p>
        <Button variant="outline" asChild>
          <Link to="/exams">Back to Exams</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/exams">Exams</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{exam.title ?? "Exam"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start gap-3">
          <GraduationCap className="text-primary mt-0.5 h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{exam.title ?? "Exam"}</h1>
            {exam.subject && <p className="text-muted-foreground text-sm">{exam.subject}</p>}
            {exam.totalMarks != null && (
              <p className="text-muted-foreground mt-1 text-xs">{exam.totalMarks} marks total</p>
            )}
          </div>
          {released ? (
            <Badge variant="default">Results ready</Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Lock className="h-3 w-3" />
              Read-only
            </Badge>
          )}
        </div>

        {!submission ? (
          <p className="text-muted-foreground mt-4 text-sm">
            Review the question paper and rubrics below. Your teacher will release results once
            grading is complete.
          </p>
        ) : !released ? (
          <p className="text-muted-foreground mt-4 text-sm">
            Your submission is being graded. Results will appear here once your teacher releases
            them.
          </p>
        ) : (
          <div className="mt-4">
            <Button asChild size="sm">
              <Link to={`/exams/${examId}/results`}>View your results</Link>
            </Button>
          </div>
        )}
      </div>

      {exam.questionPaper?.images && exam.questionPaper.images.length > 0 && (
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
      ) : (
        <div className="bg-muted/50 text-muted-foreground rounded-lg border p-6 text-center">
          <FileText className="text-muted-foreground/50 mx-auto mb-2 h-8 w-8" />
          <p className="text-sm">No structured questions for this exam yet.</p>
        </div>
      )}

      <Button variant="outline" asChild>
        <Link to="/exams">
          <ChevronLeft className="mr-1 inline h-4 w-4" />
          Back to Exams
        </Link>
      </Button>
    </div>
  );
}
