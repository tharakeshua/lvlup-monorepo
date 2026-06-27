/**
 * SDK composition root (client brain wiring) — ported from the mobile reference
 * apps/mobile-student/src/sdk/api.ts. WEB DIFF: `__DEV__` → `import.meta.env.DEV`,
 * and we attach `refreshToken` so `meRepo.switchTenant` can force a fresh ID token
 * (multi-tenant teachers switch active tenant; the new claims must take effect
 * before `getMe` refetches).
 *
 *   firebase services  →  createFirebaseTransport (invoke/subscribe/serverTime)
 *                      →  createApiClient (validate · idempotency · retry · normalize)
 *                      +  auth capability (api.auth, backed by the firebase auth handle)
 *                      →  createRepositories (the repo bag the query hooks call)
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

  // Response validation stays OFF: the deployed backend canonicalizes read
  // responses only PARTIALLY (see the mobile reference for the full rationale).
  // With validation ON the api-client throws before a screen's defensive `??`
  // fallbacks can run.
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

  // `meRepo.switchTenant` calls `api.refreshToken?.()` to force the new active-tenant
  // claims into a fresh ID token before refetching `getMe`.
  const refreshToken = (force = true) =>
    services.auth.currentUser?.getIdToken(force).then(() => undefined) ?? Promise.resolve();

  const api = Object.assign(baseApi, { auth, refreshToken }) as ApiClient;
  const repos = createRepositories(api as never);

  sdk = { transport, api, repos };
  return sdk;
}
