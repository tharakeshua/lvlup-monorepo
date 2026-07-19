import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { DigitalTestSession } from "@levelup/shared-types";

export type { DigitalTestSession } from "@levelup/shared-types";

export function useTestSession(tenantId: string | null, sessionId: string | null) {
  return useQuery<DigitalTestSession | null>({
    queryKey: ["tenants", tenantId, "digitalTestSessions", sessionId],
    queryFn: async () => {
      if (!tenantId || !sessionId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/digitalTestSessions`, sessionId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as DigitalTestSession;
    },
    enabled: !!tenantId && !!sessionId,
    staleTime: 10 * 1000, // 10s — sessions change frequently
  });
}

interface StartTestParams {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
}

interface StartTestResponse {
  sessionId: string;
  startedAt: unknown;
  serverDeadline: unknown;
  questionOrder: string[];
  totalQuestions: number;
  attemptNumber: number;
  resuming: boolean;
}

export function useStartTest() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<StartTestParams, StartTestResponse>(functions, "startTestSession");

  return useMutation({
    mutationFn: async (params: StartTestParams) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "digitalTestSessions"],
      });
    },
  });
}

interface SubmitTestParams {
  tenantId: string;
  sessionId: string;
}

interface SubmitTestResponse {
  success: boolean;
  pointsEarned?: number;
  totalPoints?: number;
  percentage?: number;
}

export function useSubmitTest() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SubmitTestParams, SubmitTestResponse>(
    functions,
    "submitTestSession"
  );

  return useMutation({
    mutationFn: async (params: SubmitTestParams) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "digitalTestSessions"],
      });
    },
  });
}
