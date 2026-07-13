/**
 * RubricPreset — reusable rubric template for evaluation.
 * Collection: /tenants/{tenantId}/rubricPresets/{presetId}
 * @module content/rubric-preset
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { UnifiedRubric } from "./rubric";
import type { QuestionType } from "./item";

export type RubricPresetCategory =
  | "general"
  | "math"
  | "science"
  | "language"
  | "coding"
  | "essay"
  | "custom";

export interface RubricPreset {
  id: string;
  tenantId: string;

  // Display
  name: string;
  description?: string;

  // The rubric template
  rubric: UnifiedRubric;

  // Classification
  category: RubricPresetCategory;
  questionTypes?: QuestionType[];

  // System-provided vs teacher-created
  isDefault: boolean;

  // Audit
  createdBy: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
