/**
 * Immutable-submission evaluation orchestration.
 *
 * This module deliberately knows nothing about a live conversation session or
 * mutable content repositories. It receives one frozen submission, acquires an
 * evaluation lease, invokes Evaluation Core outside the transaction, then asks
 * the submission repository to append the result exactly once.
 */
import type {
  ConversationLease,
  ItemSubmissionDoc,
  ItemSubmissionEvaluation,
  StoredEvaluation,
  UnifiedEvaluationResult,
} from "@levelup/domain";
import type { AuthContext } from "../shared/context.js";
import { fail } from "../shared/context.js";
import { evaluateWithAi } from "../evaluation/evaluate.js";
import type {
  Doc,
  EvaluationOutcome,
  EvaluationRequest,
  TranscriptTurn,
} from "../evaluation/types.js";
import { canonicalHash, isLeaseExpired, makeLease } from "./ids.js";
import { CONVERSATION_LIMITS } from "./policy.js";

export interface EvaluateFrozenSubmissionInput {
  tenantId: string;
  submission: ItemSubmissionDoc;
  /** Stable causal id from finish/hard-limit/recovery, not a transport envelope. */
  ownerRequestId: string;
}

export interface EvaluateFrozenSubmissionResult {
  submission: ItemSubmissionDoc;
  /** True when no provider evaluation was made because durable state was replayed. */
  replayed: boolean;
  /** The submission is durably failed and must wait for a retry/operational review. */
  failed: boolean;
}

type FrozenEvaluationPacket = {
  request: EvaluationRequest;
  callContext: {
    tenantId: string;
    uid: string;
    role: string;
    resourceType: string;
    resourceId: string;
    now: () => string;
    submissionId: string;
    spaceId: string;
    storyPointId: string;
    itemId: string;
    chatSessionId: string;
    usage: {
      actorUserId: string;
      actorRole: string;
      initiatedByUserId: string;
      initiatorRole: string;
      subjectUserId: string;
      billingUserId: string;
      related: Record<string, string>;
    };
  };
  evaluatorPromptVersion: string;
  evaluatorModelPolicyId: "evaluation.quality";
  settings: Doc | null;
};

/**
 * Evaluate a frozen submission once. Evaluation Core failures are made durable
 * through `failEvaluation`; a stale evaluator never gets a chance to overwrite
 * a newer result because commit/fail are lease-fenced by the repository.
 */
export async function evaluateFrozenSubmission(
  input: EvaluateFrozenSubmissionInput,
  ctx: AuthContext
): Promise<EvaluateFrozenSubmissionResult> {
  const now = ctx.now();
  const evaluationOwnerRequestId = `evaluation:${input.ownerRequestId}`;
  const requestedLease = makeLease(
    evaluationOwnerRequestId,
    now,
    CONVERSATION_LIMITS.evaluationLeaseMs
  );
  const claim = await ctx.repos.itemSubmissions.acquireEvaluation({
    tenantId: input.tenantId,
    submissionId: input.submission.id,
    ownerRequestId: evaluationOwnerRequestId,
    lease: requestedLease,
    now,
  });

  if (claim.outcome === "evaluated_replay") {
    return { submission: claim.submission, replayed: true, failed: false };
  }
  if (claim.outcome === "terminal_failure") {
    return { submission: claim.submission, replayed: true, failed: true };
  }

  const activeLease = claim.submission.workflow.evaluationLease;
  if (
    !activeLease ||
    activeLease.ownerRequestId !== evaluationOwnerRequestId ||
    isLeaseExpired(activeLease, now)
  ) {
    fail("CONFLICT", "Evaluation lease was not acquired by this finalization request");
  }
  if (!claim.attempt) fail("INTERNAL_ERROR", "Evaluation claim did not create an audit attempt");

  let packet: FrozenEvaluationPacket;
  let outcome: EvaluationOutcome;
  try {
    packet = buildFrozenEvaluationPacket(claim.submission, input.tenantId, ctx);
    outcome = await evaluateWithAi(ctx.ai, packet.callContext, packet.request);
  } catch (error) {
    return persistEvaluationFailure({
      tenantId: input.tenantId,
      submission: claim.submission,
      attemptId: claim.attempt.id,
      lease: activeLease,
      attemptNumber: claim.attempt.attemptNumber,
      error,
      ctx,
    });
  }

  const evaluatedAt = ctx.now();
  const evaluation = makeSubmissionEvaluation(packet, outcome, evaluatedAt);
  try {
    const submission = await ctx.repos.itemSubmissions.commitEvaluation({
      tenantId: input.tenantId,
      submissionId: claim.submission.id,
      attemptId: claim.attempt.id,
      leaseToken: activeLease.token,
      evaluation,
      now: evaluatedAt,
    });
    return { submission, replayed: false, failed: false };
  } catch (error) {
    // A timed-out/stale worker can lose its lease after the provider returns.
    // Return the authoritative durable document if a successor already advanced
    // it rather than emitting a second provider call or masking the result.
    const latest = await ctx.repos.itemSubmissions.get(input.tenantId, claim.submission.id);
    if (latest) {
      return {
        submission: latest,
        replayed: Boolean(latest.evaluation),
        failed: latest.workflow.status === "grading_failed",
      };
    }
    throw error;
  }
}

