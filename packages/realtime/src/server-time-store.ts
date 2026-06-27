/**
 * `server-time-store.ts` — a single shared `serverTimeOffset` subscription
 * (transport-realtime layer §3.2 / SDK-SERVER §7.1 open-Q #1).
 *
 * The ONE client-side server-time primitive. Lazily opens a single underlying
 * `transport.serverTimeOffset` listener on first consumer and tears it down when the last
 * consumer leaves — so `useServerTime()` is single-listener regardless of consumer count
 * (the dedupe asserted by `use-server-time.test.tsx`).
 *
 * It supplies authoritative time only; the deadline subtraction (`remainingMs(session, now)`)
 * lives in `@levelup/repositories` (REVIEW §6 #6), never here.
 */
import type { RealtimeTransport, SubscriptionHandle } from "./seam.js";

export interface ServerTimeStore {
  /** Current offset in ms (`serverNow ≈ Date.now() + offsetMs`). */
  getOffset(): number;
  /** Subscribe to offset changes; returns an unsubscribe fn. Shares one underlying listener. */
  subscribe(cb: (offsetMs: number) => void): () => void;
}

export function createServerTimeStore(
  transport: Pick<RealtimeTransport, "serverTimeOffset">
): ServerTimeStore {
  let offsetMs = 0;
  let handle: SubscriptionHandle | undefined;
  const listeners = new Set<(offsetMs: number) => void>();

  function ensureOpen(): void {
    if (handle) return;
    handle = transport.serverTimeOffset((next) => {
      offsetMs = next;
      for (const l of listeners) l(next);
    });
  }

  return {
    getOffset() {
      return offsetMs;
    },
    subscribe(cb) {
      listeners.add(cb);
      ensureOpen();
      // Replay current offset immediately.
      cb(offsetMs);
      let active = true;
      return () => {
        if (!active) return; // idempotent
        active = false;
        listeners.delete(cb);
        if (listeners.size === 0 && handle) {
          handle.unsubscribe();
          handle = undefined;
        }
      };
    },
  };
}
