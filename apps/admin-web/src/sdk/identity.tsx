/**
 * Identity shim — the stable seam pages import INSTEAD of `@levelup/shared-stores`.
 *
 * It collapses the old zustand auth/tenant stores onto two SDK primitives:
 *   • `useSession()` (firebase auth + parsed claims) — the signed-in user and the
 *     custom-claims `tenantId`/`role` that scope every callable server-side.
 *   • `useMe()` (@levelup/query bootstrap callable) — the richer user + membership
 *     list, read defensively (typed `unknown`).
 *
 * Pages should call these instead of passing a `tenantId` into data hooks — the
 * query hooks (`useClasses()`, `useExams()`, …) are tenant-implicit (claims-scoped).
 * `useCurrentTenantId()` remains available for display / routing / cache keys.
 */
import { useMe, useTenant } from "@levelup/query";

import { useSession } from "./session";

/** Defensive record reader for the `unknown` `useMe` payload. */
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export interface CurrentUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isSuperAdmin: boolean;
}

export interface CurrentMembership {
  tenantId: string;
  role: string;
}

export { useSession } from "./session";

/** Whether auth has resolved a signed-in firebase user. */
export function useIsAuthenticated(): boolean {
  return !!useSession().user;
}

/** True while the initial auth state is still resolving. */
export function useAuthLoading(): boolean {
  return useSession().loading;
}

/** The signed-in user merged with super-admin flag from claims. */
export function useCurrentUser(): CurrentUser | null {
  const { user, claims } = useSession();
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    isSuperAdmin: claims?.isSuperAdmin ?? false,
  };
}

/**
 * The active tenant id — sourced from the ID-token claims (the canonical scoping
 * key the server enforces). Falls back to the `useMe` payload if a build ever
 * ships without the claim.
 */
export function useCurrentTenantId(): string | null {
  const { claims } = useSession();
  const me = asRecord(useMe().data);
  return (
    claims?.tenantId ??
    (me.currentTenantId as string | undefined) ??
    (me.tenantId as string | undefined) ??
    null
  );
}

/** The active membership ({ tenantId, role }) for the current tenant. */
export function useCurrentMembership(): CurrentMembership | null {
  const { claims } = useSession();
  const tenantId = useCurrentTenantId();
  if (!tenantId) return null;
  return { tenantId, role: claims?.role ?? "tenantAdmin" };
}

interface MembershipRow {
  tenantId: string;
  role: string;
  tenantName?: string;
}

/** All memberships for the signed-in user (for the tenant switcher). */
export function useAllMemberships(): MembershipRow[] {
  const me = asRecord(useMe().data);
  const raw =
    (me.memberships as unknown[] | undefined) ?? (me.allMemberships as unknown[] | undefined) ?? [];
  return raw
    .map((m) => asRecord(m))
    .filter((m) => typeof m.tenantId === "string")
    .map((m) => ({
      tenantId: m.tenantId as string,
      role: (m.role as string | undefined) ?? "tenantAdmin",
      tenantName: m.tenantName as string | undefined,
    }));
}

/** The current tenant record (name/settings/onboarding) — query `useTenant()`. */
export function useCurrentTenant() {
  return useTenant();
}
