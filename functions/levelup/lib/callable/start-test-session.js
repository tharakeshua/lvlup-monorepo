"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTestSession = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const firestore_2 = require("../utils/firestore");
const helpers_1 = require("../utils/helpers");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
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
exports.startTestSession = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.StartTestSessionRequestSchema
    );
    if (!data.tenantId || !data.spaceId || !data.storyPointId) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "tenantId, spaceId, and storyPointId are required"
      );
    }
    await (0, auth_1.assertTenantMember)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 30);
    const space = await (0, firestore_2.loadSpace)(data.tenantId, data.spaceId);
    if (space.status !== "published") {
      throw new https_1.HttpsError("failed-precondition", "Space is not published");
    }
    const storyPoint = await (0, firestore_2.loadStoryPoint)(
      data.tenantId,
      data.spaceId,
      data.storyPointId
    );
    // ── Schedule enforcement ───────────────────────────────────────────────
    const schedule = storyPoint.assessmentConfig?.schedule;
    if (schedule) {
      const nowMs = Date.now();
      if (schedule.startAt && schedule.startAt.toMillis() > nowMs) {
        throw new https_1.HttpsError(
          "failed-precondition",
          `This test is not available yet. It opens on ${new Date(schedule.startAt.toMillis()).toLocaleString()}.`
        );
      }
      if (schedule.endAt && schedule.endAt.toMillis() < nowMs) {
        throw new https_1.HttpsError(
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
      throw new https_1.HttpsError(
        "failed-precondition",
        "Timed test must have a duration configured"
      );
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
      throw new https_1.HttpsError(
        "failed-precondition",
        `Maximum attempts (${maxAttempts}) reached`
      );
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
          const aEnd = a.data().endedAt?.toMillis() ?? 0;
          const bEnd = b.data().endedAt?.toMillis() ?? 0;
          return bEnd - aEnd;
        });
      // Lock after passing
      if (retryConfig.lockAfterPassing) {
        const passingPct = storyPoint.assessmentConfig?.passingPercentage ?? 0;
        const hasPassed = completedDocs.some((d) => (d.data().percentage ?? 0) >= passingPct);
        if (hasPassed) {
          throw new https_1.HttpsError(
            "failed-precondition",
            "You have already passed this test. No further attempts are allowed."
          );
        }
      }
      // Cooldown period
      if (retryConfig.cooldownMinutes && completedDocs.length > 0) {
        const lastEndedAt = completedDocs[0].data().endedAt;
        if (lastEndedAt) {
          const cooldownEnd = lastEndedAt.toMillis() + retryConfig.cooldownMinutes * 60 * 1000;
          if (Date.now() < cooldownEnd) {
            const minutesLeft = Math.ceil((cooldownEnd - Date.now()) / 60000);
            throw new https_1.HttpsError(
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
      const activeSession = activeSessions[0].data();
      return {
        sessionId: activeSession.id,
        startedAt: activeSession.startedAt,
        serverDeadline: activeSession.serverDeadline,
        questionOrder: activeSession.questionOrder,
        totalQuestions: activeSession.totalQuestions,
        attemptNumber: activeSession.attemptNumber,
        sectionMapping: activeSession.sectionMapping ?? {},
        lastVisitedIndex: activeSession.lastVisitedIndex ?? 0,
        resuming: true,
      };
    }
    // Load items for question order
    const items = await (0, firestore_2.loadItems)(data.tenantId, data.spaceId, data.storyPointId);
    const questionItems = items.filter((i) => i.type === "question");
    if (questionItems.length === 0) {
      throw new https_1.HttpsError("failed-precondition", "No questions found in this story point");
    }
    // Build section mapping (itemId → sectionId)
    const sectionMapping = {};
    for (const item of questionItems) {
      if (item.sectionId) {
        sectionMapping[item.id] = item.sectionId;
      }
    }
    // Determine question order
    let questionOrder = questionItems.map((i) => i.id);
    const adaptiveConfig = storyPoint.assessmentConfig?.adaptiveConfig;
    if (adaptiveConfig?.enabled) {
      // Adaptive ordering: group by difficulty then order by initial difficulty
      questionOrder = buildAdaptiveOrder(questionItems, adaptiveConfig.initialDifficulty);
    } else if (storyPoint.assessmentConfig?.shuffleQuestions) {
      questionOrder = (0, helpers_1.shuffleArray)(questionOrder);
    }
    const attemptNumber = existingSessions.docs.length + 1;
    const now = firestore_1.Timestamp.now();
    const serverDeadline =
      sessionType === "timed_test"
        ? firestore_1.Timestamp.fromMillis(now.toMillis() + durationMinutes * 60 * 1000)
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
      createdAt: firestore_1.FieldValue.serverTimestamp(),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await sessionRef.set(sessionDoc);
    v2_1.logger.info(
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
  }
);
/**
 * Build adaptive question order: start from initialDifficulty,
 * group questions by difficulty, shuffle within groups.
 */
function buildAdaptiveOrder(items, initialDifficulty) {
  const difficultyOrder =
    initialDifficulty === "easy"
      ? ["easy", "medium", "hard"]
      : initialDifficulty === "hard"
        ? ["hard", "medium", "easy"]
        : ["medium", "easy", "hard"];
  const groups = { easy: [], medium: [], hard: [] };
  for (const item of items) {
    const payload = item.payload;
    const difficulty = payload.difficulty ?? item.difficulty ?? "medium";
    groups[difficulty].push(item.id);
  }
  // Shuffle within each difficulty group
  const ordered = [];
  for (const diff of difficultyOrder) {
    ordered.push(...(0, helpers_1.shuffleArray)(groups[diff]));
  }
  return ordered;
}
//# sourceMappingURL=start-test-session.js.map
