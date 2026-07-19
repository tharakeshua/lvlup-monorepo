import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { UserMembership } from "@levelup/shared-types";

export type { UserMembership } from "@levelup/shared-types";

export function useCurrentUser(uid: string | null) {
  return useQuery({
    queryKey: ["users", uid],
    queryFn: async () => {
      if (!uid) return null;
      const { db } = getFirebaseServices();
      const { doc, getDoc } = await import("firebase/firestore");
      const docRef = doc(db, "users", uid);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { uid: snap.id, ...snap.data() };
    },
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserMemberships(uid: string | null) {
  return useQuery<UserMembership[]>({
    queryKey: ["userMemberships", uid],
    queryFn: async () => {
      if (!uid) return [];
      const { db } = getFirebaseServices();
      const colRef = collection(db, "userMemberships");
      const q = query(colRef, where("uid", "==", uid), where("status", "==", "active"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserMembership);
    },
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });
}

interface SwitchTenantResponse {
  success: boolean;
  role: string;
}

export function useSwitchTenant() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<{ tenantId: string }, SwitchTenantResponse>(
    functions,
    "switchActiveTenant"
  );

  return useMutation({
    mutationFn: async (params: { tenantId: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate everything — tenant context changed
      queryClient.invalidateQueries();
    },
  });
}
