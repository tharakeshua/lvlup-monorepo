/**
 * SDK composition root (client brain wiring):
 *
 *   firebase services  →  createFirebaseTransport (invoke/subscribe/serverTime)
 *                      →  createApiClient (validate · idempotency · retry · normalize)
 *                      +  auth capability (api.auth, backed by the firebase auth handle)
 *                      →  createRepositories (the repo bag the query hooks call)
 *
 * `createApiClient` only builds the CALLABLE namespaces; the `api.auth` capability
 * (sign-in/out/reset/restore/state — NOT callables, a pure transport seam) is
 * composed here from `createFirebaseAuthHandle`, exactly as `authRepo` expects.
 */
import { createApiClient, type ApiClient } from "@levelup/api-client";
import { createRepositories, type Repositories } from "@levelup/repositories";
import {
  createFirebaseAuthHandle,
  createFirebaseTransport,
  type AuthUserSnapshot,
  type Transport,
} from "@levelup/transport-firebase";

import { FUNCTIONS_REGION } from "./env";
import { getFirebaseServices } from "./firebase";

/** Platform-neutral session shape the `authRepo` seam consumes (repositories §C3). */
interface AuthSession {
  uid: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
}

function toSession(snap: AuthUserSnapshot | null): AuthSession | null {
  if (!snap) return null;
  return {
    uid: snap.uid,
    email: snap.email ?? undefined,
    displayName: snap.displayName ?? undefined,
    emailVerified: snap.emailVerified,
  };
}

export interface Sdk {
  transport: Transport;
  api: ApiClient;
  repos: Repositories;
}

let sdk: Sdk | null = null;

export function getSdk(): Sdk {
  if (sdk) return sdk;

  const services = getFirebaseServices();
  const transport = createFirebaseTransport(services, {
    region: FUNCTIONS_REGION,
    validatePayloads: __DEV__,
  });

  // NOTE: `@levelup/transport-firebase` and `@levelup/api-client` each restate the
  // `Transport` seam; their `subscribe` callback error types differ by a nominal
  // `ApiError` vs `ApiErrorDetails` (a known cross-package drift the SDK's
  // typecheck/fix wave reconciles). Structurally identical at runtime → cast.
  //
  // Envelope cutover DONE: SDK-coord fixed the request-envelope drift server-side
  // (the deployed callables now strip `__apiVersion`/`__idempotencyKey` natively),
  // so the temporary `transport-compat` shim was removed.
  //
  // Response validation stays OFF: the RESPONSE-shape canonicalization is only
  // PARTIAL on the deployed backend — `listSpaces` validates clean, but
  // `listStoryPoints` still returns the legacy `order` key (canonical = `orderIndex`)
  // and other reads may drift too. With validation ON the api-client THROWS before
  // a screen's defensive `??` fallbacks can run, breaking SpaceDetail/ContentViewer.
  // Flip to `true` once SDK-coord canonicalizes ALL read responses (story points +
  // items + progress), not just spaces. The data is correct + usable today.
  const baseApi = createApiClient(transport as never, {
    validateResponses: false,
  });

  // The auth capability `authRepo` reads off `api.auth` (not a callable surface).
  const authHandle = createFirebaseAuthHandle(services.auth);
  const auth = {
    signIn: async (input: { email: string; password: string }) => {
      const { user } = await authHandle.signIn(input.email, input.password);
      return toSession(user)!;
    },
    signOut: () => authHandle.signOut(),
    sendPasswordReset: (email: string) => authHandle.sendPasswordReset(email),
    restoreSession: async () => toSession(authHandle.currentUser()),
    onAuthState: (cb: (s: AuthSession | null) => void) => {
      const unsub = authHandle.onAuthState((snap) => cb(toSession(snap)));
      return { unsubscribe: unsub };
    },
  };

  const api = Object.assign(baseApi, { auth }) as ApiClient;
  const repos = createRepositories(api as never);

  sdk = { transport, api, repos };
  return sdk;
}
