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
    return <p className="text-muted-foreground py-2 text-sm">No items in this section.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Numbered item buttons */}
      <div className="flex flex-wrap gap-1.5">
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

          let bg = "bg-muted text-muted-foreground";
          if (isCorrect || (isCompleted && item.type === "material")) {
            bg = "bg-emerald-500 text-white";
          } else if (isPartial) {
            bg = "bg-yellow-500 text-white";
          } else if (isIncorrect) {
            bg = "bg-red-400 text-white";
          } else if (isCompleted) {
            bg = "bg-emerald-500 text-white";
          }

          return (
            <button
              key={item.id}
              onClick={() => setCurrentIndex(idx)}
              className={`h-8 w-8 rounded text-xs font-medium transition-colors ${bg} ${isCurrent ? "ring-primary ring-2 ring-offset-1" : ""}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current item */}
      {currentItem && (
        <div className="bg-card rounded-lg border p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentItem.type === "material" ? (
                <FileText className="text-primary h-4 w-4" />
              ) : currentItem.type === "question" ? (
                <HelpCircle className="h-4 w-4 text-purple-500" />
              ) : null}
              <span className="text-muted-foreground text-sm">
                {currentIndex + 1} of {items.length}
              </span>
            </div>
            {currentItem.difficulty && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  currentItem.difficulty === "easy"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : currentItem.difficulty === "medium"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {currentItem.difficulty}
              </span>
            )}
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
            <div className="text-muted-foreground text-sm">
              {currentItem.title ?? "Content item"}
            </div>
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
              <Link to={spaceId ? spaceHref(location.pathname, spaceId) : spacesListHref(location.pathname)}>
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

      <div className="mt-2">
        <h1 className="text-xl font-bold">{storyPoint?.title ?? "Story Point"}</h1>
        {storyPoint?.description && (
          <p className="text-muted-foreground mt-1 text-sm">{storyPoint.description}</p>
        )}
        {!storyPoint && storyPoints && storyPoints.length > 0 && (
          <p className="text-destructive mt-1 text-sm">Story point not found</p>
        )}
      </div>
    </>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (itemsHasError) {
    return (
      <div className="space-y-4">
        {header}
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <p className="text-destructive text-sm font-medium">Failed to load content items</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {itemsError instanceof Error ? itemsError.message : "An unexpected error occurred"}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* Story point prev/next */}
      {storyPoints && storyPoints.length > 1 && (
        <div className="bg-card flex items-center justify-between rounded-lg border px-4 py-2">
          {prevSP ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(getStoryPointLink(prevSP))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{prevSP.title}</span>
              <span className="sm:hidden">Previous</span>
            </Button>
          ) : (
            <div />
          )}
          <span className="text-muted-foreground text-xs">
            {currentSPIndex + 1} / {storyPoints.length}
          </span>
          {nextSP ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(getStoryPointLink(nextSP))}
            >
              <span className="hidden sm:inline">{nextSP.title}</span>
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

            return (
              <Collapsible key={section.id} open={isOpen}>
                <div
                  className={`bg-card overflow-hidden rounded-lg border-2 transition-colors ${isOpen ? "border-primary/30" : "border-border"}`}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      onClick={() => toggleSection(section.id)}
                      className={`flex w-full items-center justify-between p-4 text-left transition-colors ${isOpen ? "bg-primary/5" : "hover:bg-accent/50"}`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`text-muted-foreground h-4 w-4 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                        />
                        <div>
                          <h3 className="text-sm font-semibold">{section.title}</h3>
                          {section.description && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {section.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs tabular-nums">
                          {completedCount}/{sectionItems.length}
                        </span>
                        {completedCount === sectionItems.length && sectionItems.length > 0 && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t px-4 pb-4 pt-4">
                      <ItemNavigator items={sectionItems} {...navigatorProps} />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}

          {/* Unsectioned items */}
          {itemsBySection.unsectioned.length > 0 && (
            <div className="bg-card rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-semibold">Other Items</h3>
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
        <div className="flex items-center justify-between border-t pt-4">
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
