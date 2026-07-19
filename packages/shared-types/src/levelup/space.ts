/**
 * Space entity — a learning space containing story points and items.
 * Collection: /tenants/{tenantId}/spaces/{spaceId}
 * @module levelup/space
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { UnifiedRubric } from "../content/rubric";
import type { SpaceRatingAggregate } from "./space-review";

export type SpaceType = "learning" | "practice" | "assessment" | "resource" | "hybrid";

export type SpaceStatus = "draft" | "published" | "archived";

export type SpaceAccessType = "class_assigned" | "tenant_wide" | "public_store";

export interface SpaceStats {
  totalStoryPoints: number;
  totalItems: number;
  totalStudents: number;
  avgCompletionRate?: number;
}

export interface Space {
  id: string;
  tenantId: string;

  // Core
  title: string;
  description?: string;
  thumbnailUrl?: string;
  slug?: string;

  // Classification
  type: SpaceType;
  subject?: string;
  labels?: string[];

  // Assignment
  classIds: string[];
  sectionIds?: string[];
  teacherIds: string[];
  accessType: SpaceAccessType;
  academicSessionId?: string;

  // AI configuration
  defaultEvaluatorAgentId?: string;
  defaultTutorAgentId?: string;

  // Assessment defaults
  defaultTimeLimitMinutes?: number;
  allowRetakes?: boolean;
  maxRetakes?: number;
  showCorrectAnswers?: boolean;

  // Rubric (space-level default)
  defaultRubric?: UnifiedRubric;

  // Store (B2C public marketplace)
  price?: number;
  currency?: string;
  publishedToStore?: boolean;
  storeDescription?: string;
  storeThumbnailUrl?: string;

  // Lifecycle
  status: SpaceStatus;
  publishedAt?: FirestoreTimestamp;
  archivedAt?: FirestoreTimestamp;

  // Denormalized stats
  stats?: SpaceStats;

  // Rating aggregate
  ratingAggregate?: SpaceRatingAggregate;

  // Versioning
  version?: number;

  // Audit
  createdBy: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

/**
 * ContentVersion — tracks a point-in-time snapshot of content changes.
 * Collection: /tenants/{tenantId}/spaces/{spaceId}/versions/{versionId}
 */
export interface ContentVersion {
  id: string;
  version: number;
  entityType: "space" | "storyPoint" | "item";
  entityId: string;
  changeType: "created" | "updated" | "published" | "archived";
  changeSummary: string;
  changedBy: string;
  changedAt: FirestoreTimestamp;
}
