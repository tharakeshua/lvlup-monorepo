/**
 * Achievement & Gamification types for the student experience.
 * Collection: /tenants/{tenantId}/achievements/{achievementId}
 * Collection: /tenants/{tenantId}/studentAchievements/{odocId}
 * @module gamification/achievement
 */

import type { FirestoreTimestamp } from "../identity/user";

export type AchievementCategory =
  | "learning" // Completing spaces, story points
  | "consistency" // Streaks, daily logins
  | "excellence" // High scores, perfect exams
  | "exploration" // Trying different subjects
  | "social" // Leaderboard, helping peers
  | "milestone"; // Major progress milestones

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

/**
 * Achievement definition — a badge template created by the system or tenant admin.
 */
export interface Achievement {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name
  category: AchievementCategory;
  rarity: AchievementRarity;
  tier: AchievementTier;

  /** Criteria for earning this achievement */
  criteria: AchievementCriteria;

  /** Points awarded when earned */
  pointsReward: number;

  /** Whether this achievement is active */
  isActive: boolean;

  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface AchievementCriteria {
  type: AchievementCriteriaType;
  threshold: number; // e.g., 10 spaces completed
  subject?: string; // optional subject filter
  spaceId?: string; // optional space filter
}

export type AchievementCriteriaType =
  | "spaces_completed"
  | "story_points_completed"
  | "exams_passed"
  | "perfect_scores"
  | "streak_days"
  | "total_points"
  | "items_completed"
  | "chat_sessions"
  | "leaderboard_top3"
  | "login_days";

/**
 * StudentAchievement — records a student earning an achievement.
 */
export interface StudentAchievement {
  id: string;
  tenantId: string;
  userId: string;
  achievementId: string;
  achievement: Achievement; // Denormalized for display
  earnedAt: FirestoreTimestamp;
  seen: boolean; // Whether the user has seen the unlock notification
}

/**
 * Student level/XP summary.
 * Document: /tenants/{tenantId}/studentLevels/{userId}
 */
export interface StudentLevel {
  id: string;
  tenantId: string;
  userId: string;
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  totalXP: number;
  tier: AchievementTier;
  achievementCount: number;
  updatedAt: FirestoreTimestamp;
}

/**
 * Study goal for the study planner.
 * Collection: /tenants/{tenantId}/studyGoals/{goalId}
 */
export interface StudyGoal {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  description?: string;
  targetType: "spaces" | "story_points" | "items" | "exams" | "minutes";
  targetCount: number;
  currentCount: number;
  startDate: string; // ISO date
  endDate: string; // ISO date
  completed: boolean;
  completedAt?: FirestoreTimestamp;
  createdAt: FirestoreTimestamp;
}

/**
 * Study session log entry.
 */
export interface StudySession {
  id: string;
  tenantId: string;
  userId: string;
  date: string; // ISO date
  minutesStudied: number;
  spacesWorked: string[];
  itemsCompleted: number;
  pointsEarned: number;
}
