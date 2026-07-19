import { useQuery, useQueries } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { ClassProgressSummary } from "@levelup/shared-types";

export function useClassProgressSummary(tenantId: string | null, classId: string | null) {
  return useQuery<ClassProgressSummary | null>({
    queryKey: ["tenants", tenantId, "classProgressSummaries", classId],
    queryFn: async () => {
      if (!tenantId || !classId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/classProgressSummaries`, classId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ClassProgressSummary;
    },
    enabled: !!tenantId && !!classId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useClassSummaries(tenantId: string | null, classIds: string[]) {
  return useQueries({
    queries: classIds.map((classId) => ({
      queryKey: ["tenants", tenantId, "classProgressSummaries", classId],
      queryFn: async () => {
        if (!tenantId) return null;
        const { db } = getFirebaseServices();
        const docRef = doc(db, `tenants/${tenantId}/classProgressSummaries`, classId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as ClassProgressSummary;
      },
      enabled: !!tenantId,
      staleTime: 5 * 60 * 1000,
    })),
  });
}
