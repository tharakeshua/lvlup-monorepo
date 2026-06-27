/**
 * Fake `Transport` — the unit-test seam for `@levelup/api-client` and everything
 * above it (repositories, query hooks) that needs a `Transport` but no emulator.
 *
 * Matches the `Transport` interface owned by `@levelup/api-contract`
 * (transport-realtime.md §3 / api-contract `src/transport/transport.ts`):
 *     invoke<N>(name, data) => Promise<ResOf<N>>
 *     subscribe<S>(name, params, cb) => SubscriptionHandle
 *     serverTimeOffset(cb) => SubscriptionHandle
 *     refreshToken(force?) => Promise<void>
 *
 * Capabilities:
 *   • RECORDS every invoke call ({ name, data }) so tests can assert the wire
 *     payload (e.g. "saveSpace was called with no tenantId in the body").
 *   • Returns CANNED responses, registered per-callable-name as either a static
 *     value (`ResOf<N>`) or a function of the request. Unregistered names throw a
 *     clear error (so a test can't silently pass against an absent stub).
 *   • Can be told to THROW for a name (to exercise normalizeError/retry paths),
 *     including HttpsError-shaped errors (duck-typed; no firebase import).
 *   • Drives subscriptions manually: `emit(name, payload)` pushes to live
 *     subscribers, `flushSynced(name)` fires `onSynced`, `failSub(name, err)`
 *     fires `error`.
 *   • Drives `serverTimeOffset` via `setServerOffset(ms)`.
 *
 * Typed loosely against the contract via structural shapes so this file does not
 * have to import the (still-being-built) `@levelup/api-contract` symbols. The
 * `createFakeTransport()` return value is assignable to the real `Transport`
 * because the method signatures match; the validation phase can tighten the
 * import to `import type { Transport } from '@levelup/api-contract'`.
 */

export interface RecordedInvoke {
  name: string;
  data: unknown;
  at: number;
}

export interface FakeSubscriptionHandle {
  unsubscribe(): void;
  readonly id: string;
  readonly active: boolean;
}

type SubCallbacks = {
  next: (payload: unknown) => void;
  error?: (err: unknown) => void;
  onSynced?: () => void;
};

type ResponderFn = (data: unknown) => unknown | Promise<unknown>;

export interface FakeTransport {
  // ---- Transport surface (structurally compatible with the real interface) ----
  invoke(name: string, data: unknown): Promise<unknown>;
  subscribe(
    name: string,
    params: unknown,
    cb: SubCallbacks | ((payload: unknown) => void)
  ): FakeSubscriptionHandle;
  serverTimeOffset(cb: (offsetMs: number) => void): FakeSubscriptionHandle;
  refreshToken(forceRefresh?: boolean): Promise<void>;

  // ---- Test controls ----
  /** Register a canned response (value or req→res fn) for a callable name. */
  onInvoke(name: string, responder: unknown | ResponderFn): FakeTransport;
  /** Make a callable throw. `err` may be an HttpsError-shaped object. */
  failInvoke(name: string, err: unknown): FakeTransport;
  /** All recorded invoke calls, in order. */
  readonly calls: RecordedInvoke[];
  /** Recorded calls filtered to one callable name. */
  callsTo(name: string): RecordedInvoke[];
  /** Last recorded call (or undefined). */
  lastCall(): RecordedInvoke | undefined;
  /** How many times refreshToken was called. */
  readonly refreshTokenCount: number;
  reset(): void;

  // ---- Subscription drivers ----
  emit(name: string, payload: unknown): void;
  flushSynced(name: string): void;
  failSub(name: string, err: unknown): void;
  /** Active subscriber count for a subscription name. */
  subscriberCount(name: string): number;
  setServerOffset(ms: number): void;
}

interface FakeTransportOptions {
  /** Default responder when a name has no registered stub. Default: throw. */
  defaultResponder?: ResponderFn;
}

export function createFakeTransport(opts: FakeTransportOptions = {}): FakeTransport {
  const responders = new Map<string, ResponderFn>();
  const failures = new Map<string, unknown>();
  const calls: RecordedInvoke[] = [];
  const subs = new Map<string, Set<SubCallbacks>>();
  const offsetListeners = new Set<(ms: number) => void>();
  let refreshCount = 0;
  let subIdSeq = 0;
  let serverOffsetMs = 0;

  const normalizeCb = (cb: SubCallbacks | ((p: unknown) => void)): SubCallbacks =>
    typeof cb === "function" ? { next: cb } : cb;

  const fake: FakeTransport = {
    async invoke(name, data) {
      calls.push({ name, data, at: Date.now() });
      if (failures.has(name)) throw failures.get(name);
      const responder = responders.get(name) ?? opts.defaultResponder;
      if (!responder) {
        throw new Error(
          `[fake-transport] no canned response registered for invoke('${name}'). ` +
            `Call fakeTransport.onInvoke('${name}', res) first.`
        );
      }
      return responder(data);
    },

    subscribe(name, _params, cb) {
      const callbacks = normalizeCb(cb);
      const set = subs.get(name) ?? new Set<SubCallbacks>();
      set.add(callbacks);
      subs.set(name, set);
      const id = `sub_${name}_${subIdSeq++}`;
      let active = true;
      return {
        id,
        get active() {
          return active;
        },
        unsubscribe() {
          active = false;
          set.delete(callbacks);
        },
      };
    },

    serverTimeOffset(cb) {
      offsetListeners.add(cb);
      cb(serverOffsetMs); // emit current immediately
      const id = `offset_${subIdSeq++}`;
      let active = true;
      return {
        id,
        get active() {
          return active;
        },
        unsubscribe() {
          active = false;
          offsetListeners.delete(cb);
        },
      };
    },

    async refreshToken() {
      refreshCount++;
    },

    onInvoke(name, responder) {
      responders.set(
        name,
        typeof responder === "function" ? (responder as ResponderFn) : () => responder
      );
      return fake;
    },

    failInvoke(name, err) {
      failures.set(name, err);
      return fake;
    },

    get calls() {
      return calls;
    },
    callsTo(name) {
      return calls.filter((c) => c.name === name);
    },
    lastCall() {
      return calls[calls.length - 1];
    },
    get refreshTokenCount() {
      return refreshCount;
    },
    reset() {
      responders.clear();
      failures.clear();
      calls.length = 0;
      subs.clear();
      offsetListeners.clear();
      refreshCount = 0;
      serverOffsetMs = 0;
    },

    emit(name, payload) {
      subs.get(name)?.forEach((cb) => cb.next(payload));
    },
    flushSynced(name) {
      subs.get(name)?.forEach((cb) => cb.onSynced?.());
    },
    failSub(name, err) {
      subs.get(name)?.forEach((cb) => cb.error?.(err));
    },
    subscriberCount(name) {
      return subs.get(name)?.size ?? 0;
    },
    setServerOffset(ms) {
      serverOffsetMs = ms;
      offsetListeners.forEach((cb) => cb(ms));
    },
  };

  return fake;
}

/**
 * Build an HttpsError-shaped object for `failInvoke` so tests can exercise
 * `normalizeError`/`fromTransportError` without importing firebase.
 */
export function httpsErrorLike(
  code: string,
  message: string,
  details?: unknown
): { code: string; message: string; details?: unknown } {
  return { code, message, details };
}
