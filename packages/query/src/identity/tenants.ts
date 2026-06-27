/**
 * Identity — tenant hooks (identity.md "Query hooks"). Super-admin list/get +
 * save + lifecycle verbs (deactivate/reactivate) + export + pre-auth lookup. All
 * mutations are ⚷ (lifecycle/claims) — never optimistic.
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
import { invalidateForCallable } from "../invalidation/invalidate.js";
import { tenantKeys } from "../keys/registry.js";

type TenantRepoBag = Repositories & {
  tenantRepo: {
    list(filter?: object): Promise<unknown>;
    get(tenantOverride?: string): Promise<unknown>;
    save(input: unknown): Promise<unknown>;
    deactivate(tenantOverride: string, reason?: string): Promise<unknown>;
    reactivate(tenantOverride: string): Promise<unknown>;
    exportData(input: unknown): Promise<unknown>;
    lookupByCode(code: string): Promise<unknown>;
  };
};
const t = (repos: Repositories) => (repos as TenantRepoBag).tenantRepo;

export function useTenants(filter?: object): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: tenantKeys.list(filter ?? {}),
    queryFn: () => t(repos).list(filter),
  });
}

export function useTenant(tenantOverride?: string): UseQueryResult<unknown> {
  const { repos } = useApi();
  return useQuery({
    queryKey: tenantKeys.detail(tenantOverride ?? "active"),
    queryFn: () => t(repos).get(tenantOverride),
  });
}

/** Pre-auth, public lookup — returns ONLY `TenantPublicView`. No invalidation. */
export function useLookupTenantByCode(): UseMutationResult<unknown, unknown, string> {
  const { repos } = useApi();
  return useMutation({ mutationFn: (code: string) => t(repos).lookupByCode(code) });
}

export function useSaveTenant(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: unknown) => t(repos).save(input),
    onSettled: (data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: tenantKeys.all() });
      void invalidateForCallable(qc, "v1.identity.saveTenant", { vars, data });
    },
  });
}

export function useDeactivateTenant(): UseMutationResult<
  unknown,
  unknown,
  { tenantOverride: string; reason?: string }
> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v) => t(repos).deactivate(v.tenantOverride, v.reason),
    onSettled: (data, _err, vars) => {
      void invalidateForCallable(qc, "v1.identity.deactivateTenant", { vars, data });
    },
  });
}

export function useReactivateTenant(): UseMutationResult<
  unknown,
  unknown,
  { tenantOverride: string }
> {
  const { repos } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v) => t(repos).reactivate(v.tenantOverride),
    onSettled: (data, _err, vars) => {
      void invalidateForCallable(qc, "v1.identity.reactivateTenant", { vars, data });
    },
  });
}

export function useExportTenantData(): UseMutationResult<unknown, unknown, unknown> {
  const { repos } = useApi();
  return useMutation({ mutationFn: (input: unknown) => t(repos).exportData(input) });
}
