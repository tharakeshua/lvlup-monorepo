/**
 * Public result/option types for the realtime hooks (transport-realtime layer §3.2).
 */
import type { ApiError } from "./seam.js";

/** Lifecycle of a subscription as surfaced to the UI. */
export type RealtimeStatus = "idle" | "connecting" | "live" | "error";

/** What `useSubscription` returns. */
export interface UseSubscriptionResult<P> {
  /** Latest validated payload (undefined until the first emission). */
  data: P | undefined;
  /** Current lifecycle status. */
  status: RealtimeStatus;
  /** Last error, if any (cleared on the next successful emission). */
  error: ApiError | undefined;
  /** True once the first *server* snapshot has been received (vs local-cache hydrate). */
  synced: boolean;
}

/** Per-call options for `useSubscription`. */
export interface UseSubscriptionOptions {
  /** Gate the subscription (e.g. don't subscribe until a `sessionId` is known). Default `true`. */
  enabled?: boolean;
  /** Side-channel callback fired on every payload (e.g. for `@levelup/query` cache binding). */
  onData?: (payload: unknown) => void;
}

/** What `useServerTime` returns. */
export interface ServerTime {
  /** Current server-clock offset in ms (`serverNow ≈ Date.now() + offsetMs`). */
  offsetMs: number;
  /** Server-corrected `now()` in epoch ms. */
  now: () => number;
  /** Convert a local `Date` (default: now) to its server-corrected equivalent. */
  toServerDate: (d?: Date) => Date;
}
