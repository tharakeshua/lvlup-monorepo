import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpace, useApiError, useServerTime } from "@levelup/query";
import { useStoryPoints } from "../hooks/useStoryPoints";
import { useStoryPointItems } from "../hooks/useSpaceItems";
import {
  useTestSessions,
  useStartTest,
  useSubmitTest,
  useSaveAnswer,
} from "../hooks/useTestSession";
import { spacesListHref, spaceHref, testAnalyticsHref } from "../lib/space-paths";
import { QuestionAnswerer } from "../components/questions";
import QuestionNavigator from "../components/test/QuestionNavigator";
import CountdownTimer from "../components/test/CountdownTimer";
import NetworkStatusBanner from "../components/test/NetworkStatusBanner";
import ProgressBar from "../components/common/ProgressBar";
import type {
  QuestionStatus,
  DigitalTestSession,
  QuestionPayload,
  StoryPointSection,
  AdaptiveState,
} from "@levelup/shared-types";
import {
  Button,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  CelebrationBurst,
} from "@levelup/shared-ui";
import {
  updateAdaptiveState,
  selectNextQuestion,
  type QuestionMeta,
} from "@levelup/shared-services";
import {
  PlayCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Trash2,
  Send,
  Award,
  BarChart3,
  MoreHorizontal,
  TrendingUp,
  Lock,
  CalendarClock,
  Lightbulb,
} from "lucide-react";

