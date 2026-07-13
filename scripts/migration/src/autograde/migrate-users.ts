/**
 * Migrate AutoGrade users → /users/{uid} + /userMemberships/{uid}_{tenantId}
 *
 * Processes students, teachers, and parents from /clients/{clientId}/students|teachers|parents
 * into the unified user model. Also creates the client admin's user + membership.
 */

import * as admin from "firebase-admin";
import { getFirestore, toTimestamp } from "../config.js";
import { processBatch, readAllDocs, docExists } from "../utils/batch-processor.js";
import { MigrationLogger } from "../utils/logger.js";

interface LegacyStudent {
  _docId: string;
  id: string;
  clientId: string;
  authUid?: string;
  email: string;
  firstName: string;
  lastName: string;
  rollNumber: string;
  classIds: string[];
  parentIds: string[];
  createdAt: admin.firestore.Timestamp;
  status: "active" | "inactive";
  metadata?: { dateOfBirth?: admin.firestore.Timestamp; phone?: string };
}

interface LegacyTeacher {
  _docId: string;
  id: string;
  clientId: string;
  authUid?: string;
  email: string;
  firstName: string;
  lastName: string;
  classIds: string[];
  subjects: string[];
  phone?: string;
  createdAt: admin.firestore.Timestamp;
  status: "active" | "inactive";
}

interface LegacyParent {
  _docId: string;
  id: string;
  clientId: string;
  authUid?: string;
  email: string;
  firstName: string;
  lastName: string;
  studentIds: string[];
  phone?: string;
  createdAt: admin.firestore.Timestamp;
  status: "active" | "inactive";
}

export async function migrateAutogradeUsers(options: {
  clientId: string;
  dryRun: boolean;
  logger: MigrationLogger;
}): Promise<void> {
  const { clientId, dryRun, logger } = options;
  const db = getFirestore();
  const tenantId = clientId; // 1:1 mapping

  logger.info(`Migrating AutoGrade users for client ${clientId}`);

  // Migrate students
  const students = await readAllDocs<LegacyStudent>(
    db.collection(`clients/${clientId}/students`) as admin.firestore.CollectionReference
  );
  logger.info(`Found ${students.length} students`);

  await processBatch(
    students,
    async (student, batch, db) => {
      const uid = student.authUid || student._docId;
      return migrateUserDoc(db, batch, {
        uid,
        email: student.email,
        displayName: `${student.firstName} ${student.lastName}`.trim(),
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.metadata?.phone || null,
        tenantId,
        role: "student",
        joinSource: "migration",
        studentId: student._docId,
        classIds: student.classIds,
        parentIds: student.parentIds,
        createdAt: student.createdAt,
        status: student.status === "active" ? "active" : "inactive",
        dryRun,
        logger,
      });
    },
    { dryRun, logger }
  );

  // Migrate teachers
  const teachers = await readAllDocs<LegacyTeacher>(
    db.collection(`clients/${clientId}/teachers`) as admin.firestore.CollectionReference
  );
  logger.info(`Found ${teachers.length} teachers`);

  await processBatch(
    teachers,
    async (teacher, batch, db) => {
      const uid = teacher.authUid || teacher._docId;
      return migrateUserDoc(db, batch, {
        uid,
        email: teacher.email,
        displayName: `${teacher.firstName} ${teacher.lastName}`.trim(),
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        phone: teacher.phone || null,
        tenantId,
        role: "teacher",
        joinSource: "migration",
        teacherId: teacher._docId,
        classIds: teacher.classIds,
        subjects: teacher.subjects,
        createdAt: teacher.createdAt,
        status: teacher.status === "active" ? "active" : "inactive",
        dryRun,
        logger,
      });
    },
    { dryRun, logger }
  );

  // Migrate parents
  const parents = await readAllDocs<LegacyParent>(
    db.collection(`clients/${clientId}/parents`) as admin.firestore.CollectionReference
  );
  logger.info(`Found ${parents.length} parents`);

  await processBatch(
    parents,
    async (parent, batch, db) => {
      const uid = parent.authUid || parent._docId;
      return migrateUserDoc(db, batch, {
        uid,
        email: parent.email,
        displayName: `${parent.firstName} ${parent.lastName}`.trim(),
        firstName: parent.firstName,
        lastName: parent.lastName,
        phone: parent.phone || null,
        tenantId,
        role: "parent",
        joinSource: "migration",
        parentId: parent._docId,
        studentIds: parent.studentIds,
        createdAt: parent.createdAt,
        status: parent.status === "active" ? "active" : "inactive",
        dryRun,
        logger,
      });
    },
    { dryRun, logger }
  );

  logger.printSummary();
}

