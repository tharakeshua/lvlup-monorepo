import { useState, useMemo } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useSpace, useStoryPointProgress, useRecordItemAttempt, useApiError } from "@levelup/query";
import { asSpaceId, asStoryPointId, asItemId } from "@levelup/domain";
import { useStoryPoints } from "../hooks/useStoryPoints";
import { useStoryPointItems } from "../hooks/useSpaceItems";
import { useEvaluateAnswer } from "../hooks/useEvaluateAnswer";
import {
  spacesListHref,
  spaceHref,
  storyPointHref,
  testHref,
  practiceHref,
} from "../lib/space-paths";
import { QuestionAnswerer } from "../components/questions";
import { autoEvaluateClient } from "../utils/auto-evaluate-client";
import MaterialViewer from "../components/materials/MaterialViewer";
import ChatTutorPanel from "../components/chat/ChatTutorPanel";
import type {
  UnifiedItem,
  UnifiedEvaluationResult,
  StoredEvaluation,
  StoryPointProgressDoc,
  AttemptRecord,
} from "@levelup/shared-types";
import AttemptHistoryPanel from "../components/common/AttemptHistoryPanel";
import {
  FileText,
  HelpCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  Button,
  Skeleton,
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@levelup/shared-ui";
import { DifficultyChip, navNodeClass, type NavNodeState } from "../components/common/lyceum";

/**
 * Convert a StoredEvaluation (from Firestore) to a UnifiedEvaluationResult
 * so it can be passed to FeedbackPanel/QuestionAnswerer.
 */
function storedToEvaluation(stored: StoredEvaluation): UnifiedEvaluationResult {
  return {
    score: stored.score,
    maxScore: stored.maxScore,
    correctness: stored.correctness,
    percentage: stored.percentage,
    strengths: stored.strengths,
    weaknesses: stored.weaknesses,
    missingConcepts: stored.missingConcepts,
    summary: stored.summary,
    mistakeClassification: stored.mistakeClassification,
    confidence: 1,
    gradedAt: {
      seconds: Math.floor(Date.now() / 1000),
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    },
  };
}

/**
 * Convert a UnifiedEvaluationResult to a compact StoredEvaluation for persistence.
 */
function evaluationToStored(eval_: UnifiedEvaluationResult): StoredEvaluation {
  return {
    score: eval_.score,
    maxScore: eval_.maxScore,
    correctness: eval_.correctness,
    percentage: eval_.percentage,
    strengths: eval_.strengths ?? [],
    weaknesses: eval_.weaknesses ?? [],
    missingConcepts: eval_.missingConcepts ?? [],
    summary: eval_.summary,
    mistakeClassification: eval_.mistakeClassification,
  };
}

/** Practice-style navigator: numbered buttons + one item at a time + prev/next */
function ItemNavigator({
  items,
  spProgress,
  evaluations,
  onSubmitAnswer,
  onOpenChat,
  onCompleteMaterial,
}: {
  items: UnifiedItem[];
  spProgress: StoryPointProgressDoc | null | undefined;
  evaluations: Record<string, UnifiedEvaluationResult>;
  onSubmitAnswer: (item: UnifiedItem, answer: unknown) => void;
  onOpenChat: (itemId: string) => void;
  onCompleteMaterial: (itemId: string) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentItem = items[currentIndex];

  if (!items.length) {
    return (
      <p className="text-fg-secondary py-2 text-sm">
        No items in this section yet — check back soon.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Numbered item buttons */}
      <div className="flex flex-wrap gap-1.5" role="navigation" aria-label="Items in this section">
        {items.map((item, idx) => {
          const itemProgress = spProgress?.items?.[item.id];
          const isCompleted = itemProgress?.completed;
          const eval_ = evaluations[item.id];
          const qStatus = itemProgress?.questionData?.status;

          // Use in-memory evaluation first, fall back to persisted questionData status
          const isCorrect = (eval_ != null && eval_.correctness >= 1) || qStatus === "correct";
          const isPartial =
            (eval_ != null && eval_.correctness > 0 && eval_.correctness < 1) ||
            qStatus === "partial";
          const isIncorrect = (eval_ != null && eval_.correctness === 0) || qStatus === "incorrect";
          const isCurrent = idx === currentIndex;

          let state: NavNodeState = "idle";
          if (isCorrect || isCompleted) state = "correct";
          else if (isPartial) state = "partial";
          else if (isIncorrect) state = "incorrect";

          return (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Item ${idx + 1}: ${
                state === "correct"
                  ? "done"
                  : state === "partial"
                    ? "almost there"
                    : state === "incorrect"
                      ? "worth another look"
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

      {/* Current item */}
      {currentItem && (
        <div className="border-subtle bg-surface shadow-e1 rounded-xl border p-5 sm:p-6">
          <div className="border-subtle mb-4 flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              {currentItem.type === "material" ? (
                <span className="bg-brand-subtle text-brand flex h-7 w-7 items-center justify-center rounded-md">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                </span>
              ) : currentItem.type === "question" ? (
                <span className="bg-brand-subtle text-brand flex h-7 w-7 items-center justify-center rounded-md">
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                </span>
              ) : null}
              <span className="text-fg-muted text-xs">
                {currentItem.type === "material" ? "Material" : "Question"}{" "}
                <span className="font-mono tabular-nums">
                  {currentIndex + 1} of {items.length}
                </span>
              </span>
            </div>
            <DifficultyChip difficulty={currentItem.difficulty} />
          </div>

          {currentItem.type === "material" ? (
            <MaterialViewer
              item={currentItem}
              onComplete={onCompleteMaterial}
              isCompleted={!!spProgress?.items?.[currentItem.id]?.completed}
            />
          ) : currentItem.type === "question" ? (
            <>
              <QuestionAnswerer
                key={currentItem.id}
                item={currentItem}
                onSubmit={(answer) => onSubmitAnswer(currentItem, answer)}
                onOpenChat={() => onOpenChat(currentItem.id)}
                evaluation={evaluations[currentItem.id]}
                mode="practice"
                showCorrect
              />
              <AttemptHistoryPanel attempts={spProgress?.items?.[currentItem.id]?.attempts ?? []} />
            </>
          ) : (
            <div className="text-fg-secondary text-sm">{currentItem.title ?? "Content item"}</div>
          )}
        </div>
      )}

      {/* Prev / Next */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
          disabled={currentIndex >= items.length - 1}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function StoryPointViewerPage() {
  const { spaceId, storyPointId } = useParams<{ spaceId: string; storyPointId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentTenantId, user } = useAuthStore();
  const userId = user?.uid ?? null;

  const { data: spaceData } = useSpace<{ title?: string }>(spaceId ?? "");
  // Repo unwraps `{ space }` — hook data IS the SpaceView.
  const space = spaceData;
  const { data: storyPoints } = useStoryPoints(null, spaceId ?? null);
  const {
    data: items,
    isLoading,
    error: itemsError,
    isError: itemsHasError,
  } = useStoryPointItems(null, spaceId ?? null, storyPointId ?? null);
  const { data: spProgressData } = useStoryPointProgress(
    asSpaceId(spaceId ?? ""),
    asStoryPointId(storyPointId ?? "")
  );
  const spProgress = (spProgressData ?? null) as StoryPointProgressDoc | null;
  const evaluateAnswer = useEvaluateAnswer();
  const recordAttempt = useRecordItemAttempt();
  const { handleError } = useApiError();

  const [chatItemId, setChatItemId] = useState<string | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, UnifiedEvaluationResult>>({});
  // All collapsed by default
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  // NOTE: We intentionally do NOT restore evaluations from persisted progress on load.
  // On revisit, the form should be fresh/interactive so the student can reattempt.
  // Status colors still show from persisted questionData.status on the nav buttons.

  const storyPoint = storyPoints?.find((sp) => sp.id === storyPointId);
  const sections = useMemo(
    () => (storyPoint?.sections ?? []).sort((a, b) => a.orderIndex - b.orderIndex),
    [storyPoint?.sections]
  );

  // Group items by section
  const itemsBySection = useMemo(() => {
    const allItems = items ?? [];
    const map: Record<string, UnifiedItem[]> = {};
    const unsectioned: UnifiedItem[] = [];
    for (const item of allItems) {
      if (item.sectionId) {
        (map[item.sectionId] ??= []).push(item);
      } else {
        unsectioned.push(item);
      }
    }
    return { map, unsectioned };
  }, [items]);

  // Check if any items are actually linked to sections
  const hasSectionedItems = useMemo(
    () => Object.keys(itemsBySection.map).length > 0,
    [itemsBySection.map]
  );

  // Prev/next story point navigation
  const currentSPIndex = storyPoints?.findIndex((sp) => sp.id === storyPointId) ?? -1;
  const prevSP = currentSPIndex > 0 && storyPoints ? storyPoints[currentSPIndex - 1] : null;
  const nextSP =
    currentSPIndex >= 0 && storyPoints && currentSPIndex < storyPoints.length - 1
      ? storyPoints[currentSPIndex + 1]
      : null;

  const getStoryPointLink = (sp: { id: string; type: string }) => {
    if (!spaceId) return spacesListHref(location.pathname);
    if (sp.type === "timed_test" || sp.type === "test") {
      return testHref(location.pathname, spaceId, sp.id);
    }
    if (sp.type === "practice") return practiceHref(location.pathname, spaceId, sp.id);
    return storyPointHref(location.pathname, spaceId, sp.id);
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleSubmitAnswer = async (item: UnifiedItem, answer: unknown) => {
    // Tenant is derived server-side from auth; only require route params.
    if (!spaceId || !storyPointId) return;
    try {
      let evaluationResult: UnifiedEvaluationResult;

      const localResult = autoEvaluateClient(item, answer);
      if (localResult) {
        evaluationResult = localResult;
      } else {
        evaluationResult = await evaluateAnswer.mutateAsync({
          tenantId: currentTenantId ?? "",
          spaceId,
          storyPointId,
          itemId: item.id,
          answer,
          mode: "practice",
        });
      }

      setEvaluations((prev) => ({ ...prev, [item.id]: evaluationResult }));

      // recordItemAttempt is now server-authoritative (A11/CD13): the client no
      // longer sends score/correct/evaluationData — the server recomputes from
      // the submitted answer. The in-memory `evaluationResult` above still drives
      // the immediate UI feedback.
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

  const handleCompleteMaterial = (itemId: string) => {
    if (!spaceId || !storyPointId) return;
    // Material completion: server marks the material item complete from the
    // attempt (no answer payload for materials).
    recordAttempt.mutate({
      spaceId: asSpaceId(spaceId),
      storyPointId: asStoryPointId(storyPointId),
      itemId: asItemId(itemId),
      answer: null,
    });
  };

  const navigatorProps = {
    spProgress,
    evaluations,
    onSubmitAnswer: handleSubmitAnswer,
    onOpenChat: (id: string) => setChatItemId(id),
    onCompleteMaterial: handleCompleteMaterial,
  };

  const header = (
    <>
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
            <BreadcrumbPage>{storyPoint?.title ?? "Story Point"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-3">
        <h1 className="font-display text-fg text-2xl">{storyPoint?.title ?? "Story Point"}</h1>
        {storyPoint?.description && (
          <p className="text-fg-secondary max-w-reading mt-1.5 text-sm leading-relaxed">
            {storyPoint.description}
          </p>
        )}
        {!storyPoint && storyPoints && storyPoints.length > 0 && (
          <p className="text-error mt-1 text-sm">
            We couldn&apos;t find this lesson — it may have moved.
          </p>
        )}
      </div>
    </>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (itemsHasError) {
    return (
      <div className="space-y-4">
        {header}
        <div className="border-subtle flex flex-col items-center justify-center rounded-xl border border-dashed py-16">
          <p className="font-display text-fg text-lg">We couldn&apos;t load this lesson</p>
          <p className="text-fg-secondary mt-1 text-xs">
            {itemsError instanceof Error
              ? itemsError.message
              : "Something hiccuped on our end. Give it another go."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-ly-rise space-y-6">
      {header}

      {/* Story point prev/next rail */}
      {storyPoints && storyPoints.length > 1 && (
        <div className="border-subtle bg-surface shadow-e1 rounded-pill flex items-center justify-between border px-3 py-1.5">
          {prevSP ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(getStoryPointLink(prevSP))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden max-w-[16rem] truncate sm:inline">{prevSP.title}</span>
              <span className="sm:hidden">Previous</span>
            </Button>
          ) : (
            <div />
          )}
          <span className="text-fg-muted font-mono text-xs tabular-nums">
            {currentSPIndex + 1} / {storyPoints.length}
          </span>
          {nextSP ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(getStoryPointLink(nextSP))}
            >
              <span className="hidden max-w-[16rem] truncate sm:inline">{nextSP.title}</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div />
          )}
        </div>
      )}

      {/* Sections with per-section item navigators (only if items have sectionId) */}
      {sections.length > 0 && hasSectionedItems ? (
        <div className="space-y-3">
          {sections.map((section) => {
            const sectionItems = itemsBySection.map[section.id] ?? [];
            const isOpen = openSections.has(section.id);
            const completedCount = sectionItems.filter(
              (item) => spProgress?.items?.[item.id]?.completed
            ).length;
            const allDone = completedCount === sectionItems.length && sectionItems.length > 0;

            return (
              <Collapsible key={section.id} open={isOpen}>
                <div
                  className={`bg-surface duration-fast ease-standard overflow-hidden rounded-xl border transition-colors ${
                    isOpen ? "border-brand-muted shadow-e1" : "border-subtle"
                  }`}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={isOpen}
                      className={`duration-fast ease-standard flex w-full items-center justify-between p-4 text-left transition-colors ${
                        isOpen ? "bg-brand-subtle/40" : "hover:bg-surface-sunken/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`text-fg-muted duration-fast h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                          aria-hidden
                        />
                        <div>
                          <h3 className="text-fg text-sm font-semibold">{section.title}</h3>
                          {section.description && (
                            <p className="text-fg-secondary mt-0.5 text-xs">
                              {section.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-fg-muted font-mono text-xs tabular-nums">
                          {completedCount}/{sectionItems.length}
                        </span>
                        {allDone && (
                          <span className="text-mastery-mastered inline-flex items-center gap-1 text-xs font-medium">
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                            <span className="hidden sm:inline">All done</span>
                          </span>
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-subtle border-t px-4 pb-4 pt-4">
                      <ItemNavigator items={sectionItems} {...navigatorProps} />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}

          {/* Unsectioned items */}
          {itemsBySection.unsectioned.length > 0 && (
            <div className="border-subtle bg-surface rounded-xl border p-4">
              <h3 className="text-fg mb-3 text-sm font-semibold">Other items</h3>
              <ItemNavigator items={itemsBySection.unsectioned} {...navigatorProps} />
            </div>
          )}
        </div>
      ) : (
        /* No sections — single navigator for all items */
        <ItemNavigator items={items ?? []} {...navigatorProps} />
      )}

      {/* Bottom story point nav */}
      {storyPoints && storyPoints.length > 1 && (
        <div className="border-subtle flex items-center justify-between border-t pt-4">
          {prevSP ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(getStoryPointLink(prevSP))}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <div />
          )}
          {nextSP ? (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(getStoryPointLink(nextSP))}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => spaceId && navigate(spaceHref(location.pathname, spaceId))}
            >
              Back to Space
            </Button>
          )}
        </div>
      )}

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