/**
 * Convert ONLY frozen submission data into the Evaluation Core request. This
 * guard is intentionally strict: a generic answer key or a runtime/interviewer
 * policy cannot accidentally re-enter the authoritative assessment grader.
 */
export function buildFrozenEvaluationPacket(
  submission: ItemSubmissionDoc,
  tenantId: string,
  ctx: AuthContext
): FrozenEvaluationPacket {
  if (submission.payload.mode !== "agent_assessment") {
    fail("PRECONDITION_FAILED", "Only agent-assessment submissions may be evaluated here");
  }
  if (canonicalHash(submission.payload.transcript) !== submission.payload.transcriptHash) {
    fail("PRECONDITION_FAILED", "Frozen assessment transcript failed its integrity check");
  }
  const snapshot = submission.payload.configurationSnapshot;
  if (
    snapshot.mode !== "agent_assessment" ||
    snapshot.fingerprint !== submission.payload.configurationFingerprint
  ) {
    fail("PRECONDITION_FAILED", "Frozen assessment configuration does not match its submission");
  }
  const evaluatorContext = snapshot.context.evaluatorContext;
  if (!evaluatorContext) {
    fail("PRECONDITION_FAILED", "Assessment submission is missing its frozen evaluator context");
  }
  if (evaluatorContext.evaluatorModelPolicyId !== "evaluation.quality") {
    fail(
      "PRECONDITION_FAILED",
      "Assessment evaluation must use the frozen evaluation.quality policy"
    );
  }

  const question = asDoc(evaluatorContext.question);
  const answerKey = asDoc(evaluatorContext.answerKey);
  if (question["questionType"] !== "chat_agent_question") {
    fail("PRECONDITION_FAILED", "Frozen evaluator question is not a conversational assessment");
  }
  if (answerKey["questionType"] !== "chat_agent_question") {
    fail(
      "PRECONDITION_FAILED",
      "Frozen assessment answer key does not match the conversational question"
    );
  }

  const rubric = cloneDoc(asDoc(evaluatorContext.rubric));
  // The assessment answer key is private server-only evaluator material. Keep
  // it out of all projections but make authored reference data available to the
  // one frozen Evaluation Core prompt.
  if (typeof answerKey["modelAnswer"] === "string")
    rubric["modelAnswer"] = answerKey["modelAnswer"];
  if (typeof answerKey["evaluationGuidance"] === "string") {
    rubric["evaluatorGuidance"] = answerKey["evaluationGuidance"];
  }
  const settings = objectOrNull(evaluatorContext.evaluationSettings);
  const agent = objectOrNull(evaluatorContext.evaluatorAgent);
  const maxScore = frozenMaxScore(question, rubric);
  if (maxScore <= 0) {
    fail("PRECONDITION_FAILED", "Frozen assessment evaluator question has no positive max score");
  }
  const questionText =
    stringValue(question["scenario"]) ??
    stringValue(question["prompt"]) ??
    stringValue(question["text"]) ??
    "";
  if (!questionText) fail("PRECONDITION_FAILED", "Frozen assessment evaluator question is empty");

  const answer = adaptFrozenTranscript(submission.payload.transcript, tenantId);
  const request: EvaluationRequest = {
    question: {
      text: questionText,
      questionType: "chat_agent_question",
      maxScore,
      typeData: cloneDoc(question),
    },
    answer,
    agent,
    rubric,
    settings,
    mode: "batch",
    operation: "conversation.assessment.finalize",
    feature: "levelup.agent_assessment",
    // Never substitute snapshot.runtimeModelPolicyId here.
    modelPolicyId: evaluatorContext.evaluatorModelPolicyId,
  };

  return {
    request,
    callContext: {
      tenantId,
      uid: submission.ownerUid,
      role: ctx.role ?? "system",
      resourceType: "itemSubmission",
      resourceId: submission.id,
      now: ctx.now,
      submissionId: submission.id,
      spaceId: submission.spaceId,
      storyPointId: submission.storyPointId,
      itemId: submission.itemId,
      chatSessionId: submission.sessionId,
      usage: {
        actorUserId: ctx.uid,
        actorRole: ctx.role ?? "system",
        initiatedByUserId: ctx.uid,
        initiatorRole: ctx.role ?? "system",
        subjectUserId: submission.ownerUid,
        billingUserId: submission.ownerUid,
        related: {
          submissionId: submission.id,
          sessionId: submission.sessionId,
          spaceId: submission.spaceId,
          storyPointId: submission.storyPointId,
          itemId: submission.itemId,
        },
      },
    },
    evaluatorPromptVersion: evaluatorContext.evaluatorPromptVersion,
    evaluatorModelPolicyId: evaluatorContext.evaluatorModelPolicyId,
    settings,
  };
}

