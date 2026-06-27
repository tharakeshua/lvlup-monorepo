import * as admin from "firebase-admin";

admin.initializeApp();

// Allow undefined values in Firestore documents (converted to null)
admin.firestore().settings({ ignoreUndefinedProperties: true });

// ── Consolidated callable functions ─────────────────────────────────────────
export { saveExam } from "./callable/save-exam";
export { gradeQuestion } from "./callable/grade-question";

// ── Unchanged callable functions ────────────────────────────────────────────
export { extractQuestions } from "./callable/extract-questions";
export { uploadAnswerSheets } from "./callable/upload-answer-sheets";

// ── Storage triggers ────────────────────────────────────────────────────────
export { onQuestionPaperUpload } from "./triggers/on-question-paper-upload";
export { onAnswerSheetUpload } from "./triggers/on-answer-sheet-upload";

// ── Notification triggers ─────────────────────────────────────────────────
export { onExamPublished } from "./triggers/on-exam-published";
export { onResultsReleased } from "./triggers/on-results-released";

// ── Firestore triggers ─────────────────────────────────────────────────────
export { onSubmissionCreated } from "./triggers/on-submission-created";
export { onSubmissionUpdated } from "./triggers/on-submission-updated";
export { onExamDeleted } from "./triggers/on-exam-deleted";
// Exported as V2 to match the previously deployed Firestore trigger and avoid
// any leftover name clash with an old HTTPS function.
export { onQuestionSubmissionUpdatedV2 } from "./triggers/on-question-submission-updated";

// ── Scheduled functions ──────────────────────────────────────────────────
export { staleSubmissionWatchdog } from "./schedulers/stale-submission-watchdog";
