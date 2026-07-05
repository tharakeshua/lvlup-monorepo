import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { assertAuth, assertTenantMember } from "../utils/auth";
import { getDb, loadItems } from "../utils/firestore";
import { autoEvaluateSubmission } from "../utils/auto-evaluate";
import { isoNow, toMillis, toTimestamp } from "@levelup/domain";
import { SubmitTestSessionRequestSchema } from "../contracts/wire";
import { parseRequest } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { recalculateAndWriteProgress } from "../utils/progress-updater";
import type { StoredItemProgressEntry } from "../utils/progress-updater";
import type { DigitalTestSession, TestSubmission, AnswerKey, QuestionPayload } from "../types";
import type { TestAnalytics, AnalyticsBreakdownEntry, UnifiedItem } from "../types";
import { AI_EVALUATABLE_TYPES } from "../types";
import { DigitalTestSessionDocSchema as DigitalTestSessionSchema } from "../contracts/legacy-docs";

const GRACE_PERIOD_MS = 30_000; // 30 seconds grace period

/**
 * Submit a timed test / quiz session.
 *
 * Validates timing, auto-evaluates deterministic questions,
 * triggers AI evaluation for subjective questions, computes scores
 * and detailed analytics (topic, difficulty, section, Bloom's breakdowns).
 */
