/**
 * onAnswerSheetUpload — Cloud Storage trigger.
 *
 * Fires when answer sheet images are uploaded to:
 *   tenants/{tenantId}/exams/{examId}/answer-sheets/{studentId}/{filename}
 *
 * Collects uploaded images and creates a submission document if one doesn't
 * already exist. The submission creation then triggers the grading pipeline
 * via the existing onSubmissionCreated Firestore trigger.
 *
 * Note: For the primary upload flow (web/scanner), the uploadAnswerSheets
 * callable is preferred. This Storage trigger serves as an alternative path
 * for bulk file uploads via GCS or automated scanning pipelines.
 */
export declare const onAnswerSheetUpload: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/storage").StorageEvent
>;
