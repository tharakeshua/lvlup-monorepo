import * as admin from "firebase-admin";
import { type ExtractedQuestion } from "../prompts/extraction";
export declare const extractQuestions: import("firebase-functions/https").CallableFunction<
  any,
  Promise<
    | {
        success: boolean;
        questions: ExtractedQuestion[];
        warnings: never[];
        metadata: {
          questionCount: number;
          tokensUsed: number;
          cost: number;
          extractedAt: string;
          imageQualityAcceptable: boolean;
          mode: string;
        };
      }
    | {
        success: boolean;
        questions: {
          id: string;
          examId: string;
          text: string;
          maxMarks: number;
          order: number;
          rubric: {
            criteria: {
              id: string;
              name: string;
              description: string;
              maxPoints: number;
            }[];
            scoringMode: "criteria_based";
            dimensions: never[];
          };
          questionType: "standard" | "diagram" | "multi-part";
          extractionConfidence: number;
          readabilityIssue: boolean;
          subQuestions: {
            label: string;
            text: string;
            maxMarks: number;
            rubric: {
              criteria: {
                id: string;
                name: string;
                description: string;
                maxPoints: number;
              }[];
              scoringMode: "criteria_based";
            } | null;
          }[];
          extractedBy: "ai";
          extractedAt: admin.firestore.FieldValue;
          createdAt: admin.firestore.FieldValue;
          updatedAt: admin.firestore.FieldValue;
        }[];
        warnings: string[];
        metadata: {
          questionCount: number;
          tokensUsed: number;
          cost: number;
          extractedAt: string;
          imageQualityAcceptable: boolean;
          mode?: undefined;
        };
      }
  >,
  unknown
>;
