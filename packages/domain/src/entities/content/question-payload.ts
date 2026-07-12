/**
 * The 15 question-type payloads — the REAL `z.discriminatedUnion` on `questionType`
 * (REVIEW top-risk #3 / be-levelup §4.3), now DERIVED from `QUESTION_TYPE_REGISTRY`
 * (DP-2 Part A). This module re-exports the existing public identifiers under their
 * original names so every downstream import keeps resolving; only the SOURCE moved
 * (hand-authored union → registry-derived). DP-2 is behavior-preserving: the
 * exported `QuestionTypeDataSchema` is structurally identical to the pre-DP-2 union
 * (same 15 members, same per-type shapes incl. their current answer fields).
 */
export {
  QuestionTypeDataSchema,
  McqOptionSchema,
  QUESTION_TYPE_REGISTRY,
  QUESTION_TYPES,
  zQuestionType,
  minimalQuestionData,
  AUTO_EVALUATABLE_TYPES,
  AI_EVALUATABLE_TYPES,
} from "./question-types/registry.js";
export type {
  QuestionTypeData,
  McqOption,
  QuestionTypeSpec,
  GradingMode,
  QuestionType,
} from "./question-types/registry.js";
