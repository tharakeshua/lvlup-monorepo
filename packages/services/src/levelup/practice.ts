/**
 * Single-answer practice paths (testsession-progress.md).
 *
 * `evaluateAnswer` (ai tier): may invoke Gemini through `ctx.ai.generate` for
 * subjective items, persists progress server-side in the SAME call (no second
 * round-trip), and returns the cost-stripped `StoredEvaluation` only. Idempotent
 * on (uid, spaceId, itemId, answerHash). `recordItemAttempt` (CD13): the client
 * sends the raw `answer` only — the server scores deterministically and writes
 * progress via the single progress-updater, returning the authoritative
 * `{progress, completed}` the optimistic recipe reconciles from. Neither accepts a
 * client-supplied score (§6.5).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import type { StoredEvaluation } from "@levelup/domain";
import { authorize } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import { withIdempotency } from "../shared/idempotency.js";
import {
  stripEvaluationCost,
  projectSpaceProgress,
  tsOrNull,
  tsRequired,
} from "../shared/projections.js";
import { xrepos } from "../shared/extended-repos.js";
import { autoEvaluateDeterministic, DETERMINISTIC_TYPES } from "./grading.js";
import { applyProgress } from "./progress-updater.js";
import { resolveLevelupEvaluationConfig } from "../evaluation/resolve.js";
import { evaluateWithAi } from "../evaluation/evaluate.js";
import type { TranscriptTurn } from "../evaluation/types.js";

type Doc = Record<string, unknown>;

/**
 * Normalize a question subtype to the DETERMINISTIC_TYPES vocabulary so grading
 * matches BOTH the legacy authoring names AND the canonical zQuestionType the
 * migrated/canonical content uses (mcaq/true-false/numerical/fill-blanks/jumbled).
 */
const QT_TO_GRADING: Record<string, string> = {
  mcaq: "multi_select",
  msq: "multi_select",
  "multiple-choice": "multiple_choice",
  "true-false": "true_false",
  numerical: "numeric",
  "fill-blanks": "fill_blank",
  "fill-blanks-dd": "fill_blank",
  jumbled: "ordering",
  "group-options": "grouping",
  group_options: "grouping",
  grouping: "grouping",
  text: "short_answer",
  paragraph: "long_answer",
  essay: "long_answer",
};
export function normalizeQuestionType(t: string): string {
  const k = String(t).trim();
  return QT_TO_GRADING[k] ?? k;
}

/**
 * True when an item is configured for AI/rubric evaluation. A scoring rubric —
 * a `scoringMode` (criteria_based / dimension_based / holistic / hybrid) or a
 * non-empty `dimensions`/`criteria` ladder — is an inherently subjective
 * construct owned by the unified evaluator, so such an item must reach the AI
 * pass even when it ALSO carries a server answer key. Mirrors the rubric leg of
 * `resolveLevelupEvaluationConfig` (`item.effectiveRubric ?? item.rubric`).
 */
export function hasAiRubric(item: Record<string, unknown>): boolean {
  const rubric = (item["effectiveRubric"] ?? item["rubric"]) as Record<string, unknown> | undefined;
  if (!rubric || typeof rubric !== "object") return false;
  if (typeof rubric["scoringMode"] === "string" && rubric["scoringMode"]) return true;
  const dims = rubric["dimensions"];
  const crit = rubric["criteria"];
  return (Array.isArray(dims) && dims.length > 0) || (Array.isArray(crit) && crit.length > 0);
}

/**
 * Best-effort MIME type for a captured-media Storage path so the AI gateway can
 * label the attached part. The upload path may not carry a faithful extension
 * (the `answer-sheet` grant stamps audio as `.jpg` — see request-upload-url), so
 * we detect audio extensions when present and otherwise default to `image/jpeg`,
 * mirroring the autograde image-attach convention (extract-questions.ts).
 */
