/**
 * Durable conversation finalization.
 *
 * Assessment completion deliberately crosses three independently durable
 * boundaries: immutable submission, immutable evaluation, and the progress
 * application marker.  Each boundary is replay-safe; this service only
 * orchestrates them and never reconstructs an evaluator result itself.
 */
import {
  FinishConversationRequestSchema,
  type FinishConversationRequest,
  type FinishConversationResponse,
} from "@levelup/api-contract";
import type {
  ConversationConfigurationSnapshot,
  ConversationMessage,
  ConversationSessionDoc,
  ItemSubmissionDoc,
  ItemSubmissionPayload,
  ItemSubmissionView,
} from "@levelup/domain";
import type { AuthContext, SystemContext } from "../shared/context.js";
import { fail, requireTenant } from "../shared/context.js";
import { projectChatBump } from "../levelup/levelup-projection.js";
import { canonicalHash, isLeaseExpired, itemSubmissionId, makeLease } from "./ids.js";
import { CONVERSATION_LIMITS } from "./policy.js";
import { projectConversationSession, projectGrading } from "./projections.js";
import { assertConversationOwner } from "./reads.js";
import { evaluateFrozenSubmission } from "./submission-evaluation.js";

export type ConversationFinalizationSource = "learner" | "hard_limit" | "recovery";

export type ContinueConversationFinalizationInput = {
  tenantId: string;
  sessionId: string;
  ownerRequestId: string;
} & (
  | {
      source: "learner";
      ownerUid: string;
      earlyFinishConfirmed?: boolean;
    }
  | { source: "hard_limit" | "recovery" }
);

/** Durable state returned to callable and recovery callers without raw evaluation data. */
export interface ConversationFinalizationState {
  session: ConversationSessionDoc;
  submission?: ItemSubmissionDoc;
  replayed: boolean;
}

/** Public learner finish entry point. T-D registers this exact named export. */
export async function finishConversationService(
  request: FinishConversationRequest,
  ctx: AuthContext
): Promise<FinishConversationResponse> {
  const parsed = FinishConversationRequestSchema.safeParse(request);
  if (!parsed.success) fail("VALIDATION_ERROR", "Invalid finish conversation request");
  const input = parsed.data;
  const tenantId = requireTenant(ctx);
  const existing = await ctx.repos.conversations.getSession(tenantId, input.sessionId);
  if (!existing) fail("NOT_FOUND", "Conversation session was not found");
  assertConversationOwner(existing, ctx);

  const state = await continueConversationFinalization(
    {
      tenantId,
      sessionId: input.sessionId,
      ownerRequestId: input.clientRequestId,
      source: "learner",
      ownerUid: ctx.uid,
      ...(input.earlyFinishConfirmed === true ? { earlyFinishConfirmed: true } : {}),
    },
    ctx
  );
  return projectFinishResponse(state, ctx.now());
}

/**
 * Common hard-limit/recovery path.  It is intentionally public to the
 * tenant-scoped worker but is not a callable: caller-supplied requests can only
 * use the learner source above.
 */