export const submitTestSession = onCall(
  { region: "asia-south1", timeoutSeconds: 120, cors: true },
  async (request) => {
    const callerUid = assertAuth(request.auth);
    const data = parseRequest(request.data, SubmitTestSessionRequestSchema);

    if (!data.tenantId || !data.sessionId) {
      throw new HttpsError("invalid-argument", "tenantId and sessionId are required");
    }

    await assertTenantMember(callerUid, data.tenantId);
    await enforceRateLimit(data.tenantId, callerUid, "write", 30);

    const db = getDb();
    const sessionRef = db.doc(`tenants/${data.tenantId}/digitalTestSessions/${data.sessionId}`);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      throw new HttpsError("not-found", "Test session not found");
    }

    const sessionResult = DigitalTestSessionSchema.safeParse({
      id: sessionDoc.id,
      ...sessionDoc.data(),
    });
    if (!sessionResult.success) {
      logger.error("Invalid DigitalTestSession document", {
        docId: sessionDoc.id,
        errors: sessionResult.error.flatten(),
      });
      throw new HttpsError("internal", "Data integrity error");
    }
    const session = sessionResult.data as unknown as DigitalTestSession;

    // Verify ownership
    if (session.userId !== callerUid) {
      throw new HttpsError("permission-denied", "Not your test session");
    }

    // Must be in_progress
    if (session.status !== "in_progress") {
      throw new HttpsError("failed-precondition", `Session is already ${session.status}`);
    }

    // Validate timing for timed tests
    const now = Timestamp.now();
    if (session.sessionType === "timed_test" && session.serverDeadline) {
      // B8 collapse — never call .toMillis() on a doc field directly.
      const deadlineMs = toMillis(toTimestamp(session.serverDeadline));
      if (now.toMillis() > deadlineMs + GRACE_PERIOD_MS) {
        throw new HttpsError(
          "failed-precondition",
          "Submission time exceeds the deadline plus grace period"
        );
      }
    }

    // Load items with answer keys for grading
    const items = await loadItems(data.tenantId, session.spaceId, session.storyPointId);
    const itemMap = new Map(items.map((i: UnifiedItem) => [i.id, i]));

    // Load answer keys from server-only subcollection (parallelized)
    // Try nested path first (storyPoints subcollection), fallback to flat
    const answerKeyMap = new Map<string, AnswerKey>();
    const questionItems = items.filter((i: UnifiedItem) => i.type === "question");
    const akResults = await Promise.all(
      questionItems.map(async (item: UnifiedItem) => {
        // Try nested path first
        let snap = await db
          .collection(
            `tenants/${data.tenantId}/spaces/${session.spaceId}/storyPoints/${session.storyPointId}/items/${item.id}/answerKeys`
          )
          .limit(1)
          .get();
        // Fallback to flat path
        if (snap.empty) {
          snap = await db
            .collection(
              `tenants/${data.tenantId}/spaces/${session.spaceId}/items/${item.id}/answerKeys`
            )
            .limit(1)
            .get();
        }
        return { itemId: item.id, snap };
      })
    );
    for (const { itemId, snap } of akResults) {
      if (!snap.empty) {
        answerKeyMap.set(itemId, snap.docs[0].data() as AnswerKey);
      }
    }

    // Grade each submission
    let totalPoints = 0;
    let pointsEarned = 0;
    let totalMarks = 0;
    let marksEarned = 0;
    const updatedSubmissions: Record<string, TestSubmission> = {};
    const pendingAIItemIds: string[] = [];

    for (const [itemId, submission] of Object.entries(session.submissions || {})) {
      const item = itemMap.get(itemId);
      if (!item) continue;

      const sub = submission as TestSubmission;
      const itemPoints =
        item.meta?.totalPoints ?? (item.payload as QuestionPayload)?.basePoints ?? 1;
      const itemMarks = item.meta?.maxMarks ?? itemPoints;
      totalPoints += itemPoints;
      totalMarks += itemMarks;

      // Try auto-evaluation first
      const answerKey = answerKeyMap.get(itemId);
      const autoResult = autoEvaluateSubmission(item, sub, answerKey);

      if (autoResult) {
        updatedSubmissions[itemId] = {
          ...sub,
          evaluation: autoResult,
          correct: autoResult.correctness >= 1,
          pointsEarned: autoResult.score,
          totalPoints: itemPoints,
        };
        pointsEarned += autoResult.score;
        marksEarned += autoResult.correctness * itemMarks;
      } else {
        // P1-6: AI evaluation needed — mark as pending, exclude from percentage calc
        const questionType = (item.payload as QuestionPayload)?.questionType;
        const isAIType = questionType && AI_EVALUATABLE_TYPES.includes(questionType);

        updatedSubmissions[itemId] = {
          ...sub,
          pointsEarned: 0,
          totalPoints: itemPoints,
        };

        if (isAIType) {
          pendingAIItemIds.push(itemId);
          // Exclude AI-pending items from totalPoints for percentage calculation
          totalPoints -= itemPoints;
          totalMarks -= itemMarks;
        }
      }
    }

    // Also count unanswered questions in total
    for (const item of items) {
      if (item.type === "question" && !session.submissions?.[item.id]) {
        const itemPoints =
          item.meta?.totalPoints ?? (item.payload as QuestionPayload)?.basePoints ?? 1;
        const itemMarks = item.meta?.maxMarks ?? itemPoints;
        totalPoints += itemPoints;
        totalMarks += itemMarks;
      }
    }

    const percentage = totalPoints > 0 ? (pointsEarned / totalPoints) * 100 : 0;

    // Compute enhanced analytics
    const analytics = computeTestAnalytics(
      updatedSubmissions,
      itemMap,
      session.sectionMapping ?? {}
    );

    // Update session
    const sessionUpdate: Record<string, unknown> = {
      status: "completed",
      submissions: updatedSubmissions,
      pointsEarned,
      totalPoints,
      marksEarned: Math.round(marksEarned * 100) / 100,
      totalMarks,
      percentage: Math.round(percentage * 100) / 100,
      analytics,
      submittedAt: now,
      endedAt: now,
      autoSubmitted: data.autoSubmitted ?? false,
      updatedAt: isoNow(),
    };

    // P1-6: Flag session if there are pending AI evaluations
    if (pendingAIItemIds.length > 0) {
      sessionUpdate.pendingAIEvaluation = true;
      sessionUpdate.pendingAIItemIds = pendingAIItemIds;
    }

    await sessionRef.update(sessionUpdate);

    // Build item entries for the unified progress updater
    const nowMs = Date.now();
    const newItemEntries: Record<string, StoredItemProgressEntry> = {};

    for (const [itemId, sub] of Object.entries(updatedSubmissions)) {
      // P1-6: Skip AI-pending items from progress (they have 0 points and would drag down %)
      if (pendingAIItemIds.includes(itemId)) continue;

      const bestScore = sub.pointsEarned ?? 0;
      const maxScore = sub.totalPoints ?? 0;
      // P1-5: Require correct OR at least 50% for partial-credit items
      const completed = (sub.correct ?? false) || (maxScore > 0 && bestScore / maxScore >= 0.5);

      // Build compact evaluation for persistence on revisit
      const evalData = sub.evaluation
        ? {
            score: sub.evaluation.score ?? 0,
            maxScore: sub.evaluation.maxScore ?? maxScore,
            correctness: sub.evaluation.correctness ?? 0,
            percentage: sub.evaluation.percentage ?? 0,
            strengths: sub.evaluation.strengths ?? [],
            weaknesses: sub.evaluation.weaknesses ?? [],
            missingConcepts: sub.evaluation.missingConcepts ?? [],
          }
        : undefined;

      newItemEntries[itemId] = {
        itemId,
        storyPointId: session.storyPointId,
        itemType: "question",
        completed,
        completedAt: completed ? nowMs : undefined,
        lastUpdatedAt: nowMs,
        timeSpent: sub.timeSpentSeconds ?? 0,
        interactions: 1,
        questionData: {
          status: sub.correct ? "correct" : (sub.pointsEarned ?? 0) > 0 ? "partial" : "incorrect",
          attemptsCount: 1,
          bestScore,
          pointsEarned: bestScore,
          totalPoints: maxScore,
          percentage: maxScore > 0 ? (bestScore / maxScore) * 100 : 0,
          solved: sub.correct ?? false,
        },
        // Persist answer and evaluation for revisit display
        lastAnswer: sub.answer,
        lastEvaluation: evalData,
      };
    }

    // Update space progress via unified updater (with transaction + full re-aggregation)
    await recalculateAndWriteProgress({
      db,
      tenantId: data.tenantId,
      userId: callerUid,
      spaceId: session.spaceId,
      storyPointId: session.storyPointId,
      newItemEntries,
      forceStoryPointComplete: true, // Test submission = storyPoint complete
    });

    logger.info(
      `Submitted test session ${data.sessionId}: ${pointsEarned}/${totalPoints} (${percentage.toFixed(1)}%)`
    );

    return {
      success: true,
      pointsEarned,
      totalPoints,
      marksEarned: Math.round(marksEarned * 100) / 100,
      totalMarks,
      percentage: Math.round(percentage * 100) / 100,
    };
  }
);

