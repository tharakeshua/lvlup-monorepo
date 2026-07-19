import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { LearningInsight } from "@levelup/shared-types";

/**
 * Fetch active (non-dismissed) insights for a student, ordered by priority.
 */
export function useStudentInsights(tenantId: string | null, studentId: string | null) {
  return useQuery<LearningInsight[]>({
    queryKey: ["tenants", tenantId, "insights", studentId],
    queryFn: async () => {
      if (!tenantId || !studentId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/insights`);
      const q = query(
        colRef,
        where("studentId", "==", studentId),
        where("dismissedAt", "==", null),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LearningInsight);
    },
    enabled: !!tenantId && !!studentId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Dismiss an insight by setting dismissedAt.
 */
export function useDismissInsight(tenantId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (insightId: string) => {
      if (!tenantId) throw new Error("No tenant context");
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/insights`, insightId);
      await updateDoc(docRef, { dismissedAt: serverTimestamp() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "insights"] });
    },
  });
}
