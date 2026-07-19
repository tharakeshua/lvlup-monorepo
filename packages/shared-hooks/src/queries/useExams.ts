import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, orderBy, QueryConstraint } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { Exam } from "@levelup/shared-types";

export type { Exam } from "@levelup/shared-types";

export function useExams(
  tenantId: string | null,
  options?: { spaceId?: string; classId?: string; status?: string }
) {
  return useQuery<Exam[]>({
    queryKey: ["tenants", tenantId, "exams", options ?? {}],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/exams`);
      const constraints: QueryConstraint[] = [];
      if (options?.spaceId) {
        constraints.push(where("linkedSpaceId", "==", options.spaceId));
      }
      if (options?.classId) {
        constraints.push(where("classIds", "array-contains", options.classId));
      }
      if (options?.status) {
        constraints.push(where("status", "==", options.status));
      }
      constraints.push(orderBy("updatedAt", "desc"));
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Exam);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}
