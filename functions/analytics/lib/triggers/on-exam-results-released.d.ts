/**
 * onExamResultsReleased — Firestore trigger that computes ExamAnalytics
 * when an exam's status changes to 'results_released'.
 *
 * Triggers on: /tenants/{tenantId}/exams/{examId}
 */
export declare const onExamResultsReleased: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      examId: string;
      tenantId: string;
    }
  >
>;
