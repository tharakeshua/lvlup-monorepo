/**
 * Content authoring + read services (levelup-content §2.2 / SDK-LAYERS-PLAN §5.2).
 *
 * The server brain for the content CRUD + projection surface:
 *   • saveSpace      — upsert + lifecycle transition authority (ALLOWED_TRANSITIONS.space)
 *   • saveStoryPoint — upsert under a space
 *   • saveItem       — extract the ⚷ answer key into the deny-all subcollection,
 *                      persist the answer-stripped item
 *   • getItemForEdit — ⚷ authoring-only re-merge of the answer key
 *   • listSpaces / getSpace / listStoryPoints / getStoryPoint / listItems —
 *                      role-/state-scoped, answer-key/guidance-stripped projections
 *
 * Every authority-sensitive verb calls `authorize(ctx, action, resource)` BEFORE
 * any side effect; `tenantId` is claim-derived (`requireTenant`), never from the
 * body. Answer-key / guidance fields never leave the server except through the
 * gated `getItemForEdit` authoring read.
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { zLegacyStoryPointTypeRead } from "@levelup/domain";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { isAuthoringRole, projectRubric, tsOrNull, tsRequired } from "../shared/projections.js";
import { xrepos } from "../shared/extended-repos.js";

type Doc = Record<string, unknown>;

/**
 * Best-effort ContentVersion change-log row (`spaces/{s}/versions`, the legacy
 * path `listVersions` reads). NEVER fails the save — the log is an audit trail,
 * not an invariant; test fakes may not even carry the repo.
 */
async function recordVersion(
  ctx: AuthContext,
  tenantId: string,
  spaceId: string,
  entry: { entityType: string; entityId: string; changeType: string; changeSummary: string }
): Promise<void> {
  try {
    await xrepos(ctx).contentVersions?.add(tenantId, spaceId, { ...entry, changedBy: ctx.uid });
  } catch {
    /* best-effort */
  }
}

// ── whitelist-projection primitives (LVL-1, mirrors autograde/reads.ts) ───────
/** Drop UNDEFINED keys so absent OPTIONAL fields don't serialize as `null`
 *  (a Firebase callable turns `undefined`→`null` over the wire, which a strict
 *  `.optional()` schema then rejects). `null` is KEPT (nullable-required fields). */
function compact(o: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}

