import { useQuery, useQueries } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { StudentProgressSummary } from "@levelup/shared-types";

export function useStudentProgressSummary(tenantId: string | null, studentId: string | null) {
  return useQuery<StudentProgressSummary | null>({
    queryKey: ["tenants", tenantId, "studentProgressSummaries", studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/studentProgressSummaries`, studentId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as StudentProgressSummary;
    },
    enabled: !!tenantId && !!studentId,
    staleTime: 30 * 1000,
  });
}

export function useStudentSummaries(tenantId: string | null, studentIds: string[]) {
  return useQueries({
    queries: studentIds.map((studentId) => ({
      queryKey: ["tenants", tenantId, "studentProgressSummaries", studentId],
      queryFn: async () => {
        if (!tenantId) return null;
        const { db } = getFirebaseServices();
        const docRef = doc(db, `tenants/${tenantId}/studentProgressSummaries`, studentId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as StudentProgressSummary;
      },
      enabled: !!tenantId,
      staleTime: 30 * 1000,
    })),
  });
}
