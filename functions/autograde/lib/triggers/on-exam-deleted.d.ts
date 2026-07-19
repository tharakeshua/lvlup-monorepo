/**
 * Firestore trigger: cascade delete when an exam is deleted.
 *
 * Cleans up:
 * - All submissions for this exam
 * - All questionSubmissions (subcollections of submissions)
 * - All examQuestions (subcollection of exam)
 * - Exam analytics document
 */
export declare const onExamDeleted: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    import("firebase-functions/firestore").QueryDocumentSnapshot | undefined,
    {
      tenantId: string;
      examId: string;
    }
  >
>;
