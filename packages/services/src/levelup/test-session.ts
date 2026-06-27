/**
 * Test-session authority services (testsession-progress.md / REVIEW §6.6).
 *
 * The server owns the clock and ordering: `serverDeadline`, `attemptNumber`,
 * `isLatest`, question/visited order. `startTestSession` is idempotent-resumable
 * on (uid, spaceId, storyPointId). `submitTestSession` claims the session by
 * transitioning `in_progress→completed` inside a tx as its FIRST step (the
 * submit-vs-expire single-writer race), batch-loads answer keys, auto-grades
 * deterministic items, flags AI-pending ones, writes progress via the single
 * progress-updater, and returns the result. The client submits ANSWERS only —
 * never scores (CD13/§6.5).
 */
import type { ReqOf, ResOf } from "@levelup/api-contract";
import { authorize, assertTransition } from "@levelup/access";
import type { AuthContext } from "../shared/context.js";
import { requireTenant, fail } from "../shared/context.js";
import type { ProgressItemUpdate } from "../repo-admin/types.js";
import { xrepos } from "../shared/extended-repos.js";
import { autoEvaluateDeterministic, storyPointTypeToSessionType } from "./grading.js";
import { applyProgress } from "./progress-updater.js";

type Doc = Record<string, unknown>;

/** Default session window (overridable per story point). */
const DEFAULT_SESSION_MINUTES = 30;

// ── startTestSession ──────────────────────────────────────────────────────────
export async function startTestSessionService(
  input: ReqOf<"v1.levelup.startTestSession">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.startTestSession">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "testSession.start", { spaceId: input.spaceId, tenantId });

  // Idempotent resume: an existing in_progress session is returned as-is.
  const existing = await ctx.repos.testSessions.list(tenantId, {
    where: {
      userId: ctx.uid,
      spaceId: input.spaceId,
      storyPointId: input.storyPointId,
      status: "in_progress",
    },
    limit: 1,
  });
  if (existing.items.length > 0) {
    return {
      session: existing.items[0],
      resuming: true,
    } as unknown as ResOf<"v1.levelup.startTestSession">;
  }

  const storyPoint = await ctx.repos.storyPoints.get(tenantId, input.storyPointId);
  if (!storyPoint) fail("NOT_FOUND", "story point not found");

  const now = ctx.now();
  const durationMin =
    (storyPoint["durationMinutes"] as number | undefined) ?? DEFAULT_SESSION_MINUTES;
  const serverDeadline = new Date(Date.parse(now) + durationMin * 60 * 1000).toISOString();

  // Compute the prior attempt count for attemptNumber + isLatest authority.
  const priors = await ctx.repos.testSessions.list(tenantId, {
    where: { userId: ctx.uid, spaceId: input.spaceId, storyPointId: input.storyPointId },
    limit: 200,
  });

  // Question set = the story point's items (drives totalQuestions + questionOrder).
  const itemsPage = await ctx.repos.items.list(tenantId, {
    where: { spaceId: input.spaceId, storyPointId: input.storyPointId },
    limit: 200,
  });
  const questionOrder = itemsPage.items.map((it) => (it as Doc)["id"] as string);

  const session: Doc = {
    tenantId,
    userId: ctx.uid,
    spaceId: input.spaceId,
    storyPointId: input.storyPointId,
    sessionType: storyPointTypeToSessionType((storyPoint["type"] as string) ?? "practice"),
    status: "in_progress",
    attemptNumber: priors.items.length + 1,
    isLatest: true,
    // timing
    startedAt: now,
    endedAt: null,
    durationMinutes: durationMin,
    serverDeadline,
    // question tracking (boolean maps are records, not arrays — D6)
    totalQuestions: questionOrder.length,
    answeredQuestions: 0,
    questionOrder,
    visitedQuestions: {},
    markedForReview: {},
    // audit
    submittedAt: null,
    autoSubmitted: false,
    createdAt: now,
    updatedAt: now,
  };
  const { id } = await ctx.repos.testSessions.upsert(tenantId, session, now);

  // Demote prior latest flags.
  await ctx.repos.tx(async (tx) => {
    for (const p of priors.items) {
      if (p["isLatest"]) tx.upsert("testSessions", tenantId, { id: p["id"], isLatest: false });
    }
  });

  return {
    session: { ...session, id },
    resuming: false,
  } as unknown as ResOf<"v1.levelup.startTestSession">;
}

