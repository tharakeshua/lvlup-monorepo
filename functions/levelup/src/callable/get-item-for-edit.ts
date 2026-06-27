import * as admin from "firebase-admin";
import { onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { assertAuth, assertTeacherOrAdmin } from "../utils/auth";
import { loadItem } from "../utils/firestore";
import { parseRequest } from "../utils";
import type {
  MCQOption,
  FillBlank,
  FillBlanksDDBlank,
  GroupOptionsGroup,
  QuestionPayload,
  UnifiedItem,
} from "@levelup/shared-types";

const idSchema = z.string().min(1).max(200);
const RequestSchema = z.object({
  tenantId: idSchema,
  spaceId: idSchema,
  storyPointId: idSchema,
  itemId: idSchema,
});

/**
 * getItemForEdit — returns the full UnifiedItem with answer-key data merged
 * back into the payload. Server-side strips answers into a protected
 * `answerKeys` subcollection for timed_test items so students can't see them
 * via Firestore reads. The teacher portal needs the unstripped version when
 * editing — otherwise saving overwrites the answer key with empty values.
 *
 * Auth: teacher or admin only.
 */
export const getItemForEdit = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const { tenantId, spaceId, storyPointId, itemId } = parseRequest(request.data, RequestSchema);

  await assertTeacherOrAdmin(callerUid, tenantId);

  const item = await loadItem(tenantId, spaceId, itemId, storyPointId);
  if (item.type !== "question") return { item };

  const db = admin.firestore();
  // Determine the actual item path (nested or flat) so we can find its
  // answerKeys subcollection.
  const nestedItemPath = `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items/${itemId}`;
  const flatItemPath = `tenants/${tenantId}/spaces/${spaceId}/items/${itemId}`;
  const nestedSnap = await db.doc(nestedItemPath).get();
  const itemPath = nestedSnap.exists ? nestedItemPath : flatItemPath;

  const akSnap = await db.collection(`${itemPath}/answerKeys`).limit(1).get();
  if (akSnap.empty) return { item };

  const ak = akSnap.docs[0].data();
  const merged = mergeAnswerKey(item, ak);
  return { item: merged };
});

interface AnswerKeyData {
  correctAnswer?: unknown;
  acceptableAnswers?: unknown[];
  evaluationGuidance?: string;
  modelAnswer?: string;
}

/**
 * Merges answer-key data back into a stripped payload so the teacher editor
 * can show the existing correct answer. Inverse of `stripAnswerFromPayload`.
 */
function mergeAnswerKey(item: UnifiedItem, ak: AnswerKeyData): UnifiedItem {
  const payload = item.payload as QuestionPayload;
  const qd = payload.questionData as Record<string, unknown> | undefined;
  if (!qd) return item;

  const merged: Record<string, unknown> = { ...qd };
  switch (payload.questionType) {
    case "mcq":
    case "mcaq": {
      const correctIds = (ak.correctAnswer as string[] | undefined) ?? [];
      merged.options = ((qd.options ?? []) as MCQOption[]).map((o) => ({
        ...o,
        isCorrect: correctIds.includes(o.id),
      }));
      break;
    }
    case "true-false":
      merged.correctAnswer = ak.correctAnswer;
      break;
    case "numerical":
      merged.correctAnswer = ak.correctAnswer;
      if (Array.isArray(ak.acceptableAnswers) && ak.acceptableAnswers[0]) {
        const tol = (ak.acceptableAnswers[0] as { tolerance?: number }).tolerance;
        if (tol != null) merged.tolerance = tol;
      }
      break;
    case "text":
      merged.correctAnswer = ak.correctAnswer;
      if (ak.acceptableAnswers) merged.acceptableAnswers = ak.acceptableAnswers;
      break;
    case "fill-blanks": {
      const akBlanks =
        (ak.correctAnswer as Array<{
          id: string;
          correctAnswer: string;
          acceptableAnswers?: string[];
        }>) ?? [];
      const byId = new Map(akBlanks.map((b) => [b.id, b]));
      merged.blanks = ((qd.blanks ?? []) as FillBlank[]).map((b) => {
        const k = byId.get(b.id);
        return k
          ? { ...b, correctAnswer: k.correctAnswer, acceptableAnswers: k.acceptableAnswers }
          : b;
      });
      break;
    }
    case "fill-blanks-dd": {
      const akBlanks = (ak.correctAnswer as Array<{ id: string; correctOptionId: string }>) ?? [];
      const byId = new Map(akBlanks.map((b) => [b.id, b]));
      merged.blanks = ((qd.blanks ?? []) as FillBlanksDDBlank[]).map((b) => {
        const k = byId.get(b.id);
        return k ? { ...b, correctOptionId: k.correctOptionId } : b;
      });
      break;
    }
    case "matching": {
      // Stored mappings come back via correctAnswer.
      const akPairs =
        (ak.correctAnswer as Array<{ id: string; left: string; right: string }>) ?? [];
      if (akPairs.length) merged.pairs = akPairs;
      break;
    }
    case "jumbled":
      if (ak.correctAnswer) merged.correctOrder = ak.correctAnswer;
      break;
    case "group-options": {
      const akGroups = (ak.correctAnswer as Array<{ id: string; correctItems: string[] }>) ?? [];
      const byId = new Map(akGroups.map((g) => [g.id, g]));
      merged.groups = ((qd.groups ?? []) as GroupOptionsGroup[]).map((g) => {
        const k = byId.get(g.id);
        return k ? { ...g, correctItems: k.correctItems } : g;
      });
      break;
    }
    default:
      // AI-evaluated types — pass through evaluationGuidance / modelAnswer if present
      if (ak.evaluationGuidance) merged.evaluationGuidance = ak.evaluationGuidance;
      if (ak.modelAnswer) merged.modelAnswer = ak.modelAnswer;
      break;
  }

  return {
    ...item,
    payload: { ...payload, questionData: merged } as QuestionPayload,
  };
}
