import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy, QueryConstraint } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Teacher } from "@levelup/shared-types";

export type { Teacher } from "@levelup/shared-types";

export function useTeachers(
  tenantId: string | null,
  options?: { classId?: string; status?: string }
) {
  return useQuery<Teacher[]>({
    queryKey: ["tenants", tenantId, "teachers", options ?? {}],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/teachers`);
      const constraints: QueryConstraint[] = [];
      if (options?.classId) {
        constraints.push(where("classIds", "array-contains", options.classId));
      }
      if (options?.status) {
        constraints.push(where("status", "==", options.status));
      }
      constraints.push(orderBy("uid", "asc"));
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Teacher);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    {
      tenantId: string;
      uid: string;
      subjects?: string[];
      designation?: string;
      classIds?: string[];
    },
    { teacherId: string }
  >(functions, "createTeacher");

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      uid: string;
      subjects?: string[];
      designation?: string;
      classIds?: string[];
    }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "teachers"] });
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    {
      tenantId: string;
      teacherId: string;
      subjects?: string[];
      designation?: string;
      classIds?: string[];
    },
    { success: boolean }
  >(functions, "updateTeacher");

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      teacherId: string;
      subjects?: string[];
      designation?: string;
      classIds?: string[];
    }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "teachers"] });
    },
  });
}
