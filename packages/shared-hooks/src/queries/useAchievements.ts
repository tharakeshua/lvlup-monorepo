import { useQuery } from "@tanstack/react-query";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { getFirebaseServices } from "@levelup/shared-services";
import type {
  Achievement,
  StudentAchievement,
  StudentLevel,
  StudyGoal,
} from "@levelup/shared-types";

/**
 * Fetch all active achievement definitions for a tenant.
 */
export function useAchievements(tenantId: string | null) {
  return useQuery<Achievement[]>({
    queryKey: ["tenants", tenantId, "achievements"],
    queryFn: async () => {
      if (!tenantId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/achievements`);
      const q = query(colRef, where("isActive", "==", true), orderBy("tier"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Achievement);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all achievements earned by a specific student.
 */
export function useStudentAchievements(tenantId: string | null, userId: string | null) {
  return useQuery<StudentAchievement[]>({
    queryKey: ["tenants", tenantId, "studentAchievements", userId],
    queryFn: async () => {
      if (!tenantId || !userId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/studentAchievements`);
      const q = query(colRef, where("userId", "==", userId), orderBy("earnedAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudentAchievement);
    },
    enabled: !!tenantId && !!userId,
    staleTime: 60 * 1000,
  });
}

/**
 * Fetch student's current level and XP.
 */
export function useStudentLevel(tenantId: string | null, userId: string | null) {
  return useQuery<StudentLevel | null>({
    queryKey: ["tenants", tenantId, "studentLevel", userId],
    queryFn: async () => {
      if (!tenantId || !userId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/studentLevels`, userId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        // Return default level 1
        return {
          id: userId,
          tenantId,
          userId,
          level: 1,
          currentXP: 0,
          xpToNextLevel: 100,
          totalXP: 0,
          tier: "bronze" as const,
          achievementCount: 0,
          updatedAt: null,
        } as unknown as StudentLevel;
      }
      return { id: snap.id, ...snap.data() } as StudentLevel;
    },
    enabled: !!tenantId && !!userId,
    staleTime: 30 * 1000,
  });
}

/**
 * Fetch student's study goals.
 */
export function useStudyGoals(tenantId: string | null, userId: string | null) {
  return useQuery<StudyGoal[]>({
    queryKey: ["tenants", tenantId, "studyGoals", userId],
    queryFn: async () => {
      if (!tenantId || !userId) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, `tenants/${tenantId}/studyGoals`);
      const q = query(colRef, where("userId", "==", userId), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StudyGoal);
    },
    enabled: !!tenantId && !!userId,
    staleTime: 60 * 1000,
  });
}
