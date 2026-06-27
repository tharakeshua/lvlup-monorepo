/**
 * SDK composition root (client brain wiring):
 *
 *   firebase services  →  createFirebaseTransport (invoke/subscribe/serverTime)
 *                      →  createApiClient (validate · idempotency · retry · normalize)
 *                      +  auth capability (api.auth, backed by the firebase auth handle)
 *                      →  createRepositories (the repo bag the query hooks call)
 *
 * Mirrors `apps/mobile-student/src/sdk/api.ts` — the only web diff is `__DEV__`
 * → `import.meta.env.DEV`.
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

  // Response validation stays OFF: the deployed backend's read-response
  // canonicalization is only PARTIAL (e.g. story-points still emit the legacy
  // `order` key). With validation ON the api-client throws before a screen's
  // defensive `??` fallbacks can run. Flip to `true` once SDK-coord canonicalizes
  // ALL read responses. The data is correct + usable today.
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
