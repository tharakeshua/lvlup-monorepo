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
exports.importFromBank = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const firestore_2 = require("../utils/firestore");
const legacy_docs_1 = require("../contracts/legacy-docs");
/**
 * Import questions from the question bank into a story point.
 * Creates UnifiedItem copies from QuestionBankItem sources.
 */
exports.importFromBank = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(request.data, wire_1.ImportFromBankRequestSchema);
    if (
      !data.tenantId ||
      !data.spaceId ||
      !data.storyPointId ||
      !data.questionBankItemIds?.length
    ) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "tenantId, spaceId, storyPointId, and questionBankItemIds are required"
      );
    }
    if (data.questionBankItemIds.length > 50) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "Cannot import more than 50 questions at once"
      );
    }
    await (0, auth_1.assertTeacherOrAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 30);
    const db = admin.firestore();
    // Verify story point exists
    await (0, firestore_2.loadStoryPoint)(data.tenantId, data.spaceId, data.storyPointId);
    // Load bank items
    const bankItemRefs = data.questionBankItemIds.map((id) =>
      db.doc(`tenants/${data.tenantId}/questionBank/${id}`)
    );
    const bankItemDocs = await db.getAll(...bankItemRefs);
    // Items are stored at the canonical nested path; flat path is legacy
    // and only consulted to keep orderIndex monotonic if any rows still
    // live there.
    const nestedItemsPath = `tenants/${data.tenantId}/spaces/${data.spaceId}/storyPoints/${data.storyPointId}/items`;
    const flatItemsPath = `tenants/${data.tenantId}/spaces/${data.spaceId}/items`;
    // Get current max orderIndex in story point (consider both paths).
    const [nestedLast, flatLast] = await Promise.all([
      db.collection(nestedItemsPath).orderBy("orderIndex", "desc").limit(1).get(),
      db
        .collection(flatItemsPath)
        .where("storyPointId", "==", data.storyPointId)
        .orderBy("orderIndex", "desc")
        .limit(1)
        .get(),
    ]);
    const nestedMax = nestedLast.empty ? -1 : (nestedLast.docs[0].data().orderIndex ?? -1);
    const flatMax = flatLast.empty ? -1 : (flatLast.docs[0].data().orderIndex ?? -1);
    let orderIndex = Math.max(nestedMax, flatMax) + 1;
    const batch = db.batch();
    const createdIds = [];
    for (const doc of bankItemDocs) {
      if (!doc.exists) continue;
      const bankItemResult = legacy_docs_1.QuestionBankItemDocSchema.safeParse({
        id: doc.id,
        ...doc.data(),
      });
      if (!bankItemResult.success) {
        v2_1.logger.error("Invalid QuestionBankItem document", {
          docId: doc.id,
          errors: bankItemResult.error.flatten(),
        });
        continue; // Skip invalid bank items
      }
      const bankItem = bankItemResult.data;
      const itemRef = db.collection(nestedItemsPath).doc();
      batch.set(itemRef, {
        id: itemRef.id,
        spaceId: data.spaceId,
        storyPointId: data.storyPointId,
        sectionId: data.sectionId ?? null,
        tenantId: data.tenantId,
        type: "question",
        payload: {
          questionType: bankItem.questionType,
          title: bankItem.title,
          content: bankItem.content,
          explanation: bankItem.explanation ?? null,
          basePoints: bankItem.basePoints ?? 1,
          difficulty: bankItem.difficulty,
          bloomsLevel: bankItem.bloomsLevel ?? null,
          questionData: bankItem.questionData,
        },
        title: bankItem.title,
        content: bankItem.content,
        difficulty: bankItem.difficulty,
        topics: bankItem.topics,
        labels: bankItem.tags,
        orderIndex,
        linkedQuestionId: null,
        createdBy: callerUid,
        createdAt: (0, domain_1.isoNow)(),
        updatedAt: (0, domain_1.isoNow)(),
      });
      // Update usage count on bank item
      batch.update(doc.ref, {
        usageCount: firestore_1.FieldValue.increment(1),
        lastUsedAt: (0, domain_1.isoNow)(),
      });
      createdIds.push(itemRef.id);
      orderIndex++;
    }
    await batch.commit();
    v2_1.logger.info(
      `Imported ${createdIds.length} questions from bank into story point ${data.storyPointId}`
    );
    return {
      success: true,
      importedCount: createdIds.length,
      itemIds: createdIds,
    };
  }
);
//# sourceMappingURL=import-from-bank.js.map
