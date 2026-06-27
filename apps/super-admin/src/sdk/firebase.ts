/**
 * Firebase WEB initialization — the ONLY place this app touches `firebase/*`
 * directly, mirroring `@levelup/transport-firebase`'s single-source rule. Produces
 * the `FirebaseTransportServices` bag the transport carries bytes over.
 *
 * WEB specifics vs. mobile-student/src/sdk/firebase.ts:
 *   • Auth uses `getAuth(app)` (browser/IndexedDB persistence) instead of RN's
 *     `initializeAuth` + `getReactNativePersistence(AsyncStorage)`.
 *   • Reuses the firebase app the legacy `initializeFirebase` (shared-services)
 *     creates in main.tsx — `getApps()` returns it, so auth/db/functions are the
 *     SAME instances the auth store + remaining shared-services reads use.
 *   • Functions are regioned to `asia-south1` (all v1.* callables).
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
let emulatorsConnected = false;

export function getFirebaseServices(): FirebaseTransportServices {
  if (services) return services;

  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

  // Browser persistence (IndexedDB) — getAuth reuses the app's existing Auth.
  const auth: Auth = getAuth(app);
  const db: Firestore = getFirestore(app);
  const rtdb: Database = getDatabase(app);
  const storage: FirebaseStorage = getStorage(app);
  const functions: Functions = getFunctions(app, FUNCTIONS_REGION);

  if (USE_EMULATORS && !emulatorsConnected) {
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
    connectDatabaseEmulator(rtdb, EMULATOR_HOST, 9000);
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);
    connectStorageEmulator(storage, EMULATOR_HOST, 9199);
    emulatorsConnected = true;
  }

  // FirebaseTransportServices is the 5-instance slice the transport carries bytes
  // over (it intentionally does NOT include `app`).
  services = { auth, db, rtdb, storage, functions };
  return services;
}
