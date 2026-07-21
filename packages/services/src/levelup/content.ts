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
import { MODEL_POLICY_IDS, zLegacyStoryPointTypeRead } from "@levelup/domain";
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
const isDoc = (v: unknown): v is Doc => typeof v === "object" && v !== null && !Array.isArray(v);
const hasOwn = (v: Doc, key: string): boolean => Object.prototype.hasOwnProperty.call(v, key);
const MODEL_POLICY_SET = new Set<string>(MODEL_POLICY_IDS);

/**
 * Authoring works against the same exact answer-key path as conversation
 * runtime. The temporary legacy fallback keeps older in-memory test seams
 * usable while T-B finishes its `getScoped` twin; production repos always
 * provide the exact reader.
 */
async function getAnswerKeyAt(
  ctx: AuthContext,
  tenantId: string,
  spaceId: string,
  storyPointId: string,
  itemId: string
): Promise<Doc | null> {
  const repo = ctx.repos.answerKeys as unknown as {
    get(tenant: string, id: string): Promise<Doc | null>;
    getScoped?: (
      tenant: string,
      space: string,
      storyPoint: string,
      id: string
    ) => Promise<Doc | null>;
  };
  return repo.getScoped
    ? repo.getScoped(tenantId, spaceId, storyPointId, itemId)
    : repo.get(tenantId, itemId);
}

/** Tenant-level agents are flat, but their requested space is still part of
 * the lookup authority. As above, use T-B's exact scope reader when present. */
async function getAgentAt(
  ctx: AuthContext,
  tenantId: string,
  spaceId: string,
  agentId: string
): Promise<Doc | null> {
  const repo = xrepos(ctx).agents as unknown as {
    get(tenant: string, id: string): Promise<Doc | null>;
    getScoped?: (tenant: string, space: string, id: string) => Promise<Doc | null>;
  };
  return repo.getScoped ? repo.getScoped(tenantId, spaceId, agentId) : repo.get(tenantId, agentId);
}

/** Exact item reads prevent an authoring caller from using an item ID to cross
 * the requested space/story-point boundary. The fallback still verifies both
 * parents for older in-memory seams. */
async function getItemAt(
  ctx: AuthContext,
  tenantId: string,
  spaceId: string,
  storyPointId: string,
  itemId: string
): Promise<Doc | null> {
  const repo = ctx.repos.items as unknown as {
    get(tenant: string, id: string): Promise<Doc | null>;
    getScoped?: (
      tenant: string,
      space: string,
      storyPoint: string,
      id: string
    ) => Promise<Doc | null>;
  };
  const item = repo.getScoped
    ? await repo.getScoped(tenantId, spaceId, storyPointId, itemId)
    : await repo.get(tenantId, itemId);
  if (!item || item["spaceId"] !== spaceId || item["storyPointId"] !== storyPointId) return null;
  return item;
}

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
  "privateEvaluationObjectives",
  // LD-01: canonical MCQ/MCAQ/jumbled/matching answer fields (live leak if omitted).
  "isCorrect",
  "correctOrder",
  "right",
] as const;

/**
 * `modelAnswer` and `evaluatorGuidance` are overloaded names: at an item
 * payload they belong exclusively in the deny-all answer key, while in a
 * UnifiedRubric they are canonical authoring guidance (§5.4).  The strip
 * helper therefore preserves only those two fields below a top-level rubric
 * container; learner projections subsequently remove them with
 * `projectRubric(..., false)`.
 */
const RUBRIC_CONTAINER_FIELDS = new Set(["rubric", "defaultRubric", "effectiveRubric"]);
const RUBRIC_AUTHORING_FIELDS = new Set(["modelAnswer", "evaluatorGuidance"]);

/**
 * Recursively strip every answer-key/guidance field from a value (deep, by
 * name). Exported for question-bank import, whose question-data payload must
 * never retain private answer material.
 */
export function stripAnswerFields<T>(value: T): T {
  return stripAnswerFieldsInternal(value, false, false, true);
}

/**
 * Content docs carry a top-level rubric/defaultRubric/effectiveRubric. Preserve
 * rubric-local authoring guidance while stripping all answer-key fields from
 * every other subtree.
 */
function stripContentAnswerFields<T>(value: T): T {
  return stripAnswerFieldsInternal(value, true, false, true);
}