async function migrateUserDoc(
  db: admin.firestore.Firestore,
  batch: admin.firestore.WriteBatch,
  params: {
    uid: string;
    email: string;
    displayName: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    tenantId: string;
    role: "student" | "teacher" | "parent";
    joinSource: string;
    studentId?: string;
    teacherId?: string;
    parentId?: string;
    classIds?: string[];
    parentIds?: string[];
    studentIds?: string[];
    subjects?: string[];
    createdAt: admin.firestore.Timestamp;
    status: "active" | "inactive";
    dryRun: boolean;
    logger: MigrationLogger;
  }
): Promise<{ action: "created" | "skipped" | "error"; id: string }> {
  const { uid, dryRun, logger } = params;

  // Create or merge /users/{uid}
  const userPath = `users/${uid}`;
  const userExists = await docExists(db, userPath);

  if (dryRun) {
    logger.info(`[DRY RUN] Would ${userExists ? "merge" : "create"} user ${uid} (${params.role})`);
  } else {
    const userData = {
      uid,
      email: params.email || null,
      phone: params.phone,
      authProviders: params.email ? ["email"] : [],
      displayName: params.displayName,
      firstName: params.firstName,
      lastName: params.lastName,
      photoURL: null,
      isSuperAdmin: false,
      status: params.status === "active" ? "active" : "suspended",
      updatedAt: admin.firestore.Timestamp.now(),
      ...(!userExists && {
        createdAt: params.createdAt || admin.firestore.Timestamp.now(),
      }),
    };
    batch.set(db.doc(userPath), userData, { merge: true });
  }

  // Create /userMemberships/{uid}_{tenantId}
  const membershipId = `${uid}_${params.tenantId}`;
  const membershipPath = `userMemberships/${membershipId}`;

  if (await docExists(db, membershipPath)) {
    logger.debug(`Membership ${membershipId} already exists, skipping`);
    return { action: "skipped", id: uid };
  }

  if (dryRun) {
    logger.info(`[DRY RUN] Would create membership ${membershipId}`);
    return { action: "created", id: uid };
  }

  const membership: Record<string, unknown> = {
    id: membershipId,
    uid,
    tenantId: params.tenantId,
    tenantCode: "", // Will be populated by tenant lookup if needed
    role: params.role,
    status: params.status,
    joinSource: "migration",
    createdAt: params.createdAt || admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  };

  if (params.studentId) membership.studentId = params.studentId;
  if (params.teacherId) membership.teacherId = params.teacherId;
  if (params.parentId) membership.parentId = params.parentId;
  if (params.studentIds) membership.parentLinkedStudentIds = params.studentIds;

  if (params.role === "teacher" && params.classIds) {
    membership.permissions = {
      canCreateExams: true,
      canEditRubrics: true,
      canManuallyGrade: true,
      canViewAllExams: false,
      canCreateSpaces: false,
      canManageContent: false,
      canViewAnalytics: false,
      canConfigureAgents: false,
      managedSpaceIds: [],
      managedClassIds: params.classIds,
    };
  }

  batch.set(db.doc(membershipPath), membership);
  return { action: "created", id: uid };
}
