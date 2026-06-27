/**
 * `FirebaseTransportServices` (transport-realtime.md §2.2 config/firebase-services.ts).
 *
 * The minimal slice of the app's full `FirebaseServices` bag this transport needs.
 * Keeping the adapter decoupled from the full app-level service bag means the app
 * can construct/own Firebase init exactly once (`shared-services/firebase/config.ts`)
 * and hand this transport only the four instances it carries bytes over.
 *
 * This file (with the rest of transport-firebase) is the ONLY client-side place
 * `firebase/{functions,firestore,database,auth,storage}` may be imported (principle 3).
 */
import type { Functions } from "firebase/functions";
import type { Firestore } from "firebase/firestore";
import type { Database } from "firebase/database";
import type { Auth } from "firebase/auth";
import type { FirebaseStorage } from "firebase/storage";

/** Minimal slice of the app's `FirebaseServices` the transport carries bytes over. */
export interface FirebaseTransportServices {
  /** Already-regioned `Functions` instance (region bound by the app at `getFunctions`). */
  functions: Functions;
  /** Firestore instance — doc/query subscription source. */
  db: Firestore;
  /** RTDB instance — node subscription source + `/.info/serverTimeOffset`. */
  rtdb: Database;
  /** Auth instance — ID-token forwarding seam + `PathContext` derivation. */
  auth: Auth;
  /** Storage instance — the signed-PUT upload consumer (the only client Storage site). */
  storage: FirebaseStorage;
}
