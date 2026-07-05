import * as functions from "firebase-functions/v1";
/**
 * Auth trigger: runs when a Firebase Auth account is deleted.
 * Soft-deletes the user doc and deactivates all memberships.
 */
export declare const onUserDeleted: functions.CloudFunction<
  import("firebase-admin/auth").UserRecord
>;
