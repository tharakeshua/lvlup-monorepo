/**
 * Firebase web initialization — the ONLY place this app touches `firebase/*`
 * directly, mirroring `@levelup/transport-firebase`'s single-source rule. Produces
 * the `FirebaseTransportServices` bag the transport carries bytes over.
 *
 * Web specifics vs. mobile:
 *   • Auth uses `getAuth(app)` (browser persistence) instead of `initializeAuth`
 *     + `getReactNativePersistence(AsyncStorage)`. No react-native imports.
 *   • The app is REUSED from the default Firebase app that `initializeFirebase()`
 *     (shared-services) already created in main.tsx — so login/auth stay shared.
 *     We never create a second app.
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

export function getFirebaseServices(): FirebaseTransportServices {
  if (services) return services;

  // Reuse the default app that shared-services `initializeFirebase()` already
  // created in main.tsx; only init if (somehow) none exists yet. This keeps the
  // SDK and the app's login on the same Firebase app instance.
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

  // Web auth with browser persistence.
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
    console.log(
      `[firebase] emulators @ ${EMULATOR_HOST} (auth:9099 fs:8080 rtdb:9000 fn:5001 st:9199)`
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`[firebase] live project ${FIREBASE_CONFIG.projectId} region ${FUNCTIONS_REGION}`);
  }

  // FirebaseTransportServices is the 5-instance slice the transport carries bytes
  // over (it intentionally does NOT include `app`).
  services = { auth, db, rtdb, storage, functions };
  return services;
}
