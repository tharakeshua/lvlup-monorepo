import { useMemo } from "react";
import { UserStoryPointProgressDoc } from "../services/progress/UserStoryPointProgressService";
import { ItemProgressEntry } from "../types/items";

export interface StoryPointProgressSummary {
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  completedItems: number;
  totalItems: number;
}

/**
 * Hook to compute consistent progress calculations from a UserStoryPointProgressDoc.
 * This ensures the same calculation logic is used across the app.
 */
export const useStoryPointProgressCalculations = (
  progressDoc: UserStoryPointProgressDoc | null
): StoryPointProgressSummary => {
  return useMemo(() => {
    if (!progressDoc) {
      return {
        pointsEarned: 0,
        totalPoints: 0,
        percentage: 0,
        completedItems: 0,
        totalItems: 0,
      };
    }

    const items = Object.values(progressDoc.items || {});

    // Calculate totals from all items in the progress document
    let pointsEarned = 0;
    let totalPoints = 0;
    let completedItems = 0;
    const totalItems = items.length;

    items.forEach((item: ItemProgressEntry) => {
      if (item.itemType === "question" && item.questionData) {
        const q = item.questionData;
        totalPoints += q.totalPoints || 0;
        pointsEarned += q.pointsEarned || 0;
        if (q.solved || item.completed) {
          completedItems++;
        }
      } else if (item.itemType !== "question") {
        // For non-question items, count completion but no points for now
        if (item.completed) {
          completedItems++;
        }
      }
    });

    const percentage = totalPoints > 0 ? Math.round((pointsEarned / totalPoints) * 100) : 0;

    return {
      pointsEarned,
      totalPoints,
      percentage,
      completedItems,
      totalItems,
    };
  }, [progressDoc]);
};

export default useStoryPointProgressCalculations;
