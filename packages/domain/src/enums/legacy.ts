/**
 * Legacy enum READ-ADAPTERS (widen-on-read, narrow-on-write) — DATA-MODEL-FIX-PLAN
 * §4 U1.1, AD-4/AD-5/AD-6/AD-10.
 *
 * The canonical enums (`exam.ts`, `submission.ts`, `grading.ts`, `misc.ts`,
 * `content.ts`, `entities/autograde/evaluation-settings.ts`) are ALREADY the SSOT
 * and MUST NOT be widened. But un-migrated Firestore docs (the SUB001 seed +
 * writes still emitted by `functions/{autograde,levelup}`) carry dropped legacy
 * values. This module is the ONE place those legacy values are collapsed forward
 * to canonical — the same precedent as `primitives/timestamp.ts` (`toTimestamp()`
 * colocates the canonical type with the boundary collapse).
 *
 * Contract:
 *   - `normalizeX(value)`  — pure legacy→canonical mapper (canonical passes through).
 *   - `zLegacyXRead`       — lenient READ schema: accepts canonical ∪ legacy, emits
 *                            canonical. Every consumer (repositories now, Phase-3
 *                            function migrations later) parses reads through these.
 *
 * WRITES keep using the strict canonical schemas (`zExamStatus`, `zSubmissionPipelineStatus`,
 * …). This module exports NO lenient write schema — never narrow a read schema
 * against un-migrated data, never widen a write path.
 */
import { z } from "zod";
import { EXAM_STATUSES, type ExamStatus } from "./exam.js";
import { SUBMISSION_PIPELINE_STATUSES, type SubmissionPipelineStatus } from "./submission.js";
import { UPLOAD_SOURCES, type UploadSource } from "./misc.js";
import { STORY_POINT_TYPES, type StoryPointType } from "./content.js";
import { TEST_SESSION_TYPES, type TestSessionType } from "./test-session.js";
import { zGradeLetter, type GradeLetter } from "./grading.js";
import { GRADING_PIPELINE_STEPS } from "../entities/autograde/evaluation-settings.js";

// ---------------------------------------------------------------------------
// ExamStatus — legacy 'completed' → 'grading' (AD-10).
// 'completed' meant graded-but-unreleased; mapping it to 'results_released' would
// leak results through resultsReleased-gated access. 'grading' is safe and self-
// heals on explicit release. NEVER map to 'results_released'.
// ---------------------------------------------------------------------------
export const LEGACY_EXAM_STATUSES = ["completed"] as const;
export type LegacyExamStatus = (typeof LEGACY_EXAM_STATUSES)[number];

export const normalizeExamStatus = (value: ExamStatus | LegacyExamStatus): ExamStatus =>
  value === "completed" ? "grading" : value;

export const zLegacyExamStatusRead = z
  .enum([...EXAM_STATUSES, ...LEGACY_EXAM_STATUSES])
  .transform(normalizeExamStatus);

// ---------------------------------------------------------------------------
// SubmissionPipelineStatus — 'ocr_processing' → 'scouting', 'ocr_failed' → 'scouting_failed'.
// ---------------------------------------------------------------------------
export const LEGACY_SUBMISSION_PIPELINE_STATUSES = ["ocr_processing", "ocr_failed"] as const;
export type LegacySubmissionPipelineStatus = (typeof LEGACY_SUBMISSION_PIPELINE_STATUSES)[number];

const SUBMISSION_PIPELINE_STATUS_MAP: Record<
  LegacySubmissionPipelineStatus,
  SubmissionPipelineStatus
> = {
  ocr_processing: "scouting",
  ocr_failed: "scouting_failed",
};

export const normalizeSubmissionPipelineStatus = (
  value: SubmissionPipelineStatus | LegacySubmissionPipelineStatus
): SubmissionPipelineStatus =>
  value in SUBMISSION_PIPELINE_STATUS_MAP
    ? SUBMISSION_PIPELINE_STATUS_MAP[value as LegacySubmissionPipelineStatus]
    : (value as SubmissionPipelineStatus);

