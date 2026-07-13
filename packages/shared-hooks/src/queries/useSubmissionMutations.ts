import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "@levelup/shared-services";
import type {
  SaveExamRequest,
  SaveResponse,
  GradeQuestionRequest,
  GradeQuestionResponse,
} from "@levelup/shared-types";

interface UploadAnswerSheetsParams {
  tenantId: string;
  examId: string;
  studentId: string;
  classId: string;
  imageUrls: string[];
}

interface UploadAnswerSheetsResponse {
  submissionId: string;
}

export function useUploadAnswerSheets() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<UploadAnswerSheetsParams, UploadAnswerSheetsResponse>(
    functions,
    "uploadAnswerSheets"
  );

  return useMutation({
    mutationFn: async (params: UploadAnswerSheetsParams) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "submissions"] });
      queryClient.invalidateQueries({
        queryKey: ["tenants", variables.tenantId, "exams", variables.examId],
      });
    },
  });
}

export function useGradeQuestion() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<GradeQuestionRequest, GradeQuestionResponse>(
    functions,
    "gradeQuestion"
  );

  return useMutation({
    mutationFn: async (params: GradeQuestionRequest) => {
      const result = await callable(params);
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "submissions"] });
    },
  });
}

export function useReleaseResults() {
  const queryClient = useQueryClient();
  const { functions } = getFirebaseServices();
  const callable = httpsCallable<SaveExamRequest, SaveResponse>(functions, "saveExam");

  return useMutation({
    mutationFn: async (params: { tenantId: string; examId: string; classIds?: string[] }) => {
      const result = await callable({
        id: params.examId,
        tenantId: params.tenantId,
        data: { status: "results_released", classIds: params.classIds },
      });
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "exams"] });
      queryClient.invalidateQueries({ queryKey: ["tenants", variables.tenantId, "submissions"] });
    },
  });
}
