import { useQuery } from "@tanstack/react-query";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type { SpaceProgress, StoryPointProgressDoc } from "@levelup/shared-types";

export type StudentProgress = SpaceProgress;

/**
 * Fetch space-level progress for a student.
 * Uses direct doc get with deterministic ID ({userId}_{spaceId}) for efficiency.
 * Returns the space summary (storyPoint aggregates) — no item-level data.
 *
 * For item-level data, use `useStoryPointProgress`.
 */
export function useProgress(tenantId: string | null, studentId: string | null, spaceId?: string) {
  return useQuery<SpaceProgress | null>({
    queryKey: ["tenants", tenantId, "progress", studentId, spaceId ?? "overall"],
    queryFn: async () => {
      if (!tenantId || !studentId) return null;
      const { db } = getFirebaseServices();

      if (spaceId) {
        // Direct doc get with deterministic ID — no index needed
        const progressId = `${studentId}_${spaceId}`;
        const docRef = doc(db, `tenants/${tenantId}/spaceProgress/${progressId}`);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as SpaceProgress;
      }

      // Overall mode: fetch ALL spaceProgress docs for this user and
      // aggregate them into a single summary.
      const colRef = collection(db, `tenants/${tenantId}/spaceProgress`);
      const q = query(colRef, where("userId", "==", studentId));
      const snap = await getDocs(q);
      if (snap.empty) return null;

      // Aggregate across all spaces
      let totalPointsEarned = 0;
      let totalPointsMax = 0;
      const allStoryPoints: Record<string, any> = {};

      for (const d of snap.docs) {
        const data = d.data() as SpaceProgress;
        totalPointsEarned += data.pointsEarned ?? 0;
        totalPointsMax += data.totalPoints ?? 0;
        Object.assign(allStoryPoints, data.storyPoints ?? {});
      }

      const firstDoc = snap.docs[0]!;
      return {
        ...firstDoc.data(),
        id: `${studentId}_overall`,
        pointsEarned: totalPointsEarned,
        totalPoints: totalPointsMax,
        percentage: totalPointsMax > 0 ? (totalPointsEarned / totalPointsMax) * 100 : 0,
        storyPoints: allStoryPoints,
      } as SpaceProgress;
    },
    enabled: !!tenantId && !!studentId,
    staleTime: 30 * 1000,
  });
}

/**
 * Bulk-fetch ALL spaceProgress docs for a user in one Firestore query.
 * Returns a Record<spaceId, SpaceProgress> map so listing pages can
 * look up progress per-space without N+1 individual queries.
 */
export function useAllSpaceProgress(tenantId: string | null, studentId: string | null) {
  return useQuery<Record<string, SpaceProgress>>({
    queryKey: ["tenants", tenantId, "progress", studentId, "all"],
    queryFn: async () => {
      if (!tenantId || !studentId) return {};
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/spaceProgress`);
      const q = query(colRef, where("userId", "==", studentId));
      const snap = await getDocs(q);

      const map: Record<string, SpaceProgress> = {};
      for (const d of snap.docs) {
        const data = { id: d.id, ...d.data() } as SpaceProgress;
        if (data.spaceId) {
          map[data.spaceId] = data;
        }
      }
      return map;
    },
    enabled: !!tenantId && !!studentId,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch storyPoint-level progress subdoc for a student.
 * Contains per-item progress with lastAnswer and lastEvaluation for revisit display.
 *
 * Falls back to legacy space-level doc's items map if the subcollection doc
 * doesn't exist yet (backward compatibility during migration).
 */
export function useStoryPointProgress(
  tenantId: string | null,
  studentId: string | null,
  spaceId: string | null,
  storyPointId: string | null
) {
  return useQuery<StoryPointProgressDoc | null>({
    queryKey: ["tenants", tenantId, "progress", studentId, spaceId, "sp", storyPointId],
    queryFn: async () => {
      if (!tenantId || !studentId || !spaceId || !storyPointId) return null;
      const { db } = getFirebaseServices();
      const progressId = `${studentId}_${spaceId}`;

      // Try new subcollection path first
      const subdocRef = doc(
        db,
        `tenants/${tenantId}/spaceProgress/${progressId}/storyPointProgress/${storyPointId}`
      );
      const subdocSnap = await getDoc(subdocRef);
      if (subdocSnap.exists()) {
        return { storyPointId: subdocSnap.id, ...subdocSnap.data() } as StoryPointProgressDoc;
      }

      // Fallback: read legacy flat items from the space-level doc
      const spaceDocRef = doc(db, `tenants/${tenantId}/spaceProgress/${progressId}`);
      const spaceDocSnap = await getDoc(spaceDocRef);
      if (!spaceDocSnap.exists()) return null;

      const spaceData = spaceDocSnap.data();
      const legacyItems: Record<string, any> = spaceData?.["items"] ?? {};

      // Filter items belonging to this storyPoint
      const itemsForSP: Record<string, any> = {};
      for (const [itemId, entry] of Object.entries(legacyItems)) {
        if (entry?.storyPointId === storyPointId) {
          itemsForSP[itemId] = entry;
        }
      }

      // No items for this storyPoint in legacy data
      if (Object.keys(itemsForSP).length === 0) return null;

      // Synthesize a StoryPointProgressDoc from the legacy data
      const storyPoints = spaceData?.["storyPoints"] as Record<string, any> | undefined;
      const spSummary = storyPoints?.[storyPointId];
      return {
        storyPointId,
        status: spSummary?.status ?? "in_progress",
        pointsEarned: spSummary?.pointsEarned ?? 0,
        totalPoints: spSummary?.totalPoints ?? 0,
        percentage: spSummary?.percentage ?? 0,
        completedItems: Object.values(itemsForSP).filter((e: any) => e?.completed).length,
        totalItems: Object.keys(itemsForSP).length,
        completedAt: spSummary?.completedAt,
        updatedAt: Date.now(),
        items: itemsForSP,
      } as StoryPointProgressDoc;
    },
    enabled: !!tenantId && !!studentId && !!spaceId && !!storyPointId,
    staleTime: 30 * 1000,
  });
}
