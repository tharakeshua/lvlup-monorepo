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

/** Pull the questionData payload (with nested `questionType`) from an item. */
export function getQuestionData(item?: UnifiedItemLike, direct?: unknown): Dict | undefined {
  const directDict = asDict(direct);
  if (directDict) return directDict;
  if (!item) return undefined;
  const payload = asDict(item.payload);
  return (
    asDict(item.questionData) ??
    asDict(payload?.questionData) ??
    (payload && "questionType" in payload ? payload : undefined)
  );
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
