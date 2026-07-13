import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy, QueryConstraint } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Space } from "@levelup/shared-types";

export type { Space } from "@levelup/shared-types";

export function useSpaces(
  tenantId: string | null,
  options?: { status?: string; classIds?: string[] }
) {
  const classIds = options?.classIds;
  return useQuery<Space[]>({
    queryKey: ["tenants", tenantId, "spaces", options?.status ?? "all", classIds ?? []],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/spaces`);
      const constraints: QueryConstraint[] = [];
      // When classIds are provided (student context), add array-contains-any
      // so Firestore security rules can verify access per-document.
      if (classIds && classIds.length > 0) {
        constraints.push(where("classIds", "array-contains-any", classIds));
      }
      if (options?.status) {
        constraints.push(where("status", "==", options.status));
      }
      // Only use server-side orderBy when no classIds filter (avoids needing
      // a 3-field composite index).  Sort client-side otherwise.
      if (!classIds || classIds.length === 0) {
        constraints.push(orderBy("updatedAt", "desc"));
      }
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      const spaces = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Space);
      // Client-side sort when server-side orderBy was skipped
      if (classIds && classIds.length > 0) {
        spaces.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() ?? 0;
          const bTime = b.updatedAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
      }
      return spaces;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 min for lists
  });
}
