/**
 * Firebase web initialization — the ONLY place this app touches `firebase/*`
 * directly (mirroring `@levelup/transport-firebase`'s single-source rule).
 * Produces the `FirebaseTransportServices` bag the transport carries bytes over.
 *
 * WEB specifics vs. mobile:
 *   • Auth uses `getAuth(app)` (browser/IndexedDB persistence) instead of RN's
 *     `initializeAuth` + `getReactNativePersistence(AsyncStorage)`.
 *   • Functions are regioned to `asia-south1` (all v1.* callables).
 *   • No emulator wiring — admin-web targets the live project.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import type { FirebaseTransportServices } from "@levelup/transport-firebase";

import { FIREBASE_CONFIG, FUNCTIONS_REGION } from "./env";

let services: FirebaseTransportServices | null = null;

export function getFirebaseServices(): FirebaseTransportServices {
  if (services) return services;

  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);

  const auth: Auth = getAuth(app);
  const db: Firestore = getFirestore(app);
  const rtdb: Database = getDatabase(app);
  const storage: FirebaseStorage = getStorage(app);
  const functions: Functions = getFunctions(app, FUNCTIONS_REGION);

  // FirebaseTransportServices is the 5-instance slice the transport carries bytes
  // over (it intentionally does NOT include `app`).
  services = { auth, db, rtdb, storage, functions };
  return services;
}
