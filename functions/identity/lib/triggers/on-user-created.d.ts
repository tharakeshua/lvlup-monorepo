import * as functions from "firebase-functions/v1";
/**
 * Auth trigger: runs when a new Firebase Auth account is created.
 * Creates the platform-level /users/{uid} document.
 */
export declare const onUserCreated: functions.CloudFunction<
  import("firebase-admin/auth").UserRecord
>;