/** Animate a number counting up from 0 to target */
function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    startTime.current = Date.now();
    let raf: number;
    const animate = () => {
      const elapsed = Date.now() - (startTime.current ?? Date.now());
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

type View = "landing" | "test" | "results";

export default function TimedTestPage() {
  const { spaceId, storyPointId } = useParams<{ spaceId: string; storyPointId: string }>();
  const location = useLocation();
  const { currentTenantId, user } = useAuthStore();
  const userId = user?.uid ?? null;

  const { offsetMs } = useServerTime();
  const { data: space } = useSpace<{ title?: string }>(spaceId ?? "");
  const { data: storyPoints } = useStoryPoints(currentTenantId, spaceId ?? null);
  const { data: items } = useStoryPointItems(
    currentTenantId,
    spaceId ?? null,
    storyPointId ?? null
  );
  const { data: sessions } = useTestSessions(
    currentTenantId,
    userId,
    spaceId ?? null,
    storyPointId ?? null
  );

  const startTest = useStartTest();
  const submitTest = useSubmitTest();
  const saveAnswer = useSaveAnswer();
  const { handleError } = useApiError();

  const storyPoint = storyPoints?.find((sp) => sp.id === storyPointId);
  const activeSession = sessions?.find((s) => s.status === "in_progress");
  const completedSessions = sessions?.filter((s) => s.status === "completed") ?? [];

  const [view, setView] = useState<View>(activeSession ? "test" : "landing");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedSession, setSelectedSession] = useState<DigitalTestSession | null>(null);
  const [sectionMapping, setSectionMapping] = useState<Record<string, string>>({});
  const [startError, setStartError] = useState<string | null>(null);
  // Per-question time tracking
  const questionStartTime = useRef<number>(Date.now());
  const timePerQuestion = useRef<Record<string, number>>({});
  const mainRef = useRef<HTMLDivElement>(null);
  // Guard against concurrent submissions (race condition between manual submit and auto-submit)
  const isSubmitting = useRef(false);
  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Auto-submit notification
  const [autoSubmitNotice, setAutoSubmitNotice] = useState(false);

  // Sections from story point
  const sections: StoryPointSection[] = useMemo(
    () => storyPoint?.sections ?? [],
    [storyPoint?.sections]
  );

  // Initialize from active session
  useEffect(() => {
    if (activeSession) {
      setView("test");
      const statuses: Record<string, QuestionStatus> = {};
      for (const qId of activeSession.questionOrder) {
        if (activeSession.submissions[qId]) {
          statuses[qId] = activeSession.markedForReview[qId] ? "answered_and_marked" : "answered";
        } else if (activeSession.visitedQuestions[qId]) {
          statuses[qId] = activeSession.markedForReview[qId] ? "marked_for_review" : "not_answered";
        } else {
          statuses[qId] = "not_visited";
        }
      }
      setQuestionStatuses(statuses);

      // Restore saved answers
      const saved: Record<string, unknown> = {};
      for (const [qId, sub] of Object.entries(activeSession.submissions)) {
        saved[qId] = sub.answer;
      }
      setAnswers(saved);

      // Restore section mapping
      if (activeSession.sectionMapping) {
        setSectionMapping(activeSession.sectionMapping);
      }

      // Resume to last visited position or first unanswered
      const resumeIndex = activeSession.lastVisitedIndex ?? 0;
      const firstUnanswered = activeSession.questionOrder.findIndex(
        (qId) => !activeSession.submissions[qId]
      );
      setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : resumeIndex);
    }
  }, [activeSession]);

  const questionOrder =
    activeSession?.questionOrder ??
    items?.filter((i) => i.type === "question").map((i) => i.id) ??
    [];
  const itemsMap = new Map((items ?? []).map((item) => [item.id, item]));
  const currentQuestionId = questionOrder[currentIndex];
  const currentItem = currentQuestionId ? itemsMap.get(currentQuestionId) : null;

  // Current section label
  const currentSectionId = currentQuestionId ? sectionMapping[currentQuestionId] : null;
  const currentSection = currentSectionId ? sections.find((s) => s.id === currentSectionId) : null;

  // Mark question as visited and track time per question
  useEffect(() => {
    if (currentQuestionId && view === "test") {
      // Record time spent on previous question
      const prevId = questionOrder[currentIndex - 1] ?? questionOrder[currentIndex];
      if (prevId && prevId !== currentQuestionId) {
        const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000);
        timePerQuestion.current[prevId] = (timePerQuestion.current[prevId] ?? 0) + elapsed;
      }
      questionStartTime.current = Date.now();

      setQuestionStatuses((prev) => {
        if (prev[currentQuestionId] === "not_visited" || !prev[currentQuestionId]) {
          return { ...prev, [currentQuestionId]: "not_answered" };
        }
        return prev;
      });

      // Focus main content area on navigation
      mainRef.current?.focus();
    }
  }, [currentQuestionId, view, currentIndex, questionOrder]);

  const handleStartTest = async () => {
    if (!spaceId || !storyPointId) return;
    setStartError(null);
    try {
      const result = await startTest.mutateAsync({
        tenantId: currentTenantId ?? "",
        spaceId,
        storyPointId,
      });
      // Store section mapping from response
      if (result.sectionMapping) {
        setSectionMapping(result.sectionMapping);
      }
      if (result.lastVisitedIndex) {
        setCurrentIndex(result.lastVisitedIndex);
      }
      setView("test");
    } catch (err) {
      const errorCode =
        (err as { code?: string })?.code ?? (err as { message?: string })?.message ?? "";
      if (errorCode.includes("PRECONDITION_FAILED") || errorCode.includes("precondition-failed")) {
        setStartError("This test is not available yet.");
      } else {
        handleError(err, "Failed to start test");
      }
    }
  };

  const handleSaveAnswer = useCallback(
    (itemId: string, answer: unknown) => {
      setAnswers((prev) => ({ ...prev, [itemId]: answer }));
      setQuestionStatuses((prev) => {
        const wasMarked =
          prev[itemId] === "marked_for_review" || prev[itemId] === "answered_and_marked";
        return {
          ...prev,
          [itemId]: wasMarked ? "answered_and_marked" : "answered",
        };
      });

      // Persist to server with tracked time
      if (activeSession) {
        const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000);
        const totalTime = (timePerQuestion.current[itemId] ?? 0) + elapsed;
        setSaveStatus("saving");
        saveAnswer.mutate(
          {
            tenantId: currentTenantId ?? "",
            sessionId: activeSession.id,
            itemId,
            answer,
            timeSpentSeconds: totalTime,
          },
          {
            onSuccess: () => {
              setSaveStatus("saved");
              setTimeout(() => setSaveStatus("idle"), 1500);
            },
            onError: () => {
              setSaveStatus("error");
            },
          }
        );
      }
    },
    [activeSession, currentTenantId, saveAnswer]
  );

  // Track adaptive state locally for real-time question reordering
  const [localAdaptiveState, setLocalAdaptiveState] = useState<AdaptiveState | null>(null);

  // Initialize local adaptive state from session
  useEffect(() => {
    if (activeSession?.adaptiveState) {
      setLocalAdaptiveState(activeSession.adaptiveState);
    }
  }, [activeSession?.adaptiveState]);

  const handleSaveAndNext = () => {
    if (currentIndex < questionOrder.length - 1) {
      // For adaptive tests, determine next question dynamically
      const adaptiveConfig = storyPoint?.assessmentConfig?.adaptiveConfig;
      if (adaptiveConfig?.enabled && localAdaptiveState && currentQuestionId) {
        const submission = activeSession?.submissions[currentQuestionId];
        const wasCorrect = submission?.correct ?? false;
        const newState = updateAdaptiveState(localAdaptiveState, adaptiveConfig, wasCorrect);
        setLocalAdaptiveState(newState);

        // Build remaining questions pool
        const answeredIds = new Set(Object.keys(answers));
        answeredIds.add(currentQuestionId);
        const remaining: QuestionMeta[] = questionOrder
          .filter((qId) => !answeredIds.has(qId))
          .map((qId) => {
            const item = itemsMap.get(qId);
            const payload = item?.payload as QuestionPayload | undefined;
            return {
              id: qId,
              difficulty: (payload?.difficulty ?? item?.difficulty ?? "medium") as
                | "easy"
                | "medium"
                | "hard",
            };
          });

        const nextId = selectNextQuestion(newState, remaining);
        if (nextId) {
          const nextIdx = questionOrder.indexOf(nextId);
          if (nextIdx >= 0) {
            setCurrentIndex(nextIdx);
            return;
          }
        }
      }
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleMarkForReview = useCallback(() => {
    if (!currentQuestionId) return;
    setQuestionStatuses((prev) => {
      const current = prev[currentQuestionId];
      if (current === "answered" || current === "answered_and_marked") {
        return {
          ...prev,
          [currentQuestionId]:
            current === "answered_and_marked" ? "answered" : "answered_and_marked",
        };
      }
      return {
        ...prev,
        [currentQuestionId]: current === "marked_for_review" ? "not_answered" : "marked_for_review",
      };
    });
  }, [currentQuestionId]);

  const handleClearResponse = () => {
    if (!currentQuestionId) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQuestionId];
      return next;
    });
    setQuestionStatuses((prev) => ({
      ...prev,
      [currentQuestionId]:
        prev[currentQuestionId] === "answered_and_marked" ||
        prev[currentQuestionId] === "marked_for_review"
          ? "marked_for_review"
          : "not_answered",
    }));
  };

  const handleSubmitTest = useCallback(
    async (autoSubmitted = false) => {
      if (!activeSession) return;
      // Prevent concurrent submissions (e.g., manual submit + auto-submit race)
      if (isSubmitting.current) return;
      isSubmitting.current = true;
      setShowConfirm(false);

      // Save any pending answer for the current question before submitting
      if (currentQuestionId && answers[currentQuestionId] !== undefined) {
        const elapsed = Math.round((Date.now() - questionStartTime.current) / 1000);
        const totalTime = (timePerQuestion.current[currentQuestionId] ?? 0) + elapsed;
        try {
          await saveAnswer.mutateAsync({
            tenantId: currentTenantId ?? "",
            sessionId: activeSession.id,
            itemId: currentQuestionId,
            answer: answers[currentQuestionId],
            timeSpentSeconds: totalTime,
          });
        } catch {
          // Best-effort save before submit — don't block submission
        }
      }

      try {
        await submitTest.mutateAsync({
          tenantId: currentTenantId ?? "",
          sessionId: activeSession.id,
          submissions: answers,
          autoSubmitted,
        });
        setView("results");
      } catch (err) {
        isSubmitting.current = false;
        handleError(err, "Failed to submit test");
      }
    },
    [
      currentTenantId,
      activeSession,
      answers,
      submitTest,
      currentQuestionId,
      saveAnswer,
      handleError,
    ]
  );

  const handleTimeUp = useCallback(() => {
    setAutoSubmitNotice(true);
    handleSubmitTest(true);
  }, [handleSubmitTest]);

  // Keyboard navigation for test view
  useEffect(() => {
    if (view !== "test") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          setCurrentIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowRight":
          e.preventDefault();
          setCurrentIndex((prev) => Math.min(questionOrder.length - 1, prev + 1));
          break;
        case "m":
        case "M":
          e.preventDefault();
          handleMarkForReview();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [view, questionOrder.length, handleMarkForReview]);

  // LANDING VIEW
  if (view === "landing") {
    const bestScore =
      completedSessions.length > 0
        ? Math.max(...completedSessions.map((s) => s.percentage ?? 0))
        : null;

    // Schedule checks
    const schedule = storyPoint?.assessmentConfig?.schedule;
    const now = Date.now();
    const scheduleStartMs = schedule?.startAt
      ? (schedule.startAt as unknown as { seconds: number }).seconds * 1000
      : null;
    const scheduleEndMs = schedule?.endAt
      ? (schedule.endAt as unknown as { seconds: number }).seconds * 1000
      : null;
    const isBeforeSchedule = scheduleStartMs ? now < scheduleStartMs : false;
    const isAfterSchedule = scheduleEndMs ? now > scheduleEndMs : false;

    // Retry checks
    const retryConfig = storyPoint?.assessmentConfig?.retryConfig;
    const passingPct = storyPoint?.assessmentConfig?.passingPercentage ?? 0;
    const hasPassed =
      retryConfig?.lockAfterPassing &&
      completedSessions.some((s) => (s.percentage ?? 0) >= passingPct);
    const lastSession =
      completedSessions.length > 0
        ? completedSessions.reduce((latest, s) => {
            const latestEnd = (latest.endedAt as unknown as { seconds: number })?.seconds ?? 0;
            const sEnd = (s.endedAt as unknown as { seconds: number })?.seconds ?? 0;
            return sEnd > latestEnd ? s : latest;
          })
        : null;
    const cooldownEndMs =
      retryConfig?.cooldownMinutes && lastSession?.endedAt
        ? (lastSession.endedAt as unknown as { seconds: number }).seconds * 1000 +
          retryConfig.cooldownMinutes * 60 * 1000
        : null;
    const isInCooldown = cooldownEndMs ? now < cooldownEndMs : false;
    const cooldownMinutesLeft =
      isInCooldown && cooldownEndMs ? Math.ceil((cooldownEndMs - now) / 60000) : 0;

    const canStart = !isBeforeSchedule && !isAfterSchedule && !hasPassed && !isInCooldown;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={spacesListHref(location.pathname)}>Spaces</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to={
                    spaceId
                      ? spaceHref(location.pathname, spaceId)
                      : spacesListHref(location.pathname)
                  }
                >
                  {space?.title ?? "Space"}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{storyPoint?.title ?? "Test"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="bg-card rounded-lg border p-6">
          <div className="mb-4 flex items-center gap-3">
            <Clock className="text-destructive h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold">{storyPoint?.title}</h1>
              <p className="text-muted-foreground text-sm">Timed Test</p>
            </div>
          </div>

          {/* Schedule banner */}
          {isBeforeSchedule && scheduleStartMs && (
            <div className="mb-4 flex items-center gap-2 rounded bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
              <CalendarClock className="h-5 w-5 flex-shrink-0 text-blue-500" />
              <div>
                <p className="font-medium text-blue-700 dark:text-blue-300">Scheduled</p>
                <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                  Available from {new Date(scheduleStartMs).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          {isAfterSchedule && (
            <div className="mb-4 flex items-center gap-2 rounded bg-red-50 p-3 text-sm dark:bg-red-950/30">
              <Lock className="text-destructive h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-destructive font-medium">Closed</p>
                <p className="text-destructive/80 text-xs">
                  The submission window for this test has closed.
                </p>
              </div>
            </div>
          )}

          {/* Cooldown banner */}
          {isInCooldown && (
            <div className="mb-4 flex items-center gap-2 rounded bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <Clock className="h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-amber-700 dark:text-amber-300">Cooldown Active</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  You can retry in {cooldownMinutesLeft} minute
                  {cooldownMinutesLeft !== 1 ? "s" : ""}.
                </p>
              </div>
            </div>
          )}

          {/* Locked after passing */}
          {hasPassed && (
            <div className="mb-4 flex items-center gap-2 rounded bg-emerald-50 p-3 text-sm dark:bg-emerald-950/30">
              <Lock className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-700 dark:text-emerald-300">Test Passed</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
                  You&apos;ve already passed this test. No further attempts are allowed.
                </p>
              </div>
            </div>
          )}

          {storyPoint?.assessmentConfig?.instructions && (
            <div className="bg-primary/5 mb-4 rounded p-3 text-sm">
              <p className="text-primary mb-1 font-medium">Instructions:</p>
              <p className="text-primary/80 whitespace-pre-wrap">
                {storyPoint.assessmentConfig.instructions}
              </p>
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded border p-3">
              <p className="text-muted-foreground">Duration</p>
              <p className="font-semibold">
                {storyPoint?.assessmentConfig?.durationMinutes ?? "--"} minutes
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-muted-foreground">Questions</p>
              <p className="font-semibold">
                {storyPoint?.stats?.totalQuestions ??
                  items?.filter((i) => i.type === "question").length ??
                  "--"}
              </p>
            </div>
            <div className="rounded border p-3">
              <p className="text-muted-foreground">Total Points</p>
              <p className="font-semibold">{storyPoint?.stats?.totalPoints ?? "--"}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-muted-foreground">Max Attempts</p>
              <p className="font-semibold">
                {storyPoint?.assessmentConfig?.maxAttempts ?? "Unlimited"}
              </p>
            </div>
          </div>

          {storyPoint?.assessmentConfig?.passingPercentage && (
            <p className="text-muted-foreground mb-4 text-sm">
              Passing: {storyPoint.assessmentConfig.passingPercentage}%
            </p>
          )}

          {storyPoint?.assessmentConfig?.adaptiveConfig?.enabled && (
            <div className="mb-4 rounded bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
              <p className="font-medium text-blue-700 dark:text-blue-300">Adaptive Test</p>
              <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                Question difficulty adjusts based on your performance.
              </p>
            </div>
          )}

          <Button
            onClick={handleStartTest}
            disabled={startTest.isPending || !canStart}
            className="gap-2"
          >
            <PlayCircle className="h-5 w-5" />
            {startTest.isPending ? "Starting..." : !canStart ? "Unavailable" : "Start Test"}
          </Button>

          {startError && (
            <p className="text-destructive mt-2 text-sm" data-testid="start-error">
              {startError}
            </p>
          )}
          {!startError && startTest.isError && (
            <p className="text-destructive mt-2 text-sm">
              Failed to start test. You may have reached the maximum attempts.
            </p>
          )}
        </div>

        {/* Previous Attempts */}
        {completedSessions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Previous Attempts</h2>
              {bestScore != null && (
                <span className="text-muted-foreground text-sm">
                  Best: {Math.round(bestScore)}%
                </span>
              )}
            </div>
            {completedSessions.map((session, idx) => {
              const prevSession = completedSessions[idx + 1];
              const improved =
                prevSession && (session.percentage ?? 0) > (prevSession.percentage ?? 0);

              return (
                <button
                  key={session.id}
                  onClick={() => {
                    setSelectedSession(session);
                    setView("results");
                  }}
                  className="w-full rounded-lg border p-4 text-left transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        Attempt #{session.attemptNumber}
                        {session.autoSubmitted && (
                          <span className="ml-2 text-xs text-amber-600">(auto-submitted)</span>
                        )}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {session.endedAt
                          ? new Date(session.endedAt.seconds * 1000).toLocaleDateString()
                          : "--"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-right">
                      {improved && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                      <div>
                        <p className="text-lg font-bold">
                          {session.percentage != null ? `${Math.round(session.percentage)}%` : "--"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {session.pointsEarned ?? 0}/{session.totalPoints ?? 0} pts
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // TEST VIEW
  if (view === "test" && activeSession) {
    const deadline = activeSession.serverDeadline
      ? activeSession.serverDeadline.seconds * 1000
      : null;

    if (!deadline) {
      return (
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
            <p className="text-sm font-medium">Waiting for server deadline...</p>
            <p className="text-muted-foreground mt-1 text-xs">
              The test timer could not be started. Please refresh the page.
            </p>
          </div>
        </div>
      );
    }

    const answeredCount = Object.values(questionStatuses).filter(
      (s) => s === "answered" || s === "answered_and_marked"
    ).length;
    const markedCount = Object.values(questionStatuses).filter(
      (s) => s === "marked_for_review" || s === "answered_and_marked"
    ).length;
    const unansweredCount = Object.values(questionStatuses).filter(
      (s) => s === "not_answered" || s === "not_visited"
    ).length;

    return (
      <div className="flex h-[calc(100vh-4rem)] gap-4">
        {/* Left: Question Navigator — hidden on mobile */}
        <aside className="hidden w-52 flex-shrink-0 overflow-y-auto border-r pr-4 lg:block">
          <QuestionNavigator
            questionOrder={questionOrder}
            currentIndex={currentIndex}
            questionStatuses={questionStatuses}
            onNavigate={setCurrentIndex}
            sectionMapping={sectionMapping}
            sections={sections}
          />
        </aside>

        {/* Center: Question */}
        <main ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto outline-none">
          {/* Mobile question navigator trigger */}
          <div className="mb-3 lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  Question {currentIndex + 1} of {questionOrder.length} — View All
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[60vh]">
                <SheetHeader>
                  <SheetTitle>Questions</SheetTitle>
                </SheetHeader>
                <div className="py-4">
                  <QuestionNavigator
                    questionOrder={questionOrder}
                    currentIndex={currentIndex}
                    questionStatuses={questionStatuses}
                    onNavigate={setCurrentIndex}
                    sectionMapping={sectionMapping}
                    sections={sections}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Network Status */}
          <NetworkStatusBanner />

          {/* Timer Bar */}
          <div className="bg-background sticky top-0 z-10 mb-4 flex items-center justify-between border-b py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Q{currentIndex + 1}/{questionOrder.length}
              </span>
              {currentSection && (
                <span className="text-muted-foreground bg-muted rounded px-2 py-0.5 text-xs">
                  {currentSection.title}
                </span>
              )}
              {saveStatus === "saving" && (
                <span className="text-muted-foreground animate-pulse text-[10px]">Saving...</span>
              )}
              {saveStatus === "saved" && (
                <span className="text-[10px] text-emerald-500">Saved</span>
              )}
              {saveStatus === "error" && (
                <button
                  onClick={() => {
                    if (currentQuestionId && answers[currentQuestionId] !== undefined) {
                      handleSaveAnswer(currentQuestionId, answers[currentQuestionId]);
                    }
                  }}
                  className="text-destructive text-[10px] hover:underline"
                >
                  Save failed — tap to retry
                </button>
              )}
            </div>
            <CountdownTimer deadline={deadline} onTimeUp={handleTimeUp} serverOffset={-offsetMs} />
          </div>

          {currentItem && (
            <QuestionAnswerer
              key={currentItem.id}
              item={currentItem}
              onSubmit={(answer) => handleSaveAnswer(currentItem.id, answer)}
              mode="test"
              savedAnswer={answers[currentItem.id]}
            />
          )}

          {/* Controls */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
            {/* Primary actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                size="sm"
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Previous</span>
              </Button>

              <Button
                onClick={handleSaveAndNext}
                disabled={currentIndex === questionOrder.length - 1}
                size="sm"
                className="gap-1"
              >
                <span className="hidden sm:inline">Save &</span> Next{" "}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Secondary actions — visible on sm+ */}
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkForReview}
                className="gap-1 border-amber-300 text-amber-600 dark:border-amber-600 dark:text-amber-400"
              >
                <Flag className="h-4 w-4" /> Mark
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleClearResponse}
                className="text-destructive gap-1"
              >
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
            </div>

            {/* Mobile "More" dropdown */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleMarkForReview}>
                    <Flag className="mr-2 h-4 w-4" /> Mark for Review
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleClearResponse} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Clear Response
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-1" />

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirm(true)}
              className="gap-1"
            >
              <Send className="h-4 w-4" /> <span className="hidden sm:inline">Submit Test</span>
              <span className="sm:hidden">Submit</span>
            </Button>
          </div>

          <p className="text-muted-foreground mt-2 hidden text-xs sm:block">
            Keyboard: &larr; Previous &middot; &rarr; Next &middot; M Mark for Review
          </p>
        </main>

        {/* Confirmation Dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Submit Test?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to submit? You cannot change your answers after submission.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1 text-sm">
              <p>
                Answered: {answeredCount}/{questionOrder.length}
              </p>
              <p>Marked for review: {markedCount}</p>
              {unansweredCount > 0 && (
                <p className="text-destructive font-medium">Not answered: {unansweredCount}</p>
              )}
              {unansweredCount === 0 && <p className="text-emerald-600">All questions answered</p>}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleSubmitTest(false)}
                disabled={submitTest.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitTest.isPending ? "Submitting..." : "Submit"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // RESULTS VIEW
  if (view === "results") {
    const session = selectedSession ?? completedSessions[0];
    if (!session) {
      return <p className="text-muted-foreground">No results available.</p>;
    }

    const passed = storyPoint?.assessmentConfig?.passingPercentage
      ? (session.percentage ?? 0) >= storyPoint.assessmentConfig.passingPercentage
      : true;

    // Check for improvement
    const prevSession = completedSessions.find(
      (s) => s.attemptNumber === session.attemptNumber - 1
    );
    const improvement = prevSession
      ? (session.percentage ?? 0) - (prevSession.percentage ?? 0)
      : null;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Confetti for passing */}
        <CelebrationBurst trigger={passed} variant="confetti" />

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={spacesListHref(location.pathname)}>Spaces</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to={
                    spaceId
                      ? spaceHref(location.pathname, spaceId)
                      : spacesListHref(location.pathname)
                  }
                >
                  {space?.title}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{storyPoint?.title} — Results</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {autoSubmitNotice && session.autoSubmitted && (
          <div
            className="rounded-md border border-amber-200 bg-amber-500/10 p-3 text-sm text-amber-700 dark:border-amber-800 dark:text-amber-400"
            role="alert"
          >
            Time expired — your test was auto-submitted.
          </div>
        )}

        <div className="bg-card rounded-lg border p-6 text-center">
          <Award
            className={`mx-auto mb-3 h-12 w-12 ${passed ? "text-emerald-500" : "text-destructive"}`}
          />
          <h1 className="mb-1 text-2xl font-bold">
            {passed ? "Congratulations!" : "Keep Practicing!"}
          </h1>
          <p className="text-muted-foreground text-sm">
            Attempt #{session.attemptNumber}
            {session.autoSubmitted && " (Auto-submitted)"}
          </p>
          {improvement != null && improvement !== 0 && (
            <p
              className={`mt-1 text-sm ${improvement > 0 ? "text-emerald-600" : "text-destructive"}`}
            >
              {improvement > 0 ? "+" : ""}
              {Math.round(improvement)}% vs previous attempt
            </p>
          )}

          <AnimatedScoreGrid session={session} />
        </div>

        {/* Difficulty Breakdown */}
        {session.analytics?.difficultyBreakdown &&
          Object.keys(session.analytics.difficultyBreakdown).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Difficulty Analysis</h2>
              {(["easy", "medium", "hard"] as const).map((diff) => {
                const data = session.analytics?.difficultyBreakdown?.[diff];
                if (!data) return null;
                const label = diff.charAt(0).toUpperCase() + diff.slice(1);
                return (
                  <div key={diff} className="flex items-center gap-3">
                    <span className="w-20 text-sm">{label}</span>
                    <div className="flex-1">
                      <ProgressBar
                        value={data.correct}
                        max={data.total}
                        size="sm"
                        color={data.correct === data.total ? "green" : "orange"}
                        showPercent={false}
                      />
                    </div>
                    <span className="text-muted-foreground w-12 text-right text-xs">
                      {data.correct}/{data.total}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

        {/* Bloom's Level Breakdown */}
        {session.analytics?.bloomsBreakdown &&
          Object.keys(session.analytics.bloomsBreakdown).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Bloom&apos;s Taxonomy</h2>
              {Object.entries(session.analytics.bloomsBreakdown).map(([level, data]) => (
                <div key={level} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm capitalize">{level}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={data.correct}
                      max={data.total}
                      size="sm"
                      color={data.correct === data.total ? "green" : "orange"}
                      showPercent={false}
                    />
                  </div>
                  <span className="text-muted-foreground w-12 text-right text-xs">
                    {data.correct}/{data.total}
                  </span>
                </div>
              ))}
            </div>
          )}

        {/* Section Breakdown */}
        {session.analytics?.sectionBreakdown && sections.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Section Analysis</h2>
            {Object.entries(session.analytics.sectionBreakdown).map(([sectionId, data]) => {
              const section = sections.find((s) => s.id === sectionId);
              return (
                <div key={sectionId} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm">{section?.title ?? sectionId}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={data.correct}
                      max={data.total}
                      size="sm"
                      color={data.correct === data.total ? "green" : "orange"}
                      showPercent={false}
                    />
                  </div>
                  <span className="text-muted-foreground w-12 text-right text-xs">
                    {data.correct}/{data.total}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Per-question breakdown */}
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5" /> Question Breakdown
          </h2>
          {session.questionOrder.map((qId, index) => {
            const submission = session.submissions[qId];
            const item = itemsMap.get(qId);
            const payload = item?.payload as QuestionPayload | undefined;
            const qSectionId = session.sectionMapping?.[qId];
            const qSection = qSectionId ? sections.find((s) => s.id === qSectionId) : null;

            return (
              <div key={qId} className="rounded-lg border p-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Q{index + 1}: {payload?.title ?? payload?.content?.slice(0, 60) ?? "Question"}
                    </span>
                    {qSection && (
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">
                        {qSection.title}
                      </span>
                    )}
                  </div>
                  {submission?.correct != null && (
                    <span
                      className={`text-xs font-medium ${submission.correct ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                    >
                      {submission.correct ? "Correct" : "Incorrect"}
                    </span>
                  )}
                </div>
                {submission && (
                  <div className="text-muted-foreground text-xs">
                    Points: {submission.pointsEarned ?? 0}/{submission.totalPoints ?? 0}
                    {submission.timeSpentSeconds > 0 &&
                      ` | Time: ${Math.round(submission.timeSpentSeconds)}s`}
                  </div>
                )}
                {!submission && <p className="text-muted-foreground text-xs">Not attempted</p>}
              </div>
            );
          })}
        </div>

        {/* Topic Analysis */}
        {session.analytics?.topicBreakdown &&
          Object.keys(session.analytics.topicBreakdown).length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Topic Analysis</h2>
              {Object.entries(session.analytics.topicBreakdown).map(([topic, data]) => (
                <div key={topic} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm">{topic}</span>
                  <div className="flex-1">
                    <ProgressBar
                      value={data.correct}
                      max={data.total}
                      size="sm"
                      color={data.correct === data.total ? "green" : "orange"}
                      showPercent={false}
                    />
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {data.correct}/{data.total}
                  </span>
                </div>
              ))}
            </div>
          )}

        {/* Weak Areas Summary (mini recommendations) */}
        {session.analytics?.topicBreakdown &&
          (() => {
            const weakTopics = Object.entries(session.analytics.topicBreakdown)
              .filter(([, data]) => data.total > 0 && data.correct / data.total < 0.5)
              .sort(([, a], [, b]) => a.correct / a.total - b.correct / b.total)
              .slice(0, 3);
            if (weakTopics.length === 0) return null;
            return (
              <div className="space-y-2 rounded-lg border bg-amber-50/50 p-4 dark:bg-amber-950/20">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Lightbulb className="h-4 w-4 text-amber-500" /> Areas to Improve
                </h2>
                {weakTopics.map(([topic, data]) => (
                  <p key={topic} className="text-muted-foreground text-sm">
                    Focus on <span className="text-foreground font-medium">{topic}</span> (
                    {data.correct}/{data.total} correct)
                  </p>
                ))}
                <Button variant="link" size="sm" asChild className="h-auto px-0">
                  <Link
                    to={
                      spaceId && storyPointId
                        ? testAnalyticsHref(location.pathname, spaceId, storyPointId)
                        : spacesListHref(location.pathname)
                    }
                  >
                    <BarChart3 className="mr-1 h-3 w-3" /> View full analytics
                  </Link>
                </Button>
              </div>
            );
          })()}

        {/* Difficulty Progression (for adaptive tests) */}
        {session.difficultyProgression && session.difficultyProgression.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Difficulty Progression</h2>
            <div className="flex h-16 items-end gap-1">
              {session.difficultyProgression.map((entry, idx) => {
                const height =
                  entry.difficulty === "hard" ? 100 : entry.difficulty === "medium" ? 60 : 30;
                return (
                  <div key={idx} className="flex flex-1 flex-col items-center">
                    <div
                      className={`w-full rounded-t ${
                        entry.correct
                          ? "bg-emerald-400 dark:bg-emerald-600"
                          : "bg-red-400 dark:bg-red-600"
                      }`}
                      style={{ height: `${height}%` }}
                      title={`Q${entry.questionIndex + 1}: ${entry.difficulty} (${entry.correct ? "correct" : "incorrect"})`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>Easy</span>
              <span>Medium</span>
              <span>Hard</span>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setView("landing");
              setSelectedSession(null);
            }}
          >
            Back to Test Info
          </Button>
          <Button variant="outline" asChild>
            <Link
              to={
                spaceId && storyPointId
                  ? testAnalyticsHref(location.pathname, spaceId, storyPointId)
                  : spacesListHref(location.pathname)
              }
            >
              <BarChart3 className="mr-1 h-4 w-4" /> Analytics
            </Link>
          </Button>
          <Button asChild>
            <Link
              to={
                spaceId ? spaceHref(location.pathname, spaceId) : spacesListHref(location.pathname)
              }
            >
              Back to Space
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 rounded" />
      <Skeleton className="h-4 w-full rounded" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 rounded-lg" />
      ))}
    </div>
  );
}

/** Animated score display for results view */
function AnimatedScoreGrid({ session }: { session: DigitalTestSession }) {
  const animatedScore = useCountUp(session.percentage != null ? Math.round(session.percentage) : 0);

  return (
    <>
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div>
          <p className="text-3xl font-bold tabular-nums">
            {session.percentage != null ? `${animatedScore}%` : "--"}
          </p>
          <p className="text-muted-foreground text-xs">Score</p>
        </div>
        <div>
          <p className="text-3xl font-bold">
            {session.pointsEarned ?? 0}/{session.totalPoints ?? 0}
          </p>
          <p className="text-muted-foreground text-xs">Points</p>
        </div>
        <div>
          <p className="text-3xl font-bold">
            {session.answeredQuestions}/{session.totalQuestions}
          </p>
          <p className="text-muted-foreground text-xs">Answered</p>
        </div>
      </div>
      {session.analytics?.averageTimePerQuestion != null && (
        <p className="text-muted-foreground mt-3 text-xs">
          Average time per question: {session.analytics.averageTimePerQuestion}s
        </p>
      )}
    </>
  );
}
