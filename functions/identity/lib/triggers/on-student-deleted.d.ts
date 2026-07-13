/**
 * Firestore trigger: when a student status changes to 'archived',
 * remove studentId from parent.childStudentIds[] and class.studentIds[].
 */
export declare const onStudentArchived: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      studentId: string;
    }
  >
>;
