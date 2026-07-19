/**
 * Firebase Admin SDK initialization for migration scripts.
 * Uses GOOGLE_APPLICATION_CREDENTIALS or a service account key file.
 */

import * as admin from "firebase-admin";

let initialized = false;

export function initFirebase(): admin.app.App {
  if (initialized) return admin.app();

  const app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });

  initialized = true;
  return app;
}

export function getFirestore(): admin.firestore.Firestore {
  initFirebase();
  return admin.firestore();
}

export function getAuth(): admin.auth.Auth {
  initFirebase();
  return admin.auth();
}

/** Firestore server timestamp for migration writes. */
export function serverTimestamp(): admin.firestore.FieldValue {
  return admin.firestore.FieldValue.serverTimestamp();
}

/** Create a Firestore Timestamp from a Date or millis. */
export function toTimestamp(
  value: Date | number | { seconds: number; nanoseconds: number } | undefined
): admin.firestore.Timestamp {
  if (!value) return admin.firestore.Timestamp.now();
  if (typeof value === "number") return admin.firestore.Timestamp.fromMillis(value);
  if (value instanceof Date) return admin.firestore.Timestamp.fromDate(value);
  // Already a Firestore-like timestamp object
  return new admin.firestore.Timestamp(value.seconds, value.nanoseconds);
}
