import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTenantMember } from "../utils/auth";
import { loadSpace, loadStoryPoint, loadItems } from "../utils/firestore";
import { shuffleArray } from "../utils/helpers";
import { isoNow, toMillis, toTimestamp } from "@levelup/domain";
import { StartTestSessionRequestSchema } from "../contracts/wire";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import type { UnifiedItem, QuestionPayload } from "../types";

/**
 * Start a new timed test / quiz session.
 *
 * Creates a DigitalTestSession with:
 * - Server timestamp for startedAt
 * - Precomputed serverDeadline
 * - Shuffled question order (if configured)
 * - Section mapping (itemId → sectionId)
 * - Adaptive difficulty ordering (if enabled)
 * - Max attempts enforcement
 */
export const startTestSession = onCall({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = assertAuth(request.auth);
  const data = parseRequest(request.data, StartTestSessionRequestSchema);

  if (!data.tenantId || !data.spaceId || !data.storyPointId) {
    throw new HttpsError("invalid-argument", "tenantId, spaceId, and storyPointId are required");
  }

  await assertTenantMember(callerUid, data.tenantId);
  await enforceRateLimit(data.tenantId, callerUid, "write", 30);

  const space = await loadSpace(data.tenantId, data.spaceId);
  if (space.status !== "published") {
    throw new HttpsError("failed-precondition", "Space is not published");
  }

  const storyPoint = await loadStoryPoint(data.tenantId, data.spaceId, data.storyPointId);

  // ── Schedule enforcement ───────────────────────────────────────────────
  const schedule = storyPoint.assessmentConfig?.schedule;
  if (schedule) {
    const nowMs = Date.now();
    // B8: schedule fields may be Firestore Timestamps or ISO strings — collapse.
    const startAtMs = schedule.startAt ? toMillis(toTimestamp(schedule.startAt)) : undefined;
    const endAtMs = schedule.endAt ? toMillis(toTimestamp(schedule.endAt)) : undefined;
    if (startAtMs !== undefined && startAtMs > nowMs) {
      throw new HttpsError(
        "failed-precondition",
        `This test is not available yet. It opens on ${new Date(startAtMs).toLocaleString()}.`
      );
    }
    if (endAtMs !== undefined && endAtMs < nowMs) {
      throw new HttpsError(
        "failed-precondition",
        "This test is no longer available. The submission window has closed."
      );
    }
  }

  // Determine session type
  const sessionType =
    storyPoint.type === "timed_test" || storyPoint.type === "test"
      ? "timed_test"
      : storyPoint.type === "quiz"
        ? "quiz"
        : "practice";

  const durationMinutes = storyPoint.assessmentConfig?.durationMinutes ?? 0;
  if (sessionType === "timed_test" && durationMinutes <= 0) {
    throw new HttpsError("failed-precondition", "Timed test must have a duration configured");
  }

  const db = admin.firestore();

  // Check max attempts
  const maxAttempts = storyPoint.assessmentConfig?.maxAttempts ?? 0;
  const existingSessions = await db
    .collection(`tenants/${data.tenantId}/digitalTestSessions`)
    .where("userId", "==", callerUid)
    .where("storyPointId", "==", data.storyPointId)
    .get();

  const completedAttempts = existingSessions.docs.filter((d) => {
    const status = d.data().status;
    return status === "completed" || status === "expired";
  }).length;

  if (maxAttempts > 0 && completedAttempts >= maxAttempts) {
    throw new HttpsError("failed-precondition", `Maximum attempts (${maxAttempts}) reached`);
  }

  // ── Retry cooldown & passing lock enforcement ───────────────────────
  const retryConfig = storyPoint.assessmentConfig?.retryConfig;
  if (retryConfig && completedAttempts > 0) {
    const completedDocs = existingSessions.docs
      .filter((d) => {
        const s = d.data().status;
        return s === "completed" || s === "expired";
      })
      .sort((a, b) => {
        // B8 collapse — endedAt stays a Timestamp at rest today, but never
        // call .toMillis() on a doc field directly (MIGRATION-PATTERN rule 3).
        const aEnd = a.data().endedAt ? toMillis(toTimestamp(a.data().endedAt)) : 0;
        const bEnd = b.data().endedAt ? toMillis(toTimestamp(b.data().endedAt)) : 0;
        return bEnd - aEnd;
      });

    // Lock after passing
    if (retryConfig.lockAfterPassing) {
      const passingPct = storyPoint.assessmentConfig?.passingPercentage ?? 0;
      const hasPassed = completedDocs.some((d) => (d.data().percentage ?? 0) >= passingPct);
      if (hasPassed) {
        throw new HttpsError(
          "failed-precondition",
          "You have already passed this test. No further attempts are allowed."
        );
      }
    }

    // Cooldown period
    if (retryConfig.cooldownMinutes && completedDocs.length > 0) {
      const lastEndedAt = completedDocs[0].data().endedAt;
      if (lastEndedAt) {
        const cooldownEnd =
          toMillis(toTimestamp(lastEndedAt)) + retryConfig.cooldownMinutes * 60 * 1000;
        if (Date.now() < cooldownEnd) {
          const minutesLeft = Math.ceil((cooldownEnd - Date.now()) / 60000);
          throw new HttpsError(
            "failed-precondition",
            `Please wait ${minutesLeft} minute(s) before retrying.`
          );
        }
      }
    }
  }

  // Check for active in-progress session
  const activeSessions = existingSessions.docs.filter((d) => d.data().status === "in_progress");
  if (activeSessions.length > 0) {
    const activeDoc = activeSessions[0];
    const activeSession = activeDoc.data();
    let questionOrder = Array.isArray(activeSession.questionOrder)
      ? (activeSession.questionOrder as string[])
      : [];
    if (questionOrder.length === 0) {
      const items = await loadItems(data.tenantId, data.spaceId, data.storyPointId);
      questionOrder = items
        .filter((i: UnifiedItem) => i.type === "question")
        .map((i: UnifiedItem) => i.id);
      if (questionOrder.length > 0) {
        await activeDoc.ref.update({
          questionOrder,
          totalQuestions: questionOrder.length,
          updatedAt: isoNow(),
        });
      }
    }
    return {
      sessionId: activeSession.id,
      startedAt: activeSession.startedAt,
      serverDeadline: activeSession.serverDeadline,
      questionOrder,
      totalQuestions: questionOrder.length || activeSession.totalQuestions || 0,
      attemptNumber: activeSession.attemptNumber,
      sectionMapping: activeSession.sectionMapping ?? {},
      lastVisitedIndex: activeSession.lastVisitedIndex ?? 0,
      resuming: true,
    };
  }

  // Load items for question order
  const items = await loadItems(data.tenantId, data.spaceId, data.storyPointId);
  const questionItems = items.filter((i: UnifiedItem) => i.type === "question");

  if (questionItems.length === 0) {
    throw new HttpsError("failed-precondition", "No questions found in this story point");
  }

  // Build section mapping (itemId → sectionId)
  const sectionMapping: Record<string, string> = {};
  for (const item of questionItems) {
    if (item.sectionId) {
      sectionMapping[item.id] = item.sectionId;
    }
  }

  // Determine question order
  let questionOrder = questionItems.map((i: UnifiedItem) => i.id);
  const adaptiveConfig = storyPoint.assessmentConfig?.adaptiveConfig;

  if (adaptiveConfig?.enabled) {
    // Adaptive ordering: group by difficulty then order by initial difficulty
    questionOrder = buildAdaptiveOrder(questionItems, adaptiveConfig.initialDifficulty);
  } else if (storyPoint.assessmentConfig?.shuffleQuestions) {
    questionOrder = shuffleArray(questionOrder);
  }

  const attemptNumber = existingSessions.docs.length + 1;
  const now = Timestamp.now();
  const serverDeadline =
    sessionType === "timed_test"
      ? Timestamp.fromMillis(now.toMillis() + durationMinutes * 60 * 1000)
      : null;

  // Mark previous attempts as not latest
  if (existingSessions.docs.length > 0) {
    const batch = db.batch();
    for (const doc of existingSessions.docs) {
      if (doc.data().isLatest) {
        batch.update(doc.ref, { isLatest: false });
      }
    }
    await batch.commit();
  }

  // Create the session
  const sessionRef = db.collection(`tenants/${data.tenantId}/digitalTestSessions`).doc();

  const sessionDoc = {
    id: sessionRef.id,
    tenantId: data.tenantId,
    userId: callerUid,
    spaceId: data.spaceId,
    storyPointId: data.storyPointId,
    sessionType,
    attemptNumber,
    status: "in_progress",
    isLatest: true,
    startedAt: now,
    endedAt: null,
    durationMinutes,
    serverDeadline,
    totalQuestions: questionOrder.length,
    answeredQuestions: 0,
    questionOrder,
    visitedQuestions: {},
    submissions: {},
    markedForReview: {},
    sectionMapping,
    lastVisitedIndex: 0,
    adaptiveState: adaptiveConfig?.enabled
      ? {
          currentDifficulty: adaptiveConfig.initialDifficulty,
          consecutiveCorrect: 0,
          consecutiveIncorrect: 0,
          answeredByDifficulty: { easy: 0, medium: 0, hard: 0 },
        }
      : null,
    currentDifficultyLevel: adaptiveConfig?.enabled ? adaptiveConfig.initialDifficulty : null,
    difficultyProgression: adaptiveConfig?.enabled ? [] : null,
    pointsEarned: null,
    totalPoints: null,
    marksEarned: null,
    totalMarks: null,
    percentage: null,
    analytics: null,
    submittedAt: null,
    autoSubmitted: false,
    createdAt: isoNow(),
    updatedAt: isoNow(),
  };

  await sessionRef.set(sessionDoc);

  logger.info(
    `Started ${sessionType} session ${sessionRef.id} for user ${callerUid} in space ${data.spaceId}`
  );

  return {
    sessionId: sessionRef.id,
    startedAt: now,
    serverDeadline,
    questionOrder,
    totalQuestions: questionOrder.length,
    attemptNumber,
    sectionMapping,
    lastVisitedIndex: 0,
    resuming: false,
  };
});

/**
 * Build adaptive question order: start from initialDifficulty,
 * group questions by difficulty, shuffle within groups.
 */
function buildAdaptiveOrder(
  items: UnifiedItem[],
  initialDifficulty: "easy" | "medium" | "hard"
): string[] {
  const difficultyOrder: Array<"easy" | "medium" | "hard"> =
    initialDifficulty === "easy"
      ? ["easy", "medium", "hard"]
      : initialDifficulty === "hard"
        ? ["hard", "medium", "easy"]
        : ["medium", "easy", "hard"];

  const groups: Record<string, string[]> = { easy: [], medium: [], hard: [] };

  for (const item of items) {
    const payload = item.payload as QuestionPayload;
    const difficulty = payload.difficulty ?? item.difficulty ?? "medium";
    groups[difficulty].push(item.id);
  }

  // Shuffle within each difficulty group
  const ordered: string[] = [];
  for (const diff of difficultyOrder) {
    ordered.push(...shuffleArray(groups[diff]));
  }

  return ordered;
}
