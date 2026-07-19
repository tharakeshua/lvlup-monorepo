/**
 * Item metadata and analytics dimension types.
 * @module content/item-metadata
 */

import type { BloomsLevel } from "../constants/grades";

export interface PyqInfo {
  exam: string;
  year: number;
  session?: string;
  questionNumber?: string;
}

export interface MigrationSource {
  type: "levelup_item" | "levelup_question" | "autograde_question";
  sourceId: string;
  sourceCollection: string;
}

/**
 * Rich metadata for a UnifiedItem.
 * Both totalPoints (gamified) and maxMarks (academic) are always available.
 */
export interface ItemMetadata {
  totalPoints?: number;
  maxMarks?: number;
  estimatedTime?: number;
  tags?: string[];

  // Educational metadata
  learningObjectives?: string[];
  skillsAssessed?: string[];
  bloomsLevel?: BloomsLevel;
  prerequisites?: string[];

  // Retries
  isRetriable?: boolean;

  // AI evaluator override
  evaluatorAgentId?: string;

  // PYQ metadata
  pyqInfo?: PyqInfo[];

  // Analytics
  featured?: boolean;
  viewCount?: number;
  successRate?: number;

  // Migration
  migrationSource?: MigrationSource;
}

/**
 * Multi-dimensional analytics attached to items.
 * Powers filtering, reporting, and AI recommendations.
 */
export interface ItemAnalytics {
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[];
  labels?: string[];
  bloomsLevel?: BloomsLevel;
  bloomsSubLevel?: string;
  cognitiveLoad?: "low" | "medium" | "high";
  skillsAssessed?: string[];
  primarySkill?: string;
  secondarySkills?: string[];
  conceptCategory?: string;
  learningObjective?: string;
  applicationDomain?: "theory" | "practical" | "real-world" | "conceptual";
  questionComplexity?: "single-concept" | "multi-concept" | "synthesis" | "integration";
  prerequisiteTopics?: string[];
  relatedTopics?: string[];
  conceptImportance?: "foundational" | "important" | "advanced" | "optional" | "bonus";
  commonMistakes?: string[];
  hintsAvailable?: boolean;
  curriculumStandards?: string[];
  examRelevance?: string[];
  customDimensions?: Record<string, string | string[] | number>;
}
