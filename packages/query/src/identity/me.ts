/**
 * Identity — session/`me` hooks (identity.md "Query hooks").
 *
 *   useMe()            → meRepo.get (the collapsed user+memberships+claims+tenant view)
 *   useSwitchTenant()  → meRepo.switchTenant; resets the WHOLE cache (tenant-implicit
 *                        keys) after the transport re-stamps claims (⚷, never optimistic)
 *   useJoinTenant()    → meRepo.joinByCode; invalidates the `me` view (⚷)
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type { Repositories } from "@levelup/repositories";
import { useApi } from "../provider/useApi.js";
import { resetForTenantSwitch } from "../provider/reset.js";
import { invalidateForCallable } from "../invalidation/invalidate.js";
import { meKeys } from "../keys/registry.js";

type MeRepoBag = Repositories & {
  meRepo: {
    get(): Promise<unknown>;
    switchTenant(targetTenantId: string): Promise<unknown>;
    joinByCode(tenantCode: string): Promise<unknown>;
  };
};

export function useMe(): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: meKeys.detail("me"),
    queryFn: () => (repos as MeRepoBag).meRepo.get(),
  });
}

/**
 * Switch the active tenant. The repo re-stamps claims server-side then forces a
 * token refresh; on success we `resetForTenantSwitch` (full `qc.clear()`) — the
 * only safe cross-tenant boundary (tenant-implicit keys). NOT optimistic (⚷).
 */
export function useSwitchTenant(): UseMutationResult<unknown, unknown, string> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetTenantId: string) =>
      (repos as MeRepoBag).meRepo.switchTenant(targetTenantId),
    onSettled: () => {
      resetForTenantSwitch(qc);
    },
  });
}

/** Join a tenant by code. Invalidates the `me` view (⚷, never optimistic). */
export function useJoinTenant(): UseMutationResult<unknown, unknown, string> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tenantCode: string) => (repos as MeRepoBag).meRepo.joinByCode(tenantCode),
    onSettled: (data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: meKeys.all() });
      void invalidateForCallable(qc, "v1.identity.joinTenant", { vars, data });
    },
  });
}
