"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitTestSession = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const firestore_2 = require("../utils/firestore");
const auto_evaluate_1 = require("../utils/auto-evaluate");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const progress_updater_1 = require("../utils/progress-updater");
const types_1 = require("../types");
const legacy_docs_1 = require("../contracts/legacy-docs");
const GRACE_PERIOD_MS = 30_000; // 30 seconds grace period
/**
 * Submit a timed test / quiz session.
 *
 * Validates timing, auto-evaluates deterministic questions,
 * triggers AI evaluation for subjective questions, computes scores
 * and detailed analytics (topic, difficulty, section, Bloom's breakdowns).
 */
exports.submitTestSession = (0, https_1.onCall)(
  { region: "asia-south1", timeoutSeconds: 120, cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(request.data, wire_1.SubmitTestSessionRequestSchema);
    if (!data.tenantId || !data.sessionId) {
      throw new https_1.HttpsError("invalid-argument", "tenantId and sessionId are required");
    }
    await (0, auth_1.assertTenantMember)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 30);
    const db = (0, firestore_2.getDb)();
    const sessionRef = db.doc(`tenants/${data.tenantId}/digitalTestSessions/${data.sessionId}`);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      throw new https_1.HttpsError("not-found", "Test session not found");
    }
    const sessionResult = legacy_docs_1.DigitalTestSessionDocSchema.safeParse({
      id: sessionDoc.id,
      ...sessionDoc.data(),
    });
    if (!sessionResult.success) {
      v2_1.logger.error("Invalid DigitalTestSession document", {
        docId: sessionDoc.id,
        errors: sessionResult.error.flatten(),
      });
      throw new https_1.HttpsError("internal", "Data integrity error");
    }
    const session = sessionResult.data;
    // Verify ownership
    if (session.userId !== callerUid) {
      throw new https_1.HttpsError("permission-denied", "Not your test session");
    }
    // Must be in_progress
    if (session.status !== "in_progress") {
      throw new https_1.HttpsError("failed-precondition", `Session is already ${session.status}`);
    }
    // Validate timing for timed tests
    const now = firestore_1.Timestamp.now();
    if (session.sessionType === "timed_test" && session.serverDeadline) {
      // B8 collapse — never call .toMillis() on a doc field directly.
      const deadlineMs = (0, domain_1.toMillis)((0, domain_1.toTimestamp)(session.serverDeadline));
      if (now.toMillis() > deadlineMs + GRACE_PERIOD_MS) {
        throw new https_1.HttpsError(
          "failed-precondition",
          "Submission time exceeds the deadline plus grace period"
        );
      }
    }
    // Load items with answer keys for grading
    const items = await (0, firestore_2.loadItems)(
      data.tenantId,
      session.spaceId,
      session.storyPointId
    );
    const itemMap = new Map(items.map((i) => [i.id, i]));
    // Load answer keys from server-only subcollection (parallelized)
    // Try nested path first (storyPoints subcollection), fallback to flat
    const answerKeyMap = new Map();
    const questionItems = items.filter((i) => i.type === "question");
    const akResults = await Promise.all(
      questionItems.map(async (item) => {
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
        answerKeyMap.set(itemId, snap.docs[0].data());
      }
    }
    // Grade each submission
    let totalPoints = 0;
    let pointsEarned = 0;
    let totalMarks = 0;
    let marksEarned = 0;
    const updatedSubmissions = {};
    const pendingAIItemIds = [];
    for (const [itemId, submission] of Object.entries(session.submissions || {})) {
      const item = itemMap.get(itemId);
      if (!item) continue;
      const sub = submission;
      const itemPoints = item.meta?.totalPoints ?? item.payload?.basePoints ?? 1;
      const itemMarks = item.meta?.maxMarks ?? itemPoints;
      totalPoints += itemPoints;
      totalMarks += itemMarks;
      // Try auto-evaluation first
      const answerKey = answerKeyMap.get(itemId);
      const autoResult = (0, auto_evaluate_1.autoEvaluateSubmission)(item, sub, answerKey);
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
        const questionType = item.payload?.questionType;
        const isAIType = questionType && types_1.AI_EVALUATABLE_TYPES.includes(questionType);
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
        const itemPoints = item.meta?.totalPoints ?? item.payload?.basePoints ?? 1;
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
    const sessionUpdate = {
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
      updatedAt: (0, domain_1.isoNow)(),
    };
    // P1-6: Flag session if there are pending AI evaluations
    if (pendingAIItemIds.length > 0) {
      sessionUpdate.pendingAIEvaluation = true;
      sessionUpdate.pendingAIItemIds = pendingAIItemIds;
    }
    await sessionRef.update(sessionUpdate);
    // Build item entries for the unified progress updater
    const nowMs = Date.now();
    const newItemEntries = {};
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
    await (0, progress_updater_1.recalculateAndWriteProgress)({
      db,
      tenantId: data.tenantId,
      userId: callerUid,
      spaceId: session.spaceId,
      storyPointId: session.storyPointId,
      newItemEntries,
      forceStoryPointComplete: true, // Test submission = storyPoint complete
    });
    v2_1.logger.info(
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
function computeTestAnalytics(submissions, itemMap, sectionMapping) {
  const topicBreakdown = {};
  const bloomsBreakdown = {};
  const difficultyBreakdown = {};
  const sectionBreakdown = {};
  const timePerQuestion = {};
  let totalTime = 0;
  let questionCount = 0;
  for (const [itemId, sub] of Object.entries(submissions)) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    const payload = item.payload;
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
//# sourceMappingURL=submit-test-session.js.map
