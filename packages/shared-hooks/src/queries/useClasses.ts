import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy, QueryConstraint } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Class } from "@levelup/shared-types";

export type { Class } from "@levelup/shared-types";

export function useClasses(
  tenantId: string | null,
  options?: { grade?: string; status?: string; academicSessionId?: string }
) {
  return useQuery<Class[]>({
    queryKey: ["tenants", tenantId, "classes", options ?? {}],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/classes`);
      const constraints: QueryConstraint[] = [];
      if (options?.grade) {
        constraints.push(where("grade", "==", options.grade));
      }
      if (options?.status) {
        constraints.push(where("status", "==", options.status));
      }
      if (options?.academicSessionId) {
        constraints.push(where("academicSessionId", "==", options.academicSessionId));
      }
      constraints.push(orderBy("name", "asc"));
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Class);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateClass() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    {
      tenantId: string;
      name: string;
      grade: string;
      section?: string;
      academicSessionId?: string;
      teacherIds?: string[];
    },
    { classId: string }
  >(functions, "createClass");

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      name: string;
      grade: string;
      section?: string;
      academicSessionId?: string;
      teacherIds?: string[];
    }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "classes"] });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    {
      tenantId: string;
      classId: string;
      name?: string;
      grade?: string;
      section?: string;
      academicSessionId?: string;
      teacherIds?: string[];
      studentIds?: string[];
    },
    { success: boolean }
  >(functions, "updateClass");

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      classId: string;
      name?: string;
      grade?: string;
      section?: string;
      academicSessionId?: string;
      teacherIds?: string[];
      studentIds?: string[];
    }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "classes"] });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<{ tenantId: string; classId: string }, { success: boolean }>(
    functions,
    "deleteClass"
  );

  return useMutation({
    mutationFn: async (params: { tenantId: string; classId: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "classes"] });
    },
  });
}
