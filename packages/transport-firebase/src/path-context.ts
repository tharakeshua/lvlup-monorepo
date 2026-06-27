/**
 * `PathContext` — the read-path tenant/uid scope (transport-realtime.md §2.2 note,
 * §9 open-Q #1).
 *
 * Subscriptions resolve to a Firestore doc/query path or an RTDB node that is
 * tenant- and (for self-scoped channels) uid-qualified. Neither `tenantId` nor
 * `uid` may ever be client-supplied; both are derived authoritatively here from the
 * decoded ID token (`tenantId` claim) and `auth.currentUser.uid`. The descriptor
 * path templates embed `__tenant__` / `__uid__` placeholders that the
 * subscribe-time resolver substitutes from this context.
 *
 * The context is derived once at `createFirebaseTransport` time and refreshed on
 * `onIdTokenChanged` (and by `refreshToken()` after `switchActiveTenant`), so the
 * read path stays tenant-authoritative even across a tenant switch.
 */
import type { Auth, User } from "firebase/auth";
import { onIdTokenChanged } from "firebase/auth";

export interface PathContext {
  /** Active-tenant id from the decoded ID-token claim. Empty until first resolve. */
  readonly tenantId: string;
  /** `auth.currentUser.uid`. Empty when signed out. */
  readonly uid: string;
}

export const EMPTY_PATH_CONTEXT: PathContext = { tenantId: "", uid: "" };

/** Placeholder tokens the source descriptors embed (substituted at subscribe time). */
export const TENANT_PLACEHOLDER = "__tenant__";
export const UID_PLACEHOLDER = "__uid__";

/** The active-tenant custom claim key on the decoded ID token. */
const TENANT_CLAIM = "tenantId";

/**
 * Reads `{tenantId, uid}` from a signed-in user's fresh ID-token result.
 * Returns the empty context when signed out.
 */
async function readContext(user: User | null): Promise<PathContext> {
  if (!user) return EMPTY_PATH_CONTEXT;
  const token = await user.getIdTokenResult();
  const claimTenant = token.claims[TENANT_CLAIM];
  return {
    uid: user.uid,
    tenantId: typeof claimTenant === "string" ? claimTenant : "",
  };
}

/**
 * A live, refresh-aware `PathContext` holder.
 *  • `get()` returns the latest resolved context (sync; used at subscribe time).
 *  • re-resolves on every `onIdTokenChanged` (sign-in/out + token refresh).
 *  • `refresh(force)` forces a fresh ID token (after `switchActiveTenant` re-stamps
 *    the tenant claim) and re-reads the context.
 *  • `dispose()` detaches the auth listener.
 */
export interface PathContextHolder {
  get(): PathContext;
  refresh(force?: boolean): Promise<void>;
  dispose(): void;
}

export function createPathContextHolder(auth: Auth): PathContextHolder {
  let current: PathContext = EMPTY_PATH_CONTEXT;

  // Seed synchronously from whatever user is already present (claims fill in on the
  // first async token read below / on the first onIdTokenChanged tick).
  if (auth.currentUser) {
    current = { tenantId: "", uid: auth.currentUser.uid };
  }

  const stop = onIdTokenChanged(auth, (user) => {
    void readContext(user).then((ctx) => {
      current = ctx;
    });
  });

  return {
    get: () => current,
    async refresh(force = true) {
      const user = auth.currentUser;
      if (user && force) {
        await user.getIdToken(true);
      }
      current = await readContext(user);
    },
    dispose: stop,
  };
}
