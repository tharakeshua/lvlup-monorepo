import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCurrentTenantId, useAuthStore } from "@levelup/shared-stores";
import { useExam, useSubmissions } from "@levelup/shared-hooks";
import {
  doc,
  getDocs,
  collection,
  query,
  orderBy,
  updateDoc,
  serverTimestamp,
  writeBatch,
  onSnapshot,
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { getFirebaseServices, callGradeQuestion } from "@levelup/shared-services";
import type {
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

export default function GradingReviewPage() {
  const { examId, submissionId } = useParams<{
    examId: string;
    submissionId: string;
  }>();
  const navigate = useNavigate();
  const tenantId = useCurrentTenantId();
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const { data: exam } = useExam(tenantId, examId ?? null);
  const { data: allSubmissions = [] } = useSubmissions(tenantId, { examId });

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

  // Exam questions don't change during grading — fetch once.
  useEffect(() => {
    if (!tenantId || !examId) return;
    const { db } = getFirebaseServices();
    (async () => {
      const qSnap = await getDocs(
        query(
          collection(db, `tenants/${tenantId}/exams/${examId}/questions`),
          orderBy("order", "asc")
        )
      );
      setQuestions(qSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExamQuestion));
    })();
  }, [tenantId, examId]);

  // Live submission listener — pipelineStatus, summary, scoutingResult.
  useEffect(() => {
    if (!tenantId || !submissionId) return;
    const { db } = getFirebaseServices();
    const unsub = onSnapshot(
      doc(db, `tenants/${tenantId}/submissions`, submissionId),
      (snap) => {
        if (snap.exists()) {
          setSubmission({ id: snap.id, ...snap.data() } as Submission);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [tenantId, submissionId]);

  // Live questionSubmissions listener — picks up grading progress per question.
  useEffect(() => {
    if (!tenantId || !submissionId) return;
    const { db } = getFirebaseServices();
    const unsub = onSnapshot(
      collection(db, `tenants/${tenantId}/submissions/${submissionId}/questionSubmissions`),
      (snap) => {
        setQuestionSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as QuestionSubmission));
      }
    );
    return () => unsub();
  }, [tenantId, submissionId]);

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
    if (!override || !override.reason.trim() || !tenantId || !submissionId || !firebaseUser) return;
    const qs = questionSubs.find((q) => q.id === questionSubId);
    const question = questions.find((q) => q.id === qs?.questionId);
    const maxMarks = question?.maxMarks ?? 0;
    if (override.score < 0 || override.score > maxMarks) return;
    setSaving(true);
    setGradeError(null);
    try {
      // Use the callable so the server recomputes submission.summary in a transaction.
      await callGradeQuestion({
        tenantId,
        submissionId,
        examId: examId ?? undefined,
        questionId: qs!.questionId,
        score: override.score,
        feedback: override.reason.trim(),
        mode: "manual",
      });
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[questionSubId];
        return next;
      });
    } catch (err) {
      setGradeError(err instanceof Error ? err.message : "Override failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAiGrade = useCallback(
    async (questionSubId: string) => {
      if (!tenantId || !submissionId || !examId) return;
      const qs = questionSubs.find((q) => q.id === questionSubId);
      if (!qs) return;
      if (!qs.mapping?.imageUrls?.length) {
        setGradeError("No answer-sheet pages mapped to this question. Re-run scouting first.");
        return;
      }
      setGradingQuestionId(questionSubId);
      setGradeError(null);
      try {
        await callGradeQuestion({
          tenantId,
          submissionId,
          examId,
          questionId: qs.questionId,
          mode: "ai",
        });
      } catch (err) {
        setGradeError(err instanceof Error ? err.message : "AI grading failed");
      } finally {
        setGradingQuestionId(null);
      }
    },
    [tenantId, submissionId, examId, questionSubs]
  );

  const pendingQuestionCount = questionSubs.filter(
    (qs) => qs.gradingStatus === "pending" || qs.gradingStatus === "processing"
  ).length;

  const handleGradeAllPending = useCallback(async () => {
    if (!tenantId || !submissionId || !examId) return;
    const pending = questionSubs.filter(
      (qs) => qs.gradingStatus === "pending" || qs.gradingStatus === "failed"
    );
    if (pending.length === 0) return;
    setGradeError(null);
    for (const qs of pending) {
      setGradingQuestionId(qs.id);
      try {
        await callGradeQuestion({
          tenantId,
          submissionId,
          examId,
          questionId: qs.questionId,
          mode: "ai",
        });
      } catch (err) {
        setGradeError(err instanceof Error ? err.message : `Grading Q${qs.questionId} failed`);
        break;
      }
    }
    setGradingQuestionId(null);
  }, [tenantId, submissionId, examId, questionSubs]);

  const handleBulkApprove = async () => {
    if (!tenantId || !submissionId || !firebaseUser) return;
    setSaving(true);
    try {
      const { db } = getFirebaseServices();
      const batch = writeBatch(db);

      for (const qs of questionSubs) {
        if (qs.gradingStatus === "graded") {
          batch.update(
            doc(db, `tenants/${tenantId}/submissions/${submissionId}/questionSubmissions`, qs.id),
            { gradingStatus: "manual", updatedAt: serverTimestamp() }
          );
        }
      }

      batch.update(doc(db, `tenants/${tenantId}/submissions`, submissionId), {
        pipelineStatus: "reviewed",
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

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
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptGrade = useCallback(
    async (questionSubId: string) => {
      if (!tenantId || !submissionId || !firebaseUser) return;
      setSaving(true);
      try {
        const { db } = getFirebaseServices();
        await updateDoc(
          doc(
            db,
            `tenants/${tenantId}/submissions/${submissionId}/questionSubmissions`,
            questionSubId
          ),
          { gradingStatus: "manual", reviewSuggested: false, updatedAt: serverTimestamp() }
        );
        setQuestionSubs((prev) =>
          prev.map((q) =>
            q.id === questionSubId ? { ...q, gradingStatus: "manual" as QuestionGradingStatus } : q
          )
        );
      } finally {
        setSaving(false);
      }
    },
    [tenantId, submissionId, firebaseUser]
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
    <div className="space-y-6">
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
            <h1 className="truncate text-xl font-bold">
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
            <span className="text-muted-foreground whitespace-nowrap text-xs">
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
              className="bg-violet-600 text-white hover:bg-violet-700"
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
              className="bg-green-600 text-white hover:bg-green-700"
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
            <p className="text-2xl font-bold">{submission.summary?.totalScore ?? 0}</p>
            <p className="text-muted-foreground text-xs">
              / {submission.summary?.maxScore ?? exam?.totalMarks ?? 0} Score
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
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
            <p className="text-2xl font-bold">
              {submission.summary?.questionsGraded ?? 0}/
              {submission.summary?.totalQuestions ?? questions.length}
            </p>
            <p className="text-muted-foreground text-xs">Questions Graded</p>
          </CardContent>
        </Card>
      </div>

      {/* High Score Celebration (Task 4.4) */}
      {submission.summary?.percentage != null && submission.summary.percentage >= 90 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 dark:border-amber-800 dark:from-amber-950/30 dark:to-yellow-950/30">
          <Trophy className="h-6 w-6 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Outstanding Performance!
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {submission.studentName} scored {Math.round(submission.summary.percentage)}% —{" "}
              {submission.summary.grade} grade
            </p>
          </div>
          <Star className="h-5 w-5 text-amber-400" />
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Per-Question Review</h2>
            <button
              onClick={() => setShowKeyboardHints((prev) => !prev)}
              className="text-muted-foreground hover:text-foreground"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {needsReviewCount > 0 && (
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {needsReviewCount} need{needsReviewCount === 1 ? "s" : ""} review
              </span>
            )}
            <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
              <button
                onClick={() => setReviewFilter("all")}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${reviewFilter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                All ({questions.length})
              </button>
              <button
                onClick={() => setReviewFilter("needs_review")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${reviewFilter === "needs_review" ? "bg-amber-500 text-white" : "hover:bg-muted"}`}
              >
                <Eye className="h-3 w-3" /> Review
              </button>
              <button
                onClick={() => setReviewFilter("low_confidence")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors ${reviewFilter === "low_confidence" ? "bg-red-500 text-white" : "hover:bg-muted"}`}
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
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                aria-label="Toggle details"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="text-muted-foreground text-sm font-bold">Q{q.order}</span>
                <span className="flex-1 truncate text-sm">{q.text}</span>
                <div className="flex items-center gap-2">
                  {/* Confidence badge */}
                  {confidence != null && (
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        confidence >= 0.9
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : confidence >= 0.7
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {Math.round(confidence * 100)}%
                    </span>
                  )}
                  {/* Status icon */}
                  {qs?.gradingStatus === "graded" && !isReviewSuggested && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {qs?.gradingStatus === "graded" && isReviewSuggested && (
                    <Eye className="h-4 w-4 text-amber-500" />
                  )}
                  {qs?.gradingStatus === "needs_review" && (
                    <Eye className="h-4 w-4 text-amber-500" />
                  )}
                  {qs?.gradingStatus === "failed" && <XCircle className="h-4 w-4 text-red-500" />}
                  {qs?.gradingStatus === "overridden" && (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  )}
                  {qs?.gradingStatus === "manual" && <Check className="h-4 w-4 text-blue-500" />}
                  {(qs?.gradingStatus === "pending" ||
                    qs?.gradingStatus === "processing" ||
                    gradingQuestionId === qs?.id) && (
                    <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                  )}
                  <span className="text-sm font-semibold">
                    {qs?.manualOverride ? qs.manualOverride.score : (eval_?.score ?? "-")}/
                    {q.maxMarks}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-4 border-t px-4 py-4">
                  {/* Original Question Text (Task 1.3) */}
                  <details className="bg-muted/30 group rounded border">
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
                          <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                            Rubric Criteria
                          </p>
                          {q.rubric.criteria.map((c, ci) => (
                            <div
                              key={ci}
                              className="text-muted-foreground flex items-center justify-between text-xs"
                            >
                              <span>{c.name}</span>
                              <span className="font-medium">{c.maxPoints} pts</span>
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
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
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
                        <div className="space-y-1 rounded border border-dashed border-amber-300 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950/20">
                          <ImageOff className="mx-auto h-5 w-5 text-amber-500" />
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                            No pages mapped to this question
                          </p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400">
                            Scouting did not find a student response. Re-run scouting or grade
                            manually below.
                          </p>
                        </div>
                      ) : null}

                      {/* Grading error context (Task 3.1) */}
                      {qs &&
                        (qs as QuestionSubmission & { gradingError?: string }).gradingError && (
                          <div className="space-y-1.5 rounded border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
                            <div className="flex items-center gap-2">
                              <Info className="h-3.5 w-3.5 text-red-500" />
                              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                                Grading Error
                              </p>
                            </div>
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {(qs as QuestionSubmission & { gradingError?: string }).gradingError}
                            </p>
                            {(qs.gradingRetryCount ?? 0) > 0 && (
                              <p className="text-[10px] text-red-500/70">
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
                          <div className="space-y-2 rounded border p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-muted-foreground text-xs font-medium">Score</p>
                                <p className="text-lg font-bold">
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
                                      ? "text-green-600 dark:text-green-400"
                                      : confidence != null && confidence >= 0.7
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400"
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
                                  className={`h-full rounded-full transition-all ${
                                    confidence != null && confidence >= 0.9
                                      ? "bg-green-500"
                                      : confidence != null && confidence >= 0.7
                                        ? "bg-amber-500"
                                        : "bg-red-500"
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
                                <p className="mb-1 text-xs font-medium text-green-600 dark:text-green-400">
                                  Strengths
                                </p>
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
                                <p className="mb-1 text-xs font-medium text-red-600 dark:text-red-400">
                                  Weaknesses
                                </p>
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
                                    className="flex items-center justify-between text-xs"
                                  >
                                    <span>{rb.criterion}</span>
                                    <span className="font-medium">
                                      {rb.awarded}/{rb.max}
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
                    <div className="space-y-3 rounded bg-orange-50 p-3 dark:bg-orange-950/30">
                      <div className="flex items-center gap-2">
                        <History className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                        <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                          Override Audit Trail
                        </p>
                      </div>
                      {/* Timeline */}
                      <div className="relative space-y-3 border-l-2 border-orange-200 pl-4 dark:border-orange-800">
                        {/* Step 1: AI Grading */}
                        <div className="relative">
                          <div className="bg-muted-foreground/40 absolute -left-[1.3rem] top-0.5 h-2.5 w-2.5 rounded-full" />
                          <p className="text-muted-foreground text-[10px] font-medium">AI Graded</p>
                          <p className="text-xs">
                            Score:{" "}
                            <span className="font-medium">
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
                          <div className="absolute -left-[1.3rem] top-0.5 h-2.5 w-2.5 rounded-full bg-orange-500" />
                          <p className="text-[10px] font-medium text-orange-700 dark:text-orange-400">
                            Override Applied
                          </p>
                          <p className="text-xs">
                            Score changed:{" "}
                            <span className="line-through">{qs.manualOverride.originalScore}</span>{" "}
                            →{" "}
                            <span className="font-semibold">
                              {qs.manualOverride.score}/{q.maxMarks}
                            </span>
                          </p>
                          <p className="text-muted-foreground text-xs">
                            Reason: {qs.manualOverride.reason}
                          </p>
                          {qs.manualOverride.overriddenAt && (
                            <p className="flex items-center gap-1 text-[10px] text-orange-500/70">
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
                        className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
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
                          className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30"
                        >
                          <Check className="h-3 w-3" /> Accept AI Grade ({eval_?.score}/{q.maxMarks}
                          )
                        </Button>
                      )}

                    {qs &&
                      qs.gradingStatus === "failed" &&
                      !qs.manualOverride &&
                      (qs.gradingRetryCount ?? 0) >= 3 && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                          <RotateCcw className="h-3 w-3" /> Retry limit reached — use manual
                          override
                        </span>
                      )}
                  </div>

                  {gradeError && expandedQ === q.id && (
                    <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{gradeError}</span>
                    </div>
                  )}

                  {/* Override form */}
                  {qs && !qs.manualOverride && (
                    <div className="space-y-2 rounded border p-3">
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
                          className="bg-orange-600 text-white hover:bg-orange-700"
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
                <span className="mt-2 block font-medium text-amber-600 dark:text-amber-400">
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
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Approve All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
