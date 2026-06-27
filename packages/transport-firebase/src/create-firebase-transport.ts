/**
 * `createFirebaseTransport` (transport-realtime.md §2.2 create-firebase-transport.ts).
 *
 * The public factory: takes the four Firebase service instances (already initialized
 * + regioned by the app's `getFirebaseServices()`) and returns a fully-wired
 * `Transport`:
 *   • `invoke`           → invokeViaCallable (ID-token auto-forwarded, no tenantId)
 *   • `subscribe`        → createSubscribe (Firestore/RTDB dispatch + payload validate)
 *   • `serverTimeOffset` → createServerTimeOffset (/.info/serverTimeOffset)
 *   • `refreshToken`     → createRefreshToken (force fresh token + PathContext refresh)
 *   • `storage`          → createStorageTransport (the only client Storage site)
 *
 * Derives a live `PathContext { tenantId, uid }` from `services.auth` on init and on
 * `onIdTokenChanged`, refreshed by `refreshToken()` after `switchActiveTenant`.
 *
 * The transport does NOT call `initializeFirebase` / re-region functions — that
 * stays in the app's `getFirebaseServices()`.
 */
import type { CallableName, ReqOf, ResOf } from "@levelup/api-contract";
import type { Transport } from "./transport-contract.js";
import type { FirebaseTransportServices } from "./config/firebase-services.js";
import { type FunctionsRegion } from "./config/region.js";
import { type EmulatorConfig } from "./config/region.js";
import { createPathContextHolder } from "./path-context.js";
import { invokeViaCallable } from "./invoke/invoke-via-callable.js";
import { createSubscribe } from "./subscribe/subscribe.js";
import type { ValidateMode } from "./subscribe/validate-payload.js";
import { createServerTimeOffset } from "./server-time/server-time-offset.js";
import { createRefreshToken } from "./auth/refresh-token.js";
import { createStorageTransport } from "./storage/storage-transport.js";

export interface FirebaseTransportOptions {
  /** Default `DEFAULT_REGION`. The transport does NOT re-region `functions` — the
   *  app binds the region at `getFunctions`; this is shared with `transport-http`. */
  region?: FunctionsRegion;
  /** Dev: strict subscription payload parse (throws on drift). Default: prod (best-effort). */
  validatePayloads?: boolean;
  /** Optional emulator wiring, mirroring `initializeFirebase`'s emulator hookup. */
  emulator?: EmulatorConfig;
}

export function createFirebaseTransport(
  services: FirebaseTransportServices,
  opts: FirebaseTransportOptions = {}
): Transport {
  const mode: ValidateMode = opts.validatePayloads ? "dev" : "prod";

  // Live, refresh-aware tenant/uid scope for the read (subscription) path.
  const ctxHolder = createPathContextHolder(services.auth);

  const subscribe = createSubscribe(services, () => ctxHolder.get(), mode);
  const serverTimeOffset = createServerTimeOffset(services.rtdb);
  const refreshToken = createRefreshToken(services.auth, (force) => ctxHolder.refresh(force));
  const storage = createStorageTransport({
    functions: services.functions,
    storage: services.storage,
  });

  return {
    invoke<N extends CallableName>(name: N, data: ReqOf<N>): Promise<ResOf<N>> {
      return invokeViaCallable(services.functions, name, data);
    },
    subscribe,
    serverTimeOffset,
    refreshToken,
    storage,
  };
}
