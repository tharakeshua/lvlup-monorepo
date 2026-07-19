/**
 * saveStaff — Update staff member details and permissions.
 *
 * Uses the consolidated upsert pattern:
 * - id present → update existing staff member
 */
export declare const saveStaff: import("firebase-functions/https").CallableFunction<
  any,
  Promise<{
    id: string;
    created: boolean;
  }>,
  unknown
>;
