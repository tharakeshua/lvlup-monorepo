/**
 * onSubmissionGraded — Firestore trigger that recalculates the AutoGrade
 * section of a student's progress summary when a submission is graded.
 *
 * Triggers on: /tenants/{tenantId}/submissions/{submissionId}
 * Condition: status changes to 'graded' or 'results_released'
 */
export declare const onSubmissionGraded: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      submissionId: string;
    }
  >
>;
