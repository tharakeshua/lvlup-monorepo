/**
 * Runtime environment for the SDK transport (web / Vite).
 *
 * Config is read from `import.meta.env` (VITE_*). The SAME values feed
 * `initializeFirebase()` in main.tsx, which creates the default Firebase app
 * that `firebase.ts` reuses — so auth/login stays shared across the app and SDK.
 *
 * Emulators are opt-in via `VITE_USE_EMULATORS=true` (default false → live
 * project). All v1.* callables live in region `asia-south1`.
 */

export const FUNCTIONS_REGION = "asia-south1" as const;

export const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === "true";

/** Emulator host. The browser reaches the dev machine on 127.0.0.1. */
export const EMULATOR_HOST = "127.0.0.1" as const;

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

export const FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};