function adaptFrozenTranscript(
  transcript: ItemSubmissionDoc["payload"]["transcript"],
  tenantId: string
): EvaluationRequest["answer"] {
  const media: Array<{ storagePath: string; mimeType?: string }> = [];
  const turns: TranscriptTurn[] = transcript.map((turn) => {
    const parts: string[] = [];
    for (const block of turn.content) {
      switch (block.type) {
        case "text":
          parts.push(block.text);
          break;
        case "citation":
          // A citation label is learner-visible context; its backing identifier is
          // not prompt prose and never becomes a provider-visible storage path.
          parts.push(`[Citation: ${block.label}]`);
          break;
        case "media": {
          if (!block.storagePath.startsWith(`tenants/${tenantId}/`)) {
            fail("PERMISSION_DENIED", "Frozen assessment media is outside the active tenant");
          }
          const ordinal = media.length + 1;
          media.push({ storagePath: block.storagePath, mimeType: block.mimeType });
          parts.push(`[image:${ordinal}]`);
          break;
        }
      }
    }
    return {
      role: turn.role === "learner" ? "user" : "assistant",
      content: parts.join("\n"),
    };
  });
  return {
    transcript: turns,
    ...(media.length > 0 ? { media } : {}),
    // Deliberately no `observations`: interviewer evidence is audit-only.
  };
}

