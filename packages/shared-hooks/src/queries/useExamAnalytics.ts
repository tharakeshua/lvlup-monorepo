import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { ExamAnalytics } from "@levelup/shared-types";

export function useExamAnalytics(tenantId: string | null, examId: string | null) {
  return useQuery<ExamAnalytics | null>({
    queryKey: ["tenants", tenantId, "examAnalytics", examId],
    queryFn: async () => {
      if (!tenantId || !examId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/examAnalytics`, examId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ExamAnalytics;
    },
    enabled: !!tenantId && !!examId,
    staleTime: 5 * 60 * 1000,
  });
}