const num = (v: unknown, fb: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fb;
const int = (v: unknown, fb: number): number => Math.trunc(num(v, fb));
const optNum = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const optInt = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : undefined;
const optStr = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const optBool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const optStrArray = (v: unknown): string[] | undefined =>
  Array.isArray(v) ? v.map((x) => String(x)) : undefined;

/** Pick the given keys off a bag, dropping undefineds; undefined when empty/non-object. */
function pickDefined(src: unknown, keys: readonly string[]): Doc | undefined {
  if (!src || typeof src !== "object" || Array.isArray(src)) return undefined;
  const out: Doc = {};
  for (const k of keys) {
    const v = (src as Doc)[k];
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Difficulty: lowercase legacy casing drift; drop unknown values (optional field). */
const DIFFICULTY_SET = new Set(["easy", "medium", "hard"]);
function canonDifficulty(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const d = v.toLowerCase();
  return DIFFICULTY_SET.has(d) ? d : undefined;
}

/** StoryPoint type: legacy 'test' → 'timed_test' via the domain read-adapter (AD-4). */
function canonStoryPointType(v: unknown): string {
  return typeof v === "string" ? zLegacyStoryPointTypeRead.parse(v) : "standard";
}

/** Answer-bearing field names stripped from an item payload before it is stored. */
const ANSWER_KEY_FIELDS = [
  "answerKey",
  "correctAnswer",
  "acceptableAnswers",
  "modelAnswer",
  "evaluationGuidance",
  "evaluatorGuidance",
] as const;

/** Recursively strip any answer-key/guidance field from a value (deep, by name).
 *  Exported for `importFromBank`, which persists bank items through the same
 *  answer-stripped-item + deny-all-key split as `saveItem`. */
export function stripAnswerFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripAnswerFields(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const copy: Doc = {};
    for (const [k, v] of Object.entries(value as Doc)) {
      if ((ANSWER_KEY_FIELDS as readonly string[]).includes(k)) continue;
      copy[k] = stripAnswerFields(v);
    }
    return copy as unknown as T;
  }
  return value;
}

// ── canonical content projection (DEFENSIVE) ─────────────────────────────────
// The READ surface must validate against the strict `@levelup/domain` view schemas
// (StoryPointSchema / UnifiedItemSchema) regardless of how the stored doc looks:
// a freshly-saved canonical doc, REAL already-canonical data, OR a legacy/seed doc
// with merge-upsert leftovers (`order`, `durationSeconds`, a one-level `kind` payload
// in the old authoring vocabulary). These helpers rename/drop/restructure so the
// emitted response is clean — they never reach for answer-bearing fields.

/** Legacy authoring questionType vocabulary → canonical zQuestionType.
 *  Exported for the question-bank read projection (same legacy drift). */
export const QUESTION_TYPE_MAP: Record<string, string> = {
  mcq: "mcq",
  msq: "mcaq",
  mcaq: "mcaq",
  true_false: "true-false",
  "true-false": "true-false",
  numeric: "numerical",
  numerical: "numerical",
  short_answer: "text",
  text: "text",
  long_answer: "paragraph",
  essay: "paragraph",
  paragraph: "paragraph",
  code: "code",
  fill_blank: "fill-blanks",
  "fill-blanks": "fill-blanks",
  "fill-blanks-dd": "fill-blanks-dd",
  match: "matching",
  matching: "matching",
  ordering: "jumbled",
  jumbled: "jumbled",
  audio_response: "audio",
  oral: "audio",
  audio: "audio",
  diagram: "image_evaluation",
  file_upload: "image_evaluation",
  image_evaluation: "image_evaluation",
  "group-options": "group-options",
  chat_agent_question: "chat_agent_question",
};

/** Legacy materialType vocabulary → canonical zMaterialType. */
const MATERIAL_TYPE_MAP: Record<string, string> = {
  reading: "text",
  text: "text",
  video: "video",
  pdf: "pdf",
  link: "link",
  image: "link",
  audio: "link",
  slides: "story",
  story: "story",
  interactive: "interactive",
  rich: "rich",
};

function asOptions(raw: unknown): Array<{ id: string; text: string; imageUrl?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((o, i) => {
    const od = (o ?? {}) as Doc;
    return {
      id: String(od["id"] ?? i),
      text: String(od["text"] ?? ""),
      ...(typeof od["imageUrl"] === "string" ? { imageUrl: od["imageUrl"] } : {}),
    };
  });
}

/** Build a canonical, ANSWER-FREE `questionData` for the two-level item payload. */
function buildQuestionData(qt: string, legacy: Doc): Doc {
  const options = asOptions(legacy["options"]);
  switch (qt) {
    case "mcq":
      return { questionType: "mcq", options };
    case "mcaq":
      return { questionType: "mcaq", options };
    case "true-false":
      return { questionType: "true-false" };
    case "numerical":
      return { questionType: "numerical" };
    case "text":
      return { questionType: "text" };
    case "paragraph":
      return { questionType: "paragraph" };
    case "code":
      return {
        questionType: "code",
        ...(typeof legacy["language"] === "string" ? { language: legacy["language"] } : {}),
      };
    case "fill-blanks": {
      const template = String(legacy["prompt"] ?? legacy["template"] ?? "");
      const n = (template.match(/_{2,}/g) ?? ["_"]).length;
      return {
        questionType: "fill-blanks",
        template,
        blanks: Array.from({ length: n }, (_, i) => ({ id: `b${i + 1}` })),
      };
    }
    case "jumbled":
      return { questionType: "jumbled", tokens: options.map((o) => o.text) };
    case "matching":
      // Present both columns but NEVER reveal the correct pairing — the right column
      // (the answer) lives only in the deny-all AnswerKey, so it is omitted here.
      return {
        questionType: "matching",
        pairs: options.map((o) => ({ left: o.text, right: "" })),
      };
    case "audio":
      return { questionType: "audio" };
    case "image_evaluation":
      return { questionType: "image_evaluation" };
    case "group-options":
      return {
        questionType: "group-options",
        groups: [],
        items: options.map((o) => ({ id: o.id, text: o.text })),
      };
    case "chat_agent_question":
      return { questionType: "chat_agent_question" };
    default:
      return { questionType: "text" };
  }
}

/** Build a canonical `materialData` for the two-level item payload. */
function buildMaterialData(mt: string, legacy: Doc): Doc {
  const url = typeof legacy["url"] === "string" ? legacy["url"] : "";
  const body = typeof legacy["body"] === "string" ? legacy["body"] : "";
  switch (mt) {
    case "video":
      return {
        materialType: "video",
        url,
        ...(typeof legacy["durationSeconds"] === "number"
          ? { durationSeconds: legacy["durationSeconds"] }
          : {}),
      };
    case "pdf":
      return { materialType: "pdf", url };
    case "link":
      return {
        materialType: "link",
        url,
        ...(typeof legacy["title"] === "string" ? { label: legacy["title"] } : {}),
      };
    case "story":
      return {
        materialType: "story",
        slides: [
          {
            ...(typeof legacy["title"] === "string" ? { title: legacy["title"] } : {}),
            body,
          },
        ],
      };
    case "interactive":
      return { materialType: "interactive", embedUrl: url };
    case "rich":
      return { materialType: "rich", blocks: [] };
    case "text":
    default:
      return { materialType: "text", body };
  }
}

/**
 * Normalize an item `payload` to the canonical two-level discriminated union and
 * derive the top-level item `type`. A legacy one-level `{ kind, ... }` payload is
 * rebuilt; an already-canonical `{ type, ... }` payload is passed through.
 */
function normalizeItemPayload(
  payload: Doc | undefined,
  item: Doc
): { type: string; payload: Doc; title?: string; content?: string } {
  const p = (payload ?? {}) as Doc;
  const kind = typeof p["kind"] === "string" ? (p["kind"] as string) : undefined;

  if (kind === "question") {
    const qt = QUESTION_TYPE_MAP[String(p["questionType"] ?? "")] ?? "text";
    const basePoints =
      typeof p["points"] === "number"
        ? (p["points"] as number)
        : typeof p["basePoints"] === "number"
          ? (p["basePoints"] as number)
          : undefined;
    return {
      type: "question",
      payload: {
        type: "question",
        ...(basePoints !== undefined ? { basePoints } : {}),
        questionData: buildQuestionData(qt, p),
      },
      content: typeof p["prompt"] === "string" ? (p["prompt"] as string) : undefined,
    };
  }
  if (kind === "material") {
    const mt = MATERIAL_TYPE_MAP[String(p["materialType"] ?? "")] ?? "text";
    return {
      type: "material",
      payload: { type: "material", materialData: buildMaterialData(mt, p) },
      title: typeof p["title"] === "string" ? (p["title"] as string) : undefined,
      content: typeof p["body"] === "string" ? (p["body"] as string) : undefined,
    };
  }
  if (kind) {
    // Other legacy kinds (interactive/assessment/discussion/project/checkpoint):
    // re-stamp the discriminant onto an answer-stripped copy.
    const clean = stripAnswerFields(p) as Doc;
    clean["type"] = kind;
    delete clean["kind"];
    return { type: kind, payload: clean };
  }
  // Already canonical (`type` discriminant, no legacy `kind`): pass through.
  if (typeof p["type"] === "string") {
    return { type: String(item["type"] ?? p["type"]), payload: stripAnswerFields(p) as Doc };
  }
  // Degenerate fallback so the strict union never fails on an empty payload.
  return { type: "checkpoint", payload: { type: "checkpoint" } };
}

/** Pull the answer-key bag off the save payload (the only place answers travel). */
export function extractAnswerKey(data: Doc): Doc | null {
  const ak = data["answerKey"];
  if (ak && typeof ak === "object") return { ...(ak as Doc) };
  // Some payloads inline the answer fields rather than nesting under `answerKey`,
  // and the two-level item payload nests them DEEP (e.g.
  // `data.payload.questionData.modelAnswer`). Deep-collect every answer-bearing
  // field by name (mirrors `stripAnswerFields`) so the ⚷ key is captured into the
  // deny-all subcollection regardless of nesting depth.
  const inline: Doc = {};
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Doc)) {
        if (
          k !== "answerKey" &&
          (ANSWER_KEY_FIELDS as readonly string[]).includes(k) &&
          v !== undefined
        ) {
          inline[k] = v;
        }
        collect(v);
      }
    }
  };
  collect(data);
  return Object.keys(inline).length > 0 ? inline : null;
}