function makeSubmissionEvaluation(
  packet: FrozenEvaluationPacket,
  outcome: EvaluationOutcome,
  evaluatedAt: string
): ItemSubmissionEvaluation {
  assertOutcomeBounds(outcome);
  const result: UnifiedEvaluationResult = {
    score: outcome.score,
    maxScore: outcome.maxScore,
    correctness: outcome.correctness,
    percentage: outcome.percentage,
    strengths: [...outcome.strengths],
    weaknesses: [...outcome.weaknesses],
    missingConcepts: [...outcome.missingConcepts],
    confidence: outcome.confidence,
    ...(outcome.structuredFeedback
      ? {
          structuredFeedback: Object.fromEntries(
            Object.entries(outcome.structuredFeedback).map(([dimension, items]) => [
              dimension,
              items.map((item) => ({
                ...item,
                severity: storedFeedbackSeverity(item.severity),
                dimension,
              })),
            ])
          ),
        }
      : {}),
    ...(outcome.rubricBreakdown
      ? { rubricBreakdown: outcome.rubricBreakdown.map((item) => ({ ...item })) }
      : {}),
    ...(outcome.summary ? { summary: { ...outcome.summary } } : {}),
    ...(outcome.mistakeClassification
      ? { mistakeClassification: outcome.mistakeClassification as never }
      : {}),
    ...(outcome.tokensUsed !== undefined ? { tokensUsed: outcome.tokensUsed } : {}),
    ...(outcome.costUsd !== undefined ? { costUsd: outcome.costUsd } : {}),
    ...(outcome.dimensionsUsed ? { dimensionsUsed: [...outcome.dimensionsUsed] } : {}),
    gradedAt: evaluatedAt as UnifiedEvaluationResult["gradedAt"],
  };
  const safeResult = toStoredEvaluation(outcome, packet.settings);
  return {
    result,
    safeResult,
    resultHash: canonicalHash(result),
    evaluatorPromptVersion: packet.evaluatorPromptVersion,
    evaluatorModelPolicyId: packet.evaluatorModelPolicyId,
    evaluatedAt: evaluatedAt as ItemSubmissionEvaluation["evaluatedAt"],
  };
}

function toStoredEvaluation(outcome: EvaluationOutcome, settings: Doc | null): StoredEvaluation {
  const displaySettings = asDoc(settings?.["displaySettings"]);
  const showStrengths = displaySettings["showStrengths"] !== false;
  const showKeyTakeaway = displaySettings["showKeyTakeaway"] !== false;
  return {
    score: outcome.score,
    maxScore: outcome.maxScore,
    correctness: outcome.correctness,
    percentage: outcome.percentage,
    strengths: showStrengths ? [...outcome.strengths] : [],
    weaknesses: [...outcome.weaknesses],
    missingConcepts: [...outcome.missingConcepts],
    ...(showKeyTakeaway && outcome.summary ? { summary: { ...outcome.summary } } : {}),
    ...(outcome.mistakeClassification
      ? { mistakeClassification: outcome.mistakeClassification as never }
      : {}),
    ...(outcome.structuredFeedback
      ? {
          structuredFeedback: Object.fromEntries(
            Object.entries(outcome.structuredFeedback).map(([dimension, items]) => [
              dimension,
              items.map((item) => ({
                ...item,
                severity: storedFeedbackSeverity(item.severity),
                dimension,
              })),
            ])
          ),
        }
      : {}),
    ...(outcome.rubricBreakdown
      ? { rubricBreakdown: outcome.rubricBreakdown.map((item) => ({ ...item })) }
      : {}),
    confidence: outcome.confidence,
  } as StoredEvaluation;
}

async function persistEvaluationFailure(input: {
  tenantId: string;
  submission: ItemSubmissionDoc;
  attemptId: string;
  lease: ConversationLease;
  attemptNumber: number;
  error: unknown;
  ctx: AuthContext;
}): Promise<EvaluateFrozenSubmissionResult> {
  const retryable =
    isRetryableEvaluationError(input.error) &&
    input.attemptNumber < CONVERSATION_LIMITS.maxEvaluationAttempts;
  const now = input.ctx.now();
  const submission = await input.ctx.repos.itemSubmissions.failEvaluation({
    tenantId: input.tenantId,
    submissionId: input.submission.id,
    attemptId: input.attemptId,
    leaseToken: input.lease.token,
    error: {
      code: errorCode(input.error),
      retryable,
      safeMessage: retryable
        ? "Assessment evaluation is temporarily unavailable and will retry automatically."
        : "Assessment evaluation needs operational review. Your completed interview is preserved.",
    },
    ...(retryable ? { nextRetryAt: retryAt(now, input.attemptNumber) } : {}),
    now,
  });
  return { submission, replayed: false, failed: true };
}

