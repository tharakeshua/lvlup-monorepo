/**
 * `meRepo` (SDK-LAYERS-PLAN §4.1, identity.md "meRepo") — the session/identity
 * view (⚷-read). Collapses the live `auth-store` + `useAuth` double-source into
 * ONE `getMe` view-model.
 *
 * `switchTenant` re-stamps claims server-side then signals the transport to
 * `refreshToken()` (force `getIdToken(true)`) BEFORE the caller refetches `getMe`
 * (identity.md open-Q #4). `activeRole`/`hasPermission` are derived selectors over
 * claims — UX only; the server enforces.
 */
import type { TenantId } from "@levelup/domain";
import type {
  ApiClient,
  GetMeResponse,
  JoinTenantResponse,
  SwitchActiveTenantResponse,
} from "../internal/api-types.js";

export interface MeRepo {
  get(): Promise<GetMeResponse>;
  switchTenant(targetTenantId: TenantId | string): Promise<SwitchActiveTenantResponse>;
  joinByCode(tenantCode: string): Promise<JoinTenantResponse>;
  /** Derived: the active role from claims (UX). */
  computeActiveRole(me: Pick<GetMeResponse, "claims">): string | undefined;
  /** Derived: does the caller hold a permission key (UX pre-check). */
  isPermitted(me: Pick<GetMeResponse, "claims">, key: string): boolean;
}

export function createMeRepo(api: ApiClient): MeRepo {
  return {
    get: () => api.identity.getMe({}),
    async switchTenant(targetTenantId) {
      const res = await api.identity.switchActiveTenant({
        targetTenantId: targetTenantId as TenantId,
      });
      // Force a fresh ID token so the new claims/active tenant take effect before
      // the caller invalidates + refetches getMe (identity.md open-Q #4).
      await api.refreshToken?.();
      return res;
    },
    joinByCode: (tenantCode) => api.identity.joinTenant({ tenantCode }),
    computeActiveRole: (me) => (me.claims as { role?: string } | undefined)?.role,
    isPermitted: (me, key) => {
      const perms = (me.claims as { permissions?: Record<string, boolean> } | undefined)
        ?.permissions;
      return Boolean(perms?.[key]);
    },
  };
}
