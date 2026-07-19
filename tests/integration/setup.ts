/**
 * Firebase Emulator Suite setup for integration tests.
 *
 * Uses the Admin SDK to seed data and the client SDK to simulate
 * real user flows against the emulators.
 *
 * Emulators must be running: `firebase emulators:start`
 */
import * as admin from "firebase-admin";
import { initializeApp, getApps, deleteApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";

export const PROJECT_ID =
  process.env.FIREBASE_EMULATOR_PROJECT ?? process.env.GCLOUD_PROJECT ?? "lvlup-ff6fa";

export const EMULATOR_HOST = "127.0.0.1";
export const PORTS = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
} as const;

// ---------------------------------------------------------------------------
// Admin SDK (for seeding data + setting custom claims)
// ---------------------------------------------------------------------------

let adminApp: admin.app.App;

export function getAdminApp(): admin.app.App {
  if (adminApp) return adminApp;

  process.env["FIRESTORE_EMULATOR_HOST"] = `${EMULATOR_HOST}:${PORTS.firestore}`;
  process.env["FIREBASE_AUTH_EMULATOR_HOST"] = `${EMULATOR_HOST}:${PORTS.auth}`;

  adminApp = admin.apps.length ? admin.apps[0]! : admin.initializeApp({ projectId: PROJECT_ID });

  return adminApp;
}

export function getAdminAuth() {
  return getAdminApp().auth();
}

export function getAdminFirestore() {
  return getAdminApp().firestore();
}

// ---------------------------------------------------------------------------
// Client SDK (simulates frontend user flows)
// ---------------------------------------------------------------------------

let clientApp: FirebaseApp;
let clientAuth: Auth;
let clientDb: Firestore;
let clientFunctions: Functions;
let clientConnected = false;

export function setupClientSDK() {
  if (clientConnected)
    return { app: clientApp, auth: clientAuth, db: clientDb, functions: clientFunctions };

  for (const app of getApps()) {
    deleteApp(app);
  }

  clientApp = initializeApp({
    apiKey: "fake-api-key",
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
  });

  clientAuth = getAuth(clientApp);
  connectAuthEmulator(clientAuth, `http://${EMULATOR_HOST}:${PORTS.auth}`, {
    disableWarnings: true,
  });

  clientDb = getFirestore(clientApp);
  connectFirestoreEmulator(clientDb, EMULATOR_HOST, PORTS.firestore);

  clientFunctions = getFunctions(clientApp, "asia-south1");
  connectFunctionsEmulator(clientFunctions, EMULATOR_HOST, PORTS.functions);

  clientConnected = true;
  return { app: clientApp, auth: clientAuth, db: clientDb, functions: clientFunctions };
}

export function getClientAuth(): Auth {
  return clientAuth;
}

export function getClientFirestore(): Firestore {
  return clientDb;
}

export function getClientFunctions(): Functions {
  return clientFunctions;
}

// ---------------------------------------------------------------------------
// Cleanup helpers
// ---------------------------------------------------------------------------

export async function clearFirestoreData() {
  const url = `http://${EMULATOR_HOST}:${PORTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  await fetch(url, { method: "DELETE" });
}

export async function clearAuthAccounts() {
  const url = `http://${EMULATOR_HOST}:${PORTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  await fetch(url, { method: "DELETE" });
}

export async function resetEmulators() {
  await Promise.all([clearFirestoreData(), clearAuthAccounts()]);
}
