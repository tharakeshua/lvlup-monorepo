import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  useExam,
  useSubmissions,
  useSubmission,
  useExamQuestions,
  useQuestionSubmissions,
  useGradeManual,
  useAiGradeQuestion,
} from "@levelup/query";
import { useAuthSession } from "../../sdk/session";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { getFirebaseServices } from "@levelup/shared-services";
import type {
  Exam,
  Submission,
  QuestionSubmission,
  ExamQuestion,
  QuestionGradingStatus,
  SubmissionPipelineStatus,
} from "@levelup/shared-types";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Save,
  ThumbsUp,
  AlertTriangle,
  Loader2,
  Eye,
  Filter,
  Check,
  RotateCcw,
  Clock,
  History,
  Trophy,
  Star,
  Info,
  Keyboard,
  BookOpen,
  Sparkles,
  ImageOff,
  FileImage,
} from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@levelup/shared-ui";
import { toast } from "sonner";

/** Normalize a query hook result (bare array | PageResponse | infinite query) → array. */
function asArray<T>(d: unknown): T[] {
  if (Array.isArray(d)) return d as T[];
  if (d && typeof d === "object") {
    const o = d as { items?: T[]; pages?: { items?: T[] }[] };
    if (Array.isArray(o.items)) return o.items;
    if (Array.isArray(o.pages)) return o.pages.flatMap((p) => p.items ?? []);
  }
  return [];
}

