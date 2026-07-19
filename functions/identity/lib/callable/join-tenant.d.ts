/**
 * joinTenant — Allow a user to join a tenant using a tenant code.
 *
 * Creates a UserMembership with a pending role (defaults to 'student').
 * The tenant admin can later update the role/permissions.
 */
export declare const joinTenant: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    tenantId: string;
    membershipId: string;
    role: any;
  }>,
  unknown
>;
