/**
 * Runtime environment for the SDK transport.
 *
 * Two targets, switched by `EXPO_PUBLIC_USE_EMULATORS`:
 *   • emulator (dev, default until GATE B): project `demo-levelup`, all firebase
 *     services connected to the local emulator suite. Collection prefix is empty.
 *   • prod cutover (after GATE B): the real project `lvlup-ff6fa` (v2_ prefixed,
 *     server-side only). Config + region per SDK-coord's transport config.
 *
 * All v1.* callables live in region `asia-south1`.
 */
import Constants from "expo-constants";

export const FUNCTIONS_REGION = "asia-south1" as const;

export const USE_EMULATORS =
  (process.env.EXPO_PUBLIC_USE_EMULATORS ?? "true").toLowerCase() === "true";

/**
 * Emulator host. iOS simulator reaches the dev machine on 127.0.0.1; Android
 * emulator needs 10.0.2.2. Override with EXPO_PUBLIC_EMULATOR_HOST when needed.
 */
export const EMULATOR_HOST =
  process.env.EXPO_PUBLIC_EMULATOR_HOST ?? (Constants.platform?.android ? "10.0.2.2" : "127.0.0.1");

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL: string;
}

/** Real project — used for the prod cutover (after GATE B). */
const PROD_CONFIG: FirebaseWebConfig = {
  apiKey: "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E",
  authDomain: "lvlup-ff6fa.firebaseapp.com",
  projectId: "lvlup-ff6fa",
  storageBucket: "lvlup-ff6fa.appspot.com",
  messagingSenderId: "504506746594",
  appId: "1:504506746594:web:aac69e81f25dd95c5f80bb",
  databaseURL: "https://lvlup-ff6fa-default-rtdb.firebaseio.com",
};

/** Emulator dev — any web config works against the local suite. */
const EMULATOR_CONFIG: FirebaseWebConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-levelup.firebaseapp.com",
  projectId: "demo-levelup",
  storageBucket: "demo-levelup.appspot.com",
  messagingSenderId: "0",
  appId: "1:0:web:demo",
  databaseURL: "https://demo-levelup-default-rtdb.firebaseio.com",
};

export const FIREBASE_CONFIG: FirebaseWebConfig = USE_EMULATORS ? EMULATOR_CONFIG : PROD_CONFIG;
