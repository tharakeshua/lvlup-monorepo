/**
 * Question-bank services (LVL-2):
 *   • listQuestionBank     — authoring-gated paginated read (`questionBank.read`)
 *   • saveQuestionBankItem — strict-canonical upsert (`questionBank.write`)
 *   • importFromBank       — bank → space items through the SAME answer-stripped
 *                            item + deny-all answer-key split as saveItem
 *                            (`questionBank.import`, idempotent on the input set)
 *
 * The bank's `questionData` is the answer-free prompt union (DP-2): canonical
 * writes carry no answer fields by schema. Legacy bank docs MAY carry inline
 * answers — the import path strips them into the deny-all subcollection, and the
 * list projection whitelists them out (the bank read is authoring-gated, but the
 * emitted view is still the strict QuestionBankItemSchema).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { BLOOMS_LEVELS, DIFFICULTIES } from "@levelup/domain";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { withIdempotency } from "../shared/idempotency.js";
import { tsRequired, tsOrNull } from "../shared/projections.js";
import { xrepos } from "../shared/extended-repos.js";
import { QUESTION_TYPE_MAP, stripAnswerFields, extractAnswerKey } from "./content.js";

type Doc = Record<string, unknown>;

const DIFFICULTY_SET = new Set<string>(DIFFICULTIES);
const BLOOMS_SET = new Set<string>(BLOOMS_LEVELS);

/** Whitelist a stored bank doc to the strict QuestionBankItemSchema view. */
function projectBankItem(b: Doc, tenantId: string): Doc {
  const qt = String(b["questionType"] ?? "text");
  const difficulty = String(b["difficulty"] ?? "medium");
  const blooms = typeof b["bloomsLevel"] === "string" ? b["bloomsLevel"] : undefined;
  return {
    id: String(b["id"] ?? ""),
    tenantId: String(b["tenantId"] ?? tenantId),
    questionType: QUESTION_TYPE_MAP[qt] ?? "text",
    ...(typeof b["title"] === "string" ? { title: b["title"] } : {}),
    content: String(b["content"] ?? ""),
    ...(typeof b["explanation"] === "string" ? { explanation: b["explanation"] } : {}),
    ...(typeof b["basePoints"] === "number" ? { basePoints: b["basePoints"] } : {}),
    questionData: stripAnswerFields(
      (b["questionData"] as Doc | undefined) ?? { questionType: QUESTION_TYPE_MAP[qt] ?? "text" }
    ),
    subject: String(b["subject"] ?? ""),
    topics: Array.isArray(b["topics"]) ? (b["topics"] as unknown[]).map(String) : [],
    difficulty: DIFFICULTY_SET.has(difficulty) ? difficulty : "medium",
    ...(blooms && BLOOMS_SET.has(blooms) ? { bloomsLevel: blooms } : {}),
    usageCount: typeof b["usageCount"] === "number" ? Math.trunc(b["usageCount"]) : 0,
    ...(typeof b["averageScore"] === "number" ? { averageScore: b["averageScore"] } : {}),
    lastUsedAt: tsOrNull(b["lastUsedAt"]),
    tags: Array.isArray(b["tags"]) ? (b["tags"] as unknown[]).map(String) : [],
    createdAt: tsRequired(b["createdAt"], b["updatedAt"]),
    updatedAt: tsRequired(b["updatedAt"], b["createdAt"]),
  };
}

