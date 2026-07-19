/**
 * deactivateTenant — SuperAdmin deactivates a tenant.
 * - Sets tenant status to 'deactivated'
 * - Suspends all active user memberships
 * - Preserves data for potential reactivation
 */
export declare const deactivateTenant: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    success: boolean;
    membershipsSuspended: number;
  }>,
  unknown
>;
