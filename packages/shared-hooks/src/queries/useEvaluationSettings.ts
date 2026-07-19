import { useQuery } from "@tanstack/react-query";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { EvaluationSettings } from "@levelup/shared-types";

export type { EvaluationSettings } from "@levelup/shared-types";

export function useEvaluationSettings(tenantId: string | null, settingsId?: string | null) {
  return useQuery<EvaluationSettings | EvaluationSettings[] | null>({
    queryKey: ["tenants", tenantId, "evaluationSettings", settingsId ?? "all"],
    queryFn: async () => {
      if (!tenantId) return null;
      const { db } = getFirebaseServices();

      if (settingsId) {
        const docRef = doc(db, `tenants/${tenantId}/evaluationSettings`, settingsId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as EvaluationSettings;
      }

      // Return all evaluation settings for the tenant
      const colRef = collection(db, `tenants/${tenantId}/evaluationSettings`);
      const snap = await getDocs(colRef);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as EvaluationSettings);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}
