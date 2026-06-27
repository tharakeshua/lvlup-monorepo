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
exports.saveRubricPreset = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const auth_1 = require("../utils/auth");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * Create, update, or delete a rubric preset.
 * Save* pattern: id absent = create, id present = update,
 * data.deleted = true = soft delete.
 */
exports.saveRubricPreset = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = (0, auth_1.assertAuth)(request.auth);
    const data = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.SaveRubricPresetRequestSchema
    );
    if (!data.tenantId) {
      throw new https_1.HttpsError("invalid-argument", "tenantId is required");
    }
    await (0, auth_1.assertTeacherOrAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 30);
    const db = admin.firestore();
    const collPath = `tenants/${data.tenantId}/rubricPresets`;
    // DELETE
    if (data.id && data.data.deleted) {
      const existing = await db.doc(`${collPath}/${data.id}`).get();
      if (existing.exists && existing.data()?.isDefault) {
        throw new https_1.HttpsError("failed-precondition", "Cannot delete default presets");
      }
      await db.doc(`${collPath}/${data.id}`).delete();
      v2_1.logger.info(`Deleted rubric preset ${data.id}`);
      return { id: data.id, deleted: true };
    }
    // UPDATE
    if (data.id) {
      const ref = db.doc(`${collPath}/${data.id}`);
      const existing = await ref.get();
      if (!existing.exists) {
        throw new https_1.HttpsError("not-found", "Rubric preset not found");
      }
      const updateData = {
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
      };
      const fields = ["name", "description", "rubric", "category", "questionTypes"];
      for (const field of fields) {
        if (data.data[field] !== undefined) {
          updateData[field] = data.data[field];
        }
      }
      await ref.update(updateData);
      v2_1.logger.info(`Updated rubric preset ${data.id}`);
      return { id: data.id, created: false };
    }
    // CREATE
    if (!data.data.name || !data.data.rubric) {
      throw new https_1.HttpsError(
        "invalid-argument",
        "name and rubric are required for new presets"
      );
    }
    const ref = db.collection(collPath).doc();
    await ref.set({
      id: ref.id,
      tenantId: data.tenantId,
      name: data.data.name,
      description: data.data.description ?? "",
      rubric: data.data.rubric,
      category: data.data.category ?? "custom",
      questionTypes: data.data.questionTypes ?? [],
      isDefault: false,
      createdBy: callerUid,
      createdAt: firestore_1.FieldValue.serverTimestamp(),
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    v2_1.logger.info(`Created rubric preset ${ref.id}`);
    return { id: ref.id, created: true };
  }
);
//# sourceMappingURL=save-rubric-preset.js.map