// ── saveSpace ─────────────────────────────────────────────────────────────────
export async function saveSpaceService(
  input: ReqOf<"v1.levelup.saveSpace">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveSpace">> {
  const tenantId = requireTenant(ctx);
  const data = input.data as Doc;
  const targetStatus = data["status"] as string | undefined;

  // For an UPDATE we load the stored space so a PARTIAL request (e.g. a status-only
  // lifecycle move that omits title/type) merges over the persisted doc rather than
  // clobbering it. `title`/`type` are optional in the request schema; they are
  // REQUIRED on CREATE (enforced below) and inherited from `existing` on UPDATE.
  const existing = input.id ? await ctx.repos.spaces.get(tenantId, input.id) : null;
  if (input.id && !existing) fail("NOT_FOUND", "space not found");

  // A lifecycle move (status change) is `space.publish`/`space.archive`; a plain
  // content edit is `space.write`. Authorize the appropriate verb BEFORE any write.
  if (input.id && targetStatus) {
    const fromStatus = (existing!["status"] as string) ?? "draft";
    const action = targetStatus === "archived" ? "space.archive" : "space.publish";
    authorize(ctx, action, { spaceId: input.id, tenantId });
    if (fromStatus !== targetStatus) {
      // Server is the SOLE enforcer of ALLOWED_TRANSITIONS (§6.10). An unknown
      // status is not a valid edge → INVALID_TRANSITION.
      assertTransition("space", fromStatus, targetStatus);
      // Publish-readiness: a publish target needs ≥1 story point.
      if (targetStatus === "published") {
        const sps = await ctx.repos.storyPoints.list(tenantId, {
          where: { spaceId: input.id },
          limit: 1,
        });
        if (sps.items.length === 0) fail("FAILED_PRECONDITION", "space has no content to publish");
      }
    }
  } else {
    authorize(ctx, "space.write", input.id ? { spaceId: input.id, tenantId } : { tenantId });
  }

  // CREATE requires the authoring fields; UPDATE inherits any omitted field from
  // the stored space (partial-update merge).
  const mergedTitle =
    (data["title"] as string | undefined) ?? (existing?.["title"] as string | undefined);
  const mergedType =
    (data["type"] as string | undefined) ?? (existing?.["type"] as string | undefined);
  if (!input.id && (mergedTitle === undefined || mergedType === undefined)) {
    fail("VALIDATION_ERROR", "title and type are required to create a space");
  }

  const now = ctx.now();
  const isDelete = data["deleted"] === true;
  const doc: Doc = {
    ...(existing ?? {}),
    ...(input.id ? { id: input.id } : {}),
    ...data,
    ...(mergedTitle !== undefined ? { title: mergedTitle } : {}),
    ...(mergedType !== undefined ? { type: mergedType } : {}),
    accessType:
      (data["accessType"] as string | undefined) ??
      (existing?.["accessType"] as string | undefined) ??
      "class_assigned",
    status: targetStatus ?? (existing?.["status"] as string | undefined) ?? "draft",
    ...(targetStatus === "published" ? { publishedAt: now } : {}),
    ...(isDelete ? { archivedAt: now } : {}),
    createdBy: (existing?.["createdBy"] as string | undefined) ?? ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id, created } = await ctx.repos.spaces.upsert(tenantId, doc, now);
  await recordVersion(ctx, tenantId, id, {
    entityType: "space",
    entityId: id,
    changeType: isDelete
      ? "archived"
      : targetStatus === "published"
        ? "published"
        : created
          ? "created"
          : "updated",
    changeSummary: `space ${String(doc["title"] ?? id)}`,
  });
  if (isDelete) return { id, deleted: true } as unknown as ResOf<"v1.levelup.saveSpace">;
  return { id, created } as unknown as ResOf<"v1.levelup.saveSpace">;
}

