/**
 * Runtime environment for the SDK transport (web).
 *
 * teacher-web talks to the LIVE project `lvlup-ff6fa` (v2_-prefixed, server-side)
 * via the Vite `VITE_FIREBASE_*` env vars — the same config the legacy
 * `initializeFirebase()` bootstrap consumed. No emulator wiring (the web app has
 * always run against live). All v1.* callables live in region `asia-south1`.
 */
export const FUNCTIONS_REGION = "asia-south1" as const;

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
