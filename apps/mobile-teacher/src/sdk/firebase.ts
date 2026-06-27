/**
 * Firebase RN initialization — the ONLY place this app touches `firebase/*`
 * directly, mirroring `@levelup/transport-firebase`'s single-source rule. Produces
 * the `FirebaseTransportServices` bag the transport carries bytes over.
 *
 * RN specifics vs. web:
 *   • Auth uses `initializeAuth` + `getReactNativePersistence(AsyncStorage)` so the
 *     session survives app restarts (web uses `getAuth` with browser persistence).
 *   • Functions are regioned to `asia-south1` (all v1.* callables).
 *   • Emulator wiring is host-aware (127.0.0.1 on iOS sim, 10.0.2.2 on Android).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, initializeAuth, type Auth } from "firebase/auth";
// `getReactNativePersistence` ships only in firebase/auth's React Native build
// (`index.rn`); Metro resolves it at runtime via the `react-native` condition,
// but the default package types omit it — hence the typed shim import below.
// @ts-expect-error -- present in the RN entry, missing from the default types.
import { getReactNativePersistence } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectDatabaseEmulator, getDatabase, type Database } from "firebase/database";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import type { FirebaseTransportServices } from "@levelup/transport-firebase";

import { EMULATOR_HOST, FIREBASE_CONFIG, FUNCTIONS_REGION, USE_EMULATORS } from "./env";

let services: FirebaseTransportServices | null = null;

export function getFirebaseServices(): FirebaseTransportServices {
  if (services) return services;

  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

  // RN auth with AsyncStorage persistence. `initializeAuth` must run before any
  // `getAuth(app)` — we own init, so this is safe.
  const auth: Auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });

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