// ── saveStoryPoint ──────────────────────────────────────────────────────────
export async function saveStoryPointService(
  input: ReqOf<"v1.levelup.saveStoryPoint">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveStoryPoint">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "storyPoint.write", { spaceId: input.spaceId, tenantId });

  const now = ctx.now();
  const data = input.data as Doc;
  const isDelete = data["deleted"] === true;
  const doc: Doc = {
    ...((input as { id?: string }).id ? { id: (input as { id?: string }).id } : {}),
    ...data,
    spaceId: input.spaceId,
    createdBy: ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id, created } = await ctx.repos.storyPoints.upsert(tenantId, doc, now);
  await recordVersion(ctx, tenantId, input.spaceId, {
    entityType: "storyPoint",
    entityId: id,
    changeType: isDelete ? "archived" : created ? "created" : "updated",
    changeSummary: `storyPoint ${String(data["title"] ?? id)}`,
  });
  if (isDelete) return { id, deleted: true } as unknown as ResOf<"v1.levelup.saveStoryPoint">;
  return { id, created } as unknown as ResOf<"v1.levelup.saveStoryPoint">;
}

// ── saveItem ────────────────────────────────────────────────────────────────
export async function saveItemService(
  input: ReqOf<"v1.levelup.saveItem">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveItem">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "item.write", { spaceId: input.spaceId, tenantId });

  const now = ctx.now();
  const data = input.data as Doc;
  const isDelete = data["deleted"] === true;

  // Extract the ⚷ answer key, then persist the ANSWER-STRIPPED item (§6.4).
  const answerKey = extractAnswerKey(data);
  const strippedData = stripAnswerFields(data);
  const doc: Doc = {
    ...((input as { id?: string }).id ? { id: (input as { id?: string }).id } : {}),
    ...strippedData,
    spaceId: input.spaceId,
    storyPointId: input.storyPointId,
    // UnifiedItem invariants: required ordering + soft-delete tombstone.
    orderIndex: (strippedData["orderIndex"] as number | undefined) ?? 0,
    archivedAt: isDelete
      ? now
      : ((strippedData["archivedAt"] as string | null | undefined) ?? null),
    createdBy: ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id, created } = await ctx.repos.items.upsert(tenantId, doc, now);

  // Write the answer key to the server-only deny-all subcollection.
  if (answerKey && !isDelete) {
    await ctx.repos.answerKeys.put(tenantId, id, {
      ...answerKey,
      itemId: id,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
    });
  }

  await recordVersion(ctx, tenantId, input.spaceId, {
    entityType: "item",
    entityId: id,
    changeType: isDelete ? "archived" : created ? "created" : "updated",
    changeSummary: `item ${String(strippedData["title"] ?? id)}`,
  });
  if (isDelete) return { id, deleted: true } as unknown as ResOf<"v1.levelup.saveItem">;
  return { id, created } as unknown as ResOf<"v1.levelup.saveItem">;
}

