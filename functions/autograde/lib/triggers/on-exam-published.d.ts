/**
 * onExamPublished — Firestore trigger that sends notifications to students
 * in the exam's assigned classes when the exam status changes to 'published'.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
 */
export declare const onExamPublished: import("firebase-functions/core").CloudFunction<
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
