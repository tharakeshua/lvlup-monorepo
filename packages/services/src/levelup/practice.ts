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
import { stripEvaluationCost, projectSpaceProgress } from "../shared/projections.js";
import { xrepos } from "../shared/extended-repos.js";
import { autoEvaluateDeterministic, DETERMINISTIC_TYPES } from "./grading.js";
import { applyProgress } from "./progress-updater.js";

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
  text: "short_answer",
  paragraph: "long_answer",
  essay: "long_answer",
};
function normalizeQuestionType(t: string): string {
  const k = String(t).trim();
  return QT_TO_GRADING[k] ?? k;
}

/** Stable hash for the idempotency/dedupe key over a learner answer. */
function answerHash(answer: unknown): string {
  const s = typeof answer === "string" ? answer : JSON.stringify(answer ?? null);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Score one item — deterministic for objective types, AI for subjective. */
async function scoreOne(
  ctx: AuthContext,
  tenantId: string,
  item: Doc,
  itemId: string,
  answer: unknown
): Promise<StoredEvaluation> {
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
  if ((type === "short_answer" || type === "fill_blank") && key) {
    const correct = String(key["correctAnswer"] ?? "")
      .trim()
      .toLowerCase();
    const acceptable = ((key["acceptableAnswers"] as unknown[] | undefined) ?? []).map((a) =>
      String(a).trim().toLowerCase()
    );
    const given = String(answer ?? "")
      .trim()
      .toLowerCase();
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

  // Subjective → AI gateway (cost/quota/key all server-side). Strip cost on the way out.
  // The gateway is `generate(req, ctx: AiCallContext)`: the second arg carries the
  // server clock/tenant/uid the gateway needs for quota + cost-logging.
  // The `answerGrading` prompt requires { question, maxMarks, rubric, answer } — pass
  // them explicitly (a bare { item, answer } leaves the template var `question` unfilled
  // → "missing required variable question"). The ⚷ answer key is NOT sent to the LLM.
  const questionText = String(
    item["content"] ??
      question["text"] ??
      questionData["prompt"] ??
      questionData["text"] ??
      item["title"] ??
      ""
  );
  const ai = await ctx.ai.generate(
    {
      promptKey: "answerGrading",
      operation: "answer.evaluate",
      variables: {
        question: questionText,
        maxMarks: maxScore,
        rubric: JSON.stringify(item["effectiveRubric"] ?? item["rubric"] ?? {}),
        answer: typeof answer === "string" ? answer : JSON.stringify(answer ?? ""),
      },
    },
    { tenantId, uid: ctx.uid, now: ctx.now }
  );
  const raw = (ai.json as Doc | undefined) ?? {};
  const evaluation: StoredEvaluation = {
    score: Number(raw["score"] ?? 0),
    maxScore,
    correctness: Number(raw["correctness"] ?? 0),
    percentage: Number(raw["percentage"] ?? 0),
    strengths: (raw["strengths"] as string[] | undefined) ?? [],
    weaknesses: (raw["weaknesses"] as string[] | undefined) ?? [],
    missingConcepts: (raw["missingConcepts"] as string[] | undefined) ?? [],
  };
  return stripEvaluationCost(evaluation) as StoredEvaluation;
}

// ── evaluateAnswer (ai; persists progress server-side) ────────────────────────
export async function evaluateAnswerService(
  input: ReqOf<"v1.levelup.evaluateAnswer">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.evaluateAnswer">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "answer.evaluate", { spaceId: input.spaceId, tenantId });

  const dedupeKey = `evaluateAnswer:${input.spaceId}:${input.itemId}:${answerHash(input.answer)}`;
  return withIdempotency(ctx, tenantId, dedupeKey, async () => {
    const item = await ctx.repos.items.get(tenantId, input.itemId);
    if (!item) fail("NOT_FOUND", "item not found");

    const evaluation = await scoreOne(ctx, tenantId, item, input.itemId, input.answer);

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

    const evaluation = await scoreOne(ctx, tenantId, item, input.itemId, input.answer);

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
    progress: progress ? projectSpaceProgress(progress as Doc) : null,
  } as unknown as ResOf<"v1.levelup.getSpaceProgress">;
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
  return { progress: progress ?? null } as unknown as ResOf<"v1.levelup.getStoryPointProgress">;
}
