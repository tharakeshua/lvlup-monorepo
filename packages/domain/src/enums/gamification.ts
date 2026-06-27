import { zEnum } from "./enum.js";

export const ACHIEVEMENT_CATEGORIES = [
  "learning",
  "consistency",
  "excellence",
  "exploration",
  "social",
  "milestone",
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];
export const zAchievementCategory = zEnum(ACHIEVEMENT_CATEGORIES);

export const ACHIEVEMENT_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type AchievementRarity = (typeof ACHIEVEMENT_RARITIES)[number];
export const zAchievementRarity = zEnum(ACHIEVEMENT_RARITIES);

export const ACHIEVEMENT_TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];
export const zAchievementTier = zEnum(ACHIEVEMENT_TIERS);

export const ACHIEVEMENT_CRITERIA_TYPES = [
  "spaces_completed",
  "story_points_completed",
  "exams_passed",
  "perfect_scores",
  "streak_days",
  "total_points",
  "items_completed",
  "chat_sessions",
  "leaderboard_top3",
  "login_days",
] as const;
export type AchievementCriteriaType = (typeof ACHIEVEMENT_CRITERIA_TYPES)[number];
export const zAchievementCriteriaType = zEnum(ACHIEVEMENT_CRITERIA_TYPES);

export const STUDY_GOAL_TARGET_TYPES = [
  "spaces",
  "story_points",
  "items",
  "exams",
  "minutes",
] as const;
export type StudyGoalTargetType = (typeof STUDY_GOAL_TARGET_TYPES)[number];
export const zStudyGoalTargetType = zEnum(STUDY_GOAL_TARGET_TYPES);

export const LEADERBOARD_SCOPES = ["tenant", "space", "storyPoint"] as const;
export type LeaderboardScope = (typeof LEADERBOARD_SCOPES)[number];
export const zLeaderboardScope = zEnum(LEADERBOARD_SCOPES);