// ── saveTestAnswer (write-through; crash-resume; never optimistic; C21) ───────
export async function saveTestAnswerService(
  input: ReqOf<"v1.levelup.saveTestAnswer">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.saveTestAnswer">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "testSession.submit", { sessionId: input.sessionId, tenantId });

  const session = await ctx.repos.testSessions.get(tenantId, input.sessionId);
  if (!session) fail("NOT_FOUND", "session not found");
  if ((session["userId"] as string) !== ctx.uid) fail("PERMISSION_DENIED", "not your session");

  const now = ctx.now();
  const itemId = input.itemId;

  // 1) Persist the single answer to the submissions/{itemId} subcollection.
  const existingSub = await xrepos(ctx).testSubmissions.get(tenantId, input.sessionId, itemId);
  await ctx.repos.tx(async (tx) => {
    xrepos(ctx).testSubmissions.put(tx, tenantId, input.sessionId, {
      itemId,
      answer: input.answer,
      submittedAt: now,
      ...(input.timeSpentSeconds !== undefined ? { timeSpentSeconds: input.timeSpentSeconds } : {}),
    });
  });

  // 2) Update the session's lightweight tracking maps + answered count.
  const visited = {
    ...((session["visitedQuestions"] as Record<string, boolean> | undefined) ?? {}),
    [itemId]: true,
  };
  const marked = { ...((session["markedForReview"] as Record<string, boolean> | undefined) ?? {}) };
  if (input.markedForReview !== undefined) marked[itemId] = input.markedForReview;
  const prevAnswered = (session["answeredQuestions"] as number | undefined) ?? 0;
  const answeredQuestions = existingSub ? prevAnswered : prevAnswered + 1;
  await ctx.repos.tx(async (tx) => {
    tx.upsert("testSessions", tenantId, {
      id: input.sessionId,
      visitedQuestions: visited,
      markedForReview: marked,
      answeredQuestions,
    });
  });

  return {
    sessionId: input.sessionId,
    itemId,
    saved: true,
    answeredQuestions,
  } as unknown as ResOf<"v1.levelup.saveTestAnswer">;
}

