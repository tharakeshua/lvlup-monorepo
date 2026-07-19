import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  getFirebaseServices,
  getUserMemberships,
  identityCollectionCandidates,
} from "@levelup/shared-services";
import type { UserMembership } from "@levelup/shared-types";

export type { UserMembership } from "@levelup/shared-types";

function isMissingDocPermission(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  return code === "permission-denied" || code === "firestore/permission-denied";
}

export function useCurrentUser(uid: string | null) {
  return useQuery({
    queryKey: ["users", uid],
    queryFn: async () => {
      if (!uid) return null;
      const { db } = getFirebaseServices();
      const { doc, getDoc } = await import("firebase/firestore");
      for (const colName of identityCollectionCandidates("users")) {
        try {
          const snap = await getDoc(doc(db, colName, uid));
          if (snap.exists()) {
            return { uid: snap.id, ...snap.data() };
          }
        } catch (err) {
          if (isMissingDocPermission(err)) continue;
          throw err;
        }
      }
      return null;
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
      // Shared membership reader honors LVLUP_COLLECTION_PREFIX / v2_ SSOT.
      return getUserMemberships(uid);
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
  // Live identity callable is v1-prefixed and expects `targetTenantId`.
  const callable = httpsCallable<{ targetTenantId: string }, SwitchTenantResponse>(
    functions,
    "v1-identity-switchActiveTenant"
  );

  return useMutation({
    mutationFn: async (params: { tenantId: string }) => {
      const result = await callable({ targetTenantId: params.tenantId });
      return result.data;
    },
    onSuccess: () => {
      // Invalidate everything — tenant context changed
      queryClient.invalidateQueries();
    },
  });
}

/** @deprecated Kept for callers that still query the collection directly. */
export async function listActiveMembershipsRaw(uid: string): Promise<UserMembership[]> {
  const { db } = getFirebaseServices();
  for (const colName of identityCollectionCandidates("userMemberships")) {
    try {
      const colRef = collection(db, colName);
      const q = query(colRef, where("uid", "==", uid), where("status", "==", "active"));
      const snap = await getDocs(q);
      if (snap.docs.length > 0) {
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserMembership);
      }
    } catch (err) {
      if (isMissingDocPermission(err)) continue;
      throw err;
    }
  }
  return [];
}
