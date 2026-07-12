import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { SaveItemRequest, SaveResponse } from "@levelup/shared-types";

export function useCreateItem() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveItemRequest, SaveResponse>(functions, "saveItem");

  return useMutation({
    mutationFn: async (params: Omit<SaveItemRequest, "id">) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "items"],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "storyPoints"],
      });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveItemRequest, SaveResponse>(functions, "saveItem");

  return useMutation({
    mutationFn: async (params: SaveItemRequest & { id: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "items"],
      });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveItemRequest, SaveResponse>(functions, "saveItem");

  return useMutation({
    mutationFn: async (params: {
      id: string;
      tenantId: string;
      spaceId: string;
      storyPointId: string;
    }) => {
      const result = await callable({
        id: params.id,
        tenantId: params.tenantId,
        spaceId: params.spaceId,
        storyPointId: params.storyPointId,
        data: { deleted: true },
      });
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "items"],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "storyPoints"],
      });
    },
  });
}

export function useBulkCreateItems() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveItemRequest, SaveResponse>(functions, "saveItem");

  return useMutation({
    mutationFn: async (params: { items: Omit<SaveItemRequest, "id">[] }) => {
      const results = await Promise.all(params.items.map((item) => callable(item)));
      return results.map((r) => r.data);
    },
    onSuccess: (_data, variables) => {
      const first = variables.items[0];
      if (first) {
        queryClient.invalidateQueries({
          queryKey: ["tenants", first.tenantId, "spaces", first.spaceId, "items"],
        });
        queryClient.invalidateQueries({
          queryKey: ["tenants", first.tenantId, "spaces", first.spaceId, "storyPoints"],
        });
      }
    },
  });
}
