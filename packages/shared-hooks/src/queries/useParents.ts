import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy, QueryConstraint } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Parent } from "@levelup/shared-types";

export type { Parent } from "@levelup/shared-types";

export function useParents(tenantId: string | null, options?: { status?: string }) {
  return useQuery<Parent[]>({
    queryKey: ["tenants", tenantId, "parents", options ?? {}],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/parents`);
      const constraints: QueryConstraint[] = [];
      if (options?.status) {
        constraints.push(where("status", "==", options.status));
      }
      constraints.push(orderBy("uid", "asc"));
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Parent);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateParent() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { tenantId: string; uid: string; childStudentIds?: string[] },
    { parentId: string }
  >(functions, "createParent");

  return useMutation({
    mutationFn: async (params: { tenantId: string; uid: string; childStudentIds?: string[] }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "parents"] });
    },
  });
}
