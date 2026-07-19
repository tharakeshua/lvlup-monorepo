/**
 * QuestionBankItem — reusable question stored in a tenant-level bank.
 * Collection: /tenants/{tenantId}/questionBank/{itemId}
 * @module levelup/question-bank
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { QuestionType, QuestionTypeData } from "../content/item";
import type { BloomsLevel } from "../constants/grades";

export interface QuestionBankItem {
  id: string;
  tenantId: string;

  // Question content (mirrors QuestionPayload structure)
  questionType: QuestionType;
  title?: string;
  content: string;
  explanation?: string;
  basePoints?: number;
  questionData: QuestionTypeData;

  // Classification
  subject: string;
  topics: string[];
  difficulty: "easy" | "medium" | "hard";
  bloomsLevel?: BloomsLevel;

  // Usage tracking
  usageCount: number;
  averageScore?: number;
  lastUsedAt?: FirestoreTimestamp;

  // Organization
  tags: string[];

  // Audit
  createdBy: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface QuestionBankFilter {
  subject?: string;
  topics?: string[];
  difficulty?: "easy" | "medium" | "hard";
  bloomsLevel?: BloomsLevel;
  questionType?: QuestionType;
  tags?: string[];
  search?: string;
  sortBy?: "usageCount" | "averageScore" | "createdAt";
  sortDir?: "asc" | "desc";
  limit?: number;
  startAfter?: string;
}
