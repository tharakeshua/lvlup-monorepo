import { useState, useEffect, useCallback } from "react";
import UserStoryPointProgressService, {
  UserStoryPointProgressDoc,
} from "../services/progress/UserStoryPointProgressService";
import { ItemProgressEntry } from "../types/items";

export interface StoryPointProgressState {
  // Raw progress document
  progressDoc: UserStoryPointProgressDoc | null;

  // Computed aggregates
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  completedItems: number;
  totalItems: number;

  // Loading states
  isLoading: boolean;
  hasError: boolean;
}

export interface UseStoryPointProgressResult {
  progress: StoryPointProgressState;

  // Methods to get progress for specific items
  getItemProgress: (itemId: string) => {
    pointsGained: number;
    totalPoints: number;
    completed: boolean;
    attemptsCount: number;
  } | null;

  // Method to refresh progress (useful for manual refresh)
  refresh: () => void;
}

/**
 * Custom hook to manage story point progress with realtime updates.
 * This is the single source of truth for all story point progress data.
 */
export const useStoryPointProgress = (
  userId: string | null | undefined,
  storyPointId: string,
  options: {
    enabled?: boolean;
    // Optional list of all item IDs in this story point to compute completion percentage over
    itemIds?: string[];
  } = {}
): UseStoryPointProgressResult => {
  const { enabled = true, itemIds } = options;

  const [progress, setProgress] = useState<StoryPointProgressState>({
    progressDoc: null,
    pointsEarned: 0,
    totalPoints: 0,
    percentage: 0,
    completedItems: 0,
    totalItems: 0,
    isLoading: true,
    hasError: false,
  });

  // Compute aggregates from progress document
  const computeAggregates = useCallback(
    (doc: UserStoryPointProgressDoc | null): StoryPointProgressState => {
      if (!doc) {
        return {
          progressDoc: null,
          pointsEarned: 0,
          totalPoints: 0,
          percentage: 0,
          completedItems: 0,
          totalItems: 0,
          isLoading: false,
          hasError: false,
        };
      }

      const items = Object.values(doc.items || {});

      // Calculate totals from all items in the progress document
      let pointsEarned = 0;
      let totalPoints = 0;
      let completedItems = 0;
      // If the caller provides the full list of item IDs, use that as the denominator
      const totalItems = Array.isArray(itemIds) ? itemIds.length : items.length;

      const countCompletedForId = (id: string) => {
        const entry = (doc.items || {})[id] as ItemProgressEntry | undefined;
        return entry?.completed ? 1 : 0;
      };

      items.forEach((item: ItemProgressEntry) => {
        if (item.itemType === "question" && item.questionData) {
          const q = item.questionData;
          totalPoints += q.totalPoints || 0;
          pointsEarned += q.pointsEarned || 0;
          if (!Array.isArray(itemIds)) {
            if (item.completed) completedItems++;
          }
        } else if (item.itemType !== "question") {
          // For non-question items, count completion but no points for now
          if (!Array.isArray(itemIds)) {
            if (item.completed) completedItems++;
          }
        }
      });

      // If itemIds are provided, compute completion strictly over that set
      if (Array.isArray(itemIds)) {
        completedItems = itemIds.reduce((acc, id) => acc + countCompletedForId(id), 0);
      }

      // Percentage is based on completion, not points
      const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      return {
        progressDoc: doc,
        pointsEarned,
        totalPoints,
        percentage,
        completedItems,
        totalItems,
        isLoading: false,
        hasError: false,
      };
    },
    [Array.isArray(itemIds) ? itemIds.join(",") : ""]
  );

  // Subscribe to progress updates
  useEffect(() => {
    if (!enabled || !userId || !storyPointId) {
      setProgress((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    // Clear old progress data when story point changes to prevent stale data
    setProgress({
      progressDoc: null,
      pointsEarned: 0,
      totalPoints: 0,
      percentage: 0,
      completedItems: 0,
      totalItems: 0,
      isLoading: true,
      hasError: false,
    });

    const unsubscribe = UserStoryPointProgressService.subscribe(
      userId,
      storyPointId,
      (doc: UserStoryPointProgressDoc | null) => {
        try {
          const newState = computeAggregates(doc);
          setProgress(newState);
        } catch (error) {
          console.error("[useStoryPointProgress] Error computing aggregates:", error);
          setProgress((prev) => ({
            ...prev,
            isLoading: false,
            hasError: true,
          }));
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId, storyPointId, enabled, computeAggregates]);

  // Get progress for a specific item
  const getItemProgress = useCallback(
    (itemId: string) => {
      if (!progress.progressDoc) {
        return {
          pointsGained: 0,
          totalPoints: 0,
          completed: false,
          attemptsCount: 0,
        };
      }

      const item = progress.progressDoc.items?.[itemId];
      if (!item) {
        return {
          pointsGained: 0,
          totalPoints: 0,
          completed: false,
          attemptsCount: 0,
        };
      }

      if (item.itemType === "question" && item.questionData) {
        const q = item.questionData;
        return {
          pointsGained: q.pointsEarned || 0,
          totalPoints: q.totalPoints || 0,
          // Completion should come from progress.completed
          completed: !!item.completed,
          attemptsCount: q.attemptsCount || 0,
        };
      } else {
        return {
          pointsGained: 0,
          totalPoints: 0,
          completed: !!item.completed,
          attemptsCount: item.interactions || 0,
        };
      }
    },
    [progress.progressDoc]
  );

  // Refresh progress (re-trigger subscription)
  const refresh = useCallback(() => {
    if (!enabled || !userId || !storyPointId) return;

    setProgress((prev) => ({ ...prev, isLoading: true, hasError: false }));
    // The subscription will automatically re-fetch
  }, [enabled, userId, storyPointId]);

  return {
    progress,
    getItemProgress,
    refresh,
  };
};

export default useStoryPointProgress;
