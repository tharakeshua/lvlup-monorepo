/**
 * onQuestionSubmissionUpdated — Checks if all questions are graded and
 * triggers submission finalization.
 */
export declare const onQuestionSubmissionUpdatedV2: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      submissionId: string;
      questionId: string;
    }
  >
>;