// ── listQuestionBank ─────────────────────────────────────────────────────────
export async function listQuestionBankService(
  input: ReqOf<"v1.levelup.listQuestionBank">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listQuestionBank">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "questionBank.read", { tenantId });
  const f = input as {
    questionType?: string;
    subject?: string;
    difficulty?: string;
    bloomsLevel?: string;
    topic?: string;
    search?: string;
    cursor?: string;
    limit?: number;
  };

  const where: Doc = {};
  if (f.questionType) where["questionType"] = f.questionType;
  if (f.subject) where["subject"] = f.subject;
  if (f.difficulty) where["difficulty"] = f.difficulty;
  if (f.bloomsLevel) where["bloomsLevel"] = f.bloomsLevel;

  const needle = f.search?.toLowerCase();
  const page = await xrepos(ctx).questionBank.list(tenantId, {
    ...(Object.keys(where).length > 0 ? { where } : {}),
    ...(f.cursor ? { cursor: f.cursor } : {}),
    limit: f.limit ?? 20,
    // topic/search are in-memory refinements over the fetched page (no index).
    filter: (d) => {
      if (f.topic && !(Array.isArray(d["topics"]) && d["topics"].includes(f.topic))) return false;
      if (needle) {
        const hay = `${String(d["title"] ?? "")} ${String(d["content"] ?? "")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    },
  });
  return {
    items: page.items.map((b) => projectBankItem(b as Doc, tenantId)),
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.levelup.listQuestionBank">;
}

// ── saveQuestionBankItem ─────────────────────────────────────────────────────
export async function saveQuestionBankItemService(
  input: ReqOf<"v1.levelup.saveQuestionBankItem">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveQuestionBankItem">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "questionBank.write", { tenantId });

  const data = input.data as Doc;
  if (data["deleted"] === true) {
    // The bank has no tombstone field (strict schema) → a delete is a hard delete.
    if (!input.id) fail("VALIDATION_ERROR", "id is required to delete a bank item");
    await xrepos(ctx).questionBank.delete(tenantId, input.id);
    return { id: input.id, deleted: true } as unknown as ResOf<"v1.levelup.saveQuestionBankItem">;
  }

  const existing = input.id ? await xrepos(ctx).questionBank.get(tenantId, input.id) : null;
  if (input.id && !existing) fail("NOT_FOUND", "bank item not found");

  const { deleted: _drop, ...rest } = data;
  void _drop;
  const { id, created } = await xrepos(ctx).questionBank.upsert(tenantId, {
    ...(input.id ? { id: input.id } : {}),
    ...rest,
    topics: (data["topics"] as unknown[] | undefined) ?? [],
    tags: (data["tags"] as unknown[] | undefined) ?? [],
    usageCount: (existing?.["usageCount"] as number | undefined) ?? 0,
    lastUsedAt: (existing?.["lastUsedAt"] as string | null | undefined) ?? null,
    createdBy: (existing?.["createdBy"] as string | undefined) ?? ctx.uid,
    updatedBy: ctx.uid,
  });
  return { id, created } as unknown as ResOf<"v1.levelup.saveQuestionBankItem">;
}

// ── importFromBank ───────────────────────────────────────────────────────────
export async function importFromBankService(
  input: ReqOf<"v1.levelup.importFromBank">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.importFromBank">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "questionBank.import", { spaceId: input.spaceId, tenantId });

  // Idempotent on the exact (space, storyPoint, bank-item-set) tuple — a retried
  // call returns the SAME createdItemIds instead of duplicating items.
  const idemKey = `importFromBank:${input.spaceId}:${input.storyPointId}:${[...input.bankItemIds].sort().join(",")}`;
  return withIdempotency(ctx, tenantId, idemKey, async () => {
    const bankItems = await xrepos(ctx).questionBank.getMany(tenantId, input.bankItemIds);
    if (bankItems.length === 0) fail("NOT_FOUND", "no bank items found for the given ids");

    const now = ctx.now();
    const createdItemIds: string[] = [];
    for (const [i, bank] of bankItems.entries()) {
      const b = bank as Doc;
      const qt = QUESTION_TYPE_MAP[String(b["questionType"] ?? "text")] ?? "text";
      const rawQd = (b["questionData"] as Doc | undefined) ?? { questionType: qt };
      // Same split as saveItem: the ⚷ answer fields (legacy bank docs may inline
      // them) go to the deny-all subcollection; the item stores the stripped rest.
      const answerKey = extractAnswerKey(b);
      const doc: Doc = {
        type: input.targetType ?? "question",
        payload: {
          type: "question",
          ...(typeof b["basePoints"] === "number" ? { basePoints: b["basePoints"] } : {}),
          questionData: stripAnswerFields({ ...rawQd, questionType: qt }),
        },
        ...(typeof b["title"] === "string" ? { title: b["title"] } : {}),
        content: String(b["content"] ?? ""),
        ...(typeof b["difficulty"] === "string" ? { difficulty: b["difficulty"] } : {}),
        topics: Array.isArray(b["topics"]) ? b["topics"] : [],
        linkedQuestionId: String(b["id"] ?? ""),
        spaceId: input.spaceId,
        storyPointId: input.storyPointId,
        orderIndex: i,
        archivedAt: null,
        createdBy: ctx.uid,
        updatedBy: ctx.uid,
      };
      const { id } = await ctx.repos.items.upsert(tenantId, doc, now);
      if (answerKey) {
        await ctx.repos.answerKeys.put(tenantId, id, {
          ...answerKey,
          itemId: id,
          spaceId: input.spaceId,
          storyPointId: input.storyPointId,
        });
      }
      // ⚷ usage counters (server-owned): bump on every import.
      await xrepos(ctx).questionBank.upsert(tenantId, {
        id: String(b["id"]),
        usageCount: ((b["usageCount"] as number | undefined) ?? 0) + 1,
        lastUsedAt: now,
      });
      createdItemIds.push(id);
    }
    return { createdItemIds } as ResOf<"v1.levelup.importFromBank">;
  });
}
