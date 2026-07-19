import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type { SaveExamRequest, SaveResponse } from "@levelup/shared-types";

export function useCreateExam() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveExamRequest, SaveResponse>(functions, "saveExam");

  return useMutation({
    mutationFn: async (params: Omit<SaveExamRequest, "id">) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "exams"] });
    },
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveExamRequest, SaveResponse>(functions, "saveExam");

  return useMutation({
    mutationFn: async (params: SaveExamRequest & { id: string }) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "exams"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "exams", variables.id],
      });
    },
  });
}

export function usePublishExam() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveExamRequest, SaveResponse>(functions, "saveExam");

  return useMutation({
    mutationFn: async (params: { tenantId: string; examId: string }) => {
      const result = await callable({
        id: params.examId,
        tenantId: params.tenantId,
        data: { status: "published" },
      });
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "exams"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "exams", variables.examId],
      });
    },
  });
}
