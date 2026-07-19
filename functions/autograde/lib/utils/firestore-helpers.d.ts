import {
  Exam,
  ExamQuestion,
  Submission,
  QuestionSubmission,
  EvaluationFeedbackRubric,
} from "../types";
export declare function getExam(tenantId: string, examId: string): Promise<Exam | null>;
export declare function getExamQuestions(tenantId: string, examId: string): Promise<ExamQuestion[]>;
export declare function getSubmission(
  tenantId: string,
  submissionId: string
): Promise<Submission | null>;
export declare function getQuestionSubmissions(
  tenantId: string,
  submissionId: string
): Promise<QuestionSubmission[]>;
export declare function getEvaluationSettings(
  tenantId: string,
  settingsId: string
): Promise<EvaluationFeedbackRubric | null>;
