import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { AcademicSession } from "@levelup/shared-types";

export type { AcademicSession } from "@levelup/shared-types";

export function useAcademicSessions(tenantId: string | null) {
  return useQuery<AcademicSession[]>({
    queryKey: ["tenants", tenantId, "academicSessions"],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/academicSessions`);
      const q = query(colRef, orderBy("startDate", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AcademicSession);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAcademicSession() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    { tenantId: string; name: string; startDate: string; endDate: string; isCurrent?: boolean },
    { sessionId: string }
  >(functions, "createAcademicSession");

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      name: string;
      startDate: string;
      endDate: string;
      isCurrent?: boolean;
    }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "academicSessions"],
      });
    },
  });
}

export function useUpdateAcademicSession() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<
    {
      tenantId: string;
      sessionId: string;
      name?: string;
      startDate?: string;
      endDate?: string;
      isCurrent?: boolean;
      status?: "active" | "archived";
    },
    { success: boolean }
  >(functions, "updateAcademicSession");

  return useMutation({
    mutationFn: async (params: {
      tenantId: string;
      sessionId: string;
      name?: string;
      startDate?: string;
      endDate?: string;
      isCurrent?: boolean;
      status?: "active" | "archived";
    }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "academicSessions"],
      });
    },
  });
}
