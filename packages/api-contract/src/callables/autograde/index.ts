/**
 * Autograde module barrel. Exports `AUTOGRADE_CALLABLES` — the named record the
 * api-contract CORE (`src/registry.ts`) spreads into the flat `CALLABLES` registry,
 * exactly as documented in api-contract-core.md §3.1. Also re-exports every def's
 * schemas + inferred types so repositories/services/functions import them from the
 * package's public surface.
 *
 * The `<module>` name-segment of every key equals `def.module === 'autograde'`
 * (asserted by the core registry-integrity test). No request schema in this module
 * declares a `tenantId` field (D2 — asserted by the no-tenant-id-in-request test).
 */
import type { CallableDef } from "../../callable-def.js";

import { saveExamDef } from "./save-exam.js";
import { saveExamQuestionDef } from "./save-exam-question.js";
import { extractQuestionsDef } from "./extract-questions.js";
import { uploadAnswerSheetsDef } from "./upload-answer-sheets.js";
import { gradeQuestionDef } from "./grade-question.js";
import { releaseResultsDef } from "./release-results.js";
import { saveEvaluationSettingsDef } from "./save-evaluation-settings.js";
import { resolveDeadLetterDef } from "./resolve-dead-letter.js";
import { listExamsDef } from "./list-exams.js";
import { getExamDef } from "./get-exam.js";
import { listQuestionsDef } from "./list-questions.js";
import { listSubmissionsDef } from "./list-submissions.js";
import { getSubmissionDef } from "./get-submission.js";
import { listQuestionSubmissionsDef } from "./list-question-submissions.js";
import { getExamAnalyticsDef } from "./get-exam-analytics.js";
import { listEvaluationSettingsDef } from "./list-evaluation-settings.js";
import { getAutogradeEvaluationConfigDef } from "./get-evaluation-config.js";
import { listDeadLetterDef } from "./list-dead-letter.js";

/** The autograde slice of the callable registry. Spread by core into `CALLABLES`. */
export const AUTOGRADE_CALLABLES = {
  "v1.autograde.saveExam": saveExamDef,
  "v1.autograde.saveExamQuestion": saveExamQuestionDef,
  "v1.autograde.extractQuestions": extractQuestionsDef,
  "v1.autograde.uploadAnswerSheets": uploadAnswerSheetsDef,
  "v1.autograde.gradeQuestion": gradeQuestionDef,
  "v1.autograde.releaseResults": releaseResultsDef,
  "v1.autograde.saveEvaluationSettings": saveEvaluationSettingsDef,
  "v1.autograde.resolveDeadLetter": resolveDeadLetterDef,
  "v1.autograde.listExams": listExamsDef,
  "v1.autograde.getExam": getExamDef,
  "v1.autograde.listQuestions": listQuestionsDef,
  "v1.autograde.listSubmissions": listSubmissionsDef,
  "v1.autograde.getSubmission": getSubmissionDef,
  "v1.autograde.listQuestionSubmissions": listQuestionSubmissionsDef,
  "v1.autograde.getExamAnalytics": getExamAnalyticsDef,
  "v1.autograde.listEvaluationSettings": listEvaluationSettingsDef,
  "v1.autograde.getEvaluationConfig": getAutogradeEvaluationConfigDef,
  "v1.autograde.listDeadLetter": listDeadLetterDef,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as const satisfies Record<string, CallableDef<any, any>>;

// Per-callable schema + type re-exports (public surface for downstream layers).
export * from "./_shared.js";
export * from "./save-exam.js";
export * from "./save-exam-question.js";
export * from "./extract-questions.js";
export * from "./upload-answer-sheets.js";
export * from "./grade-question.js";
export * from "./release-results.js";
export * from "./save-evaluation-settings.js";
export * from "./resolve-dead-letter.js";
export * from "./list-exams.js";
export * from "./get-exam.js";
export * from "./list-questions.js";
export * from "./list-submissions.js";
export * from "./get-submission.js";
export * from "./list-question-submissions.js";
export * from "./get-exam-analytics.js";
export * from "./list-evaluation-settings.js";
export * from "./get-evaluation-config.js";
export * from "./list-dead-letter.js";