function assertOutcomeBounds(outcome: EvaluationOutcome): void {
  const numeric = [
    outcome.score,
    outcome.maxScore,
    outcome.correctness,
    outcome.percentage,
    outcome.confidence,
  ];
  if (numeric.some((value) => !Number.isFinite(value))) {
    fail("PRECONDITION_FAILED", "Evaluation result contains a non-finite score");
  }
  if (
    outcome.maxScore <= 0 ||
    outcome.score < 0 ||
    outcome.score > outcome.maxScore ||
    outcome.correctness < 0 ||
    outcome.correctness > 1 ||
    outcome.percentage < 0 ||
    outcome.percentage > 100 ||
    outcome.confidence < 0 ||
    outcome.confidence > 1
  ) {
    fail("PRECONDITION_FAILED", "Evaluation result is outside its frozen score bounds");
  }
  for (const item of outcome.rubricBreakdown ?? []) {
    if (
      !Number.isFinite(item.score) ||
      !Number.isFinite(item.maxScore) ||
      item.score < 0 ||
      item.maxScore < 0 ||
      item.score > item.maxScore
    ) {
      fail("PRECONDITION_FAILED", "Evaluation rubric breakdown is outside its score bounds");
    }
  }
}

function storedFeedbackSeverity(value: string): "critical" | "major" | "minor" {
  return value === "critical" || value === "major" || value === "minor" ? value : "minor";
}

function frozenMaxScore(question: Doc, rubric: Doc): number {
  const direct = firstPositive(question["maxScore"], question["maxMarks"], question["points"]);
  if (direct !== undefined) return direct;
  const holistic = firstPositive(rubric["holisticMaxScore"]);
  if (holistic !== undefined) return holistic;
  const criteria = Array.isArray(rubric["criteria"]) ? (rubric["criteria"] as unknown[]) : [];
  const total = criteria.reduce<number>((sum, raw) => {
    const criterion = asDoc(raw);
    return sum + (firstPositive(criterion["maxScore"], criterion["maxPoints"]) ?? 0);
  }, 0);
  return total;
}

function firstPositive(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function isRetryableEvaluationError(error: unknown): boolean {
  const code = errorCode(error);
  return !new Set([
    "VALIDATION_ERROR",
    "PRECONDITION_FAILED",
    "INVALID_TRANSITION",
    "PERMISSION_DENIED",
    "NOT_FOUND",
    "UNAUTHENTICATED",
  ]).has(code);
}

function errorCode(error: unknown): string {
  return typeof (error as { code?: unknown })?.code === "string"
    ? String((error as { code: string }).code)
    : "EVALUATION_PROVIDER_ERROR";
}

function retryAt(now: string, attemptNumber: number): string {
  const nowMs = Date.parse(now);
  const base = Number.isFinite(nowMs) ? nowMs : Date.now();
  const delayMs = Math.min(15 * 60_000, 30_000 * 2 ** Math.max(0, attemptNumber - 1));
  return new Date(base + delayMs).toISOString();
}

function asDoc(value: unknown): Doc {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Doc) : {};
}

function objectOrNull(value: unknown): Doc | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? cloneDoc(value as Doc)
    : null;
}

function cloneDoc(value: Doc): Doc {
  const output: Doc = {};
  for (const [key, nested] of Object.entries(value)) output[key] = cloneJson(nested);
  return output;
}

function cloneJson(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(cloneJson);
  if (typeof value === "object") return cloneDoc(value as Doc);
  return null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
