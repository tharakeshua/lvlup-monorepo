/**
 * onSubmissionCreated — Firestore trigger to kick off the grading pipeline.
 *
 * Uses Firestore triggers (not Cloud Tasks) for pipeline chaining so it
 * works seamlessly with the Firebase emulator.
 */
export declare const onSubmissionCreated: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    import("firebase-functions/firestore").QueryDocumentSnapshot | undefined,
    {
      tenantId: string;
      submissionId: string;
    }
  >
>;