// ── getItemForEdit (⚷ authoring re-merge) ────────────────────────────────────
export async function getItemForEditService(
  input: ReqOf<"v1.levelup.getItemForEdit">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getItemForEdit">> {
  const tenantId = requireTenant(ctx);
  // Authoring-only (teacher/tenantAdmin/staff). A student/parent is DENIED.
  authorize(ctx, "item.readForEdit", { spaceId: input.spaceId, tenantId });

  const item = await ctx.repos.items.get(tenantId, input.itemId);
  if (!item) fail("NOT_FOUND", "item not found");

  // Re-merge the ⚷ answer key — the ONE sanctioned answer-bearing read. The EDIT
  // view is projected against ITS OWN ItemEditViewSchema (UnifiedItem + answerKey):
  // the item body is whitelisted with authoring=true (rubric guidance KEPT), and
  // the answer-bearing fields ride in the whitelisted `answerKey` — never stripped.
  const key = await ctx.repos.answerKeys.get(tenantId, input.itemId);
  const view = projectItem(item as Doc, true);
  const merged: Doc = key
    ? { ...view, answerKey: projectAnswerKey(key as Doc, view, input.itemId) }
    : view;
  return { item: merged } as unknown as ResOf<"v1.levelup.getItemForEdit">;
}

/**
 * Whitelist a stored ⚷ answer-key doc to the strict AnswerKeySchema view
 * (drops the storage-only `spaceId`/`storyPointId` scope keys saveItem stamps;
 * back-fills `questionType`/audit timestamps legacy keys omit). Authoring-gated
 * caller only.
 */
function projectAnswerKey(key: Doc, itemView: Doc, itemId: string): Doc {
  const qd = ((itemView["payload"] as Doc | undefined)?.["questionData"] ?? {}) as Doc;
  const qtRaw = optStr(key["questionType"]) ?? optStr(qd["questionType"]) ?? "text";
  return compact({
    id: optStr(key["id"]) ?? `ak_${itemId}`,
    itemId: optStr(key["itemId"]) ?? itemId,
    questionType: QUESTION_TYPE_MAP[qtRaw] ?? "text",
    correctAnswer: key["correctAnswer"],
    acceptableAnswers: Array.isArray(key["acceptableAnswers"])
      ? key["acceptableAnswers"]
      : undefined,
    evaluationGuidance: optStr(key["evaluationGuidance"]),
    modelAnswer: optStr(key["modelAnswer"]),
    createdAt: tsRequired(key["createdAt"], itemView["createdAt"]),
    updatedAt: tsRequired(key["updatedAt"], key["createdAt"], itemView["updatedAt"]),
  });
}

