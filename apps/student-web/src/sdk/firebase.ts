/**
 * Firebase web initialization — the ONLY place this app touches `firebase/*`
 * directly, mirroring `@levelup/transport-firebase`'s single-source rule. Produces
 * the `FirebaseTransportServices` bag the transport carries bytes over.
 *
 * WEB specifics vs. the mobile reference (apps/mobile-student/src/sdk/firebase.ts):
 *   • Auth uses `getAuth(app)` (browser/IndexedDB persistence) instead of
 *     `initializeAuth` + `getReactNativePersistence(AsyncStorage)`.
 *   • Config comes from Vite `import.meta.env.VITE_*` (see env.ts).
 *
 * App SHARING: `@levelup/shared-services`' `initializeFirebase()` runs in main.tsx
 * before render and calls `initializeApp(...)`. We reuse that same default app via
 * `getApp()`, so `getAuth(app)` returns the SAME auth instance the legacy
 * `useAuthStore` (shared-stores) signs into — SDK callables are authenticated by
 * the user's existing session, no double-init.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectDatabaseEmulator, getDatabase, type Database } from "firebase/database";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import type { FirebaseTransportServices } from "@levelup/transport-firebase";

import { EMULATOR_HOST, FIREBASE_CONFIG, FUNCTIONS_REGION, USE_EMULATORS } from "./env";

let services: FirebaseTransportServices | null = null;

export function getFirebaseServices(): FirebaseTransportServices {
  if (services) return services;

  // Reuse the default app shared-services initialized; only init if absent.
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

  const auth: Auth = getAuth(app);
  const db: Firestore = getFirestore(app);
  const rtdb: Database = getDatabase(app);
  const storage: FirebaseStorage = getStorage(app);
  const functions: Functions = getFunctions(app, FUNCTIONS_REGION);

  if (USE_EMULATORS) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectDatabaseEmulator(rtdb, EMULATOR_HOST, 9000);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
    // eslint-disable-next-line no-console
    console.log(`[firebase] emulators @ ${EMULATOR_HOST}`);
  }

  // FirebaseTransportServices is the 5-instance slice the transport carries bytes
  // over (it intentionally does NOT include `app`).
  services = { auth, db, rtdb, storage, functions };
  return services;
}
