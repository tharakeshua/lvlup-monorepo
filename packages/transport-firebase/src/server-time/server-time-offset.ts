/**
 * `createServerTimeOffset` (transport-realtime.md §2.2 server-time/server-time-offset.ts).
 *
 * The ONLY client-side server-time primitive (REVIEW §6 #6 / SDK-SERVER §7.1.1).
 * Subscribes the RTDB special node `/.info/serverTimeOffset` — Firebase maintains
 * this as the (server − client) clock delta in ms. `serverNow = Date.now() + offset`.
 *
 * The test clock is server-authoritative: repositories compute `remainingMs(session,
 * serverNow)` from the streamed `serverDeadline` + this offset — this layer never
 * computes a deadline, it only supplies authoritative time. READ-ONLY.
 */
import { onValue, ref, type Database } from "firebase/database";
import type { SubscriptionHandle } from "../transport-contract.js";

let offsetSubSeq = 0;

export function createServerTimeOffset(rtdb: Database) {
  return function serverTimeOffset(cb: (offsetMs: number) => void): SubscriptionHandle {
    const offsetRef = ref(rtdb, "/.info/serverTimeOffset");
    const id = `serverTimeOffset_${offsetSubSeq++}`;
    let active = true;

    const detach = onValue(offsetRef, (snap) => {
      const val = snap.val();
      cb(typeof val === "number" ? val : 0);
    });

    return {
      id,
      get active() {
        return active;
      },
      unsubscribe() {
        if (!active) return; // idempotent
        active = false;
        detach();
      },
    };
  };
}
