import { useQuery } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Space } from "@levelup/shared-types";

export function useSpace(tenantId: string | null, spaceId: string | null) {
  return useQuery<Space | null>({
    queryKey: ["tenants", tenantId, "spaces", spaceId],
    queryFn: async () => {
      if (!tenantId || !spaceId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/spaces`, spaceId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Space;
    },
    enabled: !!tenantId && !!spaceId,
    staleTime: 30 * 1000, // 30s for detail views
  });
}
