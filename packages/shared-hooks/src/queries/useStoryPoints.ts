import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { StoryPoint, SaveStoryPointRequest, SaveResponse } from "@levelup/shared-types";

export type { StoryPoint } from "@levelup/shared-types";

export function useStoryPoints(tenantId: string | null, spaceId: string | null) {
  return useQuery<StoryPoint[]>({
    queryKey: ["tenants", tenantId, "spaces", spaceId, "storyPoints"],
    queryFn: async () => {
      if (!tenantId || !spaceId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/spaces/${spaceId}/storyPoints`);
      const q = query(colRef, orderBy("orderIndex", "asc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StoryPoint);
    },
    enabled: !!tenantId && !!spaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStoryPoint(
  tenantId: string | null,
  spaceId: string | null,
  storyPointId: string | null
) {
  return useQuery<StoryPoint | null>({
    queryKey: ["tenants", tenantId, "spaces", spaceId, "storyPoints", storyPointId],
    queryFn: async () => {
      if (!tenantId || !spaceId || !storyPointId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/spaces/${spaceId}/storyPoints`, storyPointId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as StoryPoint;
    },
    enabled: !!tenantId && !!spaceId && !!storyPointId,
    staleTime: 30 * 1000,
  });
}

export function useCreateStoryPoint() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveStoryPointRequest, SaveResponse>(functions, "saveStoryPoint");

  return useMutation({
    mutationFn: async (params: SaveStoryPointRequest) => {
      const result = await callable({ ...params, id: undefined });
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "storyPoints"],
      });
    },
  });
}

export function useUpdateStoryPoint() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveStoryPointRequest, SaveResponse>(functions, "saveStoryPoint");

  return useMutation({
    mutationFn: async (params: SaveStoryPointRequest & { id: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "storyPoints"],
      });
    },
  });
}

export function useDeleteStoryPoint() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveStoryPointRequest, SaveResponse>(functions, "saveStoryPoint");

  return useMutation({
    mutationFn: async (params: { id: string; tenantId: string; spaceId: string }) => {
      const result = await callable({
        id: params.id,
        tenantId: params.tenantId,
        spaceId: params.spaceId,
        data: { deleted: true },
      });
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "storyPoints"],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId],
      });
    },
  });
}

export function useReorderStoryPoints() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveStoryPointRequest, SaveResponse>(functions, "saveStoryPoint");

  return useMutation({
    mutationFn: async (params: { tenantId: string; spaceId: string; orderedIds: string[] }) => {
      // Batch update orderIndex for each storyPoint
      const results = await Promise.all(
        params.orderedIds.map((id, index) =>
          callable({
            id,
            tenantId: params.tenantId,
            spaceId: params.spaceId,
            data: { orderIndex: index },
          })
        )
      );
      return results.map((r) => r.data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "storyPoints"],
      });
    },
  });
}
