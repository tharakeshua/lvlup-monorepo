/**
 * LevelUp content callable wrappers.
 * Covers: saveQuestionBankItem, listQuestionBank, importFromBank, saveRubricPreset, saveSpaceReview
 */

import { httpsCallable } from "firebase/functions";
import { getFirebaseServices } from "../firebase";
import type { SaveResponse } from "@levelup/shared-types";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface SaveQuestionBankItemRequest {
  id?: string;
  tenantId: string;
  data: {
    questionType?: string;
    title?: string;
    content?: string;
    explanation?: string;
    basePoints?: number;
    questionData?: Record<string, unknown>;
    subject?: string;
    topics?: string[];
    difficulty?: "easy" | "medium" | "hard";
    bloomsLevel?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    tags?: string[];
    deleted?: boolean;
  };
}

export interface ListQuestionBankRequest {
  tenantId: string;
  subject?: string;
  topics?: string[];
  difficulty?: "easy" | "medium" | "hard";
  bloomsLevel?: string;
  questionType?: string;
  tags?: string[];
  search?: string;
  sortBy?: "usageCount" | "averageScore" | "createdAt";
  sortDir?: "asc" | "desc";
  limit?: number;
  startAfter?: string;
}

export interface ListQuestionBankResponse {
  items: Array<Record<string, unknown>>;
  hasMore: boolean;
  lastId: string | null;
}

export interface ImportFromBankRequest {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  sectionId?: string;
  questionBankItemIds: string[];
}

export interface ImportFromBankResponse {
  imported: number;
  itemIds: string[];
}

export interface SaveRubricPresetRequest {
  id?: string;
  tenantId: string;
  data: {
    name?: string;
    description?: string;
    rubric?: Record<string, unknown>;
    category?: string;
    questionTypes?: string[];
    deleted?: boolean;
  };
}

export interface SaveSpaceReviewRequest {
  tenantId: string;
  spaceId: string;
  rating: number;
  comment?: string;
}

export interface SaveSpaceReviewResponse {
  success: boolean;
  isUpdate: boolean;
}

export interface ListVersionsRequest {
  tenantId: string;
  spaceId: string;
  entityType?: "space" | "storyPoint" | "item";
  entityId?: string;
  limit?: number;
  startAfter?: string;
}

export interface ContentVersionEntry {
  id: string;
  version: number;
  entityType: string;
  entityId: string;
  changeType: string;
  changeSummary: string;
  changedBy: string;
  changedAt: { _seconds: number; _nanoseconds: number } | null;
}

export interface ListVersionsResponse {
  versions: ContentVersionEntry[];
  hasMore: boolean;
  lastId: string | null;
}

// ---------------------------------------------------------------------------
// Callable wrappers
// ---------------------------------------------------------------------------

function getCallable<Req, Res>(name: string) {
  const { functions } = getFirebaseServices();
  return httpsCallable<Req, Res>(functions, name);
}

export async function callSaveQuestionBankItem(
  data: SaveQuestionBankItemRequest
): Promise<SaveResponse> {
  const fn = getCallable<SaveQuestionBankItemRequest, SaveResponse>("saveQuestionBankItem");
  const result = await fn(data);
  return result.data;
}

export async function callListQuestionBank(
  data: ListQuestionBankRequest
): Promise<ListQuestionBankResponse> {
  const fn = getCallable<ListQuestionBankRequest, ListQuestionBankResponse>("listQuestionBank");
  const result = await fn(data);
  return result.data;
}

export async function callImportFromBank(
  data: ImportFromBankRequest
): Promise<ImportFromBankResponse> {
  const fn = getCallable<ImportFromBankRequest, ImportFromBankResponse>("importFromBank");
  const result = await fn(data);
  return result.data;
}

export async function callSaveRubricPreset(data: SaveRubricPresetRequest): Promise<SaveResponse> {
  const fn = getCallable<SaveRubricPresetRequest, SaveResponse>("saveRubricPreset");
  const result = await fn(data);
  return result.data;
}

export async function callSaveSpaceReview(
  data: SaveSpaceReviewRequest
): Promise<SaveSpaceReviewResponse> {
  const fn = getCallable<SaveSpaceReviewRequest, SaveSpaceReviewResponse>("saveSpaceReview");
  const result = await fn(data);
  return result.data;
}

export async function callListVersions(data: ListVersionsRequest): Promise<ListVersionsResponse> {
  const fn = getCallable<ListVersionsRequest, ListVersionsResponse>("listVersions");
  const result = await fn(data);
  return result.data;
}

export interface GetItemForEditRequest {
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
}

export interface GetItemForEditResponse {
  item: import("@levelup/shared-types").UnifiedItem;
}

/**
 * Returns the full UnifiedItem with answer-key data merged back into the
 * payload. Use this for editing timed_test items so teachers don't accidentally
 * overwrite the answer key with the stripped server payload.
 */
export async function callGetItemForEdit(
  data: GetItemForEditRequest
): Promise<GetItemForEditResponse> {
  const fn = getCallable<GetItemForEditRequest, GetItemForEditResponse>("getItemForEdit");
  const result = await fn(data);
  return result.data;
}