export async function continueConversationFinalization(
  input: ContinueConversationFinalizationInput,
  ctx: AuthContext | SystemContext
): Promise<ConversationFinalizationState> {
  const now = ctx.now();
  const before = await ctx.repos.conversations.getSession(input.tenantId, input.sessionId);
  if (!before) fail("NOT_FOUND", "Conversation session was not found");

  const requestedLease = makeLease(
    input.ownerRequestId,
    now,
    CONVERSATION_LIMITS.finalizationLeaseMs
  );
  let claim;
  try {
    claim = await ctx.repos.conversations.acquireFinalization({
      ...input,
      sessionId: before.id,
      lease: requestedLease,
      now,
    });
  } catch (error) {
    // A concurrent finisher owns the lease.  Do not race it with another
    // provider call: return the current durable workflow state for polling.
    if (serviceErrorCode(error) === "CONFLICT") {
      return readCurrentFinalizationState(ctx, input.tenantId, input.sessionId, true);
    }
    throw error;
  }

  if (claim.outcome === "completed_replay") {
    const submission =
      claim.submission ??
      (claim.session.finalization?.submissionId
        ? await ctx.repos.itemSubmissions.get(
            input.tenantId,
            claim.session.finalization.submissionId
          )
        : null);
    return {
      session: claim.session,
      ...(submission ? { submission } : {}),
      // The simple tutor/question-help port uses this outcome for its first
      // close as well as a true replay; the pre-claim state disambiguates it.
      replayed: before.status === "completed",
    };
  }

  if (claim.outcome === "submission_replay") {
    if (!claim.submission) {
      fail("CONFLICT", "Finalization replay did not include its immutable submission");
    }
    return advanceFrozenSubmission(
      {
        tenantId: input.tenantId,
        session: claim.session,
        submission: claim.submission,
        frozenRevision: claim.frozenRevision,
        ownerRequestId: input.ownerRequestId,
        replayed: true,
      },
      ctx
    );
  }

  if (claim.session.mode !== "agent_assessment") {
    fail("INTERNAL_ERROR", "Only assessments may enter the finalization claim state");
  }
  const finalizationLease = claim.session.finalization?.lease;
  if (
    !finalizationLease ||
    finalizationLease.ownerRequestId !== input.ownerRequestId ||
    isLeaseExpired(finalizationLease, now)
  ) {
    fail("CONFLICT", "Finalization lease was not acquired by this request");
  }

  const payload = await makeFrozenSubmissionPayload(
    {
      tenantId: input.tenantId,
      session: claim.session,
      frozenThroughSequence: claim.frozenThroughSequence,
      now,
    },
    ctx
  );
  let frozen;
  try {
    frozen = await ctx.repos.conversations.freezeSubmission({
      tenantId: input.tenantId,
      sessionId: claim.session.id,
      finalizationLeaseToken: finalizationLease.token,
      submissionId: itemSubmissionId(claim.session.id),
      payload,
      now: ctx.now(),
    });
  } catch (error) {
    // A stale claim can only be repaired from the immutable state that won the
    // race; never rebuild a transcript after this point.
    if (serviceErrorCode(error) === "CONFLICT") {
      return readCurrentFinalizationState(ctx, input.tenantId, input.sessionId, true);
    }
    throw error;
  }

  return advanceFrozenSubmission(
    {
      tenantId: input.tenantId,
      session: frozen.session,
      submission: frozen.submission,
      frozenRevision: claim.frozenRevision,
      ownerRequestId: input.ownerRequestId,
      replayed: frozen.replayed,
    },
    ctx
  );
}

