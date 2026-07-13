/**
 * Firestore trigger: when a tenant status changes to 'suspended' or 'expired',
 * suspend all active memberships for that tenant.
 *
 * This prevents orphaned active memberships from allowing access
 * to a deactivated tenant's resources.
 */
export declare const onTenantDeactivated: import("firebase-functions/core").CloudFunction<
  import("firebase-functions/firestore").FirestoreEvent<
    | import("firebase-functions/firestore").Change<
        import("firebase-functions/firestore").QueryDocumentSnapshot
      >
    | undefined,
    {
      tenantId: string;
    }
  >
>;
