/**
 * reactivateTenant — SuperAdmin reactivates a deactivated tenant.
 * - Restores tenant to its previous status (or 'active')
 * - Reactivates all memberships that were suspended during deactivation
 */
export declare const reactivateTenant: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    success: boolean;
    membershipsReactivated: number;
  }>,
  unknown
>;
