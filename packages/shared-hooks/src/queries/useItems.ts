import { useInfiniteQuery } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint,
} from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { UnifiedItem } from "@levelup/shared-types";

export type Item = UnifiedItem;

const PAGE_SIZE = 25;

export function useItems(
  tenantId: string | null,
  parentCollection: string,
  parentId: string | null
) {
  return useInfiniteQuery<
    { items: UnifiedItem[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null },
    Error
  >({
    queryKey: ["tenants", tenantId, parentCollection, parentId, "items"],
    queryFn: async ({ pageParam }) => {
      if (!tenantId || !parentId) return { items: [], lastDoc: null };
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/${parentCollection}/${parentId}/items`);
      const constraints: QueryConstraint[] = [orderBy("orderIndex", "asc"), limit(PAGE_SIZE)];
      if (pageParam) {
        constraints.push(startAfter(pageParam));
      }
      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UnifiedItem);
      const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
      return { items, lastDoc };
    },
    initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
    getNextPageParam: (lastPage) =>
      lastPage.items.length === PAGE_SIZE ? lastPage.lastDoc : undefined,
    enabled: !!tenantId && !!parentId,
    staleTime: 5 * 60 * 1000,
  });
}
