/**
 * Migrate AutoGrade classes:
 *   /clients/{cId}/classes/{classId} → /tenants/{tId}/classes/{classId}
 * Also migrates students and teachers references into the new class document.
 */

import * as admin from "firebase-admin";
import { getFirestore } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyClass {
  _docId: string;
  id: string;
  clientId: string;
  name: string;
  subject: string;
  academicYear: string;
  createdBy: string;
  createdAt: admin.firestore.Timestamp;
  studentCount: number;
}

export async function migrateClasses(options: {
  clientId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { clientId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = clientId;

  logger.info(`Migrating classes for client ${clientId}`);

  const classes = await readAllDocs<LegacyClass>(
    db.collection(`clients/${clientId}/classes`) as admin.firestore.CollectionReference
  );
  logger.info(`Found ${classes.length} classes`);

  // Also read students and teachers to build cross-reference
  const students = await readAllDocs<{
    _docId: string;
    classIds: string[];
    authUid?: string;
  }>(db.collection(`clients/${clientId}/students`) as admin.firestore.CollectionReference);

  const teachers = await readAllDocs<{
    _docId: string;
    classIds: string[];
    authUid?: string;
  }>(db.collection(`clients/${clientId}/teachers`) as admin.firestore.CollectionReference);

  // Build classId → studentIds / teacherIds maps
  const classStudents = new Map<string, string[]>();
  const classTeachers = new Map<string, string[]>();

  for (const s of students) {
    for (const classId of s.classIds || []) {
      if (!classStudents.has(classId)) classStudents.set(classId, []);
      classStudents.get(classId)!.push(s._docId);
    }
  }

  for (const t of teachers) {
    for (const classId of t.classIds || []) {
      if (!classTeachers.has(classId)) classTeachers.set(classId, []);
      classTeachers.get(classId)!.push(t._docId);
    }
  }

  await processBatch(
    classes,
    async (cls, batch, db) => {
      const classId = cls._docId;
      const targetPath = `tenants/${tenantId}/classes/${classId}`;

      if (await docExists(db, targetPath)) {
        logger.debug(`Class ${classId} already migrated, skipping`);
        return { action: "skipped", id: classId };
      }

      const studentIds = classStudents.get(classId) || [];
      const teacherIds = classTeachers.get(classId) || [];

      const newClass = {
        id: classId,
        tenantId,
        name: cls.name,
        grade: "", // Not in legacy schema, will need manual mapping
        section: null,
        academicSessionId: null,
        teacherIds,
        studentIds,
        studentCount: studentIds.length || cls.studentCount,
        status: "active" as const,
        createdAt: cls.createdAt || admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        _migratedFrom: "autograde",
        _legacySubject: cls.subject,
        _legacyAcademicYear: cls.academicYear,
      };

      if (dryRun) {
        logger.info(
          `[DRY RUN] Would migrate class: ${classId} (${cls.name}) - ${studentIds.length} students, ${teacherIds.length} teachers`
        );
        return { action: "created", id: classId };
      }

      batch.set(db.doc(targetPath), newClass);

      // Also create student docs under the tenant
      for (const studentId of studentIds) {
        const studentDoc = students.find((s) => s._docId === studentId);
        const studentPath = `tenants/${tenantId}/students/${studentId}`;
        if (await docExists(db, studentPath)) continue;

        batch.set(db.doc(studentPath), {
          id: studentId,
          tenantId,
          uid: studentDoc?.authUid || studentId,
          classIds: studentDoc?.classIds || [classId],
          parentIds: [],
          status: "active",
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          _migratedFrom: "autograde",
        });
      }

      // Create teacher docs under the tenant
      for (const teacherId of teacherIds) {
        const teacherDoc = teachers.find((t) => t._docId === teacherId);
        const teacherPath = `tenants/${tenantId}/teachers/${teacherId}`;
        if (await docExists(db, teacherPath)) continue;

        batch.set(db.doc(teacherPath), {
          id: teacherId,
          tenantId,
          uid: teacherDoc?.authUid || teacherId,
          subjects: [],
          classIds: teacherDoc?.classIds || [classId],
          status: "active",
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
          _migratedFrom: "autograde",
        });
      }

      return { action: "created", id: classId };
    },
    { dryRun, logger }
  );

  logger.printSummary();
}
