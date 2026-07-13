/**
 * Item progress entry — represents progress on a single item within a story point.
 */

export interface QuestionProgressData {
  pointsEarned: number;
  totalPoints: number;
  attemptsCount: number;
  solved?: boolean;
}

export interface ItemProgressEntry {
  itemId: string;
  itemType: "question" | "content" | "video" | "activity";
  completed: boolean;
  interactions: number;
  questionData?: QuestionProgressData;
  updatedAt?: unknown;
}
