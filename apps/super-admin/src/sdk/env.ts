/**
 * Runtime environment for the SDK transport (WEB variant).
 *
 * Mirrors apps/mobile-student/src/sdk/env.ts but reads Vite `import.meta.env`
 * instead of Expo `process.env`. The web app points at the real project
 * `lvlup-ff6fa` by default; emulator wiring is opt-in via VITE_USE_EMULATORS.
 *
 * All v1.* callables live in region `asia-south1`.
 */
export const FUNCTIONS_REGION = "asia-south1" as const;

export const USE_EMULATORS =
  (import.meta.env.VITE_USE_EMULATORS ?? "false").toString().toLowerCase() === "true";

export const EMULATOR_HOST =
  (import.meta.env.VITE_EMULATOR_HOST as string | undefined) ?? "127.0.0.1";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

/**
 * Config sourced from Vite env (same VITE_FIREBASE_* names main.tsx already
 * feeds `initializeFirebase`), so the SDK reuses the SAME firebase app the
 * legacy shared-services auth store initializes — one auth instance, one token.
 */
export const FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};
