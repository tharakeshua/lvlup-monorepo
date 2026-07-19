/**
 * onQuestionPaperUpload — Cloud Storage trigger.
 *
 * Fires when a file is uploaded to the question paper path:
 *   tenants/{tenantId}/exams/{examId}/question-paper/{filename}
 *
 * Updates the exam document with the uploaded image paths and transitions
 * status from 'draft' to 'question_paper_uploaded'.
 */
export declare const onQuestionPaperUpload: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/storage").StorageEvent
>;
