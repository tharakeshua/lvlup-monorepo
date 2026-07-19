import * as admin from "firebase-admin";

admin.initializeApp();

// ─────────────────────────────────────────────────────
// Consolidated Endpoints
// ─────────────────────────────────────────────────────
export { saveSpace } from "./callable/save-space";
export { saveStoryPoint } from "./callable/save-story-point";
export { saveItem } from "./callable/save-item";
export { getItemForEdit } from "./callable/get-item-for-edit";
export { listVersions } from "./callable/list-versions";

// ─────────────────────────────────────────────────────
// Assessment (Callable)
// ─────────────────────────────────────────────────────
export { startTestSession } from "./callable/start-test-session";
export { submitTestSession } from "./callable/submit-test-session";
export { evaluateAnswer } from "./callable/evaluate-answer";
export { recordItemAttempt } from "./callable/record-item-attempt";

// ─────────────────────────────────────────────────────
// Question Bank & Rubric Presets (Callable)
// ─────────────────────────────────────────────────────
export { saveQuestionBankItem } from "./callable/save-question-bank-item";
export { listQuestionBank } from "./callable/list-question-bank";
export { importFromBank } from "./callable/import-from-bank";
export { saveRubricPreset } from "./callable/save-rubric-preset";

// ─────────────────────────────────────────────────────
// AI Chat (Callable)
// ─────────────────────────────────────────────────────
export { sendChatMessage } from "./callable/send-chat-message";

// ─────────────────────────────────────────────────────
// Reviews & Ratings (Callable)
// ─────────────────────────────────────────────────────
export { saveSpaceReview } from "./callable/save-space-review";

// ─────────────────────────────────────────────────────
// Consumer / B2C Store (Callable)
// ─────────────────────────────────────────────────────
export { listStoreSpaces } from "./callable/list-store-spaces";
export { purchaseSpace } from "./callable/purchase-space";

// ─────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────
export { onTestSessionExpired } from "./triggers/on-test-session-expired";
export { onSpaceDeleted } from "./triggers/on-space-deleted";
export { onSpacePublished } from "./triggers/on-space-published";

// ─────────────────────────────────────────────────────
// Cleanup Schedulers
// ─────────────────────────────────────────────────────
export { cleanupStaleSessions } from "./triggers/cleanup-stale-sessions";
export { cleanupInactiveChats } from "./triggers/cleanup-inactive-chats";
