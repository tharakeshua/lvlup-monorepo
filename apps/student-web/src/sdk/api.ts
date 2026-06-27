/**
 * SDK composition root (client brain wiring) — web port of
 * apps/mobile-student/src/sdk/api.ts:
 *
 *   firebase services  →  createFirebaseTransport (invoke/subscribe/serverTime)
 *                      →  createApiClient (validate · idempotency · retry · normalize)
 *                      +  auth capability (api.auth, backed by the firebase auth handle)
 *                      →  createRepositories (the repo bag the query hooks call)
 *
 * WEB DIFF: `__DEV__` → `import.meta.env.DEV`.
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
    validatePayloads: import.meta.env.DEV,
  });

  // NOTE: `@levelup/transport-firebase` and `@levelup/api-client` each restate the
  // `Transport` seam; their `subscribe` callback error types differ by a nominal
  // `ApiError` vs `ApiErrorDetails` (a known cross-package drift). Structurally
  // identical at runtime → cast.
  //
  // Response validation stays OFF: the RESPONSE-shape canonicalization is only
  // PARTIAL on the deployed backend (e.g. `listStoryPoints` still returns legacy
  // `order` vs canonical `orderIndex`). With validation ON the api-client THROWS
  // before a screen's defensive `??` fallbacks can run. Flip to `true` once
  // SDK-coord canonicalizes ALL read responses.
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
