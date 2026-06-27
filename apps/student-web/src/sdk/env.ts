/**
 * Runtime environment for the web SDK transport.
 *
 * The web app reads its Firebase config from Vite `import.meta.env.VITE_*` vars
 * (see `.env.production` / `vite-env.d.ts`). All v1.* callables live in region
 * `asia-south1`. The student-web app currently targets the live project only
 * (no emulator wiring), matching the legacy `initializeFirebase` call in main.tsx.
 */
export const FUNCTIONS_REGION = "asia-south1" as const;

export const USE_EMULATORS =
  (import.meta.env.VITE_USE_EMULATORS ?? "false").toString().toLowerCase() === "true";

export const EMULATOR_HOST = import.meta.env.VITE_EMULATOR_HOST ?? "127.0.0.1";

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