// ── listItems (answer-stripped learner/teacher list) ─────────────────────────
export async function listItemsService(
  input: ReqOf<"v1.levelup.listItems">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listItems">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });

  const page = await ctx.repos.items.list(tenantId, {
    where: { spaceId: input.spaceId, storyPointId: input.storyPointId },
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  // The leak gate is the CALLABLE, not the role: a list read is ALWAYS
  // answer-stripped (only getItemForEdit re-merges).
  const authoring = isAuthoringRole(ctx);
  const items = page.items.map((it) => projectItem(it as Doc, authoring));
  return { items, nextCursor: page.nextCursor } as unknown as ResOf<"v1.levelup.listItems">;
}

// ── canonical contract-view projections (LVL-1) ───────────────────────────────
// STRICT KEY WHITELISTS against the domain view schemas (UnifiedItemSchema /
// StoryPointSchema / SpaceSchema — all `.strict()`), so raw doc keys NEVER leak:
// real-data audit-field supersets, seed drift, and merge-upsert leftovers are
// dropped rather than failing `validateResponses:true`. Every timestamp runs
// through domain `toTimestamp()` (Firestore-Timestamp-at-rest → canonical ISO);
// every required-nullable field defaults omitted → null.

/** UnifiedItem meta/analytics whitelists (ItemMetadataSchema / ItemAnalyticsSchema keys). */
const ITEM_META_KEYS = [
  "totalPoints",
  "maxMarks",
  "estimatedTime",
  "learningObjectives",
  "skillsAssessed",
  "bloomsLevel",
  "prerequisites",
  "isRetriable",
  "evaluatorAgentId",
  "pyqInfo",
  "featured",
  "viewCount",
  "successRate",
  "migrationSource",
] as const;
const ITEM_ANALYTICS_KEYS = [
  "difficulty",
  "topics",
  "cognitiveLoad",
  "conceptImportance",
  "attemptCount",
  "averageScore",
] as const;

/** Attachments: whitelist ItemAttachmentSchema entry keys. */
function projectAttachments(v: unknown): Doc[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((a) => {
    const e = (a ?? {}) as Doc;
    return compact({
      type: e["type"],
      url: String(e["url"] ?? ""),
      name: optStr(e["name"]),
      sizeBytes: optInt(e["sizeBytes"]),
    });
  });
}

/**
 * Project a single item to the canonical UnifiedItem view (STRICT WHITELIST):
 * answer-key fields stripped; rubric guidance stripped for non-authoring; legacy
 * drift canonicalized (`order`→`orderIndex`, `effectiveRubric`→`rubric`,
 * `durationSeconds`/audit supersets dropped by the whitelist, the one-level
 * `kind` payload rebuilt into the two-level `type`/`payload` union); timestamps
 * → canonical ISO; required-nullable `archivedAt` defaults to null.
 */
function projectItem(item: Doc, authoring: boolean): Doc {
  const s = stripAnswerFields(item) as Doc;
  const norm = normalizeItemPayload(s["payload"] as Doc | undefined, s);
  const rubricIn = s["rubric"] ?? s["effectiveRubric"];
  return compact({
    id: s["id"],
    spaceId: s["spaceId"],
    storyPointId: s["storyPointId"],
    sectionId: optStr(s["sectionId"]),
    tenantId: s["tenantId"],
    type: norm.type,
    payload: norm.payload,
    title: optStr(s["title"]) ?? norm.title,
    content: optStr(s["content"]) ?? norm.content,
    difficulty: canonDifficulty(s["difficulty"]),
    topics: optStrArray(s["topics"]),
    labels: optStrArray(s["labels"]),
    orderIndex: int(s["orderIndex"], int(s["order"], 0)),
    meta: pickDefined(s["meta"], ITEM_META_KEYS),
    analytics: pickDefined(s["analytics"], ITEM_ANALYTICS_KEYS),
    rubric: rubricIn ? projectRubric(rubricIn, authoring) : undefined,
    rubricId: optStr(s["rubricId"]),
    linkedQuestionId: optStr(s["linkedQuestionId"]),
    attachments: projectAttachments(s["attachments"]),
    version: optInt(s["version"]),
    createdAt: tsRequired(s["createdAt"], s["updatedAt"]),
    updatedAt: tsRequired(s["updatedAt"], s["createdAt"]),
    createdBy: optStr(s["createdBy"]) ?? optStr(s["updatedBy"]) ?? "system",
    updatedBy: optStr(s["updatedBy"]) ?? optStr(s["createdBy"]) ?? "system",
    archivedAt: tsOrNull(s["archivedAt"]),
  });
}

/** StoryPoint sections: whitelist StoryPointSectionSchema entry keys. */
function projectSections(v: unknown): Doc[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((sec, i) => {
    const e = (sec ?? {}) as Doc;
    return compact({
      id: String(e["id"] ?? `section_${i}`),
      title: String(e["title"] ?? ""),
      description: optStr(e["description"]),
      orderIndex: int(e["orderIndex"], int(e["order"], i)),
    });
  });
}

/** AssessmentConfig: whitelist nested strict shapes; legacy top-level
 *  `durationMinutes` on the story-point doc folds in as the duration fallback. */
function projectAssessmentConfig(v: unknown, sp: Doc): Doc | undefined {
  const c = (v && typeof v === "object" ? (v as Doc) : {}) as Doc;
  const schedule = c["schedule"] as Doc | undefined;
  const out = compact({
    durationMinutes: optInt(c["durationMinutes"]) ?? optInt(sp["durationMinutes"]),
    maxAttempts: optInt(c["maxAttempts"]),
    shuffle: optBool(c["shuffle"]),
    passingPercentage: optNum(c["passingPercentage"]),
    adaptiveConfig:
      c["adaptiveConfig"] && typeof c["adaptiveConfig"] === "object"
        ? compact({
            enabled: Boolean((c["adaptiveConfig"] as Doc)["enabled"]),
            startingDifficulty: canonDifficulty((c["adaptiveConfig"] as Doc)["startingDifficulty"]),
            stepUpThreshold: optInt((c["adaptiveConfig"] as Doc)["stepUpThreshold"]),
            stepDownThreshold: optInt((c["adaptiveConfig"] as Doc)["stepDownThreshold"]),
          })
        : undefined,
    schedule: schedule
      ? { opensAt: tsOrNull(schedule["opensAt"]), closesAt: tsOrNull(schedule["closesAt"]) }
      : undefined,
    retryConfig: pickDefined(c["retryConfig"], ["cooldownMinutes", "lockAfterPassing"]),
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Project a StoryPoint to the canonical view (STRICT WHITELIST): `order`→
 * `orderIndex`, legacy type `'test'`→`'timed_test'` (domain read-adapter), stats
 * coerced to the strict `{itemCount,completionCount}` shape, rubric guidance
 * stripped for non-authoring, timestamps → canonical ISO, `archivedAt` → null.
 */
function projectStoryPoint(sp: Doc, authoring: boolean): Doc {
  const s = stripAnswerFields(sp) as Doc;
  const stats = s["stats"] as Doc | undefined;
  return compact({
    id: s["id"],
    spaceId: s["spaceId"],
    tenantId: s["tenantId"],
    title: String(s["title"] ?? ""),
    description: optStr(s["description"]),
    orderIndex: int(s["orderIndex"], int(s["order"], 0)),
    type: canonStoryPointType(s["type"]),
    sections: projectSections(s["sections"]),
    assessmentConfig: projectAssessmentConfig(s["assessmentConfig"], s),
    defaultRubric: s["defaultRubric"] ? projectRubric(s["defaultRubric"], authoring) : undefined,
    defaultRubricId: optStr(s["defaultRubricId"]),
    difficulty: canonDifficulty(s["difficulty"]),
    estimatedTimeMinutes: optInt(s["estimatedTimeMinutes"]),
    stats: stats
      ? { itemCount: int(stats["itemCount"], 0), completionCount: int(stats["completionCount"], 0) }
      : undefined,
    createdAt: tsRequired(s["createdAt"], s["updatedAt"]),
    updatedAt: tsRequired(s["updatedAt"], s["createdAt"]),
    createdBy: optStr(s["createdBy"]) ?? optStr(s["updatedBy"]) ?? "system",
    updatedBy: optStr(s["updatedBy"]) ?? optStr(s["createdBy"]) ?? "system",
    archivedAt: tsOrNull(s["archivedAt"]),
  });
}

// ── listSpaces ──────────────────────────────────────────────────────────────
export async function listSpacesService(
  input: ReqOf<"v1.levelup.listSpaces">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listSpaces">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { tenantId });

  const filter = input as {
    status?: string;
    type?: string;
    classId?: string;
    subject?: string;
    teacherId?: string;
    cursor?: string;
    limit?: number;
  };
  const where: Doc = {};
  if (filter.status) where["status"] = filter.status;
  if (filter.type) where["type"] = filter.type;
  if (filter.subject) where["subject"] = filter.subject;

  const page = await ctx.repos.spaces.list(tenantId, {
    where: Object.keys(where).length > 0 ? where : undefined,
    cursor: filter.cursor,
    limit: filter.limit ?? 20,
  });

  const authoring = isAuthoringRole(ctx);
  let items = page.items.map((s) => projectSpace(s as Doc, authoring));
  // Visibility gate (§): a non-authoring learner never sees a DRAFT space.
  if (!authoring) items = items.filter((s) => (s["status"] as string) !== "draft");
  return { items, nextCursor: page.nextCursor } as unknown as ResOf<"v1.levelup.listSpaces">;
}

// ── getSpace ────────────────────────────────────────────────────────────────
export async function getSpaceService(
  input: ReqOf<"v1.levelup.getSpace">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getSpace">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });

  const space = await ctx.repos.spaces.get(tenantId, input.spaceId);
  if (!space) fail("NOT_FOUND", "space not found");
  return {
    space: projectSpace(space as Doc, isAuthoringRole(ctx)),
  } as unknown as ResOf<"v1.levelup.getSpace">;
}

/** Price: bare legacy number → zMoney; object → whitelist `{amountMinor,currency}`. */
function projectPrice(v: unknown): Doc | undefined {
  if (typeof v === "number") {
    return v > 0 ? { amountMinor: Math.trunc(v), currency: "INR" } : undefined;
  }
  if (v && typeof v === "object") {
    const p = v as Doc;
    const amountMinor = optInt(p["amountMinor"]) ?? optInt(p["amount"]);
    if (amountMinor === undefined) return undefined;
    return { amountMinor, currency: optStr(p["currency"]) ?? "INR" };
  }
  return undefined;
}

/**
 * Project a space to the canonical SpaceSchema view (STRICT WHITELIST): rubric
 * guidance stripped for non-authoring, answer fields deep-stripped, stats/
 * ratingAggregate coerced to their strict shapes, bare numeric price → zMoney,
 * timestamps → canonical ISO, required-nullables (`publishedAt`/`archivedAt`)
 * default null, raw doc supersets (audit/seed leftovers) dropped.
 */
function projectSpace(space: Doc, authoring: boolean): Doc {
  const s = stripAnswerFields(space) as Doc;
  const stats = s["stats"] as Doc | undefined;
  const rating = s["ratingAggregate"] as Doc | undefined;
  return compact({
    id: s["id"],
    tenantId: s["tenantId"],
    title: String(s["title"] ?? ""),
    description: optStr(s["description"]),
    thumbnailUrl: optStr(s["thumbnailUrl"]),
    slug: optStr(s["slug"]),
    type: s["type"] ?? "learning",
    subject: optStr(s["subject"]),
    labels: optStrArray(s["labels"]),
    classIds: optStrArray(s["classIds"]) ?? [],
    sectionIds: optStrArray(s["sectionIds"]),
    teacherIds: optStrArray(s["teacherIds"]) ?? [],
    accessType: s["accessType"] ?? "class_assigned",
    academicSessionId: optStr(s["academicSessionId"]),
    defaultEvaluatorAgentId: optStr(s["defaultEvaluatorAgentId"]),
    defaultTutorAgentId: optStr(s["defaultTutorAgentId"]),
    defaultRubric: s["defaultRubric"] ? projectRubric(s["defaultRubric"], authoring) : undefined,
    defaultRubricId: optStr(s["defaultRubricId"]),
    price: projectPrice(s["price"]),
    publishedToStore: optBool(s["publishedToStore"]),
    storeDescription: optStr(s["storeDescription"]),
    storeThumbnailUrl: optStr(s["storeThumbnailUrl"]),
    status: s["status"] ?? "draft",
    publishedAt: tsOrNull(s["publishedAt"]),
    stats: stats
      ? {
          storyPointCount: int(stats["storyPointCount"], 0),
          itemCount: int(stats["itemCount"], 0),
          enrolledCount: int(stats["enrolledCount"], int(stats["enrollmentCount"], 0)),
          completionCount: int(stats["completionCount"], 0),
        }
      : undefined,
    ratingAggregate: rating
      ? {
          averageRating: num(rating["averageRating"], num(rating["average"], 0)),
          totalReviews: int(rating["totalReviews"], int(rating["count"], 0)),
          distribution:
            rating["distribution"] && typeof rating["distribution"] === "object"
              ? rating["distribution"]
              : {},
        }
      : undefined,
    version: optInt(s["version"]),
    createdAt: tsRequired(s["createdAt"], s["updatedAt"]),
    updatedAt: tsRequired(s["updatedAt"], s["createdAt"]),
    createdBy: optStr(s["createdBy"]) ?? optStr(s["updatedBy"]) ?? "system",
    updatedBy: optStr(s["updatedBy"]) ?? optStr(s["createdBy"]) ?? "system",
    archivedAt: tsOrNull(s["archivedAt"]),
  });
}

// ── listStoryPoints ─────────────────────────────────────────────────────────
export async function listStoryPointsService(
  input: ReqOf<"v1.levelup.listStoryPoints">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listStoryPoints">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.read", { spaceId: input.spaceId, tenantId });

  const page = await ctx.repos.storyPoints.list(tenantId, {
    where: { spaceId: input.spaceId },
    limit: 200,
  });
  const authoring = isAuthoringRole(ctx);
  const items = page.items.map((sp) => projectStoryPoint(sp as Doc, authoring));
  return { items } as unknown as ResOf<"v1.levelup.listStoryPoints">;
}

// ── getStoryPoint ───────────────────────────────────────────────────────────
export async function getStoryPointService(
  input: ReqOf<"v1.levelup.getStoryPoint">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getStoryPoint">> {
  const tenantId = requireTenant(ctx);
  const req = input as { spaceId: string; storyPointId: string };
  authorize(ctx, "space.read", { spaceId: req.spaceId, tenantId });
  const sp = await ctx.repos.storyPoints.get(tenantId, req.storyPointId);
  if (!sp) fail("NOT_FOUND", "story point not found");
  return {
    storyPoint: projectStoryPoint(sp as Doc, isAuthoringRole(ctx)),
  } as unknown as ResOf<"v1.levelup.getStoryPoint">;
}
