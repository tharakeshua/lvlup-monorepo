/**
 * Runtime type guards for Auto-LevelUp domain types.
 *
 * Use these at external data boundaries (Firestore reads, API responses,
 * URL params) to narrow types safely at runtime.
 *
 * @module type-guards
 */

import type { UnifiedItem, QuestionType, MaterialType } from "./content";
import type { FirestoreTimestamp } from "./identity";
import { AUTO_EVALUATABLE_TYPES, AI_EVALUATABLE_TYPES } from "./content";

// ── Item type guards ──────────────────────────────────────────────────────

/** Narrows a UnifiedItem to a question type item. */
export function isQuestionItem(item: UnifiedItem): item is UnifiedItem & { type: "question" } {
  return item.type === "question";
}

/** Narrows a UnifiedItem to a material type item. */
export function isMaterialItem(item: UnifiedItem): item is UnifiedItem & { type: "material" } {
  return item.type === "material";
}

// ── Question evaluation guards ────────────────────────────────────────────

/** Returns true if the question type supports deterministic auto-evaluation. */
export function isAutoEvaluatable(questionType: QuestionType): boolean {
  return (AUTO_EVALUATABLE_TYPES as readonly string[]).includes(questionType);
}

/** Returns true if the question type requires AI-based evaluation. */
export function isAIEvaluatable(questionType: QuestionType): boolean {
  return (AI_EVALUATABLE_TYPES as readonly string[]).includes(questionType);
}

// ── Firestore timestamp guard ─────────────────────────────────────────────

/** Runtime check for Firestore Timestamp-like objects. */
export function isFirestoreTimestamp(value: unknown): value is FirestoreTimestamp {
  return (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    "nanoseconds" in value &&
    typeof (value as Record<string, unknown>).seconds === "number" &&
    typeof (value as Record<string, unknown>).nanoseconds === "number"
  );
}

// ── Status guards ─────────────────────────────────────────────────────────

/** Returns true if the value is a non-empty string (useful for ID validation). */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Returns true if the value is a valid Firestore document ID (non-empty, no slashes). */
export function isValidDocumentId(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 1500 && !value.includes("/")
  );
}
