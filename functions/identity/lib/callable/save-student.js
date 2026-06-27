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
exports.saveStudent = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const shared_types_1 = require("@levelup/shared-types");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
/**
 * Consolidated endpoint: replaces createStudent + updateStudent + deleteStudent + assignStudentToClass.
 * - No id = create new student
 * - id present = update existing student (including classIds assignment and soft-delete via status)
 */
exports.saveStudent = (0, https_1.onCall)(
  { region: "asia-south1", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const { id, tenantId, data } = (0, utils_1.parseRequest)(
      request.data,
      shared_types_1.SaveStudentRequestSchema
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
      const studentRef = db.collection(`tenants/${tenantId}/students`).doc();
      const classIds = data.classIds ?? [];
      await studentRef.set({
        id: studentRef.id,
        tenantId,
        uid: data.uid,
        rollNumber: data.rollNumber ?? null,
        section: data.section ?? null,
        classIds,
        parentIds: data.parentIds ?? [],
        grade: data.grade ?? null,
        admissionNumber: data.admissionNumber ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        status: "active",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        createdBy: callerUid,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedBy: callerUid,
      });
      // Create UserMembership
      const membershipId = `${data.uid}_${tenantId}`;
      const membership = {
        id: membershipId,
        uid: data.uid,
        tenantId,
        tenantCode: tenant.tenantCode,
        role: "student",
        status: "active",
        joinSource: "admin_created",
        studentId: studentRef.id,
        permissions: {
          managedClassIds: classIds,
        },
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
      };
      await db.doc(`userMemberships/${membershipId}`).set(membership);
      // Set custom claims — use MembershipClaimsInput to avoid double-cast
      const claimsInput = {
        role: membership.role,
        tenantId: membership.tenantId,
        tenantCode: membership.tenantCode,
        permissions: membership.permissions,
        staffPermissions: undefined,
        teacherId: undefined,
        studentId: membership.studentId,
        parentId: undefined,
        parentLinkedStudentIds: undefined,
        staffId: undefined,
        scannerId: undefined,
      };
      const claims = (0, utils_1.buildClaimsForMembership)(claimsInput);
      const existingUser = await admin.auth().getUser(data.uid);
      const existingClaims = existingUser.customClaims ?? {};
      await admin.auth().setCustomUserClaims(data.uid, { ...existingClaims, ...claims });
      // Add student to each assigned class
      for (const classId of classIds) {
        const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
        await classRef.update({
          studentIds: firestore_1.FieldValue.arrayUnion(studentRef.id),
          studentCount: firestore_1.FieldValue.increment(1),
          updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
      }
      v2_1.logger.info(`Created student ${studentRef.id} in tenant ${tenantId}`);
      return { id: studentRef.id, created: true };
    } else {
      // ── UPDATE ──
      const studentRef = db.doc(`tenants/${tenantId}/students/${id}`);
      const studentDoc = await studentRef.get();
      if (!studentDoc.exists) {
        throw new https_1.HttpsError("not-found", "Student not found");
      }
      const updates = {
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedBy: callerUid,
      };
      if (data.rollNumber !== undefined) updates.rollNumber = data.rollNumber;
      if (data.section !== undefined) updates.section = data.section;
      if (data.parentIds !== undefined) updates.parentIds = data.parentIds;
      if (data.grade !== undefined) updates.grade = data.grade;
      if (data.admissionNumber !== undefined) updates.admissionNumber = data.admissionNumber;
      if (data.dateOfBirth !== undefined) updates.dateOfBirth = data.dateOfBirth;
      if (data.status !== undefined) updates.status = data.status;
      // Handle classIds reassignment (replaces assignStudentToClass)
      if (data.classIds !== undefined) {
        const previousClassIds = studentDoc.data()?.classIds ?? [];
        const newClassIds = data.classIds;
        updates.classIds = newClassIds;
        const added = newClassIds.filter((c) => !previousClassIds.includes(c));
        const removed = previousClassIds.filter((c) => !newClassIds.includes(c));
        // Add student to new classes
        for (const classId of added) {
          const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
          await classRef.update({
            studentIds: firestore_1.FieldValue.arrayUnion(id),
            studentCount: firestore_1.FieldValue.increment(1),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
          });
        }
        // Remove student from old classes
        for (const classId of removed) {
          const classRef = db.doc(`tenants/${tenantId}/classes/${classId}`);
          await classRef.update({
            studentIds: firestore_1.FieldValue.arrayRemove(id),
            studentCount: firestore_1.FieldValue.increment(-1),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
          });
        }
      }
      await studentRef.update(updates);
      v2_1.logger.info(`Updated student ${id} in tenant ${tenantId}`);
      return { id, created: false };
    }
  }
);
//# sourceMappingURL=save-student.js.map
