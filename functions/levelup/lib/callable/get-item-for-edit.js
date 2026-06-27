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
exports.getItemForEdit = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const auth_1 = require("../utils/auth");
const firestore_1 = require("../utils/firestore");
const utils_1 = require("../utils");
const idSchema = zod_1.z.string().min(1).max(200);
const RequestSchema = zod_1.z.object({
  tenantId: idSchema,
  spaceId: idSchema,
  storyPointId: idSchema,
  itemId: idSchema,
});
/**
 * getItemForEdit — returns the full UnifiedItem with answer-key data merged
 * back into the payload. Server-side strips answers into a protected
 * `answerKeys` subcollection for timed_test items so students can't see them
 * via Firestore reads. The teacher portal needs the unstripped version when
 * editing — otherwise saving overwrites the answer key with empty values.
 *
 * Auth: teacher or admin only.
 */
exports.getItemForEdit = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const { tenantId, spaceId, storyPointId, itemId } = (0, utils_1.parseRequest)(
      request.data,
      RequestSchema
    );
    await (0, auth_1.assertTeacherOrAdmin)(callerUid, tenantId);
    const item = await (0, firestore_1.loadItem)(tenantId, spaceId, itemId, storyPointId);
    if (item.type !== "question") return { item };
    const db = admin.firestore();
    // Determine the actual item path (nested or flat) so we can find its
    // answerKeys subcollection.
    const nestedItemPath = `tenants/${tenantId}/spaces/${spaceId}/storyPoints/${storyPointId}/items/${itemId}`;
    const flatItemPath = `tenants/${tenantId}/spaces/${spaceId}/items/${itemId}`;
    const nestedSnap = await db.doc(nestedItemPath).get();
    const itemPath = nestedSnap.exists ? nestedItemPath : flatItemPath;
    const akSnap = await db.collection(`${itemPath}/answerKeys`).limit(1).get();
    if (akSnap.empty) return { item };
    const ak = akSnap.docs[0].data();
    const merged = mergeAnswerKey(item, ak);
    return { item: merged };
  }
);
/**
 * Merges answer-key data back into a stripped payload so the teacher editor
 * can show the existing correct answer. Inverse of `stripAnswerFromPayload`.
 */
function mergeAnswerKey(item, ak) {
  const payload = item.payload;
  const qd = payload.questionData;
  if (!qd) return item;
  const merged = { ...qd };
  switch (payload.questionType) {
    case "mcq":
    case "mcaq": {
      const correctIds = ak.correctAnswer ?? [];
      merged.options = (qd.options ?? []).map((o) => ({
        ...o,
        isCorrect: correctIds.includes(o.id),
      }));
      break;
    }
    case "true-false":
      merged.correctAnswer = ak.correctAnswer;
      break;
    case "numerical":
      merged.correctAnswer = ak.correctAnswer;
      if (Array.isArray(ak.acceptableAnswers) && ak.acceptableAnswers[0]) {
        const tol = ak.acceptableAnswers[0].tolerance;
        if (tol != null) merged.tolerance = tol;
      }
      break;
    case "text":
      merged.correctAnswer = ak.correctAnswer;
      if (ak.acceptableAnswers) merged.acceptableAnswers = ak.acceptableAnswers;
      break;
    case "fill-blanks": {
      const akBlanks = ak.correctAnswer ?? [];
      const byId = new Map(akBlanks.map((b) => [b.id, b]));
      merged.blanks = (qd.blanks ?? []).map((b) => {
        const k = byId.get(b.id);
        return k
          ? { ...b, correctAnswer: k.correctAnswer, acceptableAnswers: k.acceptableAnswers }
          : b;
      });
      break;
    }
    case "fill-blanks-dd": {
      const akBlanks = ak.correctAnswer ?? [];
      const byId = new Map(akBlanks.map((b) => [b.id, b]));
      merged.blanks = (qd.blanks ?? []).map((b) => {
        const k = byId.get(b.id);
        return k ? { ...b, correctOptionId: k.correctOptionId } : b;
      });
      break;
    }
    case "matching": {
      // Stored mappings come back via correctAnswer.
      const akPairs = ak.correctAnswer ?? [];
      if (akPairs.length) merged.pairs = akPairs;
      break;
    }
    case "jumbled":
      if (ak.correctAnswer) merged.correctOrder = ak.correctAnswer;
      break;
    case "group-options": {
      const akGroups = ak.correctAnswer ?? [];
      const byId = new Map(akGroups.map((g) => [g.id, g]));
      merged.groups = (qd.groups ?? []).map((g) => {
        const k = byId.get(g.id);
        return k ? { ...g, correctItems: k.correctItems } : g;
      });
      break;
    }
    default:
      // AI-evaluated types — pass through evaluationGuidance / modelAnswer if present
      if (ak.evaluationGuidance) merged.evaluationGuidance = ak.evaluationGuidance;
      if (ak.modelAnswer) merged.modelAnswer = ak.modelAnswer;
      break;
  }
  return {
    ...item,
    payload: { ...payload, questionData: merged },
  };
}
//# sourceMappingURL=get-item-for-edit.js.map
