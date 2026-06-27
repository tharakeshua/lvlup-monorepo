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
exports.saveParent = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * Consolidated endpoint: replaces createParent + linkParentToStudent.
 * - No id = create new parent
 * - id present = update (childStudentIds manages parent-student links)
 */
exports.saveParent = (0, https_1.onCall)({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
  const { id, tenantId, data } = (0, utils_1.parseRequest)(
    request.data,
    shared_types_1.SaveParentRequestSchema
  );
  await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, tenantId);
  await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 30);
  const db = admin.firestore();
  if (!id) {
    // ── CREATE ──
    const tenant = await (0, utils_1.getTenant)(tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new https_1.HttpsError("not-found", "Tenant not found or inactive");
    }
    if (!data.uid) {
      throw new https_1.HttpsError("invalid-argument", "uid is required");
    }
    const parentRef = db.collection(`tenants/${tenantId}/parents`).doc();
    const childStudentIds = data.childStudentIds ?? [];
    await parentRef.set({
      id: parentRef.id,
      tenantId,
      uid: data.uid,
      childStudentIds,
      status: "active",
      createdAt: firestore_1.FieldValue.serverTimestamp(),
      createdBy: callerUid,
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    });
    // Link parent to students (add parentId to each student)
    for (const studentId of childStudentIds) {
      const studentRef = db.doc(`tenants/${tenantId}/students/${studentId}`);
      await studentRef.update({
        parentIds: firestore_1.FieldValue.arrayUnion(parentRef.id),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
      });
    }
    v2_1.logger.info(`Created parent ${parentRef.id} in tenant ${tenantId}`);
    return { id: parentRef.id, created: true };
  } else {
    // ── UPDATE ──
    const parentRef = db.doc(`tenants/${tenantId}/parents/${id}`);
    const parentDoc = await parentRef.get();
    if (!parentDoc.exists) {
      throw new https_1.HttpsError("not-found", "Parent not found");
    }
    const updates = {
      updatedAt: firestore_1.FieldValue.serverTimestamp(),
      updatedBy: callerUid,
    };
    if (data.status !== undefined) updates.status = data.status;
    // Handle childStudentIds changes (replaces linkParentToStudent)
    if (data.childStudentIds !== undefined) {
      const previousChildIds = parentDoc.data()?.childStudentIds ?? [];
      const newChildIds = data.childStudentIds;
      updates.childStudentIds = newChildIds;
      const added = newChildIds.filter((s) => !previousChildIds.includes(s));
      const removed = previousChildIds.filter((s) => !newChildIds.includes(s));
      // Add parentId to newly linked students
      for (const studentId of added) {
        const studentRef = db.doc(`tenants/${tenantId}/students/${studentId}`);
        await studentRef.update({
          parentIds: firestore_1.FieldValue.arrayUnion(id),
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
      }
      // Remove parentId from unlinked students
      for (const studentId of removed) {
        const studentRef = db.doc(`tenants/${tenantId}/students/${studentId}`);
        await studentRef.update({
          parentIds: firestore_1.FieldValue.arrayRemove(id),
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
      }
    }
    await parentRef.update(updates);
    v2_1.logger.info(`Updated parent ${id} in tenant ${tenantId}`);
    return { id, created: false };
  }
});
//# sourceMappingURL=save-parent.js.map
