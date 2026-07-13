/**
 * onSpacePublished — Firestore trigger that sends notifications to enrolled
 * students when a space's status changes to 'published'.
 *
 * Triggers on: /tenants/{tenantId}/spaces/{spaceId}
 */
export declare const onSpacePublished: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
      spaceId: string;
    }
  >
>;
