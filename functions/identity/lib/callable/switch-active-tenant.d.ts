/**
 * switchActiveTenant — Switch a user's active tenant context.
 *
 * Validates the user has an active membership in the target tenant,
 * updates custom claims to reflect the new tenant, and updates the
 * user's activeTenantId.
 */
export declare const switchActiveTenant: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    success: true;
    role: "superAdmin" | "tenantAdmin" | "teacher" | "student" | "parent" | "scanner" | "staff";
  }>,
  unknown
>;
