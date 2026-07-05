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
exports.saveTeacher = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const domain_1 = require("@levelup/domain");
const legacy_docs_1 = require("../contracts/legacy-docs");
const wire_1 = require("../contracts/wire");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * Consolidated endpoint: replaces createTeacher + updateTeacher + assignTeacherToClass + updateTeacherPermissions.
 * - No id = create new teacher
 * - id present = update (including classIds assignment, permissions, soft-delete)
 */
exports.saveTeacher = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const { id, tenantId, data } = (0, utils_1.parseRequest)(
      request.data,
      wire_1.SaveTeacherRequestSchema
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
      const teacherRef = db.collection(`tenants/${tenantId}/teachers`).doc();
      await teacherRef.set({
        id: teacherRef.id,
        tenantId,
        uid: data.uid,
        subjects: data.subjects ?? [],
        designation: data.designation ?? null,
        classIds: data.classIds ?? [],
        status: "active",
        // B8: timestamps at rest are canonical ISO strings.
        createdAt: (0, domain_1.isoNow)(),
        createdBy: callerUid,
        updatedAt: (0, domain_1.isoNow)(),
        updatedBy: callerUid,
      });
      // Create UserMembership
      const membershipId = `${data.uid}_${tenantId}`;
      const membership = {
        id: membershipId,
        uid: data.uid,
        tenantId,
        tenantCode: tenant.tenantCode,
        role: "teacher",
        status: "active",
        joinSource: "admin_created",
        teacherId: teacherRef.id,
        permissions: {
          ...legacy_docs_1.DEFAULT_TEACHER_PERMISSIONS,
          managedClassIds: data.classIds ?? [],
          ...(data.permissions ?? {}),
        },
        createdAt: (0, domain_1.isoNow)(),
        updatedAt: (0, domain_1.isoNow)(),
      };
      await db.doc(`userMemberships/${membershipId}`).set(membership);
      // Set custom claims
      const claims = (0, utils_1.buildClaimsForMembership)(membership);
      const existingUser = await admin.auth().getUser(data.uid);
      const existingClaims = existingUser.customClaims ?? {};
      await admin.auth().setCustomUserClaims(data.uid, { ...existingClaims, ...claims });
      v2_1.logger.info(`Created teacher ${teacherRef.id} in tenant ${tenantId}`);
      return { id: teacherRef.id, created: true };
    } else {
      // ── UPDATE ──
      const teacherRef = db.doc(`tenants/${tenantId}/teachers/${id}`);
      const teacherDoc = await teacherRef.get();
      if (!teacherDoc.exists) {
        throw new https_1.HttpsError("not-found", "Teacher not found");
      }
      const updates = {
        updatedAt: (0, domain_1.isoNow)(),
        updatedBy: callerUid,
      };
      if (data.subjects !== undefined) updates.subjects = data.subjects;
      if (data.designation !== undefined) updates.designation = data.designation;
      if (data.status !== undefined) updates.status = data.status;
      // Handle classIds reassignment (replaces assignTeacherToClass)
      if (data.classIds !== undefined) {
        const previousClassIds = teacherDoc.data()?.classIds ?? [];
        const newClassIds = data.classIds;
        updates.classIds = newClassIds;
        const added = newClassIds.filter((c) => !previousClassIds.includes(c));
        const removed = previousClassIds.filter((c) => !newClassIds.includes(c));
        // Add teacher to new classes
        for (const classId of added) {
          const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
          await classRef.update({
            teacherIds: firestore_1.FieldValue.arrayUnion(id),
            updatedAt: (0, domain_1.isoNow)(),
          });
        }
        // Remove teacher from old classes
        for (const classId of removed) {
          const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
          await classRef.update({
            teacherIds: firestore_1.FieldValue.arrayRemove(id),
            updatedAt: (0, domain_1.isoNow)(),
          });
        }
      }
      await teacherRef.update(updates);
      // Handle permissions update (replaces updateTeacherPermissions)
      if (data.permissions !== undefined) {
        const teacherData = teacherDoc.data();
        const teacherUid = teacherData.uid;
        const membershipRef = db.doc(`userMemberships/${teacherUid}_${tenantId}`);
        const membershipDoc = await membershipRef.get();
        if (membershipDoc.exists && membershipDoc.data()?.role === "teacher") {
          const currentMembership = membershipDoc.data();
          const currentPerms = currentMembership.permissions ?? {};
          const updatedPerms = {
            ...currentPerms,
            ...data.permissions,
          };
          await membershipRef.update({
            permissions: updatedPerms,
            updatedAt: (0, domain_1.isoNow)(),
          });
          // Refresh claims if classIds changed
          const classIdsChanged =
            JSON.stringify(currentPerms.managedClassIds) !==
            JSON.stringify(updatedPerms.managedClassIds);
          if (classIdsChanged) {
            const updatedMembership = {
              ...currentMembership,
              permissions: updatedPerms,
            };
            // Replaces claims wholesale — preserve isSuperAdmin (DEP-1 bug class).
            const teacherUser = await (0, utils_1.getUser)(teacherUid);
            const claims = (0, utils_1.buildClaimsForMembership)(updatedMembership, {
              isSuperAdmin: teacherUser?.isSuperAdmin === true,
            });
            await admin.auth().setCustomUserClaims(teacherUid, claims);
          }
        }
      }
      v2_1.logger.info(`Updated teacher ${id} in tenant ${tenantId}`);
      return { id, created: false };
    }
  }
);
//# sourceMappingURL=save-teacher.js.map
