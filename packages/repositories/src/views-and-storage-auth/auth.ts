/**
 * `authRepo` (C3 — SDK-LAYERS-PLAN §9.2, §7.1; UC-4). The client auth brain.
 *
 * Wraps Firebase Auth on the transport auth-handle (via the api-client `auth`
 * capability) so NO app imports `firebase/auth` (R7 boundary). The server side
 * is already covered by `beforeSignIn` / `beforeUserCreated`; this repo is the
 * pure client sign-in/out/reset/restore + reactive-state surface that replaces
 * the live `shared-services/auth` (M9 decomposition map).
 *
 * `subscribeAuthState` returns an unsubscribe handle (refcount-naive — the
 * `@levelup/query`/`@levelup/realtime` layer owns dedupe). `isSignedIn` is the
 * one pure derived selector (UX only — the server enforces every request).
 *
 * Never optimistic: sign-in/out and password-reset are authoritative auth-state
 * transitions, not cache flips.
 */
import type { ApiClientSeam, AuthSession, SignInInput, AuthStateHandle } from "./seam.js";

export interface AuthRepo {
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  /** Resolve the persisted session on boot (`null` when signed-out). */
  restoreSession(): Promise<AuthSession | null>;
  /** Reactive auth-state stream; the handle's `unsubscribe()` detaches it. */
  subscribeAuthState(cb: (session: AuthSession | null) => void): AuthStateHandle;
  /** Pure derived selector (UX) — is a session present. No wire call. */
  isSignedIn(session: AuthSession | null | undefined): boolean;
}

export function createAuthRepo(api: ApiClientSeam): AuthRepo {
  return {
    signIn: (input) => api.auth.signIn(input),
    signOut: () => api.auth.signOut(),
    sendPasswordReset: (email) => api.auth.sendPasswordReset(email),
    restoreSession: () => api.auth.restoreSession(),
    subscribeAuthState: (cb) => api.auth.onAuthState(cb),
    isSignedIn: (session) => Boolean(session?.uid),
  };
}
