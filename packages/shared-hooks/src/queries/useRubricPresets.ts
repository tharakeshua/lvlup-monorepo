import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type {
  RubricPreset,
  RubricPresetCategory,
  UnifiedRubric,
  QuestionType,
} from "@levelup/shared-types";

export function useRubricPresets(tenantId: string | null) {
  return useQuery<RubricPreset[]>({
    queryKey: ["tenants", tenantId, "rubricPresets"],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const q = query(
        collection(db, `tenants/${tenantId}/rubricPresets`),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as RubricPreset);
    },
    enabled: !!tenantId,
    staleTime: 60 * 1000,
  });
}

export function useSaveRubricPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id?: string;
      tenantId: string;
      data: {
        name?: string;
        description?: string;
        rubric?: UnifiedRubric;
        category?: RubricPresetCategory;
        questionTypes?: QuestionType[];
        deleted?: boolean;
      };
    }) => {
      const { functions } = getFirebaseServices();
      const callable = httpsCallable(functions, "saveRubricPreset");
      const result = await callable(params);
      return result.data as { id: string; created?: boolean; deleted?: boolean };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "rubricPresets"],
      });
    },
  });
}
