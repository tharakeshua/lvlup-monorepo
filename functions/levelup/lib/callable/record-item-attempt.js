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
exports.recordItemAttempt = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const progress_updater_1 = require("../utils/progress-updater");
/**
 * Record an item attempt for non-test items (standard storyPoints, practice, etc.).
 * Updates SpaceProgress with best score tracking via the unified progress updater.
 *
 * Fixes applied:
 * - No pre-increment of attemptsCount/timeSpent — progress-updater handles merging
 * - Passes answer and evaluationData for persistence on revisit
 */
exports.recordItemAttempt = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(request.data, wire_1.RecordItemAttemptRequestSchema);
    if (!data.tenantId || !data.spaceId || !data.storyPointId || !data.itemId) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "tenantId, spaceId, storyPointId, and itemId are required"
      );
    }
    await (0, auth_1.assertTenantMember)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 30);
    const now = Date.now();
    const itemType = data.itemType || "question";
    // Build a fresh item entry — the progress-updater handles merging
    // with existing data (best-score retention, attemptsCount increment).
    // We do NOT read existing progress here to avoid double-counting.
    // NOTE: Firestore rejects undefined values, so only include optional fields when set.
    const itemEntry = {
      itemId: data.itemId,
      storyPointId: data.storyPointId,
      itemType: itemType,
      completed: data.correct || (data.maxScore > 0 && data.score / data.maxScore >= 0.5),
      timeSpent: data.timeSpent ?? 0,
      interactions: 1,
      lastUpdatedAt: now,
      questionData: {
        status: data.correct ? "correct" : data.score > 0 ? "partial" : "incorrect",
        attemptsCount: 1,
        bestScore: data.score,
        pointsEarned: data.score,
        totalPoints: data.maxScore,
        percentage: data.maxScore > 0 ? (data.score / data.maxScore) * 100 : 0,
        solved: data.correct,
      },
    };
    // Only set optional fields when they have values (Firestore rejects undefined)
    if (data.correct) itemEntry.completedAt = now;
    if (data.answer != null) itemEntry.lastAnswer = data.answer;
    if (data.evaluationData) itemEntry.lastEvaluation = data.evaluationData;
    if (data.feedback) itemEntry.feedback = data.feedback;
    // Material-type items: set score and progress
    if (itemType === "material") {
      itemEntry.score = data.score;
      itemEntry.progress = data.correct ? 100 : (data.score / Math.max(data.maxScore, 1)) * 100;
      // Remove questionData for materials
      delete itemEntry.questionData;
    }
    const { totalPointsEarned, overallPercentage } = await (0,
    progress_updater_1.recalculateAndWriteProgress)({
      db: admin.firestore(),
      tenantId: data.tenantId,
      userId: callerUid,
      spaceId: data.spaceId,
      storyPointId: data.storyPointId,
      newItemEntries: { [data.itemId]: itemEntry },
    });
    v2_1.logger.info(
      `Recorded attempt for item ${data.itemId} by user ${callerUid}: ${data.score}/${data.maxScore}`
    );
    return {
      success: true,
      bestScore: data.score,
      attemptsCount: 1,
      totalPointsEarned,
      overallPercentage,
    };
  }
);
//# sourceMappingURL=record-item-attempt.js.map