function stripAnswerFieldsInternal<T>(
  value: T,
  preserveTopLevelRubric: boolean,
  withinTopLevelRubric: boolean,
  isRoot: boolean
): T {
  if (Array.isArray(value)) {
    return value.map((v) =>
      stripAnswerFieldsInternal(v, false, withinTopLevelRubric, false)
    ) as unknown as T;
  }
  if (value && typeof value === "object") {
    const copy: Doc = {};
    for (const [k, v] of Object.entries(value as Doc)) {
      const entersTopLevelRubric =
        preserveTopLevelRubric && isRoot && RUBRIC_CONTAINER_FIELDS.has(k);
      const preservesRubricAuthoringField = withinTopLevelRubric && RUBRIC_AUTHORING_FIELDS.has(k);
      if ((ANSWER_KEY_FIELDS as readonly string[]).includes(k) && !preservesRubricAuthoringField) {
        continue;
      }
      copy[k] = stripAnswerFieldsInternal(
        v,
        false,
        withinTopLevelRubric || entersTopLevelRubric,
        false
      );
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

/** Stable, order-insensitive string hash (djb2) for content-derived shuffling. */
function hashText(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

/**
 * After answer-key stripping, matching pairs omit their `right` value (it lives
 * only in AnswerKey), which would leave the learner with no match targets to
 * pick from. We therefore:
 *  - blank each pair's `right` so the POSITIONAL left→right mapping is never
 *    leaked (the correct pairing stays server-only), and
 *  - emit a de-duplicated `options` pool of the right-side texts in a stable,
 *    content-derived order (NOT pair order) so the option set is visible and
 *    answerable without revealing which left each belongs to.
 */
function sanitizeLearnerQuestionData(qd: Doc, source?: Doc): Doc {
  if (qd["questionType"] !== "matching" || !Array.isArray(qd["pairs"])) return qd;
  const pairs = qd["pairs"] as Doc[];
  // The right-side texts are the answer targets the learner picks from. They are
  // stripped from `qd` by `stripAnswerFields` (which runs first), so read them
  // from the pre-strip `source` payload when available.
  const rightSource = Array.isArray(source?.["pairs"]) ? (source!["pairs"] as Doc[]) : pairs;
  const rights = rightSource.map((p) => String(p["right"] ?? "")).filter((t) => t.length > 0);
  const options = [...new Set(rights)].sort((a, b) => hashText(a) - hashText(b));
  return {
    ...qd,
    pairs: pairs.map((pair) => ({
      left: String(pair["left"] ?? ""),
      // Correct mappings live only in AnswerKey — never emit them on learner reads.
      right: "",
    })),
    ...(options.length > 0 ? { options } : {}),
  };
}

/** Seed/legacy flat payload: `questionType` at payload root without `payload.type`. */
function buildQuestionPayloadFromFlat(
  p: Doc,
  item: Doc,
  origQd?: Doc
): { type: string; payload: Doc; content?: string } {
  const qt = QUESTION_TYPE_MAP[String(p["questionType"] ?? "")] ?? "text";
  const basePoints =
    typeof p["basePoints"] === "number"
      ? (p["basePoints"] as number)
      : typeof p["points"] === "number"
        ? (p["points"] as number)
        : undefined;

  let questionData: Doc;
  if (isDoc(p["questionData"]) && Object.keys(p["questionData"] as Doc).length > 0) {
    const raw = stripAnswerFields({
      ...(p["questionData"] as Doc),
      questionType: (p["questionData"] as Doc)["questionType"] ?? qt,
    }) as Doc;
    questionData = sanitizeLearnerQuestionData(
      { ...raw, questionType: qt },
      origQd ?? (p["questionData"] as Doc)
    );
  } else {
    questionData = buildQuestionData(qt, p);
  }

  return {
    type: "question",
    payload: {
      type: "question",
      ...(basePoints !== undefined ? { basePoints } : {}),
      questionData,
    },
    content:
      typeof p["content"] === "string"
        ? (p["content"] as string)
        : typeof p["prompt"] === "string"
          ? (p["prompt"] as string)
          : undefined,
  };
}

/** Seed/legacy flat payload: `materialType` at payload root without `payload.type`. */
function buildMaterialPayloadFromFlat(
  p: Doc,
  item: Doc
): { type: string; payload: Doc; title?: string; content?: string } {
  if (isDoc(p["materialData"])) {
    const materialData = stripAnswerFields(p["materialData"]) as Doc;
    return {
      type: "material",
      payload: { type: "material", materialData },
      title: typeof item["title"] === "string" ? (item["title"] as string) : undefined,
      content: typeof p["content"] === "string" ? (p["content"] as string) : undefined,
    };
  }
  const mt = MATERIAL_TYPE_MAP[String(p["materialType"] ?? "")] ?? "text";
  return {
    type: "material",
    payload: { type: "material", materialData: buildMaterialData(mt, p) },
    title: typeof item["title"] === "string" ? (item["title"] as string) : undefined,
    content:
      typeof p["body"] === "string"
        ? (p["body"] as string)
        : typeof p["content"] === "string"
          ? (p["content"] as string)
          : undefined,
  };
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
      return compact({
        questionType: "chat_agent_question",
        scenario: optStr(legacy["scenario"]) ?? optStr(legacy["prompt"]),
        publicLearningObjectives: Array.isArray(legacy["publicLearningObjectives"])
          ? legacy["publicLearningObjectives"].map((objective) => {
              const entry = (objective ?? {}) as Doc;
              return { id: String(entry["id"] ?? ""), label: String(entry["label"] ?? "") };
            })
          : undefined,
        conversationStarters: optStrArray(legacy["conversationStarters"]),
        interviewerAgentId: optStr(legacy["interviewerAgentId"]),
        completionPolicy:
          legacy["completionPolicy"] && typeof legacy["completionPolicy"] === "object"
            ? legacy["completionPolicy"]
            : undefined,
      });
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
    case "rich": {
      const rich = legacy["richContent"] as Doc | undefined;
      const blocks = Array.isArray(rich?.["blocks"]) ? rich["blocks"] : [];
      return { materialType: "rich", blocks };
    }
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
  item: Doc,
  origPayload?: Doc
): { type: string; payload: Doc; title?: string; content?: string } {
  const p = (payload ?? {}) as Doc;
  const origQd = isDoc(origPayload?.["questionData"])
    ? (origPayload!["questionData"] as Doc)
    : undefined;
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
    const stripped = stripAnswerFields(p) as Doc;
    const questionData = stripped["questionData"];
    if (questionData && typeof questionData === "object" && !Array.isArray(questionData)) {
      stripped["questionData"] = sanitizeLearnerQuestionData(
        questionData as Doc,
        origQd ?? (p["questionData"] as Doc)
      );
    }
    return { type: String(item["type"] ?? p["type"]), payload: stripped };
  }
  // Seed-style flat payloads: top-level `questionType` / `materialType` without `payload.type`.
  const itemType = String(item["type"] ?? "");
  if (itemType === "question" || typeof p["questionType"] === "string") {
    return buildQuestionPayloadFromFlat(p, item, origQd);
  }
  if (itemType === "material" || typeof p["materialType"] === "string") {
    return buildMaterialPayloadFromFlat(p, item);
  }
  // Degenerate fallback so the strict union never fails on an empty payload.
  return { type: "checkpoint", payload: { type: "checkpoint" } };
}

function questionDataFromSave(data: Doc): Doc {
  const payload = data["payload"];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const questionData = (payload as Doc)["questionData"];
  return questionData && typeof questionData === "object" && !Array.isArray(questionData)
    ? (questionData as Doc)
    : {};
}

function questionDataFromItem(item: Doc | null): Doc {
  if (!item) return {};
  const payload = item["payload"];
  if (!isDoc(payload)) return {};
  const questionData = payload["questionData"];
  return isDoc(questionData) ? questionData : {};
}

function isChatAssessmentItem(data: Doc, existing: Doc | null): boolean {
  const questionData = questionDataFromSave(data);
  const storedQuestionData = questionDataFromItem(existing);
  const key = data["answerKey"];
  return (
    questionData["questionType"] === "chat_agent_question" ||
    storedQuestionData["questionType"] === "chat_agent_question" ||
    (isDoc(key) && key["questionType"] === "chat_agent_question")
  );
}

/**
 * Answer-key data can be supplied in the new explicit `data.answerKey` bag.
 * The `questionData` fallback is read-only compatibility for legacy authoring
 * docs; newly persisted chat data never keeps these fields on the public item.
 */
function mergedChatAnswerKey(data: Doc, existingKey: Doc | null): Doc {
  const supplied = isDoc(data["answerKey"]) ? (data["answerKey"] as Doc) : {};
  const legacyQuestionData = questionDataFromSave(data);
  const answerKey: Doc = {
    questionType: "chat_agent_question",
    ...(optStr(existingKey?.["modelAnswer"]) !== undefined
      ? { modelAnswer: optStr(existingKey?.["modelAnswer"]) }
      : {}),
    ...(optStr(existingKey?.["evaluationGuidance"]) !== undefined
      ? { evaluationGuidance: optStr(existingKey?.["evaluationGuidance"]) }
      : {}),
    ...(Array.isArray(existingKey?.["privateEvaluationObjectives"])
      ? { privateEvaluationObjectives: existingKey?.["privateEvaluationObjectives"] }
      : {}),
  };
  for (const field of [
    "modelAnswer",
    "evaluationGuidance",
    "privateEvaluationObjectives",
  ] as const) {
    if (hasOwn(supplied, field)) answerKey[field] = supplied[field];
    else if (hasOwn(legacyQuestionData, field)) answerKey[field] = legacyQuestionData[field];
  }
  return answerKey;
}

function assertDistinctNonBlank(values: unknown, label: string): asserts values is Doc[] {
  if (!Array.isArray(values)) fail("VALIDATION_ERROR", `${label} must be an array`);
  const seen = new Set<string>();
  for (const raw of values) {
    if (!isDoc(raw)) fail("VALIDATION_ERROR", `${label} entries must be objects`);
    const id = optStr(raw["id"]);
    if (!id || id.trim().length === 0) fail("VALIDATION_ERROR", `${label} entries require an id`);
    if (seen.has(id)) fail("VALIDATION_ERROR", `${label} ids must be unique`);
    seen.add(id);
  }
}

function validateRubricWeightsAndBounds(rubric: Doc): void {
  if (typeof rubric["scoringMode"] !== "string") {
    fail("VALIDATION_ERROR", "chat-agent assessments require a rubric scoringMode");
  }
  const bounded = (value: unknown, label: string): void => {
    if (
      value !== undefined &&
      (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    ) {
      fail("VALIDATION_ERROR", `${label} must be a positive finite number`);
    }
  };
  bounded(rubric["holisticMaxScore"], "rubric holisticMaxScore");
  for (const collection of ["dimensions", "criteria"] as const) {
    const entries = rubric[collection];
    if (entries !== undefined && !Array.isArray(entries)) {
      fail("VALIDATION_ERROR", `rubric ${collection} must be an array`);
    }
    for (const entry of (entries as unknown[] | undefined) ?? []) {
      if (!isDoc(entry)) fail("VALIDATION_ERROR", `rubric ${collection} entries must be objects`);
      bounded(entry["weight"], `rubric ${collection} weight`);
      if (collection === "dimensions")
        bounded(entry["scoringScale"], "rubric dimension scoringScale");
      else bounded(entry["maxScore"], "rubric criterion maxScore");
    }
  }
}

async function resolveChatAssessmentRubric(
  ctx: AuthContext,
  tenantId: string,
  input: { spaceId: string; storyPointId: string },
  data: Doc,
  existing: Doc | null
): Promise<Doc> {
  const direct = data["rubric"] ?? existing?.["rubric"];
  if (isDoc(direct)) return direct;

  const rubricId = optStr(data["rubricId"]) ?? optStr(existing?.["rubricId"]);
  if (rubricId) {
    const preset = await xrepos(ctx).rubricPresets.get(tenantId, rubricId);
    if (!preset || !isDoc(preset["rubric"])) {
      fail("FAILED_PRECONDITION", "the selected chat-agent rubric does not exist");
    }
    return preset["rubric"] as Doc;
  }

  const storyPoint = await ctx.repos.storyPoints.get(tenantId, input.storyPointId);
  if (isDoc(storyPoint?.["defaultRubric"])) return storyPoint["defaultRubric"] as Doc;
  const storyPointRubricId = optStr(storyPoint?.["defaultRubricId"]);
  if (storyPointRubricId) {
    const preset = await xrepos(ctx).rubricPresets.get(tenantId, storyPointRubricId);
    if (preset && isDoc(preset["rubric"])) return preset["rubric"] as Doc;
  }

  const space = await ctx.repos.spaces.get(tenantId, input.spaceId);
  if (isDoc(space?.["defaultRubric"])) return space["defaultRubric"] as Doc;
  const spaceRubricId = optStr(space?.["defaultRubricId"]);
  if (spaceRubricId) {
    const preset = await xrepos(ctx).rubricPresets.get(tenantId, spaceRubricId);
    if (preset && isDoc(preset["rubric"])) return preset["rubric"] as Doc;
  }
  fail("FAILED_PRECONDITION", "chat-agent assessments require a valid rubric or rubricId");
}

async function validateChatAssessmentAuthoring(
  ctx: AuthContext,
  tenantId: string,
  input: { spaceId: string; storyPointId: string },
  data: Doc,
  existing: Doc | null,
  questionData: Doc,
  answerKey: Doc
): Promise<void> {
  const scenario = optStr(questionData["scenario"]);
  if (!scenario || scenario.trim().length === 0) {
    fail("VALIDATION_ERROR", "chat-agent assessments require a scenario");
  }

  const publicObjectives = questionData["publicLearningObjectives"];
  assertDistinctNonBlank(publicObjectives, "public learning objective");
  for (const objective of publicObjectives) {
    const label = optStr(objective["label"]);
    if (!label || label.trim().length === 0) {
      fail("VALIDATION_ERROR", "public learning objectives require labels");
    }
  }

  const completion = questionData["completionPolicy"];
  if (!isDoc(completion))
    fail("VALIDATION_ERROR", "chat-agent assessments require completionPolicy");
  const minTurns = completion["minLearnerTurns"];
  const maxTurns = completion["maxLearnerTurns"];
  if (
    !Number.isInteger(minTurns) ||
    !Number.isInteger(maxTurns) ||
    (minTurns as number) < 1 ||
    (maxTurns as number) < 1 ||
    (maxTurns as number) > 12 ||
    (minTurns as number) > (maxTurns as number)
  ) {
    fail(
      "VALIDATION_ERROR",
      "completionPolicy requires 1 <= minLearnerTurns <= maxLearnerTurns <= 12"
    );
  }
  if (typeof completion["allowEarlyFinish"] !== "boolean") {
    fail("VALIDATION_ERROR", "completionPolicy.allowEarlyFinish must be boolean");
  }
  if (completion["hardLimitAction"] !== "auto_finalize") {
    fail("VALIDATION_ERROR", "completionPolicy.hardLimitAction must be auto_finalize");
  }

  const interviewerAgentId = optStr(questionData["interviewerAgentId"]);
  if (!interviewerAgentId)
    fail("VALIDATION_ERROR", "chat-agent assessments require interviewerAgentId");
  const interviewer = await getAgentAt(ctx, tenantId, input.spaceId, interviewerAgentId);
  if (!interviewer) fail("FAILED_PRECONDITION", "the selected interviewer agent does not exist");
  if (interviewer["spaceId"] !== input.spaceId || interviewer["type"] !== "interviewer") {
    fail(
      "FAILED_PRECONDITION",
      "the selected interviewer must belong to this space and have type interviewer"
    );
  }
  if (interviewer["isActive"] !== true) {
    fail("FAILED_PRECONDITION", "the selected interviewer agent is inactive");
  }
  const interviewerPolicy = optStr(interviewer["modelPolicyId"]);
  if (
    !interviewerPolicy ||
    !MODEL_POLICY_SET.has(interviewerPolicy) ||
    interviewerPolicy === "evaluation.quality"
  ) {
    fail(
      "FAILED_PRECONDITION",
      "the selected interviewer must have a valid conversation model policy"
    );
  }

  // `meta` is a replacement object on an item save. When it is supplied
  // without an evaluator id, that intentionally clears a prior override; only
  // an omitted `meta` retains the existing override for a partial update.
  const incomingMeta = isDoc(data["meta"]) ? (data["meta"] as Doc) : undefined;
  const evaluatorAgentId = optStr(
    (incomingMeta ?? (isDoc(existing?.["meta"]) ? (existing?.["meta"] as Doc) : {}))[
      "evaluatorAgentId"
    ]
  );
  if (evaluatorAgentId) {
    const evaluator = await getAgentAt(ctx, tenantId, input.spaceId, evaluatorAgentId);
    if (!evaluator) fail("FAILED_PRECONDITION", "the selected evaluator agent does not exist");
    if (
      evaluator["spaceId"] !== input.spaceId ||
      evaluator["type"] !== "evaluator" ||
      evaluator["isActive"] !== true ||
      evaluator["modelPolicyId"] !== "evaluation.quality"
    ) {
      fail(
        "FAILED_PRECONDITION",
        "the selected evaluator must be active, belong to this space, and use evaluation.quality"
      );
    }
  }

  const privateObjectives = answerKey["privateEvaluationObjectives"];
  assertDistinctNonBlank(privateObjectives, "private evaluation objective");
  if (privateObjectives.length === 0) {
    fail(
      "VALIDATION_ERROR",
      "chat-agent assessments require at least one private evaluation objective"
    );
  }
  for (const objective of privateObjectives) {
    const dimensionId = optStr(objective["rubricDimensionId"]);
    const description = optStr(objective["description"]);
    if (!dimensionId || !description || description.trim().length === 0) {
      fail(
        "VALIDATION_ERROR",
        "private evaluation objectives require rubricDimensionId and description"
      );
    }
  }

  const rubric = await resolveChatAssessmentRubric(ctx, tenantId, input, data, existing);
  validateRubricWeightsAndBounds(rubric);
  const dimensions = Array.isArray(rubric["dimensions"]) ? (rubric["dimensions"] as unknown[]) : [];
  const dimensionIds = new Set(
    dimensions
      .filter(isDoc)
      .map((dimension) => optStr(dimension["id"]))
      .filter(Boolean) as string[]
  );
  for (const objective of privateObjectives) {
    if (!dimensionIds.has(String(objective["rubricDimensionId"]))) {
      fail("FAILED_PRECONDITION", "private evaluation objectives must reference rubric dimensions");
    }
  }
}

function isChatAssessmentSave(data: Doc): boolean {
  const questionData = questionDataFromSave(data);
  const key = data["answerKey"];
  return (
    questionData["questionType"] === "chat_agent_question" ||
    (isDoc(key) && key["questionType"] === "chat_agent_question")
  );
}

/**
 * Pull the answer-key bag off the save payload (the only place answers travel).
 * Assessment keys use an explicit allowlist: public scenario/objectives stay on
 * the item, while model answers, guidance, and private objectives can reach only
 * the deny-all subcollection.
 */
export function extractAnswerKey(data: Doc): Doc | null {
  const ak = data["answerKey"];
  if (isChatAssessmentSave(data)) {
    const supplied = ak && typeof ak === "object" && !Array.isArray(ak) ? (ak as Doc) : {};
    const questionData = questionDataFromSave(data);
    const privateObjectives = supplied["privateEvaluationObjectives"];
    return compact({
      questionType: "chat_agent_question",
      modelAnswer: optStr(supplied["modelAnswer"]) ?? optStr(questionData["modelAnswer"]),
      evaluationGuidance:
        optStr(supplied["evaluationGuidance"]) ?? optStr(questionData["evaluationGuidance"]),
      privateEvaluationObjectives: Array.isArray(privateObjectives)
        ? privateObjectives.map((objective) => {
            const entry = (objective ?? {}) as Doc;
            return compact({
              id: optStr(entry["id"]),
              rubricDimensionId: optStr(entry["rubricDimensionId"]),
              description: optStr(entry["description"]),
              evidenceRequirement: optStr(entry["evidenceRequirement"]),
            });
          })
        : undefined,
    });
  }
  if (ak && typeof ak === "object") return { ...(ak as Doc) };
  // Matching keys are structural: the correct answer is the per-pair left→right
  // mapping, so the flat by-name collector below (which would overwrite a single
  // scalar `right`) cannot capture them. Preserve the full `pairs` list here.
  const qd = questionDataFromSave(data);
  const storedQd = questionDataFromItem(isDoc(data["item"]) ? (data["item"] as Doc) : null);
  const matchingQd =
    qd["questionType"] === "matching" && Array.isArray(qd["pairs"])
      ? qd
      : storedQd["questionType"] === "matching" && Array.isArray(storedQd["pairs"])
        ? storedQd
        : null;
  if (matchingQd) {
    const pairs = (matchingQd["pairs"] as Doc[])
      .map((p) => ({ left: String(p["left"] ?? ""), right: String(p["right"] ?? "") }))
      .filter((p) => p.left.length > 0 && p.right.length > 0);
    if (pairs.length > 0) return { questionType: "matching", pairs };
  }
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

// ── duplicateSpace ────────────────────────────────────────────────────────────
export async function duplicateSpaceService(
  input: ReqOf<"v1.levelup.duplicateSpace">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.duplicateSpace">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "space.write", { tenantId });

  const src = await ctx.repos.spaces.get(tenantId, input.spaceId);
  if (!src) fail("NOT_FOUND", "source space not found");

  const now = ctx.now();
  const srcDoc = src as Doc;

  // Write fresh draft space (strip runtime/lifecycle fields, suffix title).
  const spaceDoc: Doc = {
    title: `${String(srcDoc["title"] ?? "Untitled")} (Copy)`,
    type: srcDoc["type"],
    description: srcDoc["description"],
    thumbnailUrl: srcDoc["thumbnailUrl"],
    slug: undefined,
    subject: srcDoc["subject"],
    labels: srcDoc["labels"],
    classIds: [],
    sectionIds: srcDoc["sectionIds"],
    teacherIds: srcDoc["teacherIds"],
    accessType: srcDoc["accessType"] ?? "class_assigned",
    academicSessionId: srcDoc["academicSessionId"],
    defaultEvaluatorAgentId: srcDoc["defaultEvaluatorAgentId"],
    defaultTutorAgentId: srcDoc["defaultTutorAgentId"],
    defaultRubric: srcDoc["defaultRubric"],
    defaultRubricId: srcDoc["defaultRubricId"],
    evaluationSettingsId: srcDoc["evaluationSettingsId"],
    allowRetakes: srcDoc["allowRetakes"],
    maxRetakes: srcDoc["maxRetakes"],
    defaultTimeLimitMinutes: srcDoc["defaultTimeLimitMinutes"],
    showCorrectAnswers: srcDoc["showCorrectAnswers"],
    status: "draft",
    publishedAt: null,
    archivedAt: null,
    publishedToStore: false,
    createdBy: ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id: newSpaceId } = await ctx.repos.spaces.upsert(tenantId, spaceDoc, now);

  // Copy story points + items + answer keys. Cursor loops — a single page
  // would silently truncate large spaces (convention: autograde cascade delete).
  let spCursor: string | undefined;
  do {
    const spPage = await ctx.repos.storyPoints.list(tenantId, {
      where: { spaceId: input.spaceId },
      cursor: spCursor,
      limit: 200,
    });
    for (const sp of spPage.items) {
      const spDoc = sp as Doc;
      const { id: newSpId } = await ctx.repos.storyPoints.upsert(
        tenantId,
        {
          ...spDoc,
          id: undefined,
          spaceId: newSpaceId,
          createdBy: ctx.uid,
          updatedBy: ctx.uid,
        },
        now
      );

      let itCursor: string | undefined;
      do {
        const itPage = await ctx.repos.items.list(tenantId, {
          where: { spaceId: input.spaceId, storyPointId: spDoc["id"] as string },
          cursor: itCursor,
          limit: 200,
        });
        for (const it of itPage.items) {
          const itDoc = it as Doc;
          // Read the server-only key at its exact nested source path. An ID-only
          // lookup is not sufficient once the same item ID can exist beneath a
          // different parent/root.
          const srcKey = await getAnswerKeyAt(
            ctx,
            tenantId,
            input.spaceId,
            String(spDoc["id"] ?? ""),
            String(itDoc["id"] ?? "")
          );

          const strippedItem = stripContentAnswerFields(itDoc);
          const { id: newItemId } = await ctx.repos.items.upsert(
            tenantId,
            {
              ...strippedItem,
              id: undefined,
              spaceId: newSpaceId,
              storyPointId: newSpId,
              archivedAt: null,
              createdBy: ctx.uid,
              updatedBy: ctx.uid,
            },
            now
          );

          if (srcKey) {
            await ctx.repos.answerKeys.put(tenantId, newItemId, {
              ...(srcKey as Doc),
              itemId: newItemId,
              spaceId: newSpaceId,
              storyPointId: newSpId,
            });
          }
        }
        itCursor = itPage.nextCursor ?? undefined;
      } while (itCursor);
    }
    spCursor = spPage.nextCursor ?? undefined;
  } while (spCursor);

  await recordVersion(ctx, tenantId, newSpaceId, {
    entityType: "space",
    entityId: newSpaceId,
    changeType: "created",
    changeSummary: `duplicated from ${input.spaceId}`,
  });

  return { id: newSpaceId, created: true } as unknown as ResOf<"v1.levelup.duplicateSpace">;
}

/**
 * A publishable space must contain at least one active story point, and every
 * active story point must contain at least one active item. Cursor loops keep
 * readiness correct for large spaces; explicit scope checks also protect test
 * fakes/adapters that do not push `where` down to storage.
 */
async function assertSpacePublishReady(
  ctx: AuthContext,
  tenantId: string,
  spaceId: string
): Promise<void> {
  const storyPoints: Doc[] = [];
  let storyPointCursor: string | undefined;
  do {
    const page = await ctx.repos.storyPoints.list(tenantId, {
      where: { spaceId },
      cursor: storyPointCursor,
      limit: 200,
    });
    storyPoints.push(
      ...(page.items as Doc[]).filter(
        (sp) =>
          sp["spaceId"] === spaceId && (sp["archivedAt"] === null || sp["archivedAt"] === undefined)
      )
    );
    storyPointCursor = page.nextCursor ?? undefined;
  } while (storyPointCursor);

  if (storyPoints.length === 0) {
    fail("FAILED_PRECONDITION", "cannot publish: space has no active story points");
  }

  for (const storyPoint of storyPoints) {
    const storyPointId = String(storyPoint["id"]);
    let itemCursor: string | undefined;
    let hasActiveItem = false;
    do {
      const page = await ctx.repos.items.list(tenantId, {
        where: { spaceId, storyPointId },
        cursor: itemCursor,
        limit: 200,
      });
      hasActiveItem = (page.items as Doc[]).some(
        (item) =>
          item["spaceId"] === spaceId &&
          item["storyPointId"] === storyPointId &&
          (item["archivedAt"] === null || item["archivedAt"] === undefined)
      );
      itemCursor = hasActiveItem ? undefined : (page.nextCursor ?? undefined);
    } while (itemCursor);

    if (!hasActiveItem) {
      fail(
        "FAILED_PRECONDITION",
        `cannot publish: story point "${String(storyPoint["title"] ?? storyPointId)}" has no active items`
      );
    }
  }
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
      // Publish-readiness is server-owned: active structure must be complete.
      if (targetStatus === "published") {
        await assertSpacePublishReady(ctx, tenantId, input.id);
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
  const { deleted: _deleted, ...mutableData } = data;
  void _deleted;
  const doc: Doc = {
    ...(existing ?? {}),
    ...(input.id ? { id: input.id } : {}),
    ...mutableData,
    ...(mergedTitle !== undefined ? { title: mergedTitle } : {}),
    ...(mergedType !== undefined ? { type: mergedType } : {}),
    accessType:
      (data["accessType"] as string | undefined) ??
      (existing?.["accessType"] as string | undefined) ??
      "class_assigned",
    status: targetStatus ?? (existing?.["status"] as string | undefined) ?? "draft",
    classIds:
      (data["classIds"] as string[] | undefined) ??
      (existing?.["classIds"] as string[] | undefined) ??
      [],
    teacherIds:
      (data["teacherIds"] as string[] | undefined) ??
      (existing?.["teacherIds"] as string[] | undefined) ??
      [],
    publishedAt:
      targetStatus === "published"
        ? now
        : ((existing?.["publishedAt"] as string | null | undefined) ?? null),
    archivedAt: isDelete ? now : ((existing?.["archivedAt"] as string | null | undefined) ?? null),
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
  const existing = input.id ? await ctx.repos.storyPoints.get(tenantId, input.id) : null;
  if (input.id && !existing) fail("NOT_FOUND", "story point not found");
  if (existing && existing["spaceId"] !== input.spaceId) {
    fail("FAILED_PRECONDITION", "story point does not belong to the requested space");
  }

  const mergedTitle =
    (data["title"] as string | undefined) ?? (existing?.["title"] as string | undefined);
  const mergedType =
    (data["type"] as string | undefined) ?? (existing?.["type"] as string | undefined);
  if (!input.id && (mergedTitle === undefined || mergedType === undefined)) {
    fail("VALIDATION_ERROR", "title and type are required to create a story point");
  }

  const { deleted: _deleted, ...mutableData } = data;
  void _deleted;
  const doc: Doc = {
    ...(existing ?? {}),
    ...(input.id ? { id: input.id } : {}),
    ...mutableData,
    spaceId: input.spaceId,
    ...(mergedTitle !== undefined ? { title: mergedTitle } : {}),
    ...(mergedType !== undefined ? { type: mergedType } : {}),
    orderIndex:
      (data["orderIndex"] as number | undefined) ??
      (existing?.["orderIndex"] as number | undefined) ??
      0,
    sections:
      (data["sections"] as unknown[] | undefined) ??
      (existing?.["sections"] as unknown[] | undefined) ??
      [],
    archivedAt: isDelete ? now : ((existing?.["archivedAt"] as string | null | undefined) ?? null),
    createdBy: (existing?.["createdBy"] as string | undefined) ?? ctx.uid,
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
  const existing = input.id ? await ctx.repos.items.get(tenantId, input.id) : null;
  if (input.id && !existing) fail("NOT_FOUND", "item not found");
  if (existing && existing["spaceId"] !== input.spaceId) {
    fail("FAILED_PRECONDITION", "item does not belong to the requested space");
  }

  // Extract the ⚷ answer key, then persist the ANSWER-STRIPPED item (§6.4).
  // Chat-agent assessments are special: their answer key is an explicit private
  // object and partial item updates must retain the previously stored private
  // fields rather than accidentally replacing them with an empty object.
  const isChatAssessment = isChatAssessmentItem(data, existing as Doc | null);
  const existingAnswerKey =
    isChatAssessment && input.id
      ? await getAnswerKeyAt(
          ctx,
          tenantId,
          input.spaceId,
          optStr(existing?.["storyPointId"]) ?? input.storyPointId,
          input.id
        )
      : null;
  const answerKey = isChatAssessment
    ? mergedChatAnswerKey(data, existingAnswerKey)
    : extractAnswerKey(data);
  if (isChatAssessment && !isDelete) {
    if (!answerKey) fail("VALIDATION_ERROR", "chat-agent assessments require an answer key");
    const incomingQuestionData = questionDataFromSave(data);
    const effectiveQuestionData =
      incomingQuestionData["questionType"] === "chat_agent_question"
        ? incomingQuestionData
        : questionDataFromItem(existing as Doc | null);
    await validateChatAssessmentAuthoring(
      ctx,
      tenantId,
      { spaceId: input.spaceId, storyPointId: input.storyPointId },
      data,
      existing as Doc | null,
      effectiveQuestionData,
      answerKey
    );
  }
  const { deleted: _deleted, ...mutableData } = data;
  void _deleted;
  const strippedData = stripContentAnswerFields(mutableData);
  const mergedType =
    (strippedData["type"] as string | undefined) ?? (existing?.["type"] as string | undefined);
  const mergedPayload =
    (strippedData["payload"] as Doc | undefined) ?? (existing?.["payload"] as Doc | undefined);
  if (!input.id && (mergedType === undefined || mergedPayload === undefined)) {
    fail("VALIDATION_ERROR", "type and payload are required to create an item");
  }
  if (mergedType !== undefined && mergedPayload?.["type"] !== mergedType) {
    fail("VALIDATION_ERROR", "item type must match payload.type");
  }

  const doc: Doc = {
    ...(existing ?? {}),
    ...(input.id ? { id: input.id } : {}),
    ...strippedData,
    spaceId: input.spaceId,
    storyPointId: input.storyPointId,
    ...(mergedType !== undefined ? { type: mergedType } : {}),
    ...(mergedPayload !== undefined ? { payload: mergedPayload } : {}),
    // UnifiedItem invariants: required ordering + soft-delete tombstone.
    orderIndex:
      (strippedData["orderIndex"] as number | undefined) ??
      (existing?.["orderIndex"] as number | undefined) ??
      0,
    archivedAt: isDelete ? now : ((existing?.["archivedAt"] as string | null | undefined) ?? null),
    createdBy: (existing?.["createdBy"] as string | undefined) ?? ctx.uid,
    updatedBy: ctx.uid,
  };
  const { id, created } = await ctx.repos.items.upsert(tenantId, doc, now);

  // Write the answer key to the server-only deny-all subcollection.
  if (answerKey && !isDelete) {
    await ctx.repos.answerKeys.put(tenantId, id, {
      ...answerKey,
      id,
      itemId: id,
      tenantId,
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

  const item = await getItemAt(ctx, tenantId, input.spaceId, input.storyPointId, input.itemId);
  if (!item) fail("NOT_FOUND", "item not found");

  // Re-merge the ⚷ answer key — the ONE sanctioned answer-bearing read. The EDIT
  // view is projected against ITS OWN ItemEditViewSchema (UnifiedItem + answerKey):
  // the item body is whitelisted with authoring=true (rubric guidance KEPT), and
  // the answer-bearing fields ride in the whitelisted `answerKey` — never stripped.
  const key = await getAnswerKeyAt(ctx, tenantId, input.spaceId, input.storyPointId, input.itemId);
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
    // The canonical answer-key document id is the item id; keeping it exact
    // means authoring reads mirror service writes and seed verification paths.
    id: optStr(key["id"]) ?? itemId,
    itemId: optStr(key["itemId"]) ?? itemId,
    questionType: QUESTION_TYPE_MAP[qtRaw] ?? "text",
    correctAnswer: key["correctAnswer"],
    acceptableAnswers: Array.isArray(key["acceptableAnswers"])
      ? key["acceptableAnswers"]
      : undefined,
    evaluationGuidance: optStr(key["evaluationGuidance"]),
    modelAnswer: optStr(key["modelAnswer"]),
    privateEvaluationObjectives: Array.isArray(key["privateEvaluationObjectives"])
      ? key["privateEvaluationObjectives"]
      : undefined,
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
  // The leak gate is the CALLABLE, not the role: a list read is ALWAYS a
  // learner-safe, answer-stripped projection. `getItemForEdit` is the sole
  // authoring read that may reveal evaluator metadata, rubric guidance, and
  // private answer-key fields.
  const items = page.items.map((it) => projectItem(it as Doc, false));
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
      id: optStr(e["id"]),
      type: e["type"],
      url: String(e["url"] ?? ""),
      name: optStr(e["name"]),
      mimeType: optStr(e["mimeType"]),
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
  const s = stripContentAnswerFields(item) as Doc;
  // `stripContentAnswerFields` blanks matching `right` values (the answer), so
  // pass the ORIGINAL payload as the source the learner option pool is built from.
  const origPayload = isDoc(item["payload"]) ? (item["payload"] as Doc) : undefined;
  const norm = normalizeItemPayload(s["payload"] as Doc | undefined, s, origPayload);
  const rubricIn = s["rubric"] ?? s["effectiveRubric"];
  const meta = pickDefined(s["meta"], ITEM_META_KEYS);
  // An evaluator override is an authoring/runtime configuration reference, not
  // learner content. Keep it available on authoring reads while structurally
  // excluding it from every learner/list projection.
  if (!authoring && meta) delete meta["evaluatorAgentId"];
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
    meta,
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
  const s = stripContentAnswerFields(sp) as Doc;
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
  const s = stripContentAnswerFields(space) as Doc;
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
    evaluationSettingsId: optStr(s["evaluationSettingsId"]),
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
