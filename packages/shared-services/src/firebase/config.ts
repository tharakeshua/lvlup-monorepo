import { initializeApp, FirebaseApp, getApps } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator, FirebaseStorage } from "firebase/storage";
import { getDatabase, Database } from "firebase/database";
import { getFunctions, Functions, connectFunctionsEmulator } from "firebase/functions";
import { connectFirestoreEmulator } from "firebase/firestore";
import { connectAuthEmulator } from "firebase/auth";

/**
 * Firebase Configuration Interface
 * Supports environment variable configuration for flexible deployment
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
  measurementId?: string;
}

/**
 * Firebase Service Instances
 * Centralized access to all Firebase services
 */
export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  rtdb: Database;
  functions: Functions;
}

let firebaseServices: FirebaseServices | null = null;

/**
 * Load Firebase configuration from Node.js environment variables.
 * Used for server-side code and tests.
 * Browser apps should pass config directly to initializeFirebase().
 */
export function getFirebaseConfigFromEnv(): FirebaseConfig {
  const getEnvVar = (key: string): string => {
    const value =
      process.env[`VITE_${key}`] ?? process.env[`NEXT_PUBLIC_${key}`] ?? process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: VITE_${key}`);
    }
    return value;
  };

  const projectId = getEnvVar("FIREBASE_PROJECT_ID");
  const configuredDbUrl =
    process.env["VITE_FIREBASE_DATABASE_URL"] ?? process.env["NEXT_PUBLIC_FIREBASE_DATABASE_URL"];
  const inferredDbUrl = `https://${projectId}-default-rtdb.firebaseio.com`;

  return {
    apiKey: getEnvVar("FIREBASE_API_KEY"),
    authDomain: getEnvVar("FIREBASE_AUTH_DOMAIN"),
    projectId,
    storageBucket: getEnvVar("FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnvVar("FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnvVar("FIREBASE_APP_ID"),
    databaseURL: configuredDbUrl || inferredDbUrl,
  };
}

/**
 * Initialize Firebase with provided or environment-based configuration
 * Implements singleton pattern to prevent multiple initializations
 */
export function initializeFirebase(config?: FirebaseConfig): FirebaseServices {
  // Return existing instance if already initialized
  if (firebaseServices) {
    return firebaseServices;
  }

  // Reuse an already-initialized default app (e.g. the SDK composition root's).
  // Its options are the source of truth — they cannot drift from what the app
  // actually runs on. Only read config/env when nothing has initialized yet:
  // browser bundles routinely lack `process.env.VITE_*` and would throw.
  const existingApps = getApps();
  const app =
    existingApps.length > 0
      ? existingApps[0]!
      : initializeApp(config || getFirebaseConfigFromEnv());
  const databaseURL = (app.options.databaseURL as string | undefined) ?? config?.databaseURL;

  // Initialize all Firebase services
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  // RTDB instances are keyed by the URL passed to getDatabase(): `getDatabase(app)`
  // and `getDatabase(app, url)` create DIFFERENT instances over the SAME repo and
  // the second one throws FIREBASE FATAL "Database initialized multiple times".
  // Always use the default identifier when the app's options carry the URL so any
  // other `getDatabase(app)` caller (the SDK composition roots) shares it.
  const rtdb =
    app.options.databaseURL || !databaseURL ? getDatabase(app) : getDatabase(app, databaseURL);
  const functions = getFunctions(app, "asia-south1");

  // Connect to emulators only when explicitly enabled.
  // Uses process.env for both Vite (define'd at build time) and Node/Cloud Functions.
  const useEmulators =
    typeof process !== "undefined" && process.env?.["VITE_USE_EMULATORS"] === "true";

  if (useEmulators) {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
      connectFunctionsEmulator(functions, "127.0.0.1", 5001);
      connectStorageEmulator(storage, "127.0.0.1", 9199);
      console.log(
        "[Firebase] Connected to emulators (auth:9099, firestore:8080, functions:5001, storage:9199)"
      );
    } catch {
      // Already connected — ignore
    }
  }

  firebaseServices = { app: app!, auth, db, storage, rtdb, functions };

  console.log("[Firebase] Services initialized", {
    projectId: app.options.projectId,
    emulators: !!useEmulators,
  });

  return firebaseServices!;
}

/**
 * Get Firebase services instance
 * Initializes Firebase if not already done
 */
export function getFirebaseServices(): FirebaseServices {
  if (!firebaseServices) {
    return initializeFirebase();
  }
  return firebaseServices;
}

/**
 * Reset Firebase services (useful for testing)
 */
export function resetFirebaseServices(): void {
  firebaseServices = null;
}
