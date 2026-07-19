import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { SpaceReview } from "@levelup/shared-types";

export function useSpaceReviews(tenantId: string | null, spaceId: string | null, maxResults = 20) {
  return useQuery<SpaceReview[]>({
    queryKey: ["tenants", tenantId, "spaces", spaceId, "reviews"],
    queryFn: async () => {
      if (!tenantId || !spaceId) return [];
      const { db } = getFirebaseServices();
      const q = query(
        collection(db, `tenants/${tenantId}/spaces/${spaceId}/reviews`),
        orderBy("createdAt", "desc"),
        limit(maxResults)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SpaceReview);
    },
    enabled: !!tenantId && !!spaceId,
    staleTime: 60 * 1000,
  });
}

export function useSaveSpaceReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      spaceId: string;
      rating: number;
      comment?: string;
    }) => {
      const { functions } = getFirebaseServices();
      const callable = httpsCallable(functions, "saveSpaceReview");
      const result = await callable(params);
      return result.data as { success: boolean; isUpdate: boolean };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId, "reviews"],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "spaces", variables.spaceId],
      });
    },
  });
}