export default function GradingReviewPage() {
  const { examId, submissionId } = useParams<{
    examId: string;
    submissionId: string;
  }>();
  const navigate = useNavigate();
  // firebaseUser is kept only as a signed-in guard; grading mutations carry auth
  // server-side via claims (no tenantId/uid args).
  const firebaseUser = useAuthSession((s) => s.firebaseUser);
  const { data: examData } = useExam(examId ?? "");
  const exam = examData as Exam | undefined;
  const { data: allSubmissionsData } = useSubmissions({ examId });
  const allSubmissions = useMemo(
    () => asArray<Submission>(allSubmissionsData),
    [allSubmissionsData]
  );

  // Reads via @levelup/query (claims-scoped). Local state is seeded from these so
  // the existing optimistic-update + bulk-approve flows keep working.
  const {
    data: submissionData,
    isLoading: submissionLoading,
    refetch: refetchSubmission,
  } = useSubmission(submissionId ?? "");
  const { data: questionsData } = useExamQuestions(examId ?? "");
  const { data: questionSubsData, refetch: refetchQuestionSubs } = useQuestionSubmissions(
    submissionId ?? ""
  );
  const gradeManual = useGradeManual();
  const aiGradeQuestion = useAiGradeQuestion();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [questionSubs, setQuestionSubs] = useState<QuestionSubmission[]>([]);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { score: number; reason: string }>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "needs_review" | "low_confidence">(
    "all"
  );
  const [showBulkApproveConfirm, setShowBulkApproveConfirm] = useState(false);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  const [gradingQuestionId, setGradingQuestionId] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [imageUrlMap, setImageUrlMap] = useState<Record<string, string>>({});

  // Next/prev navigation
  const currentIdx = allSubmissions.findIndex((s) => s.id === submissionId);
  const prevSub = currentIdx > 0 ? allSubmissions[currentIdx - 1] : null;
  const nextSub = currentIdx < allSubmissions.length - 1 ? allSubmissions[currentIdx + 1] : null;

  // Seed local question state from the query (exam questions don't change during grading).
  useEffect(() => {
    setQuestions(asArray<ExamQuestion>(questionsData));
  }, [questionsData]);

  // Seed submission from the query read. (Was a Firestore onSnapshot; the SDK read
  // is invalidated/refetched after each grading mutation below.)
  useEffect(() => {
    if (submissionData) setSubmission(submissionData as Submission);
    if (!submissionLoading) setLoading(false);
  }, [submissionData, submissionLoading]);

  // Seed per-question grading results from the query read.
  useEffect(() => {
    setQuestionSubs(asArray<QuestionSubmission>(questionSubsData));
  }, [questionSubsData]);

  // mapping.imageUrls historically holds Storage paths, not HTTPS URLs.
  // Resolve every unique path once via getDownloadURL so <img> can render them.
  const allImagePaths = useMemo(() => {
    const set = new Set<string>();
    for (const qs of questionSubs) {
      qs.mapping?.imageUrls?.forEach((p) => p && set.add(p));
    }
    return Array.from(set);
  }, [questionSubs]);

  useEffect(() => {
    if (allImagePaths.length === 0) return;
    const { storage } = getFirebaseServices();
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        allImagePaths.map(async (p) => {
          if (imageUrlMap[p] !== undefined) return;
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
        setImageUrlMap((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allImagePaths, imageUrlMap]);

  const resolveImage = useCallback(
    (path: string | undefined): string | null => {
      if (!path) return null;
      if (/^https?:\/\//.test(path)) return path;
      const url = imageUrlMap[path];
      if (url === undefined) return null;
      return url;
    },
    [imageUrlMap]
  );

  const handleOverride = async (questionSubId: string) => {
    const override = overrides[questionSubId];
    if (!override || !override.reason.trim() || !submissionId || !firebaseUser) return;
    const qs = questionSubs.find((q) => q.id === questionSubId);
    const question = questions.find((q) => q.id === qs?.questionId);
    const maxMarks = question?.maxMarks ?? 0;
    if (override.score < 0 || override.score > maxMarks) return;
    setSaving(true);
    setGradeError(null);
    try {
      // useGradeManual → v1.autograde.gradeQuestion(mode:'manual'); the server
      // recomputes submission.summary, then we refetch the affected reads.
      await gradeManual.mutateAsync({
        submissionId,
        questionId: qs!.questionId,
        score: override.score,
        feedback: override.reason.trim(),
      });
      await Promise.all([refetchSubmission(), refetchQuestionSubs()]);
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[questionSubId];
        return next;
      });
      toast.success("Override saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Override failed";
      setGradeError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAiGrade = useCallback(
    async (questionSubId: string) => {
      if (!submissionId) return;
      const qs = questionSubs.find((q) => q.id === questionSubId);
      if (!qs) return;
      if (!qs.mapping?.imageUrls?.length) {
        setGradeError("No answer-sheet pages mapped to this question. Re-run scouting first.");
        return;
      }
      setGradingQuestionId(questionSubId);
      setGradeError(null);
      try {
        await aiGradeQuestion.mutateAsync({ submissionId, questionId: qs.questionId });
        await Promise.all([refetchSubmission(), refetchQuestionSubs()]);
      } catch (err) {
        setGradeError(err instanceof Error ? err.message : "AI grading failed");
      } finally {
        setGradingQuestionId(null);
      }
    },
    [submissionId, questionSubs, aiGradeQuestion, refetchSubmission, refetchQuestionSubs]
  );

  const pendingQuestionCount = questionSubs.filter(
    (qs) => qs.gradingStatus === "pending" || qs.gradingStatus === "processing"
  ).length;

  const handleGradeAllPending = useCallback(async () => {
    if (!submissionId) return;
    const pending = questionSubs.filter(
      (qs) => qs.gradingStatus === "pending" || qs.gradingStatus === "failed"
    );
    if (pending.length === 0) return;
    setGradeError(null);
    for (const qs of pending) {
      setGradingQuestionId(qs.id);
      try {
        await aiGradeQuestion.mutateAsync({ submissionId, questionId: qs.questionId });
      } catch (err) {
        setGradeError(err instanceof Error ? err.message : `Grading Q${qs.questionId} failed`);
        break;
      }
    }
    await Promise.all([refetchSubmission(), refetchQuestionSubs()]);
    setGradingQuestionId(null);
  }, [submissionId, questionSubs, aiGradeQuestion, refetchSubmission, refetchQuestionSubs]);

  // PARITY NOTE: @levelup/query has no single "bulk approve" callable. We compose
  // it as one authoritative manual-grade (v1.autograde.gradeQuestion mode:'manual')
  // per graded question — the server then advances the submission's pipeline
  // status and recomputes the summary. After the batch we refetch the SDK reads.
  const handleBulkApprove = async () => {
    if (!submissionId || !firebaseUser) return;
    const prevSubs = questionSubs;
    const prevSubmission = submission;
    setSaving(true);
    try {
      let approvedCount = 0;
      for (const qs of questionSubs) {
        if (qs.gradingStatus !== "graded") continue;
        const question = questions.find((q) => q.id === qs.questionId);
        const maxMarks = question?.maxMarks ?? 0;
        const aiScore = qs.evaluation?.score ?? 0;
        if (aiScore < 0 || aiScore > maxMarks) {
          toast.warning(
            `Skipped Q${question?.order ?? qs.questionId}: score ${aiScore} out of [0, ${maxMarks}]`
          );
          continue;
        }
        await gradeManual.mutateAsync({
          submissionId,
          questionId: qs.questionId,
          score: aiScore,
          feedback: "Bulk approved",
        });
        approvedCount += 1;
      }

      // Optimistic local reflection; refetch reconciles with the server.
      setSubmission((prev) =>
        prev ? { ...prev, pipelineStatus: "reviewed" as SubmissionPipelineStatus } : null
      );
      setQuestionSubs((prev) =>
        prev.map((q) =>
          q.gradingStatus === "graded"
            ? { ...q, gradingStatus: "manual" as QuestionGradingStatus }
            : q
        )
      );
      await Promise.all([refetchSubmission(), refetchQuestionSubs()]);
      toast.success(`Approved ${approvedCount} questions`);
    } catch (err) {
      setQuestionSubs(prevSubs);
      setSubmission(prevSubmission);
      toast.error(err instanceof Error ? err.message : "Bulk approve failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptGrade = useCallback(
    async (questionSubId: string) => {
      if (!submissionId || !firebaseUser) return;
      const qs = questionSubs.find((q) => q.id === questionSubId);
      const score = qs?.evaluation?.score;
      if (!qs || score === undefined) {
        toast.error("No AI grade to accept");
        return;
      }
      const feedback = qs.evaluation?.feedback ?? "Accepted AI grade";
      setSaving(true);
      try {
        await gradeManual.mutateAsync({
          submissionId,
          questionId: qs.questionId,
          score,
          feedback,
        });
        await Promise.all([refetchSubmission(), refetchQuestionSubs()]);
        toast.success("AI grade accepted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to accept grade");
      } finally {
        setSaving(false);
      }
    },
    [submissionId, firebaseUser, questionSubs, gradeManual, refetchSubmission, refetchQuestionSubs]
  );

  // Filter and sort questions based on review filter — prioritize review-needing items
  const filteredQuestions = questions
    .filter((q) => {
      if (reviewFilter === "all") return true;
      const qs = questionSubs.find((s) => s.questionId === q.id);
      if (!qs) return false;
      if (reviewFilter === "needs_review") {
        return (
          qs.gradingStatus === "needs_review" ||
          (qs as QuestionSubmission & { reviewSuggested?: boolean }).reviewSuggested
        );
      }
      if (reviewFilter === "low_confidence") {
        return qs.evaluation?.confidence != null && qs.evaluation.confidence < 0.7;
      }
      return true;
    })
    .sort((a, b) => {
      const qsA = questionSubs.find((s) => s.questionId === a.id);
      const qsB = questionSubs.find((s) => s.questionId === b.id);
      // Needs review first
      const aReview =
        qsA?.gradingStatus === "needs_review" ||
        (qsA as QuestionSubmission & { reviewSuggested?: boolean })?.reviewSuggested
          ? 1
          : 0;
      const bReview =
        qsB?.gradingStatus === "needs_review" ||
        (qsB as QuestionSubmission & { reviewSuggested?: boolean })?.reviewSuggested
          ? 1
          : 0;
      if (aReview !== bReview) return bReview - aReview;
      // Then by confidence (low first)
      const confA = qsA?.evaluation?.confidence ?? 1;
      const confB = qsB?.evaluation?.confidence ?? 1;
      return confA - confB;
    });

  // Count questions needing review
  const needsReviewCount = questionSubs.filter(
    (qs) =>
      qs.gradingStatus === "needs_review" ||
      (qs as QuestionSubmission & { reviewSuggested?: boolean }).reviewSuggested
  ).length;

  // Keyboard navigation (Task 5.1)
  const handleKeyNav = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const currentIdx = filteredQuestions.findIndex((q) => q.id === expandedQ);

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          const nextIdx = currentIdx < filteredQuestions.length - 1 ? currentIdx + 1 : 0;
          setExpandedQ(filteredQuestions[nextIdx]?.id ?? null);
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : filteredQuestions.length - 1;
          setExpandedQ(filteredQuestions[prevIdx]?.id ?? null);
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (expandedQ) {
            setExpandedQ(null);
          } else if (filteredQuestions.length > 0) {
            setExpandedQ(filteredQuestions[0].id);
          }
          break;
        }
        case "a": {
          // Accept AI grade for current question
          if (!expandedQ) return;
          const qs = questionSubs.find((s) => s.questionId === expandedQ);
          if (
            qs &&
            (qs.gradingStatus === "needs_review" || qs.gradingStatus === "graded") &&
            !qs.manualOverride &&
            qs.evaluation
          ) {
            handleAcceptGrade(qs.id);
          }
          break;
        }
        case "o": {
          // Focus override input for current question
          if (!expandedQ) return;
          const overrideInput = document.querySelector<HTMLInputElement>(
            `[data-override-input="${expandedQ}"]`
          );
          if (overrideInput) overrideInput.focus();
          break;
        }
        case "?": {
          setShowKeyboardHints((prev) => !prev);
          break;
        }
      }
    },
    [expandedQ, filteredQuestions, questionSubs, handleAcceptGrade]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Submission not found</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/exams">Exams</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/exams/${examId}`}>{exam?.title ?? "Exam"}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/exams/${examId}/submissions`}>Submissions</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{submission.studentName ?? "Review"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/exams/${examId}/submissions`)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-xl font-semibold">
              Grading Review — {submission.studentName}
            </h1>
            <p className="text-muted-foreground text-sm">
              Roll: {submission.rollNumber} &middot; Pipeline:{" "}
              {submission.pipelineStatus.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Next/Prev Navigation (Phase 3.2) */}
          <Button
            variant="outline"
            size="sm"
            disabled={!prevSub}
            onClick={() => prevSub && navigate(`/exams/${examId}/submissions/${prevSub.id}`)}
          >
            <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Previous</span>
          </Button>
          {allSubmissions.length > 0 && (
            <span className="text-muted-foreground whitespace-nowrap font-mono text-xs">
              {currentIdx + 1} of {allSubmissions.length}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!nextSub}
            onClick={() => nextSub && navigate(`/exams/${examId}/submissions/${nextSub.id}`)}
          >
            <span className="hidden sm:inline">Next</span> <ChevronRight className="h-4 w-4" />
          </Button>
          {pendingQuestionCount > 0 && (
            <Button
              onClick={handleGradeAllPending}
              disabled={!!gradingQuestionId}
              size="sm"
              className="bg-brand text-fg-on-accent hover:bg-brand-hover"
            >
              {gradingQuestionId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Grading {pendingQuestionCount}…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Grade {pendingQuestionCount} Pending
                </>
              )}
            </Button>
          )}
          {submission.pipelineStatus !== "reviewed" && (
            <Button
              onClick={() => setShowBulkApproveConfirm(true)}
              disabled={saving}
              size="sm"
              className="bg-success text-fg-on-accent hover:bg-success/90"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
              Approve All
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="font-mono text-2xl font-bold">{submission.summary?.totalScore ?? 0}</p>
            <p className="text-muted-foreground text-xs">
              / {submission.summary?.maxScore ?? exam?.totalMarks ?? 0} Score
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="font-mono text-2xl font-bold">
              {submission.summary?.percentage != null
                ? `${Math.round(submission.summary.percentage)}%`
                : "-"}
            </p>
            <p className="text-muted-foreground text-xs">Percentage</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{submission.summary?.grade || "-"}</p>
            <p className="text-muted-foreground text-xs">Grade</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="font-mono text-2xl font-bold">
              {submission.summary?.questionsGraded ?? 0}/
              {submission.summary?.totalQuestions ?? questions.length}
            </p>
            <p className="text-muted-foreground text-xs">Questions Graded</p>
          </CardContent>
        </Card>
      </div>

      {/* High Score Celebration (Task 4.4) */}
      {submission.summary?.percentage != null && submission.summary.percentage >= 90 && (
        <div className="border-spark/30 bg-spark-subtle flex items-center gap-3 rounded-lg border p-4">
          <Trophy className="text-spark h-6 w-6 shrink-0" />
          <div className="flex-1">
            <p className="text-fg text-sm font-semibold">Outstanding Performance!</p>
            <p className="text-fg-secondary text-xs">
              {submission.studentName} scored {Math.round(submission.summary.percentage)}% —{" "}
              {submission.summary.grade} grade
            </p>
          </div>
          <Star className="text-spark h-5 w-5" />
        </div>
      )}

      {/* Per-Question Review */}
      <div className="space-y-3">
        {/* Keyboard shortcuts hint */}
        {showKeyboardHints && (
          <div className="bg-muted/50 space-y-1 rounded-lg border p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Keyboard className="h-3.5 w-3.5" /> Keyboard Shortcuts
            </div>
            <div className="text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3">
              <span>
                <kbd className="rounded border px-1 font-mono text-[10px]">j</kbd> /{" "}
                <kbd className="rounded border px-1 font-mono text-[10px]">↓</kbd> Next question
              </span>
              <span>
                <kbd className="rounded border px-1 font-mono text-[10px]">k</kbd> /{" "}
                <kbd className="rounded border px-1 font-mono text-[10px]">↑</kbd> Previous question
              </span>
              <span>
                <kbd className="rounded border px-1 font-mono text-[10px]">Enter</kbd>{" "}
                Expand/collapse
              </span>
              <span>
                <kbd className="rounded border px-1 font-mono text-[10px]">a</kbd> Accept AI grade
              </span>
              <span>
                <kbd className="rounded border px-1 font-mono text-[10px]">o</kbd> Focus override
                input
              </span>
              <span>
                <kbd className="rounded border px-1 font-mono text-[10px]">?</kbd> Toggle this help
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Per-Question Review</h2>
            <button
              onClick={() => setShowKeyboardHints((prev) => !prev)}
              className="text-muted-foreground hover:text-foreground shrink-0"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {needsReviewCount > 0 && (
              <span className="text-warning text-xs font-medium">
                {needsReviewCount} need{needsReviewCount === 1 ? "s" : ""} review
              </span>
            )}
            <div className="border-subtle flex flex-wrap items-center gap-0.5 rounded-lg border p-0.5">
              <button
                onClick={() => setReviewFilter("all")}
                className={`duration-fast ease-standard rounded-md px-2.5 py-1 text-xs transition-colors ${reviewFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                All ({questions.length})
              </button>
              <button
                onClick={() => setReviewFilter("needs_review")}
                className={`duration-fast ease-standard flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${reviewFilter === "needs_review" ? "bg-warning text-fg-on-accent" : "hover:bg-muted"}`}
              >
                <Eye className="h-3 w-3" /> Review
              </button>
              <button
                onClick={() => setReviewFilter("low_confidence")}
                className={`duration-fast ease-standard flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${reviewFilter === "low_confidence" ? "bg-confidence-low text-fg-on-accent" : "hover:bg-muted"}`}
              >
                <Filter className="h-3 w-3" /> Low Confidence
              </button>
            </div>
          </div>
        </div>
        {filteredQuestions.length === 0 && reviewFilter !== "all" && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">No questions match the selected filter.</p>
          </div>
        )}
        {filteredQuestions.map((q) => {
          const qs = questionSubs.find((s) => s.questionId === q.id);
          const isExpanded = expandedQ === q.id;
          const eval_ = qs?.evaluation;
          const override = overrides[qs?.id ?? ""];
          const confidence = eval_?.confidence;
          const isReviewSuggested = (qs as QuestionSubmission & { reviewSuggested?: boolean })
            ?.reviewSuggested;

          return (
            <Card key={q.id}>
              <button
                onClick={() => setExpandedQ((prev) => (prev === q.id ? null : q.id))}
                className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left"
                aria-label="Toggle details"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <span className="text-muted-foreground shrink-0 font-mono text-sm font-bold">
                  Q{q.order}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{q.text}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Confidence badge */}
                  {confidence != null && (
                    <span
                      className={`rounded-pill inline-flex items-center px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                        confidence >= 0.9
                          ? "bg-confidence-high/15 text-confidence-high"
                          : confidence >= 0.7
                            ? "bg-confidence-med/15 text-confidence-med"
                            : "bg-confidence-low/15 text-confidence-low"
                      }`}
                    >
                      {Math.round(confidence * 100)}%
                    </span>
                  )}
                  {/* Status icon */}
                  {qs?.gradingStatus === "graded" && !isReviewSuggested && (
                    <CheckCircle2 className="text-success h-4 w-4" />
                  )}
                  {qs?.gradingStatus === "graded" && isReviewSuggested && (
                    <Eye className="text-warning h-4 w-4" />
                  )}
                  {qs?.gradingStatus === "needs_review" && <Eye className="text-warning h-4 w-4" />}
                  {qs?.gradingStatus === "failed" && <XCircle className="text-error h-4 w-4" />}
                  {qs?.gradingStatus === "overridden" && (
                    <AlertTriangle className="text-warning h-4 w-4" />
                  )}
                  {qs?.gradingStatus === "manual" && <Check className="text-info h-4 w-4" />}
                  {(qs?.gradingStatus === "pending" ||
                    qs?.gradingStatus === "processing" ||
                    gradingQuestionId === qs?.id) && (
                    <Loader2 className="text-info h-4 w-4 animate-spin" />
                  )}
                  <span className="font-mono text-sm font-semibold">
                    {qs?.manualOverride ? qs.manualOverride.score : (eval_?.score ?? "-")}/
                    {q.maxMarks}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-subtle space-y-4 border-t px-4 py-4">
                  {/* Original Question Text (Task 1.3) */}
                  <details className="bg-muted/30 border-subtle group rounded border">
                    <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium">
                      <BookOpen className="h-3.5 w-3.5" />
                      Question — {q.maxMarks} marks
                      {q.rubric?.criteria && (
                        <span className="ml-auto text-[10px]">
                          {q.rubric.criteria.length} criteria
                        </span>
                      )}
                    </summary>
                    <div className="space-y-2 px-3 pb-3">
                      <p className="text-sm">{q.text}</p>
                      {q.rubric?.criteria && q.rubric.criteria.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-muted-foreground tracking-caps text-[10px] font-medium uppercase">
                            Rubric Criteria
                          </p>
                          {q.rubric.criteria.map((c, ci) => (
                            <div
                              key={ci}
                              className="text-muted-foreground flex items-center justify-between text-xs"
                            >
                              <span>{c.name}</span>
                              <span className="font-mono font-medium">{c.maxPoints} pts</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>

                  {/* Side-by-side layout: Answer image on left, AI evaluation on right (Task 4.2) */}
                  <div className="grid gap-4 lg:grid-cols-2">
                    {/* LEFT: Student Answer Images */}
                    <div className="space-y-3">
                      {qs?.mapping?.imageUrls && qs.mapping.imageUrls.length > 0 ? (
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-muted-foreground text-xs font-medium">
                              Student Answer
                            </p>
                            {qs.mapping.pageIndices?.length ? (
                              <span className="rounded-pill bg-info-subtle text-info inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium">
                                <FileImage className="h-3 w-3" />
                                {qs.mapping.pageIndices.length === 1
                                  ? `Page ${qs.mapping.pageIndices[0] + 1}`
                                  : `Pages ${qs.mapping.pageIndices.map((i) => i + 1).join(", ")}`}
                              </span>
                            ) : null}
                          </div>
                          <div className="space-y-2">
                            {qs.mapping.imageUrls.map((path, idx) => {
                              const url = resolveImage(path);
                              if (url === null) {
                                return (
                                  <div
                                    key={idx}
                                    className="bg-muted/40 flex h-48 w-full items-center justify-center rounded border"
                                  >
                                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                                  </div>
                                );
                              }
                              if (url === "") {
                                return (
                                  <div
                                    key={idx}
                                    className="bg-muted/40 flex w-full flex-col items-center gap-2 rounded border border-dashed p-6 text-center"
                                  >
                                    <ImageOff className="text-muted-foreground h-5 w-5" />
                                    <p className="text-muted-foreground break-all text-[10px]">
                                      Image unavailable
                                    </p>
                                  </div>
                                );
                              }
                              return (
                                <img
                                  key={idx}
                                  src={url}
                                  alt={`Answer page ${idx + 1}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="hover:ring-primary w-full cursor-pointer rounded border object-contain hover:ring-2"
                                  onClick={() => setLightboxUrl(url)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : qs ? (
                        <div className="border-warning/40 bg-warning-subtle space-y-1 rounded border border-dashed p-4 text-center">
                          <ImageOff className="text-warning mx-auto h-5 w-5" />
                          <p className="text-warning text-xs font-medium">
                            No pages mapped to this question
                          </p>
                          <p className="text-warning text-[10px]">
                            Scouting did not find a student response. Re-run scouting or grade
                            manually below.
                          </p>
                        </div>
                      ) : null}

                      {/* Grading error context (Task 3.1) */}
                      {qs &&
                        (qs as QuestionSubmission & { gradingError?: string }).gradingError && (
                          <div className="border-error/30 bg-error-subtle space-y-1.5 rounded border p-3">
                            <div className="flex items-center gap-2">
                              <Info className="text-error h-3.5 w-3.5" />
                              <p className="text-error text-xs font-medium">Grading Error</p>
                            </div>
                            <p className="text-error text-xs">
                              {(qs as QuestionSubmission & { gradingError?: string }).gradingError}
                            </p>
                            {(qs.gradingRetryCount ?? 0) > 0 && (
                              <p className="text-error/70 text-[10px]">
                                {(qs.gradingRetryCount ?? 0) >= 3
                                  ? `Retry limit reached (${qs.gradingRetryCount} attempts)`
                                  : `Retried ${qs.gradingRetryCount} time${qs.gradingRetryCount === 1 ? "" : "s"}`}
                              </p>
                            )}
                          </div>
                        )}
                    </div>

                    {/* RIGHT: AI Evaluation */}
                    <div className="space-y-3">
                      {eval_ && (
                        <>
                          {/* Score + Confidence visual (Task 4.3) */}
                          <div className="border-subtle space-y-2 rounded border p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-muted-foreground text-xs font-medium">Score</p>
                                <p className="font-mono text-lg font-bold">
                                  {eval_.score}/{eval_.maxScore}
                                </p>
                              </div>
                              {eval_.mistakeClassification &&
                                eval_.mistakeClassification !== "None" && (
                                  <span className="rounded-full border px-2 py-0.5 text-xs">
                                    {eval_.mistakeClassification}
                                  </span>
                                )}
                            </div>
                            {/* Confidence bar with color coding */}
                            <div>
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-muted-foreground text-[10px]">
                                  AI Confidence
                                </span>
                                <span
                                  className={`text-[10px] font-medium ${
                                    confidence != null && confidence >= 0.9
                                      ? "text-confidence-high"
                                      : confidence != null && confidence >= 0.7
                                        ? "text-confidence-med"
                                        : "text-confidence-low"
                                  }`}
                                >
                                  {confidence != null
                                    ? confidence >= 0.9
                                      ? "High Confidence"
                                      : confidence >= 0.7
                                        ? "Medium — Review Suggested"
                                        : "Low — Review Recommended"
                                    : "Unknown"}
                                </span>
                              </div>
                              <div className="bg-muted h-2 overflow-hidden rounded-full">
                                <div
                                  className={`duration-base ease-standard h-full rounded-full transition-all ${
                                    confidence != null && confidence >= 0.9
                                      ? "bg-confidence-high"
                                      : confidence != null && confidence >= 0.7
                                        ? "bg-confidence-med"
                                        : "bg-confidence-low"
                                  }`}
                                  style={{ width: `${Math.round((confidence ?? 0) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Strengths & Weaknesses */}
                          <div className="grid gap-3 sm:grid-cols-2">
                            {eval_.strengths.length > 0 && (
                              <div>
                                <p className="text-success mb-1 text-xs font-medium">Strengths</p>
                                <ul className="space-y-1">
                                  {eval_.strengths.map((s, idx) => (
                                    <li key={idx} className="text-muted-foreground text-xs">
                                      + {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {eval_.weaknesses.length > 0 && (
                              <div>
                                <p className="text-error mb-1 text-xs font-medium">Weaknesses</p>
                                <ul className="space-y-1">
                                  {eval_.weaknesses.map((w, idx) => (
                                    <li key={idx} className="text-muted-foreground text-xs">
                                      - {w}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Rubric breakdown */}
                          {eval_.rubricBreakdown && eval_.rubricBreakdown.length > 0 && (
                            <div>
                              <p className="text-muted-foreground mb-2 text-xs font-medium">
                                Rubric Breakdown
                              </p>
                              <div className="space-y-1">
                                {eval_.rubricBreakdown.map((rb, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start justify-between gap-3 text-xs"
                                  >
                                    <span className="min-w-0 flex-1 break-words">
                                      {rb.criterionName}
                                    </span>
                                    <span className="shrink-0 font-mono font-medium">
                                      {rb.score}/{rb.maxScore}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Summary */}
                          {eval_.summary && (
                            <div className="bg-muted rounded p-3">
                              <p className="mb-1 text-xs font-medium">
                                {eval_.summary.keyTakeaway}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {eval_.summary.overallComment}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Override Audit Trail Timeline (Task 3.2) */}
                  {qs?.manualOverride && (
                    <div className="bg-warning-subtle space-y-3 rounded p-3">
                      <div className="flex items-center gap-2">
                        <History className="text-warning h-3.5 w-3.5" />
                        <p className="text-warning text-xs font-medium">Override Audit Trail</p>
                      </div>
                      {/* Timeline */}
                      <div className="border-warning/30 relative space-y-3 border-l-2 pl-4">
                        {/* Step 1: AI Grading */}
                        <div className="relative">
                          <div className="bg-muted-foreground/40 absolute -left-[1.3rem] top-0.5 h-2.5 w-2.5 rounded-full" />
                          <p className="text-muted-foreground text-[10px] font-medium">AI Graded</p>
                          <p className="text-xs">
                            Score:{" "}
                            <span className="font-mono font-medium">
                              {qs.manualOverride.originalScore}/{q.maxMarks}
                            </span>
                            {eval_?.confidence != null && (
                              <span className="text-muted-foreground">
                                {" "}
                                (Confidence: {Math.round(eval_.confidence * 100)}%)
                              </span>
                            )}
                          </p>
                          {eval_?.gradedAt && (
                            <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                              <Clock className="h-2.5 w-2.5" />
                              {typeof eval_.gradedAt === "object" && "toDate" in eval_.gradedAt
                                ? (eval_.gradedAt as { toDate: () => Date })
                                    .toDate()
                                    .toLocaleString()
                                : "AI grading completed"}
                            </p>
                          )}
                        </div>
                        {/* Step 2: Manual Override */}
                        <div className="relative">
                          <div className="bg-warning absolute -left-[1.3rem] top-0.5 h-2.5 w-2.5 rounded-full" />
                          <p className="text-warning text-[10px] font-medium">Override Applied</p>
                          <p className="text-xs">
                            Score changed:{" "}
                            <span className="font-mono line-through">
                              {qs.manualOverride.originalScore}
                            </span>{" "}
                            →{" "}
                            <span className="font-mono font-semibold">
                              {qs.manualOverride.score}/{q.maxMarks}
                            </span>
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Reason: {qs.manualOverride.reason}
                          </p>
                          {qs.manualOverride.overriddenAt && (
                            <p className="text-warning/70 flex items-center gap-1 text-[10px]">
                              <Clock className="h-2.5 w-2.5" />
                              {typeof qs.manualOverride.overriddenAt === "object" &&
                              "toDate" in qs.manualOverride.overriddenAt
                                ? (qs.manualOverride.overriddenAt as { toDate: () => Date })
                                    .toDate()
                                    .toLocaleString()
                                : "Recently"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {qs && (
                      <Button
                        onClick={() => handleAiGrade(qs.id)}
                        disabled={
                          gradingQuestionId === qs.id ||
                          !qs.mapping?.imageUrls?.length ||
                          qs.gradingStatus === "processing"
                        }
                        size="sm"
                        className="bg-brand text-fg-on-accent hover:bg-brand-hover gap-1.5"
                      >
                        {gradingQuestionId === qs.id || qs.gradingStatus === "processing" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" /> Grading...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            {qs.evaluation ? "Re-grade with AI" : "Grade with AI"}
                          </>
                        )}
                      </Button>
                    )}

                    {/* Accept AI Grade button */}
                    {qs &&
                      (qs.gradingStatus === "needs_review" || qs.gradingStatus === "graded") &&
                      !qs.manualOverride &&
                      qs.evaluation && (
                        <Button
                          onClick={() => handleAcceptGrade(qs.id)}
                          disabled={saving || gradingQuestionId === qs.id}
                          size="sm"
                          variant="outline"
                          className="border-success text-success hover:bg-success-subtle"
                        >
                          <Check className="h-3 w-3" /> Accept AI Grade ({eval_?.score}/{q.maxMarks}
                          )
                        </Button>
                      )}

                    {qs &&
                      qs.gradingStatus === "failed" &&
                      !qs.manualOverride &&
                      (qs.gradingRetryCount ?? 0) >= 3 && (
                        <span className="text-error inline-flex items-center gap-1 text-xs">
                          <RotateCcw className="h-3 w-3" /> Retry limit reached — use manual
                          override
                        </span>
                      )}
                  </div>

                  {gradeError && expandedQ === q.id && (
                    <div className="border-error/30 bg-error-subtle text-error flex items-start gap-2 rounded border p-2 text-xs">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{gradeError}</span>
                    </div>
                  )}

                  {/* Override form */}
                  {qs && !qs.manualOverride && (
                    <div className="border-subtle space-y-2 rounded border p-3">
                      <p className="text-xs font-medium">Manual Override</p>
                      <div className="flex items-center gap-2">
                        <Input
                          data-override-input={q.id}
                          type="number"
                          value={override?.score ?? eval_?.score ?? 0}
                          onChange={(e) =>
                            setOverrides((prev) => ({
                              ...prev,
                              [qs.id]: {
                                ...prev[qs.id],
                                score: Number(e.target.value),
                                reason: prev[qs.id]?.reason ?? "",
                              },
                            }))
                          }
                          min={0}
                          max={q.maxMarks}
                          className="h-8 w-20"
                        />
                        <span className="text-muted-foreground text-xs">/ {q.maxMarks}</span>
                        <Input
                          type="text"
                          value={override?.reason ?? ""}
                          onChange={(e) =>
                            setOverrides((prev) => ({
                              ...prev,
                              [qs.id]: {
                                ...prev[qs.id],
                                score: prev[qs.id]?.score ?? eval_?.score ?? 0,
                                reason: e.target.value,
                              },
                            }))
                          }
                          placeholder="Reason for override (required)"
                          className="h-8 flex-1"
                        />
                        <Button
                          onClick={() => handleOverride(qs.id)}
                          disabled={saving || !override?.reason?.trim()}
                          size="sm"
                          className="bg-warning text-fg-on-accent hover:bg-warning/90"
                        >
                          <Save className="h-3 w-3" /> Override
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Image Lightbox Dialog (Phase 3.1) */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl p-2">
          <DialogTitle className="sr-only">Answer Image</DialogTitle>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Full answer"
              loading="eager"
              decoding="async"
              className="h-full w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Approve Confirmation Dialog */}
      <AlertDialog open={showBulkApproveConfirm} onOpenChange={setShowBulkApproveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve All AI Grades?</AlertDialogTitle>
            <AlertDialogDescription>
              This will accept all AI-graded answers for this submission.
              {needsReviewCount > 0 && (
                <span className="text-warning mt-2 block font-medium">
                  {needsReviewCount} question{needsReviewCount === 1 ? "" : "s"} still need
                  {needsReviewCount === 1 ? "s" : ""} review.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowBulkApproveConfirm(false);
                handleBulkApprove();
              }}
              className="bg-success text-fg-on-accent hover:bg-success/90"
            >
              Approve All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
