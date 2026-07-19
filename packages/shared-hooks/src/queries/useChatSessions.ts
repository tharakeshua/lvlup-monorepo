import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { ChatSession } from "@levelup/shared-types";

export type { ChatSession } from "@levelup/shared-types";

export function useChatSession(tenantId: string | null, sessionId: string | null) {
  return useQuery<ChatSession | null>({
    queryKey: ["tenants", tenantId, "chatSessions", sessionId],
    queryFn: async () => {
      if (!tenantId || !sessionId) return null;
      const { db } = getFirebaseServices();
      const docRef = doc(db, `tenants/${tenantId}/chatSessions`, sessionId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as ChatSession;
    },
    enabled: !!tenantId && !!sessionId,
    staleTime: 10 * 1000,
  });
}

interface SendChatMessageParams {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  sessionId?: string;
  message: string;
  language?: string;
  agentId?: string;
}

interface SendChatMessageResponse {
  sessionId: string;
  reply: string;
  tokensUsed: { input: number; output: number };
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SendChatMessageParams, SendChatMessageResponse>(
    functions,
    "sendChatMessage"
  );

  return useMutation({
    mutationFn: async (params: SendChatMessageParams) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "chatSessions", data.sessionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "chatSessions"],
      });
    },
  });
}

interface EvaluateAnswerParams {
  tenantId: string;
  spaceId: string;
  itemId: string;
  answer: unknown;
  mediaUrls?: string[];
}

interface EvaluateAnswerResponse {
  score: number;
  maxScore: number;
  feedback: string;
  confidence: number;
  tokensUsed: { input: number; output: number };
  costUsd: number;
}

export function useEvaluate() {
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<EvaluateAnswerParams, EvaluateAnswerResponse>(
    functions,
    "evaluateAnswer"
  );

  return useMutation({
    mutationFn: async (params: EvaluateAnswerParams) => {
      const result = await callable(params);
      return result.data;
    },
  });
}