async function advanceFrozenSubmission(
  input: {
    tenantId: string;
    session: ConversationSessionDoc;
    submission: ItemSubmissionDoc;
    frozenRevision: number;
    ownerRequestId: string;
    replayed: boolean;
  },
  ctx: AuthContext | SystemContext
): Promise<ConversationFinalizationState> {
  let evaluated = input.submission;
  let replayed = input.replayed;
  try {
    const evaluation = await evaluateFrozenSubmission(
      {
        tenantId: input.tenantId,
        submission: input.submission,
        ownerRequestId: input.ownerRequestId,
      },
      ctx
    );
    evaluated = evaluation.submission;
    replayed ||= evaluation.replayed;
  } catch (error) {
    // A recovery worker can encounter an unexpired evaluator lease or a retry
    // that is not due.  The durable submission/session are the answer in both
    // cases and another model call would violate exactly-once grading.
    if (isWorkflowDeferral(error)) {
      return readCurrentFinalizationState(ctx, input.tenantId, input.session.id, true);
    }
    throw error;
  }

  if (!evaluated.evaluation || evaluated.workflow.status === "grading_failed") {
    const session = await ctx.repos.conversations.getSession(input.tenantId, input.session.id);
    return { session: session ?? input.session, submission: evaluated, replayed };
  }

  try {
    const progress = await ctx.repos.progress.applySubmission(
      input.tenantId,
      evaluated.id,
      ctx.now()
    );
    replayed ||= !progress.applied;
  } catch (error) {
    // The evaluation is already immutable.  Leave it for recovery to apply the
    // same submission rather than attempting to grade again.
    return readCurrentFinalizationState(ctx, input.tenantId, input.session.id, replayed);
  }

  let completed;
  try {
    completed = await ctx.repos.conversations.completeFinalization({
      tenantId: input.tenantId,
      sessionId: input.session.id,
      submissionId: evaluated.id,
      expectedFrozenRevision: input.frozenRevision,
      expectedTranscriptHash: evaluated.payload.transcriptHash,
      now: ctx.now(),
    });
  } catch (error) {
    // Progress is authoritative now.  A later recovery only repairs the session
    // pointer and safe projection; it must not alter evaluation/progress.
    return readCurrentFinalizationState(ctx, input.tenantId, input.session.id, replayed);
  }

  replayed ||= completed.replayed;
  await projectChatBump(ctx, input.tenantId, {
    userId: completed.session.ownerUid,
    sessionId: completed.session.id,
    lastMessageAt: completed.session.updatedAt,
  }).catch(() => undefined);
  return { session: completed.session, submission: evaluated, replayed };
}

async function makeFrozenSubmissionPayload(
  input: {
    tenantId: string;
    session: ConversationSessionDoc;
    frozenThroughSequence: number;
    now: string;
  },
  ctx: AuthContext | SystemContext
): Promise<ItemSubmissionPayload> {
  const transcript = await readContiguousFrozenTranscript(
    ctx,
    input.tenantId,
    input.session.id,
    input.frozenThroughSequence
  );
  const finalization = input.session.finalization;
  const configurationSnapshot = cloneFrozenConfiguration(input.session.configurationSnapshot);
  return {
    mode: "agent_assessment",
    frozenThroughSequence: input.frozenThroughSequence,
    transcript,
    transcriptHash: canonicalHash(transcript),
    configurationSnapshot,
    configurationFingerprint: configurationSnapshot.fingerprint,
    finalizationReason:
      finalization?.requestedReason === "hard_limit" ? "hard_limit" : "learner_requested",
    earlyFinish: finalization?.earlyFinishConfirmed === true,
    frozenAt: (finalization?.startedAt ?? input.now) as ItemSubmissionPayload["frozenAt"],
  };
}

