import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpace, useRecordItemAttempt, useApiError } from "@levelup/query";
import { asSpaceId, asStoryPointId, asItemId } from "@levelup/domain";
import { useStoryPoints } from "../hooks/useStoryPoints";
import { useStoryPointItems } from "../hooks/useSpaceItems";
import { useEvaluateAnswer } from "../hooks/useEvaluateAnswer";
import { spacesListHref, spaceHref } from "../lib/space-paths";
import { QuestionAnswerer } from "../components/questions";
import { autoEvaluateClient } from "../utils/auto-evaluate-client";
import ChatTutorPanel from "../components/chat/ChatTutorPanel";
import ProgressBar from "../components/common/ProgressBar";
import type { UnifiedEvaluationResult, UnifiedItem } from "@levelup/shared-types";
import { Dumbbell, CheckCircle2, CircleDot, Minus } from "lucide-react";
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
import { navNodeClass, type NavNodeState } from "../components/common/lyceum";

export default function PracticeModePage() {
  const { spaceId, storyPointId } = useParams<{ spaceId: string; storyPointId: string }>();
  const location = useLocation();
  const { currentTenantId } = useAuthStore();

  const { data: space } = useSpace<{ title?: string }>(spaceId ?? "");
  const { data: storyPoints } = useStoryPoints(currentTenantId, spaceId ?? null);
  const { data: items, isLoading } = useStoryPointItems(
    currentTenantId,
    spaceId ?? null,
    storyPointId ?? null
  );
  const evaluateAnswer = useEvaluateAnswer();
  const recordAttempt = useRecordItemAttempt();
  const { handleError } = useApiError();

  const storyPoint = storyPoints?.find((sp) => sp.id === storyPointId);
  const questions = items?.filter((i) => i.type === "question") ?? [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [evaluations, setEvaluations] = useState<Record<string, UnifiedEvaluationResult>>({});
  const [chatItemId, setChatItemId] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);

  // Warn before leaving with unsaved progress
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(evaluations).length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [evaluations]);

  // Reset currentIndex when difficulty filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [difficultyFilter]);

  const filteredQuestions = difficultyFilter
    ? questions.filter((q) => q.difficulty === difficultyFilter)
    : questions;

  const currentQuestion = filteredQuestions[currentIndex];
  const totalSolved = Object.values(evaluations).filter((e) => e.correctness >= 1).length;

  const handleSubmit = async (item: UnifiedItem, answer: unknown) => {
    if (!spaceId || !storyPointId) return;
    try {
      let evaluationResult: UnifiedEvaluationResult;

      // Try client-side evaluation first for deterministic question types
      const localResult = autoEvaluateClient(item, answer);
      if (localResult) {
        evaluationResult = localResult;
      } else {
        // Fall back to cloud function for AI-evaluatable types
        evaluationResult = await evaluateAnswer.mutateAsync({
          tenantId: currentTenantId ?? "",
          spaceId,
          storyPointId,
          itemId: item.id,
          answer,
          mode: "practice",
        });
      }

      const newEvaluations = { ...evaluations, [item.id]: evaluationResult };
      setEvaluations(newEvaluations);

      // Persist durable progress via recordItemAttempt. Per CD13 the client
      // sends only the raw answer — the server scores authoritatively.
      recordAttempt.mutate({
        spaceId: asSpaceId(spaceId),
        storyPointId: asStoryPointId(storyPointId),
        itemId: asItemId(item.id),
        answer,
      });
    } catch (err) {
      handleError(err, "Failed to evaluate answer");
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="rounded-pill h-3 w-full" />
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-ly-rise mx-auto max-w-3xl space-y-6">
      {/* Breadcrumb */}
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
            <BreadcrumbPage>{storyPoint?.title ?? "Practice"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-brand-subtle text-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
            <Dumbbell className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-fg truncate text-2xl">{storyPoint?.title}</h1>
            <p className="text-fg-secondary text-sm">Practice — retry as many times as you like.</p>
          </div>
        </div>
        <div className="shrink-0 text-right" aria-live="polite">
          <p className="text-fg font-mono text-2xl tabular-nums">
            {totalSolved}
            <span className="text-fg-muted"> / {filteredQuestions.length}</span>
          </p>
          <p className="text-fg-muted text-2xs tracking-caps font-semibold uppercase">Solved</p>
        </div>
      </div>

      {/* Score bar */}
      <ProgressBar
        value={totalSolved}
        max={filteredQuestions.length}
        color="green"
        label="Progress"
      />

      {/* Difficulty filter */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter by difficulty"
      >
        {[null, "easy", "medium", "hard"].map((d) => {
          const active = difficultyFilter === d;
          return (
            <button
              key={d ?? "all"}
              type="button"
              aria-pressed={active}
              onClick={() => setDifficultyFilter(active ? null : d)}
              className={`rounded-pill duration-fast ease-standard border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                active
                  ? "border-brand bg-brand text-fg-on-accent"
                  : "border-subtle bg-surface text-fg-secondary hover:border-strong hover:text-fg"
              }`}
            >
              {d ?? "All"}
            </button>
          );
        })}
      </div>

      {/* Question navigator mini */}
      <div
        className="flex flex-wrap gap-1.5"
        role="navigation"
        aria-label="Practice question navigator"
      >
        {filteredQuestions.map((q, idx) => {
          const eval_ = evaluations[q.id];
          const isCorrect = eval_ != null && eval_.correctness >= 1;
          const isPartial = eval_ != null && eval_.correctness > 0 && eval_.correctness < 1;
          const isIncorrect = eval_ != null && eval_.correctness === 0;
          const isCurrent = idx === currentIndex;

          let state: NavNodeState = "idle";
          if (isCorrect) state = "correct";
          else if (isPartial) state = "partial";
          else if (isIncorrect) state = "incorrect";

          return (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Question ${idx + 1}: ${
                isCorrect
                  ? "solved"
                  : isIncorrect || isPartial
                    ? "needs another look"
                    : "not attempted"
              }`}
              aria-current={isCurrent ? "step" : undefined}
              className={navNodeClass(state, isCurrent)}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current Question */}
      {currentQuestion ? (
        <div className="border-subtle bg-surface shadow-e1 rounded-xl border p-5 sm:p-6">
          <div className="border-subtle mb-4 flex items-center justify-between border-b pb-3">
            <span className="text-fg-muted text-xs">
              Question{" "}
              <span className="font-mono tabular-nums">
                {currentIndex + 1} of {filteredQuestions.length}
              </span>
            </span>
            {evaluations[currentQuestion.id] &&
              (evaluations[currentQuestion.id].correctness >= 1 ? (
                <span className="text-mastery-mastered inline-flex items-center gap-1 text-xs font-medium">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Solved
                </span>
              ) : evaluations[currentQuestion.id].correctness === 0 ? (
                <span className="text-warning inline-flex items-center gap-1 text-xs font-medium">
                  <CircleDot className="h-4 w-4" aria-hidden /> Keep going
                </span>
              ) : (
                <span className="text-warning inline-flex items-center gap-1 text-xs font-medium">
                  <Minus className="h-4 w-4" aria-hidden /> Almost there
                </span>
              ))}
          </div>

          <QuestionAnswerer
            key={currentQuestion.id}
            item={currentQuestion}
            onSubmit={(answer) => handleSubmit(currentQuestion, answer)}
            onOpenChat={() => setChatItemId(currentQuestion.id)}
            evaluation={evaluations[currentQuestion.id]}
            mode="practice"
            showCorrect
          />
        </div>
      ) : (
        <div className="border-subtle bg-surface rounded-xl border p-8 text-center">
          <p className="text-fg-secondary text-sm">
            No {difficultyFilter ?? ""} questions in this set — try another difficulty.
          </p>
          {difficultyFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setDifficultyFilter(null)}
            >
              Show all
            </Button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          Previous
        </Button>
        <Button
          onClick={() => setCurrentIndex(Math.min(filteredQuestions.length - 1, currentIndex + 1))}
          disabled={currentIndex >= filteredQuestions.length - 1}
        >
          Next
        </Button>
      </div>

      {/* Chat Panel */}
      {chatItemId && spaceId && storyPointId && (
        <ChatTutorPanel
          spaceId={spaceId}
          storyPointId={storyPointId}
          itemId={chatItemId}
          onClose={() => setChatItemId(null)}
        />
      )}
    </div>
  );
}