// ── submitTestSession ─────────────────────────────────────────────────────────
export async function submitTestSessionService(
  input: ReqOf<"v1.levelup.submitTestSession">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.submitTestSession">> {
  const tenantId = requireTenant(ctx);
  authorize(ctx, "testSession.submit", { sessionId: input.sessionId, tenantId });

  const session = await ctx.repos.testSessions.get(tenantId, input.sessionId);
  if (!session) fail("NOT_FOUND", "session not found");
  if ((session["userId"] as string) !== ctx.uid) fail("PERMISSION_DENIED", "not your session");

  const currentStatus = (session["status"] as string) ?? "in_progress";

  // Idempotent re-submit: a terminal session returns its already-computed result.
  if (currentStatus !== "in_progress") {
    return { session, progressUpdated: false } as unknown as ResOf<"v1.levelup.submitTestSession">;
  }
  assertTransition("testSession", currentStatus, "completed");

  // 1) Claim the session (single-writer): flip status inside a tx as step one.
  await ctx.repos.tx(async (tx) => {
    tx.upsert("testSessions", tenantId, {
      id: input.sessionId,
      status: "completed",
      autoSubmitted: input.autoSubmitted ?? false,
    });
  });

  // 2) Batch-load the submissions + answer keys, then auto-grade.
  const submissions = await xrepos(ctx).testSubmissions.list(tenantId, input.sessionId);
  const itemUpdates: ProgressItemUpdate[] = [];
  let totalScore = 0;
  let totalMax = 0;
  let aiPending = 0;

  for (const sub of submissions) {
    const itemId = sub["itemId"] as string;
    const type = (sub["itemType"] as string) ?? "short_answer";
    const maxScore = (sub["maxScore"] as number | undefined) ?? 1;
    const key = await ctx.repos.answerKeys.get(tenantId, itemId);
    const { evaluation, aiPending: pending } = autoEvaluateDeterministic(
      type,
      key,
      sub["answer"],
      maxScore
    );
    if (pending) aiPending++;
    totalScore += evaluation.score;
    totalMax += evaluation.maxScore;
    itemUpdates.push({
      storyPointId: session["storyPointId"] as string,
      itemId,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      correct: evaluation.correctness >= 1,
      evaluation: evaluation as unknown as Doc,
    });
    await ctx.repos.tx(async (tx) => {
      xrepos(ctx).testSubmissions.put(tx, tenantId, input.sessionId, {
        ...sub,
        evaluation,
        gradedAt: ctx.now(),
      });
    });
  }

  // 3) Write progress through the SINGLE progress-updater.
  const progressResult = await applyProgress(
    { userId: ctx.uid, spaceId: session["spaceId"] as string, items: itemUpdates },
    ctx
  );

  // 4) Finalize the session doc with the computed score/percentage.
  const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
  const now = ctx.now();
  const finalSession: Doc = {
    ...session,
    id: input.sessionId,
    status: "completed",
    // Mirror the claim-step write (§6.6 — server owns `autoSubmitted`) so the
    // returned ResultView matches the persisted doc a re-submit reads back.
    autoSubmitted: input.autoSubmitted ?? false,
    // DigitalTestSession score fields (canonical names — not totalScore/maxScore).
    pointsEarned: totalScore,
    totalPoints: totalMax,
    percentage,
    submittedAt: now,
    updatedAt: now,
  };
  // `aiPendingCount` is internal bookkeeping (not part of the session doc shape).
  await ctx.repos.testSessions.upsert(tenantId, finalSession, now);

  // 5) If fully graded, enqueue the single "graded" notification (outbox).
  if (aiPending === 0) {
    await ctx.repos.tx(async (tx) => {
      tx.enqueueOutbox(tenantId, {
        type: "test.session.graded",
        tenantId,
        payload: { sessionId: input.sessionId, recipientUid: ctx.uid },
        createdAt: now,
        status: "pending",
        attempts: 0,
      });
    });
  }

  return {
    session: finalSession,
    progressUpdated: progressResult.completed,
  } as unknown as ResOf<"v1.levelup.submitTestSession">;
}

// ── getTestSession ────────────────────────────────────────────────────────────
export async function getTestSessionService(
  input: ReqOf<"v1.levelup.getTestSession">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.getTestSession">> {
  const tenantId = requireTenant(ctx);
  const session = await ctx.repos.testSessions.get(tenantId, input.sessionId);
  if (!session) fail("NOT_FOUND", "session not found");
  if ((session["userId"] as string) !== ctx.uid) {
    authorize(ctx, "progress.read", { sessionId: input.sessionId, tenantId });
  }
  return { session } as unknown as ResOf<"v1.levelup.getTestSession">;
}

// ── listTestSessions ──────────────────────────────────────────────────────────
export async function listTestSessionsService(
  input: ReqOf<"v1.levelup.listTestSessions">,
  ctx: AuthContext
): Promise<ResOf<"v1.levelup.listTestSessions">> {
  const tenantId = requireTenant(ctx);
  const where: Record<string, unknown> = { userId: input.userId ?? ctx.uid };
  if (input.spaceId) where["spaceId"] = input.spaceId;
  if (input.storyPointId) where["storyPointId"] = input.storyPointId;
  if (input.status) where["status"] = input.status;
  if (input.latestOnly) where["isLatest"] = true;
  if ((input.userId ?? ctx.uid) !== ctx.uid) {
    authorize(ctx, "progress.read", { tenantId, studentId: input.userId });
  }
  const page = await ctx.repos.testSessions.list(tenantId, {
    where,
    cursor: input.cursor,
    limit: input.limit ?? 20,
  });
  return {
    items: page.items,
    nextCursor: page.nextCursor,
  } as unknown as ResOf<"v1.levelup.listTestSessions">;
}