export const zLegacySubmissionPipelineStatusRead = z
  .enum([...SUBMISSION_PIPELINE_STATUSES, ...LEGACY_SUBMISSION_PIPELINE_STATUSES])
  .transform(normalizeSubmissionPipelineStatus);

// ---------------------------------------------------------------------------
// Grading / DLQ pipeline step — legacy 'ocr' → 'scouting'.
// Canonical = GRADING_PIPELINE_STEPS (['scouting','grading']).
// ---------------------------------------------------------------------------
export type GradingPipelineStep = (typeof GRADING_PIPELINE_STEPS)[number];
export const LEGACY_GRADING_PIPELINE_STEPS = ["ocr"] as const;
export type LegacyGradingPipelineStep = (typeof LEGACY_GRADING_PIPELINE_STEPS)[number];

export const normalizeGradingPipelineStep = (
  value: GradingPipelineStep | LegacyGradingPipelineStep
): GradingPipelineStep => (value === "ocr" ? "scouting" : value);

export const zLegacyGradingPipelineStepRead = z
  .enum([...GRADING_PIPELINE_STEPS, ...LEGACY_GRADING_PIPELINE_STEPS])
  .transform(normalizeGradingPipelineStep);

// ---------------------------------------------------------------------------
// UploadSource — legacy 'gcs' → 'scanner'. Keep 'rn' (mobile writes it).
// ---------------------------------------------------------------------------
export const LEGACY_UPLOAD_SOURCES = ["gcs"] as const;
export type LegacyUploadSource = (typeof LEGACY_UPLOAD_SOURCES)[number];

export const normalizeUploadSource = (value: UploadSource | LegacyUploadSource): UploadSource =>
  value === "gcs" ? "scanner" : value;

export const zLegacyUploadSourceRead = z
  .enum([...UPLOAD_SOURCES, ...LEGACY_UPLOAD_SOURCES])
  .transform(normalizeUploadSource);

// ---------------------------------------------------------------------------
// StoryPointType — legacy synonym 'test' → 'timed_test'.
// ---------------------------------------------------------------------------
export const LEGACY_STORY_POINT_TYPES = ["test"] as const;
export type LegacyStoryPointType = (typeof LEGACY_STORY_POINT_TYPES)[number];

export const normalizeStoryPointType = (
  value: StoryPointType | LegacyStoryPointType
): StoryPointType => (value === "test" ? "timed_test" : value);

export const zLegacyStoryPointTypeRead = z
  .enum([...STORY_POINT_TYPES, ...LEGACY_STORY_POINT_TYPES])
  .transform(normalizeStoryPointType);

// ---------------------------------------------------------------------------
// TestSessionType — legacy 'test'/'exam' → 'timed_test' (both are timed
// assessments; NEVER map to quiz/practice). Written at rest by the legacy
// functions/LevelUp session writer and by pre-LVL-1 storyPointTypeToSessionType.
// ---------------------------------------------------------------------------
export const LEGACY_TEST_SESSION_TYPES = ["test", "exam"] as const;
export type LegacyTestSessionType = (typeof LEGACY_TEST_SESSION_TYPES)[number];

export const normalizeTestSessionType = (
  value: TestSessionType | LegacyTestSessionType
): TestSessionType => (value === "test" || value === "exam" ? "timed_test" : value);

export const zLegacyTestSessionTypeRead = z
  .enum([...TEST_SESSION_TYPES, ...LEGACY_TEST_SESSION_TYPES])
  .transform(normalizeTestSessionType);

// ---------------------------------------------------------------------------
// GradeLetter — legacy docs stored `grade` as a free string. Widen the STORAGE
// type (string) into the canonical 8-letter enum; there is NO legacy letter
// aliasing, so an unknown letter FAILS the parse (never guess — AD-4).
// ---------------------------------------------------------------------------
export const normalizeGradeLetter = (value: string): GradeLetter => zGradeLetter.parse(value);

export const zLegacyGradeLetterRead = z.string().pipe(zGradeLetter);
