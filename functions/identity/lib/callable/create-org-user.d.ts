/**
 * createOrgUser — Creates a new user within a tenant organization.
 *
 * Creates the Firebase Auth user, tenant entity doc (student/teacher/parent),
 * and UserMembership doc in a single flow.
 */
export declare const createOrgUser: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    uid: string;
    entityId: string;
    membershipId: string;
  }>,
  unknown
>;