function guessMediaMime(path: string): string {
  const ext = path.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)?.[1] ?? "";
  const AUDIO: Record<string, string> = {
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    aac: "audio/aac",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    opus: "audio/ogg",
    flac: "audio/flac",
    webm: "audio/webm",
  };
  const IMAGE: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    gif: "image/gif",
  };
  return AUDIO[ext] ?? IMAGE[ext] ?? "image/jpeg";
}

/** Stable hash for the idempotency/dedupe key over a learner answer. */
function answerHash(answer: unknown): string {
  const s = typeof answer === "string" ? answer : JSON.stringify(answer ?? null);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Score one item — deterministic for objective types, Evaluation Core (AI) for
 * subjective. Exported so `submitTestSession` grades its AI-pending items
 * through the SAME path (AI-EVALUATION-CORE-PLAN.md Phase 2).
 */
export async function scoreOne(
  ctx: AuthContext,
  tenantId: string,
  item: Doc,
  itemId: string,
  answer: unknown,
  mediaUrls?: string[],
  spaceId?: string,
  mode: "interactive" | "batch" = "interactive",
  /**
   * LLM-tracking attribution context threaded from the callers (evaluateAnswer /
   * recordItemAttempt carry `storyPointId`; submitTestSession carries the
   * `testSessionId`). Both ride the online usage `related` block below.
   */
  opts?: { storyPointId?: string; testSessionId?: string }
): Promise<StoredEvaluation> {
  // The captured-media answer is normalized client-side to `{ text, mediaUrls }`
  // (question-view.tsx) when the learner attaches an image/recording; a plain
  // answer stays a raw string/array. Resolve the scorable TEXT and the attached
  // MEDIA from BOTH shapes: the top-level `mediaUrls` (evaluateAnswer contract
  // field) takes precedence, else the media riding inside the answer object (the
  // recordItemAttempt path, whose strict contract has no top-level mediaUrls).
  const answerObj =
    answer && typeof answer === "object" && !Array.isArray(answer) ? (answer as Doc) : null;
  const answerText = answerObj
    ? String(answerObj["text"] ?? "")
    : typeof answer === "string"
      ? answer
      : JSON.stringify(answer ?? "");
  const media = (
    (mediaUrls && mediaUrls.length > 0
      ? mediaUrls
      : (answerObj?.["mediaUrls"] as string[] | undefined)) ?? []
  )
    // ⚷ Only ever attach media scoped to THIS tenant to the AI grader — a defensive
    // filter mirroring autograde's storage-path tenant-scope check (REVIEW §6.13).
    // media-upload only ever produces `tenants/{tenantId}/…` paths, so legit media
    // passes; a foreign/malformed path is dropped rather than sent to the model.
    .filter((p): p is string => typeof p === "string" && p.startsWith(`tenants/${tenantId}/`));
  // The scorable type is the QUESTION subtype. The item's top-level `type` is the
  // discriminator (`'question'`/`'material'`/…) on a real content item, so when it
  // is a non-question discriminator, read the NESTED `payload.question.type`. When a
  // flat question subtype is set directly on `type` (the in-memory factory shape),
  // use it as-is.
  const payload = (item["payload"] as Doc | undefined) ?? {};
  const question = (payload["question"] as Doc | undefined) ?? {};
  const questionData = (payload["questionData"] as Doc | undefined) ?? {};
  const ITEM_DISCRIMINATORS = new Set([
    "question",
    "material",
    "interactive",
    "assessment",
    "discussion",
    "project",
    "checkpoint",
  ]);
  const rawType = item["type"] as string | undefined;
  // Resolve the scorable subtype across ALL shapes: a flat subtype on `type`, the
  // CANONICAL two-level `payload.questionData.questionType`, a flat `payload.questionType`
  // (migrated), the legacy nested `payload.question.type`, or a flat `item.questionType`.
  // Then normalize legacy↔canonical so the deterministic set matches either vocabulary.
  const type = normalizeQuestionType(
    (rawType && !ITEM_DISCRIMINATORS.has(rawType) ? rawType : undefined) ??
      (questionData["questionType"] as string | undefined) ??
      (payload["questionType"] as string | undefined) ??
      (question["type"] as string | undefined) ??
      (item["questionType"] as string | undefined) ??
      "short_answer"
  );
  // A conversational assessment is finalized exclusively from its immutable
  // conversation submission. Generic practice/test pathways must never accept a
  // transcript or re-evaluate it, or they could create a second score/progress
  // effect outside the lease-fenced finalization workflow.
  if (type === "chat_agent_question") {
    fail(
      "PRECONDITION_FAILED",
      "Conversational assessments must be finalized through finishConversation"
    );
  }
  const maxScore =
    (item["maxScore"] as number | undefined) ?? (question["points"] as number | undefined) ?? 1;
  const key = await ctx.repos.answerKeys.get(tenantId, itemId);

  if (DETERMINISTIC_TYPES.has(type)) {
    return autoEvaluateDeterministic(type, key, answer, maxScore).evaluation;
  }

  // `short_answer`/`fill_blank` with a server answer key are exact/acceptable-match
  // scorable WITHOUT an LLM (the CD13 server-scoring path the optimistic
  // recordItemAttempt relies on; the emulator has no provider key). Fall back to AI
  // only for genuinely-subjective items lacking a deterministic key.
  //
  // …UNLESS the item carries a scoring rubric (`scoringMode`/dimensions/criteria):
  // that marks it AI-graded, so its answer key's `modelAnswer`/`evaluationGuidance`
  // is grader CONTEXT — never an exact-match target. Binary-matching a free-text
  // answer against the model sentence always scores 0 with empty feedback (vc9 P0:
  // a `text` questionType normalizes to `short_answer`, and the AI-lab items ship
  // BOTH a key and a `dimension_based`/`criteria_based` rubric). Skip the shortcut
  // so these reach the unified evaluator below.
  if ((type === "short_answer" || type === "fill_blank") && key && !hasAiRubric(item)) {
    const correct = String(key["correctAnswer"] ?? "")
      .trim()
      .toLowerCase();
    const acceptable = ((key["acceptableAnswers"] as unknown[] | undefined) ?? []).map((a) =>
      String(a).trim().toLowerCase()
    );
    const given = answerText.trim().toLowerCase();
    const isCorrect = given.length > 0 && (given === correct || acceptable.includes(given));
    return {
      score: isCorrect ? maxScore : 0,
      maxScore,
      correctness: isCorrect ? 1 : 0,
      percentage: isCorrect ? 100 : 0,
      strengths: [],
      weaknesses: [],
      missingConcepts: [],
    } as StoredEvaluation;
  }

  // Subjective → Evaluation Core (AI-EVALUATION-CORE-PLAN.md Phase 2): resolve
  // the config triad (evaluator agent → persona, question rubric, evaluation
  // settings → response dimensions) and run ONE unified gateway call. The ⚷
  // answer key stays server-side; the ⚷ rubric secrets legitimately ride the
  // server-side prompt. Cost stripped on the way out.
  const questionText = String(
    item["content"] ??
      question["text"] ??
      questionData["prompt"] ??
      questionData["text"] ??
      item["title"] ??
      ""
  );
  // Attach any captured media as gateway image/audio parts so Gemini actually
  // SEES the learner's image/recording: pass the Storage PATH as `storagePath`
  // and the ai gateway downloads + inlines the bytes (FIX-1 P0-B seam).
  const images = media.map((url) => ({ storagePath: url, mimeType: guessMediaMime(url) }));
  // Chat-agent questions submit their transcript as the answer (registry
  // learner shape `{ transcript: [{role, content}] }`) — evaluate the
  // conversation, not the JSON stringification of it.
  const rawTranscript = answerObj?.["transcript"];
  const transcript: TranscriptTurn[] | undefined = Array.isArray(rawTranscript)
    ? (rawTranscript as Doc[])
        .filter((t) => t && typeof t === "object")
        .map((t) => ({ role: String(t["role"] ?? "user"), content: String(t["content"] ?? "") }))
    : undefined;

  // LLM-tracking feature attribution (LLM-TRACKING-FRAMEWORK-PLAN.md): a
  // transcript-shaped answer is a chat-agent question; a batch score is a timed
  // test-session grade; everything else is interactive practice.
  const feature =
    transcript && transcript.length > 0
      ? "levelup.agent_question"
      : mode === "batch"
        ? "levelup.timed_test"
        : "levelup.practice";
  const storyPointId = opts?.storyPointId;
  const testSessionId = opts?.testSessionId;

  const config = await resolveLevelupEvaluationConfig(ctx, tenantId, spaceId, item);
  const outcome = await evaluateWithAi(
    ctx.ai,
    {
      tenantId,
      uid: ctx.uid,
      role: ctx.role ?? "student",
      resourceType: "item",
      resourceId: itemId,
      now: ctx.now,
      ...(spaceId ? { spaceId } : {}),
      itemId,
      ...(storyPointId ? { storyPointId } : {}),
      ...(testSessionId ? { testSessionId } : {}),
      usage: {
        actorUserId: ctx.uid,
        actorRole: ctx.role ?? "student",
        initiatedByUserId: ctx.uid,
        initiatorRole: ctx.role ?? "student",
        subjectUserId: ctx.uid,
        billingUserId: ctx.uid,
        related: {
          itemId,
          ...(spaceId ? { spaceId } : {}),
          ...(storyPointId ? { storyPointId } : {}),
          ...(testSessionId ? { testSessionId } : {}),
        },
      },
    },
    {
      question: {
        text: questionText,
        questionType: type,
        maxScore,
        typeData: { ...question, ...questionData },
      },
      answer:
        transcript && transcript.length > 0
          ? { transcript }
          : {
              ...(answerText.trim() ? { text: answerText } : {}),
              ...(images.length > 0 ? { media: images } : {}),
            },
      agent: config.agent,
      rubric: config.rubric,
      settings: config.settings,
      mode,
      operation: "answer.evaluate",
      feature,
    }
  );

  const evaluation: StoredEvaluation = {
    score: outcome.score,
    maxScore: outcome.maxScore,
    correctness: outcome.correctness,
    percentage: outcome.percentage,
    strengths: outcome.strengths,
    weaknesses: outcome.weaknesses,
    missingConcepts: outcome.missingConcepts,
    ...(outcome.summary ? { summary: outcome.summary } : {}),
    ...(outcome.mistakeClassification
      ? {
          mistakeClassification:
            outcome.mistakeClassification as StoredEvaluation["mistakeClassification"],
        }
      : {}),
    confidence: outcome.confidence,
    ...(outcome.structuredFeedback
      ? { structuredFeedback: outcome.structuredFeedback as StoredEvaluation["structuredFeedback"] }
      : {}),
    ...(outcome.rubricBreakdown
      ? { rubricBreakdown: outcome.rubricBreakdown as StoredEvaluation["rubricBreakdown"] }
      : {}),
  };
  return stripEvaluationCost(evaluation as unknown as Doc) as StoredEvaluation;
}

// ── evaluateAnswer (ai; persists progress server-side) ────────────────────────
export async function evaluateAnswerService(
  input: ReqOf<"v1.levelup.evaluateAnswer">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.evaluateAnswer">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "answer.evaluate", { spaceId: input.spaceId, tenantId });

  // ⚷ Storage-path tenant scoping for attached media (mirrors autograde
  // uploadAnswerSheets, REVIEW §6.13): reject any path not under this tenant so a
  // client can't smuggle another tenant's media into the AI grading prompt.
  const prefix = `tenants/${tenantId}/`;
  for (const p of input.mediaUrls ?? []) {
    if (!p.startsWith(prefix)) {
      fail("PERMISSION_DENIED", `media path "${p}" is not scoped to tenant ${tenantId}`);
    }
  }

  const dedupeKey = `evaluateAnswer:${input.spaceId}:${input.itemId}:${answerHash(input.answer)}`;
  return withIdempotency(ctx, tenantId, dedupeKey, async () => {
    const item = await ctx.repos.items.get(tenantId, input.itemId);
    if (!item) fail("NOT_FOUND", "item not found");

    const evaluation = await scoreOne(
      ctx,
      tenantId,
      item,
      input.itemId,
      input.answer,
      input.mediaUrls,
      input.spaceId,
      "interactive",
      input.storyPointId ? { storyPointId: input.storyPointId } : undefined
    );

    // Persist progress server-side (no second client call) when story point known.
    let progressRecorded = false;
    if (input.storyPointId) {
      await applyProgress(
        {
          userId: ctx.uid,
          spaceId: input.spaceId,
          items: [
            {
              storyPointId: input.storyPointId,
              itemId: input.itemId,
              score: evaluation.score,
              maxScore: evaluation.maxScore,
              correct: evaluation.correctness >= 1,
              evaluation: evaluation as unknown as Doc,
            },
          ],
        },
        ctx
      );
      progressRecorded = true;
    }
    return { evaluation, progressRecorded } as unknown as ResOf<"v1.levelup.evaluateAnswer">;
  });
}

// ── recordItemAttempt (CD13 — server scores; ✅ optimistic) ───────────────────
export async function recordItemAttemptService(
  input: ReqOf<"v1.levelup.recordItemAttempt">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.recordItemAttempt">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "itemAttempt.record", { spaceId: input.spaceId, tenantId });

  // Domain dedupe key includes the hashed raw answer (never a client attemptNumber).
  const dedupeKey = `recordItemAttempt:${input.spaceId}:${input.storyPointId}:${input.itemId}:${answerHash(input.answer)}`;
  return withIdempotency(ctx, tenantId, dedupeKey, async () => {
    const item = await ctx.repos.items.get(tenantId, input.itemId);
    if (!item) fail("NOT_FOUND", "item not found");

    const evaluation = await scoreOne(
      ctx,
      tenantId,
      item,
      input.itemId,
      input.answer,
      undefined,
      input.spaceId,
      "interactive",
      { storyPointId: input.storyPointId }
    );

    const result = await applyProgress(
      {
        userId: ctx.uid,
        spaceId: input.spaceId,
        items: [
          {
            storyPointId: input.storyPointId,
            itemId: input.itemId,
            score: evaluation.score,
            maxScore: evaluation.maxScore,
            correct: evaluation.correctness >= 1,
            timeSpentMs: input.timeSpent,
            evaluation: evaluation as unknown as Doc,
          },
        ],
      },
      ctx
    );

    return {
      progress: {
        itemId: input.itemId,
        completed: result.completed,
        bestScore: evaluation.score,
        latestScore: evaluation.score,
        percentage: evaluation.percentage,
        solved: evaluation.correctness >= 1,
        evaluation,
      },
      completed: result.completed,
    } as unknown as ResOf<"v1.levelup.recordItemAttempt">;
  });
}

// ── canonical progress contract-views (LVL-1) ─────────────────────────────────
// STRICT KEY WHITELIST against StoryPointProgressDocSchema (`.strict()`): raw doc
// supersets dropped, Firestore-Timestamp-at-rest → canonical ISO, required-
// nullable `completedAt` → null, nested item entries / StoredEvaluations /
// attempt records whitelisted to their strict shapes.

function compactDoc(o: Doc): Doc {
  const out: Doc = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out;
}
const numOr = (v: unknown, fb: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fb;
const intOr = (v: unknown, fb: number): number => Math.trunc(numOr(v, fb));
const optNum = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const optIntU = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : undefined;
const optStrU = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

const ITEM_TYPE_SET = new Set([
  "question",
  "material",
  "interactive",
  "assessment",
  "discussion",
  "project",
  "checkpoint",
]);

/** Whitelist a stored evaluation bag → strict StoredEvaluation (cost never stored here). */
function projectStoredEvaluation(v: unknown): Doc | undefined {
  if (!v || typeof v !== "object") return undefined;
  const e = v as Doc;
  const summary = e["summary"];
  return compactDoc({
    score: numOr(e["score"], 0),
    maxScore: numOr(e["maxScore"], 0),
    correctness: numOr(e["correctness"], 0),
    percentage: numOr(e["percentage"], 0),
    strengths: Array.isArray(e["strengths"]) ? e["strengths"] : [],
    weaknesses: Array.isArray(e["weaknesses"]) ? e["weaknesses"] : [],
    missingConcepts: Array.isArray(e["missingConcepts"]) ? e["missingConcepts"] : [],
    summary:
      summary && typeof summary === "object"
        ? {
            keyTakeaway: String((summary as Doc)["keyTakeaway"] ?? ""),
            overallComment: String((summary as Doc)["overallComment"] ?? ""),
          }
        : typeof summary === "string"
          ? { keyTakeaway: summary, overallComment: summary }
          : undefined,
    mistakeClassification: optStrU(e["mistakeClassification"]),
    // Evaluation-Core enrichments (optional on StoredEvaluationSchema).
    confidence: optNum(e["confidence"]),
    structuredFeedback:
      e["structuredFeedback"] && typeof e["structuredFeedback"] === "object"
        ? (e["structuredFeedback"] as Doc)
        : undefined,
    rubricBreakdown: Array.isArray(e["rubricBreakdown"])
      ? (e["rubricBreakdown"] as Doc[])
      : undefined,
  });
}

/** Whitelist one per-item progress entry → strict ItemProgressEntry. */
function projectItemProgressEntry(key: string, v: unknown, docFallbackTs: unknown[]): Doc {
  const e = (v ?? {}) as Doc;
  const qd = e["questionData"] as Doc | undefined;
  const rawType = optStrU(e["itemType"]);
  return compactDoc({
    itemId: optStrU(e["itemId"]) ?? key,
    // Legacy entries stored the QUESTION subtype here; the view enum is the item
    // discriminator — collapse unknowns to 'question'.
    itemType: rawType && ITEM_TYPE_SET.has(rawType) ? rawType : "question",
    completed: Boolean(e["completed"]),
    completedAt: tsOrNull(e["completedAt"]),
    timeSpent: optNum(e["timeSpent"]),
    interactions: optIntU(e["interactions"]),
    lastUpdatedAt: tsRequired(e["lastUpdatedAt"], e["completedAt"], ...docFallbackTs),
    questionData: qd
      ? compactDoc({
          status: qd["status"] ?? "pending",
          attemptsCount: intOr(qd["attemptsCount"], 0),
          bestScore: optNum(qd["bestScore"]),
          pointsEarned: optNum(qd["pointsEarned"]),
          totalPoints: optNum(qd["totalPoints"]),
          percentage: optNum(qd["percentage"]),
          solved: Boolean(qd["solved"]),
          latestScore: optNum(qd["latestScore"]),
          latestStatus: optStrU(qd["latestStatus"]),
        })
      : undefined,
    progress: optNum(e["progress"]),
    score: optNum(e["score"]),
    feedback: optStrU(e["feedback"]),
    lastAnswer: e["lastAnswer"],
    lastEvaluation: projectStoredEvaluation(e["lastEvaluation"]),
    attempts: Array.isArray(e["attempts"])
      ? (e["attempts"] as unknown[]).map((a, i) => {
          const ad = (a ?? {}) as Doc;
          return compactDoc({
            attemptNumber: intOr(ad["attemptNumber"], i + 1),
            answer: ad["answer"],
            evaluation: projectStoredEvaluation(ad["evaluation"]) ?? {
              score: numOr(ad["score"], 0),
              maxScore: numOr(ad["maxScore"], 0),
              correctness: 0,
              percentage: 0,
              strengths: [],
              weaknesses: [],
              missingConcepts: [],
            },
            score: numOr(ad["score"], 0),
            maxScore: numOr(ad["maxScore"], 0),
            timestamp: tsRequired(ad["timestamp"], e["lastUpdatedAt"], ...docFallbackTs),
          });
        })
      : undefined,
  });
}

/** Project a stored story-point progress doc → strict StoryPointProgressDocView. */
export function toStoryPointProgressDocView(d: Doc, storyPointId: string, now: string): Doc {
  const fallbackTs = [d["updatedAt"], d["completedAt"], d["startedAt"], now];
  // The canonical doc keeps `items` as a record keyed by itemId; some stored/legacy
  // shapes carry an array — key those by each entry's itemId.
  const rawItems = d["items"];
  const itemEntries: Array<[string, unknown]> = Array.isArray(rawItems)
    ? rawItems.map((e, i): [string, unknown] => [String((e as Doc | null)?.["itemId"] ?? i), e])
    : Object.entries((rawItems ?? {}) as Record<string, unknown>);
  const items: Record<string, Doc> = {};
  for (const [k, v] of itemEntries) {
    items[k] = projectItemProgressEntry(k, v, fallbackTs);
  }
  const pe = numOr(d["pointsEarned"], 0);
  const tp = numOr(d["totalPoints"], 0);
  const percentage = numOr(d["percentage"], tp > 0 ? Math.round((pe / tp) * 100) : 0);
  return compactDoc({
    storyPointId: optStrU(d["storyPointId"]) ?? storyPointId,
    status:
      optStrU(d["status"]) ??
      (percentage >= 100 ? "completed" : percentage > 0 ? "in_progress" : "not_started"),
    pointsEarned: pe,
    totalPoints: tp,
    percentage,
    completedItems: intOr(d["completedItems"], 0),
    totalItems: intOr(d["totalItems"], Object.keys(items).length),
    completedAt: tsOrNull(d["completedAt"]),
    updatedAt: tsRequired(...fallbackTs),
    items,
  });
}

// ── getSpaceProgress (shared read; teacher/parent gated) ──────────────────────
export async function getSpaceProgressService(
  input: ReqOf<"v1.levelup.getSpaceProgress">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getSpaceProgress">> {
  const tenantId = requireTenant(ctx);
  const targetUid = input.userId ?? ctx.uid;
  if (targetUid !== ctx.uid) authorize(ctx, "progress.read", { tenantId, studentId: targetUid });
  const progress = await ctx.repos.progress.get(tenantId, targetUid, input.spaceId);
  return {
    progress: progress ? projectSpaceProgress(progress as Doc, ctx.now()) : null,
  } as unknown as ResOf<"v1.levelup.getSpaceProgress">;
}

// ── listSpaceProgressForUser (C17 — paginated per-learner progress list) ──────
export async function listSpaceProgressForUserService(
  input: ReqOf<"v1.levelup.listSpaceProgressForUser">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listSpaceProgressForUser">> {
  const tenantId = requireTenant(ctx);
  // Same gate as getSpaceProgress: own data is free; another learner's data
  // rides the `progress.read` policy with the target as the resource.
  if (input.userId !== ctx.uid) {
    authorize(ctx, "progress.read", { tenantId, studentId: input.userId });
  }
  const filter = input as { userId: string; cursor?: string; limit?: number };
  const page = await ctx.repos.progressDocs.list(tenantId, {
    where: { userId: filter.userId },
    ...(filter.cursor ? { cursor: filter.cursor } : {}),
    limit: filter.limit ?? 20,
  });
  const items = page.items.map((p) => projectSpaceProgress(p as Doc, ctx.now()));
  return {
    items,
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.levelup.listSpaceProgressForUser">;
}

// ── getStoryPointProgress (shared read) ───────────────────────────────────────
export async function getStoryPointProgressService(
  input: ReqOf<"v1.levelup.getStoryPointProgress">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getStoryPointProgress">> {
  const tenantId = requireTenant(ctx);
  const targetUid = input.userId ?? ctx.uid;
  if (targetUid !== ctx.uid) authorize(ctx, "progress.read", { tenantId, studentId: targetUid });
  const progress = await xrepos(ctx).storyPointProgress.get(
    tenantId,
    targetUid,
    input.spaceId,
    input.storyPointId
  );
  return {
    progress: progress
      ? toStoryPointProgressDocView(progress as Doc, input.storyPointId, ctx.now())
      : null,
  } as unknown as ResOf<"v1.levelup.getStoryPointProgress">;
}
