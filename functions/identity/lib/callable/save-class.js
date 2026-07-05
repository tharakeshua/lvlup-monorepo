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
exports.saveClass = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * Consolidated endpoint: replaces createClass + updateClass + deleteClass.
 * - No id = create new class
 * - id present = update existing class
 * - data.status = 'deleted' = soft-delete (archives + decrements stats)
 */
exports.saveClass = (0, https_1.onCall)({ region: "asia-south1", cors: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
  const { id, tenantId, data } = (0, utils_1.parseRequest)(
    request.data,
    wire_1.SaveClassRequestSchema
  );
  await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, tenantId);
  await (0, rate_limit_1.enforceRateLimit)(tenantId, callerUid, "write", 30);
  if (!id) {
    // ── CREATE ──
    const tenant = await (0, utils_1.getTenant)(tenantId);
    if (!tenant || tenant.status !== "active") {
      throw new https_1.HttpsError("not-found", "Tenant not found or inactive");
    }
    if (!data.name || !data.grade) {
      throw new https_1.HttpsError("invalid-argument", "Name and grade are required");
    }
    const classRef = admin.firestore().collection(`tenants/${tenantId}/classes`).doc();
    await classRef.set({
      id: classRef.id,
      tenantId,
      name: data.name,
      grade: data.grade,
      section: data.section ?? null,
      academicSessionId: data.academicSessionId ?? null,
      teacherIds: data.teacherIds ?? [],
      studentIds: [],
      studentCount: 0,
      status: "active",
      // B8: timestamps at rest are canonical ISO strings.
      createdAt: (0, domain_1.isoNow)(),
      createdBy: callerUid,
      updatedAt: (0, domain_1.isoNow)(),
      updatedBy: callerUid,
    });
    await admin
      .firestore()
      .doc(`tenants/${tenantId}`)
      .update({
        "stats.totalClasses": firestore_1.FieldValue.increment(1),
        updatedAt: (0, domain_1.isoNow)(),
      });
    v2_1.logger.info(`Created class ${classRef.id} in tenant ${tenantId}`);
    return { id: classRef.id, created: true };
  } else {
    // ── UPDATE (including soft-delete) ──
    const classRef = admin.firestore().doc(`tenants/${tenantId}/classes/${id}`);
    const classDoc = await classRef.get();
    if (!classDoc.exists) {
      throw new https_1.HttpsError("not-found", "Class not found");
    }
    const updates = {
      updatedAt: (0, domain_1.isoNow)(),
      updatedBy: callerUid,
    };
    if (data.name !== undefined) updates.name = data.name;
    if (data.grade !== undefined) updates.grade = data.grade;
    if (data.section !== undefined) updates.section = data.section;
    if (data.academicSessionId !== undefined) updates.academicSessionId = data.academicSessionId;
    if (data.teacherIds !== undefined) updates.teacherIds = data.teacherIds;
    if (data.status !== undefined) updates.status = data.status;
    await classRef.update(updates);
    // If soft-deleting, decrement tenant stats
    const previousStatus = classDoc.data()?.status;
    if (data.status === "deleted" && previousStatus !== "deleted") {
      await admin
        .firestore()
        .doc(`tenants/${tenantId}`)
        .update({
          "stats.totalClasses": firestore_1.FieldValue.increment(-1),
          updatedAt: (0, domain_1.isoNow)(),
        });
    }
    v2_1.logger.info(`Updated class ${id} in tenant ${tenantId}`);
    return { id, created: false };
  }
});
//# sourceMappingURL=save-class.js.map
