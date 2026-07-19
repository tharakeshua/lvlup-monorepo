/**
 * Firestore trigger: when a class status changes to 'archived',
 * remove classId from all linked students' and teachers' classIds[].
 */
export declare const onClassArchived: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      classId: string;
    }
  >
>;
