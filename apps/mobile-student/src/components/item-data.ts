/**
 * Tolerant extractors for the @levelup/query UnifiedItem shape. Different readers
 * deliver the payload nested under `item.payload.{materialData,questionData}` or
 * flattened onto the item — these helpers normalize both. Answer-bearing fields
 * are already stripped server-side for learner reads, so the kit never sees them.
 */
import type { UnifiedItemLike } from "./_types";

type Dict = Record<string, unknown>;

function asDict(v: unknown): Dict | undefined {
  return v && typeof v === "object" ? (v as Dict) : undefined;
}

/** Pull the materialData payload (with nested `materialType`) from an item. */
export function getMaterialData(item?: UnifiedItemLike, direct?: unknown): Dict | undefined {
  const directDict = asDict(direct);
  if (directDict) return directDict;
  if (!item) return undefined;
  const payload = asDict(item.payload);
  return (
    asDict(item.materialData) ??
    asDict(payload?.materialData) ??
    // some readers put materialType fields straight on payload
    (payload && "materialType" in payload ? payload : undefined)
  );
}

/** Pull the questionData payload (with nested `questionType`) from an item.
 *
 * Handles both Firestore schemas:
 *  - v2_ seed schema:      payload.questionData = { questionType, options, … }
 *  - old hand-authored:    payload.questionType = "mcq", payload.questionData = { options, … }
 *
 * When payload.questionData exists but lacks `questionType` (old schema), we
 * merge payload.questionType into the returned dict so callers always find it.
 */
export function getQuestionData(item?: UnifiedItemLike, direct?: unknown): Dict | undefined {
  const directDict = asDict(direct);
  if (directDict) return directDict;
  if (!item) return undefined;
  const payload = asDict(item.payload);

  // (1) top-level questionData on the item (some flat projections)
  const topLevel = asDict(item.questionData);
  if (topLevel) return topLevel;

  // (2) payload.questionData — present in both v2_ and old schemas
  const nested = asDict(payload?.questionData);
  if (nested) {
    // v2_ schema: questionType is already inside nested; nothing to do.
    // Old schema: questionType lives at payload top-level — merge it in so
    // callers always find data.questionType.
    if (!("questionType" in nested) && payload && "questionType" in payload) {
      return { ...nested, questionType: payload.questionType };
    }
    return nested;
  }

  // (3) old schema with questionType on payload directly and no questionData key
  if (payload && "questionType" in payload) return payload;

  return undefined;
}

/**
 * The learner-facing prompt for an item/question. The canonical UnifiedItem read
 * (LVL-1 projection) delivers the question text at TOP-LEVEL `item.content`
 * (`normalizeItemPayload` lifts legacy `payload.prompt` there too) — check it
 * first, then the legacy flat/nested spots, then `title` as a last resort.
 */
export function getPrompt(item?: UnifiedItemLike, data?: Dict): string {
  const payload = asDict(item?.payload);
  return (
    (typeof item?.content === "string" && item.content) ||
    (typeof item?.prompt === "string" && item.prompt) ||
    (typeof data?.prompt === "string" && (data.prompt as string)) ||
    (typeof data?.question === "string" && (data.question as string)) ||
    (typeof payload?.prompt === "string" && (payload.prompt as string)) ||
    (typeof payload?.content === "string" && (payload.content as string)) ||
    (typeof item?.title === "string" && item.title) ||
    ""
  );
}

export function getBasePoints(item?: UnifiedItemLike, data?: Dict): number | undefined {
  const p = item?.basePoints ?? data?.basePoints;
  return typeof p === "number" ? p : undefined;
}

export function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
