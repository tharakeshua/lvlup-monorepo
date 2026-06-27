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
exports.rolloverSession = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const utils_1 = require("../utils");
const rate_limit_1 = require("../utils/rate-limit");
const zod_1 = require("zod");
const RolloverSessionRequestSchema = zod_1.z.object({
  tenantId: zod_1.z.string().min(1),
  sourceSessionId: zod_1.z.string().min(1),
  newSession: zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
  }),
  copyClasses: zod_1.z.boolean(),
  copyTeacherAssignments: zod_1.z.boolean(),
  promoteStudents: zod_1.z.boolean(),
});
exports.rolloverSession = (0, https_1.onCall)(
  { region: "asia-south1", timeoutSeconds: 540, memory: "1GiB", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    const data = (0, utils_1.parseRequest)(request.data, RolloverSessionRequestSchema);
    await (0, utils_1.assertTenantAdminOrSuperAdmin)(callerUid, data.tenantId);
    await (0, rate_limit_1.enforceRateLimit)(data.tenantId, callerUid, "write", 5);
    const db = admin.firestore();
    const tenantPath = `tenants/${data.tenantId}`;
    // Verify source session exists
    const sourceDoc = await db.doc(`${tenantPath}/academicSessions/${data.sourceSessionId}`).get();
    if (!sourceDoc.exists) {
      throw new https_1.HttpsError("not-found", "Source session not found");
    }
    // Create new academic session
    const newSessionRef = db.collection(`${tenantPath}/academicSessions`).doc();
    const now = firestore_1.FieldValue.serverTimestamp();
    await newSessionRef.set({
      id: newSessionRef.id,
      tenantId: data.tenantId,
      name: data.newSession.name,
      startDate: new Date(data.newSession.startDate),
      endDate: new Date(data.newSession.endDate),
      isCurrent: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    // Unset current from all other sessions
    const allSessions = await db
      .collection(`${tenantPath}/academicSessions`)
      .where("isCurrent", "==", true)
      .get();
    const batch = db.batch();
    for (const sessionDoc of allSessions.docs) {
      if (sessionDoc.id !== newSessionRef.id) {
        batch.update(sessionDoc.ref, { isCurrent: false, updatedAt: now });
      }
    }
    await batch.commit();
    let classesCreated = 0;
    let teacherAssignments = 0;
    let studentsPromoted = 0;
    let studentsUnassigned = 0;
    const classIdMap = new Map(); // old class ID -> new class ID
    if (data.copyClasses) {
      // Get all active classes from source session
      const classesSnap = await db
        .collection(`${tenantPath}/classes`)
        .where("academicSessionId", "==", data.sourceSessionId)
        .where("status", "==", "active")
        .get();
      for (const classDoc of classesSnap.docs) {
        const classData = classDoc.data();
        const newClassRef = db.collection(`${tenantPath}/classes`).doc();
        const newClassData = {
          id: newClassRef.id,
          tenantId: data.tenantId,
          name: classData.name,
          grade: classData.grade,
          section: classData.section ?? null,
          academicSessionId: newSessionRef.id,
          teacherIds: data.copyTeacherAssignments ? (classData.teacherIds ?? []) : [],
          studentCount: 0,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
        await newClassRef.set(newClassData);
        classIdMap.set(classDoc.id, newClassRef.id);
        classesCreated++;
        if (data.copyTeacherAssignments && classData.teacherIds) {
          teacherAssignments += classData.teacherIds.length;
        }
      }
    }
    if (data.promoteStudents && data.copyClasses) {
      // Get all active students
      const studentsSnap = await db
        .collection(`${tenantPath}/students`)
        .where("status", "==", "active")
        .get();
      for (const studentDoc of studentsSnap.docs) {
        const studentData = studentDoc.data();
        const currentClassIds = studentData.classIds ?? [];
        const currentGrade = studentData.grade ? parseInt(studentData.grade, 10) : null;
        const newGrade = currentGrade ? String(currentGrade + 1) : null;
        // Find matching new class
        const newClassIds = [];
        for (const oldClassId of currentClassIds) {
          const newClassId = classIdMap.get(oldClassId);
          if (newClassId) {
            newClassIds.push(newClassId);
          }
        }
        const updates = {
          updatedAt: now,
        };
        if (newGrade) {
          updates.grade = newGrade;
        }
        if (newClassIds.length > 0) {
          updates.classIds = newClassIds;
          studentsPromoted++;
        } else {
          updates.classIds = [];
          studentsUnassigned++;
        }
        await studentDoc.ref.update(updates);
      }
    }
    v2_1.logger.info(
      `Session rollover for tenant ${data.tenantId}: session=${newSessionRef.id}, classes=${classesCreated}, teachers=${teacherAssignments}, promoted=${studentsPromoted}`
    );
    await (0, utils_1.logTenantAction)(data.tenantId, callerUid, "rolloverSession", {
      sourceSessionId: data.sourceSessionId,
      newSessionId: newSessionRef.id,
      classesCreated,
      teacherAssignments,
      studentsPromoted,
      studentsUnassigned,
    });
    return {
      newSessionId: newSessionRef.id,
      classesCreated,
      teacherAssignments,
      studentsPromoted,
      studentsUnassigned,
    };
  }
);
//# sourceMappingURL=rollover-session.js.map
