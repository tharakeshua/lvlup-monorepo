/**
 * Firebase Admin SDK initialization — emulator-first, then real-project.
 *
 * Emulator detection: presence of FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST.
 * When seeding the emulator, NO credentials are required (the Admin SDK talks to the
 * emulator with the projectId only). For a real project we accept either:
 *   - GOOGLE_APPLICATION_CREDENTIALS (ADC), or
 *   - an explicit service-account JSON path / object.
 *
 * This is the ONLY file in the engine that imports `firebase-admin`.
 */

import { readFileSync } from "node:fs";
import admin from "firebase-admin";

export type App = admin.app.App;
export type Firestore = admin.firestore.Firestore;
export type Auth = admin.auth.Auth;
export type DocumentReference = admin.firestore.DocumentReference;
export type WriteBatch = admin.firestore.WriteBatch;

export interface EmulatorInfo {
  firestore: boolean;
  auth: boolean;
  firestoreHost?: string;
  authHost?: string;
}

export function detectEmulator(env: NodeJS.ProcessEnv = process.env): EmulatorInfo {
  const firestoreHost = env.FIRESTORE_EMULATOR_HOST;
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST;
  return {
    firestore: Boolean(firestoreHost),
    auth: Boolean(authHost),
    firestoreHost,
    authHost,
  };
}

export interface InitAdminOptions {
  projectId: string;
  /** App name — lets multiple seed runs coexist; default is a per-project name. */
  appName?: string;
  /** Path to a service-account JSON (real project only). Ignored against the emulator. */
  serviceAccountPath?: string;
  /** Inline service-account object (real project only). Takes precedence over path. */
  serviceAccount?: admin.ServiceAccount;
  /** RTDB url — required only if seeding RTDB read-models (leaderboard/badges). */
  databaseURL?: string;
  env?: NodeJS.ProcessEnv;
}

export interface AdminHandles {
  app: App;
  db: Firestore;
  auth: Auth;
  emulator: EmulatorInfo;
  FieldValue: typeof admin.firestore.FieldValue;
  Timestamp: typeof admin.firestore.Timestamp;
}

/** Reuse an existing named app if present (idempotent across repeated engine constructions). */
function getOrCreateApp(name: string, options: admin.AppOptions): App {
  const existing = admin.apps.find((a) => a?.name === name);
  if (existing) return existing;
  return admin.initializeApp(options, name);
}

export function initAdmin(opts: InitAdminOptions): AdminHandles {
  const env = opts.env ?? process.env;
  const emulator = detectEmulator(env);
  const appName = opts.appName ?? `seed-${opts.projectId}`;

  const appOptions: admin.AppOptions = { projectId: opts.projectId };
  if (opts.databaseURL) appOptions.databaseURL = opts.databaseURL;

  // Against the emulator we deliberately skip credentials — projectId is enough and the
  // SDK routes to FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST automatically.
  if (!emulator.firestore && !emulator.auth) {
    if (opts.serviceAccount) {
      appOptions.credential = admin.credential.cert(opts.serviceAccount);
    } else if (opts.serviceAccountPath) {
      const sa = JSON.parse(readFileSync(opts.serviceAccountPath, "utf-8"));
      appOptions.credential = admin.credential.cert(sa);
    } else {
      // Fall back to Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS).
      appOptions.credential = admin.credential.applicationDefault();
    }
  }

  const app = getOrCreateApp(appName, appOptions);
  const db = app.firestore();
  // Firestore Admin SDK: ignore undefined fields so optional entity fields can be omitted cleanly.
  try {
    db.settings({ ignoreUndefinedProperties: true });
  } catch {
    // settings() throws if called twice on the same instance — safe to ignore on reuse.
  }

  return {
    app,
    db,
    auth: app.auth(),
    emulator,
    FieldValue: admin.firestore.FieldValue,
    Timestamp: admin.firestore.Timestamp,
  };
}
