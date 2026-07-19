/**
 * onSubmissionUpdated — Firestore trigger for pipeline state machine transitions.
 *
 * Watches for pipelineStatus changes and triggers the next pipeline step.
 */
export declare const onSubmissionUpdated: import("firebase-functions/core").CloudFunction<
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
