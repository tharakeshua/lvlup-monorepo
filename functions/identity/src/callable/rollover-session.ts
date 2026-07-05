import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { isoNow } from "@levelup/domain";
import { assertTenantAdminOrSuperAdmin, parseRequest, logTenantAction } from "../utils";
import { enforceRateLimit } from "../utils/rate-limit";
import { z } from "zod";

const RolloverSessionRequestSchema = z.object({
  tenantId: z.string().min(1),
  sourceSessionId: z.string().min(1),
  newSession: z.object({
    name: z.string().min(1).max(200),
    startDate: z.string(),
    endDate: z.string(),
  }),
  copyClasses: z.boolean(),
  copyTeacherAssignments: z.boolean(),
  promoteStudents: z.boolean(),
});

export const rolloverSession = onCall(
  { region: "asia-south1", timeoutSeconds: 540, memory: "1GiB", cors: true },
  async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) throw new HttpsError("unauthenticated", "Must be logged in");

    const data = parseRequest(request.data, RolloverSessionRequestSchema);
    await assertTenantAdminOrSuperAdmin(callerUid, data.tenantId);
    await enforceRateLimit(data.tenantId, callerUid, "write", 5);

    const db = admin.firestore();
    const tenantPath = `tenants/${data.tenantId}`;

    // Verify source session exists
    const sourceDoc = await db.doc(`${tenantPath}/academicSessions/${data.sourceSessionId}`).get();
    if (!sourceDoc.exists) {
      throw new HttpsError("not-found", "Source session not found");
    }

    // Create new academic session
    const newSessionRef = db.collection(`${tenantPath}/academicSessions`).doc();
    // B8: timestamps at rest are canonical ISO strings.
    const now = isoNow();

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
    const classIdMap = new Map<string, string>(); // old class ID -> new class ID

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

        const newClassData: Record<string, unknown> = {
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
        const currentClassIds: string[] = studentData.classIds ?? [];
        const currentGrade = studentData.grade ? parseInt(studentData.grade, 10) : null;
        const newGrade = currentGrade ? String(currentGrade + 1) : null;

        // Find matching new class
        const newClassIds: string[] = [];
        for (const oldClassId of currentClassIds) {
          const newClassId = classIdMap.get(oldClassId);
          if (newClassId) {
            newClassIds.push(newClassId);
          }
        }

        const updates: Record<string, unknown> = {
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

    logger.info(
      `Session rollover for tenant ${data.tenantId}: session=${newSessionRef.id}, classes=${classesCreated}, teachers=${teacherAssignments}, promoted=${studentsPromoted}`
    );

    await logTenantAction(data.tenantId, callerUid, "rolloverSession", {
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