/**
 * Compute detailed test analytics from submissions.
 */
function computeTestAnalytics(
  submissions: Record<string, TestSubmission>,
  itemMap: Map<string, UnifiedItem>,
  sectionMapping: Record<string, string>
): TestAnalytics {
  const topicBreakdown: Record<string, AnalyticsBreakdownEntry> = {};
  const bloomsBreakdown: Record<string, AnalyticsBreakdownEntry> = {};
  const difficultyBreakdown: Record<string, AnalyticsBreakdownEntry> = {};
  const sectionBreakdown: Record<string, AnalyticsBreakdownEntry> = {};
  const timePerQuestion: Record<string, number> = {};
  let totalTime = 0;
  let questionCount = 0;

  for (const [itemId, sub] of Object.entries(submissions)) {
    const item = itemMap.get(itemId);
    if (!item) continue;

    const payload = item.payload as QuestionPayload;
    const isCorrect = sub.correct ?? false;
    const pts = sub.pointsEarned ?? 0;
    const maxPts = sub.totalPoints ?? 0;

    // Time tracking
    if (sub.timeSpentSeconds > 0) {
      timePerQuestion[itemId] = sub.timeSpentSeconds;
      totalTime += sub.timeSpentSeconds;
      questionCount++;
    }

    // Topic breakdown
    const topics = item.topics ?? [];
    for (const topic of topics) {
      if (!topicBreakdown[topic]) {
        topicBreakdown[topic] = { correct: 0, total: 0, points: 0, maxPoints: 0 };
      }
      topicBreakdown[topic].total++;
      if (isCorrect) topicBreakdown[topic].correct++;
      topicBreakdown[topic].points = (topicBreakdown[topic].points ?? 0) + pts;
      topicBreakdown[topic].maxPoints = (topicBreakdown[topic].maxPoints ?? 0) + maxPts;
    }

    // Difficulty breakdown
    const difficulty = payload.difficulty ?? item.difficulty ?? "medium";
    if (!difficultyBreakdown[difficulty]) {
      difficultyBreakdown[difficulty] = { correct: 0, total: 0, points: 0, maxPoints: 0 };
    }
    difficultyBreakdown[difficulty].total++;
    if (isCorrect) difficultyBreakdown[difficulty].correct++;
    difficultyBreakdown[difficulty].points = (difficultyBreakdown[difficulty].points ?? 0) + pts;
    difficultyBreakdown[difficulty].maxPoints =
      (difficultyBreakdown[difficulty].maxPoints ?? 0) + maxPts;

    // Bloom's level breakdown
    const bloomsLevel = payload.bloomsLevel;
    if (bloomsLevel) {
      if (!bloomsBreakdown[bloomsLevel]) {
        bloomsBreakdown[bloomsLevel] = { correct: 0, total: 0, points: 0, maxPoints: 0 };
      }
      bloomsBreakdown[bloomsLevel].total++;
      if (isCorrect) bloomsBreakdown[bloomsLevel].correct++;
      bloomsBreakdown[bloomsLevel].points = (bloomsBreakdown[bloomsLevel].points ?? 0) + pts;
      bloomsBreakdown[bloomsLevel].maxPoints =
        (bloomsBreakdown[bloomsLevel].maxPoints ?? 0) + maxPts;
    }

    // Section breakdown
    const sectionId = sectionMapping[itemId];
    if (sectionId) {
      if (!sectionBreakdown[sectionId]) {
        sectionBreakdown[sectionId] = { correct: 0, total: 0, points: 0, maxPoints: 0 };
      }
      sectionBreakdown[sectionId].total++;
      if (isCorrect) sectionBreakdown[sectionId].correct++;
      sectionBreakdown[sectionId].points = (sectionBreakdown[sectionId].points ?? 0) + pts;
      sectionBreakdown[sectionId].maxPoints = (sectionBreakdown[sectionId].maxPoints ?? 0) + maxPts;
    }
  }

  return {
    topicBreakdown: Object.keys(topicBreakdown).length > 0 ? topicBreakdown : undefined,
    bloomsBreakdown: Object.keys(bloomsBreakdown).length > 0 ? bloomsBreakdown : undefined,
    difficultyBreakdown:
      Object.keys(difficultyBreakdown).length > 0 ? difficultyBreakdown : undefined,
    sectionBreakdown: Object.keys(sectionBreakdown).length > 0 ? sectionBreakdown : undefined,
    timePerQuestion: Object.keys(timePerQuestion).length > 0 ? timePerQuestion : undefined,
    averageTimePerQuestion: questionCount > 0 ? Math.round(totalTime / questionCount) : undefined,
  };
}