async function readContiguousFrozenTranscript(
  ctx: AuthContext | SystemContext,
  tenantId: string,
  sessionId: string,
  frozenThroughSequence: number
): Promise<ItemSubmissionPayload["transcript"]> {
  const messages: ConversationMessage[] = [];
  let cursor: string | undefined;
  do {
    const page = await ctx.repos.conversations.listMessages(tenantId, sessionId, {
      ...(cursor ? { cursor } : {}),
      limit: 200,
    });
    messages.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  const bounded = messages
    .filter((message) => message.sequence <= frozenThroughSequence)
    .sort(
      (left, right) =>
        left.sequence - right.sequence || String(left.id).localeCompare(String(right.id))
    );
  if (bounded.length !== frozenThroughSequence) {
    fail("CONFLICT", "Frozen conversation transcript has missing or duplicate sequence numbers");
  }
  const transcript: ItemSubmissionPayload["transcript"] = [];
  for (let index = 0; index < bounded.length; index += 1) {
    const message = bounded[index]!;
    const expectedSequence = index + 1;
    if (message.sequence !== expectedSequence) {
      fail("CONFLICT", "Frozen conversation transcript is not contiguous");
    }
    if (message.role !== "learner" && message.role !== "assistant") {
      fail("CONFLICT", "Frozen conversation transcript contains an unsupported speaker");
    }
    if (message.role === "assistant" && message.deliveryStatus !== "complete") {
      fail("CONFLICT", "Frozen conversation transcript contains an incomplete assistant message");
    }
    transcript.push({
      sequence: message.sequence,
      role: message.role,
      content: cloneJson(message.content),
      createdAt: message.createdAt,
    });
  }
  return transcript;
}

async function readCurrentFinalizationState(
  ctx: AuthContext | SystemContext,
  tenantId: string,
  sessionId: string,
  replayed: boolean
): Promise<ConversationFinalizationState> {
  const session = await ctx.repos.conversations.getSession(tenantId, sessionId);
  if (!session) fail("NOT_FOUND", "Conversation session was not found");
  const submissionId = session.finalization?.submissionId;
  const submission = submissionId
    ? await ctx.repos.itemSubmissions.get(tenantId, submissionId)
    : undefined;
  return { session, ...(submission ? { submission } : {}), replayed };
}

function projectFinishResponse(
  state: ConversationFinalizationState,
  now: string
): FinishConversationResponse {
  return {
    session: projectConversationSession(
      state.session,
      undefined,
      projectGrading(state.session, state.submission, now)
    ),
    ...(state.submission ? { submission: projectSubmission(state.submission) } : {}),
    result: projectFinishResult(state.session, state.submission, now),
    replayed: state.replayed,
  };
}

function projectFinishResult(
  session: ConversationSessionDoc,
  submission: ItemSubmissionDoc | undefined,
  now: string
): FinishConversationResponse["result"] {
  if (session.status === "completed" || session.safeResult) {
    const evaluation = session.safeResult?.evaluation ?? submission?.evaluation?.safeResult;
    return { status: "completed", ...(evaluation ? { evaluation } : {}) };
  }
  if (session.status === "grading_failed" || submission?.workflow.status === "grading_failed") {
    const retryable = submission?.workflow.lastError?.retryable ?? false;
    const retryAfterMs = retryDelay(submission?.workflow.nextRetryAt, now);
    return {
      status: "grading_failed",
      retryable,
      ...(retryable && retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
  }
  return { status: "grading_pending", retryAfterMs: retryDelay(undefined, now) ?? 1_000 };
}

function projectSubmission(submission: ItemSubmissionDoc): ItemSubmissionView {
  return {
    id: submission.id,
    sessionId: submission.sessionId,
    attemptNumber: submission.attemptNumber,
    workflow: {
      status: submission.workflow.status,
      ...(submission.workflow.lastError
        ? { retryable: submission.workflow.lastError.retryable }
        : {}),
      ...(submission.workflow.nextRetryAt ? { nextRetryAt: submission.workflow.nextRetryAt } : {}),
      ...(submission.workflow.progressAppliedAt
        ? { progressAppliedAt: submission.workflow.progressAppliedAt }
        : {}),
    },
    ...(submission.evaluation ? { evaluation: submission.evaluation.safeResult } : {}),
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

function retryDelay(nextRetryAt: string | undefined, now: string): number | undefined {
  if (!nextRetryAt) return undefined;
  const delay = Date.parse(nextRetryAt) - Date.parse(now);
  return Number.isFinite(delay) ? Math.max(1, Math.ceil(delay)) : undefined;
}

function isWorkflowDeferral(error: unknown): boolean {
  const code = serviceErrorCode(error);
  return code === "CONFLICT" || code === "PRECONDITION_FAILED" || code === "INVALID_TRANSITION";
}

function serviceErrorCode(error: unknown): string | undefined {
  return typeof (error as { code?: unknown })?.code === "string"
    ? (error as { code: string }).code
    : undefined;
}

function cloneFrozenConfiguration(
  snapshot: ConversationConfigurationSnapshot
): ConversationConfigurationSnapshot {
  return cloneJson(snapshot);
}

function cloneJson<T>(value: T): T {
  // Domain documents crossing this boundary are already JSON-only. Round-trip
  // cloning both protects the immutable payload from later in-memory mutations
  // and strips accidental undefined properties before canonical hashing.
  return JSON.parse(JSON.stringify(value)) as T;
}
