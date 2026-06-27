/**
 * `createRefreshToken` (transport-realtime.md §2.2 auth/refresh-token.ts).
 *
 * The token seam used by `meRepo.switchTenant`: after `switchActiveTenant` re-stamps
 * the tenant claim server-side (identity open-Q #4), force a fresh ID token so the
 * new claim is in effect AND refresh the cached `PathContext.tenantId` (so the read
 * path immediately scopes to the new tenant). No-op when signed out.
 *
 * The `PathContext` refresh is wired via the `onRefreshed` hook the factory passes —
 * keeps this module free of any PathContext-holder import cycle.
 */
import type { Auth } from "firebase/auth";

export function createRefreshToken(auth: Auth, onRefreshed: (force: boolean) => Promise<void>) {
  return async function refreshToken(force = true): Promise<void> {
    await auth.currentUser?.getIdToken(force);
    // Re-derive the cached PathContext.tenantId from the freshly-minted token.
    await onRefreshed(force);
  };
}
