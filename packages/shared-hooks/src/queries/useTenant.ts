import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Tenant, SaveTenantRequest, SaveResponse } from "@levelup/shared-types";

export type { Tenant } from "@levelup/shared-types";

export function useTenant(tenantId: string | null) {
  return useQuery<Tenant | null>({
    queryKey: ["tenants", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, "tenants", tenantId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Tenant;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTenantSettings(tenantId: string | null) {
  return useQuery<Tenant["settings"] | null>({
    queryKey: ["tenants", tenantId, "settings"],
    queryFn: async () => {
      if (!tenantId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, "tenants", tenantId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return (snap.data() as Tenant).settings ?? null;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveTenantRequest, SaveResponse>(functions, "saveTenant");

  return useMutation({
    mutationFn: async (params: SaveTenantRequest & { id: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.id] });
    },
  });
}
