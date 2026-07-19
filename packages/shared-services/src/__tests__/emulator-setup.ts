/**
 * Firebase Emulator setup for integration tests.
 *
 * Connects the client SDK to local emulators. Must be imported
 * before any service module so the SDK talks to emulators rather
 * than production.
 */
import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import * as admin from "firebase-admin";
import { initializeFirebase, resetFirebaseServices } from "../firebase/config";

const PROJECT_ID = "lvlup-ff6fa";

const EMULATOR_HOST = "127.0.0.1";

const EMULATOR_PORTS = {
  auth: 9099,
  firestore: 8080,
  functions: 5001,
} as const;

let connected = false;
let adminApp: admin.app.App;

/**
 * Initialise the Firebase client SDK and connect every service to
 * the corresponding emulator. Also initialises the shared-services
 * FirebaseServices singleton so service modules use the emulator.
 * Safe to call multiple times — only connects once.
 */
export function setupEmulators() {
  if (connected) return;

  // Set up Admin SDK env vars for emulators
  process.env["FIRESTORE_EMULATOR_HOST"] = `${EMULATOR_HOST}:${EMULATOR_PORTS.firestore}`;
  process.env["FIREBASE_AUTH_EMULATOR_HOST"] = `${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`;

  // Initialise Admin SDK
  adminApp = admin.apps.length ? admin.apps[0]! : admin.initializeApp({ projectId: PROJECT_ID });

  // Clean up any existing client app from a prior run
  for (const app of getApps()) {
    deleteApp(app);
  }

  // Reset shared-services singleton so it picks up the new app
  resetFirebaseServices();

  const app = initializeApp({
    apiKey: "fake-api-key",
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
  });

  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:${EMULATOR_PORTS.auth}`, {
    disableWarnings: true,
  });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);

  const storage = getStorage(app);
  const rtdb = getDatabase(app);
  const functions = getFunctions(app, "asia-south1");
  connectFunctionsEmulator(functions, EMULATOR_HOST, EMULATOR_PORTS.functions);

  // Initialise the shared-services FirebaseServices singleton with emulator-connected services
  initializeFirebase({
    apiKey: "fake-api-key",
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
    storageBucket: `${PROJECT_ID}.appspot.com`,
    messagingSenderId: "fake",
    appId: "fake",
  });

  connected = true;
}

/**
 * Get Admin Firestore instance for seeding test data (bypasses security rules).
 */
export function getAdminFirestore() {
  return adminApp.firestore();
}

/**
 * Get Admin Auth instance for creating test users.
 */
export function getAdminAuth() {
  return adminApp.auth();
}

/**
 * Create a superAdmin test user via Admin SDK and sign in the client SDK.
 * Useful for tests that read Firestore via the client SDK service layer,
 * which is subject to security rules.
 */
export async function signInAsSuperAdmin() {
  const email = "test-superadmin@platform.test";
  const password = "testpw123";

  // Create user via Admin SDK
  let uid: string;
  try {
    const existing = await adminApp.auth().getUserByEmail(email);
    uid = existing.uid;
  } catch {
    const userRecord = await adminApp.auth().createUser({
      email,
      password,
      displayName: "Test SuperAdmin",
    });
    uid = userRecord.uid;
  }

  // Set superAdmin custom claims
  await adminApp.auth().setCustomUserClaims(uid, { role: "superAdmin" });

  // Create /users/{uid} doc with isSuperAdmin: true (required by security rules)
  await adminApp
    .firestore()
    .doc(`users/${uid}`)
    .set({
      uid,
      email,
      displayName: "Test SuperAdmin",
      isSuperAdmin: true,
      status: "active",
      authProviders: ["email"],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  // Sign in via client SDK
  const app = getApps()[0]!;
  const auth = getAuth(app);
  await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Clear all Firestore data via the emulator REST endpoint.
 */
export async function clearFirestoreData() {
  const url = `http://127.0.0.1:${EMULATOR_PORTS.firestore}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  await fetch(url, { method: "DELETE" });
}

/**
 * Clear all Auth accounts via the emulator REST endpoint.
 */
export async function clearAuthAccounts() {
  const url = `http://127.0.0.1:${EMULATOR_PORTS.auth}/emulator/v1/projects/${PROJECT_ID}/accounts`;
  await fetch(url, { method: "DELETE" });
}

/**
 * Reset all emulator data (auth + firestore).
 */
export async function resetEmulators() {
  await Promise.all([clearFirestoreData(), clearAuthAccounts()]);
}
