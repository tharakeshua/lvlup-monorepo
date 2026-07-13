/**
 * onResultsReleased — Firestore trigger that sends notifications to students
 * (and their parents) when exam results are released.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
 *
 * Also notifies the teacher who created the exam.
 */
export declare const onResultsReleased: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      examId: string;
    }
  >
>;
