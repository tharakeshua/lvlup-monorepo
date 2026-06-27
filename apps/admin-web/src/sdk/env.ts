/**
 * Runtime environment for the admin-web SDK transport.
 *
 * admin-web targets the LIVE project `lvlup-ff6fa` (v2_-prefixed, server-side
 * only). Config is read from Vite `import.meta.env.VITE_FIREBASE_*` (see
 * `.env.production`), falling back to the known prod values so the app boots in
 * dev without a local env file. All v1.* callables live in region `asia-south1`.
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

/** Real project — the only target for admin-web. */
const PROD_CONFIG: FirebaseWebConfig = {
  apiKey: "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E",
  authDomain: "lvlup-ff6fa.firebaseapp.com",
  projectId: "lvlup-ff6fa",
  storageBucket: "lvlup-ff6fa.appspot.com",
  messagingSenderId: "504506746594",
  appId: "1:504506746594:web:aac69e81f25dd95c5f80bb",
  databaseURL: "https://lvlup-ff6fa-default-rtdb.firebaseio.com",
};

const env = import.meta.env;

export const FIREBASE_CONFIG: FirebaseWebConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? PROD_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? PROD_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? PROD_CONFIG.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? PROD_CONFIG.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? PROD_CONFIG.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID ?? PROD_CONFIG.appId,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? PROD_CONFIG.databaseURL,
};
