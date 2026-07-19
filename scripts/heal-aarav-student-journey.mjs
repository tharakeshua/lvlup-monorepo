/**
 * Reset Aarav Patel demo journey for Greenwood Maths exam (v2_ SSOT).
 *
 * Clears stale submissions / notifications / space progress from prior demos,
 * maps Aarav to Priya Sharma (G8 Math), and prepares the live Maths exam
 * (`j1zqQHZau9xm3OJT00j0`) for answer-sheet upload + grading.
 *
 * Does NOT rewrite tenantCodes. Does NOT full-reseed.
 *
 * Usage: node scripts/heal-aarav-student-journey.mjs
 */
import admin from "firebase-admin";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const saFile = readdirSync(root).find(
  (f) => f.includes("firebase-adminsdk") && f.endsWith(".json")
);
if (!saFile) throw new Error("No firebase-adminsdk JSON in monorepo root");
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, saFile), "utf8"))),
  projectId: "lvlup-ff6fa",
  storageBucket: "lvlup-ff6fa.firebasestorage.app",
});
const db = admin.firestore();
const auth = admin.auth();

const TID = "tn_greenwood_524e429639";
const SCHOOL_CODE = "GRN001";
const CLASS_MATH = "cls_greenwood-class-g8-math_db8edee86a";
const STUDENT_ID = "stu_greenwood-student-s-aarav_80317ac983";
const STUDENT_EMAIL = "aarav.patel@greenwood.edu";
const STUDENT_PASSWORD = "Test@12345";
const MATHS_EXAM_ID = "j1zqQHZau9xm3OJT00j0";
const ALGEBRA_SPACE = "spc_greenwood-space-space-algebra_1d2ab9a5be";
const now = new Date().toISOString();

/** Legacy demo artifacts to remove (handover + old midterm seeds). */
const LEGACY_SUBMISSION_IDS = [
  "sub_greenwood-demo-aarav-mid_handover01",
  "sub_greenwood-submission-sub-aarav-mid_3fa67ef8f1",
];
const LEGACY_EXAM_IDS = [
  "exm_greenwood-demo-math-mid_handover01",
  "exm_greenwood-exam-exam-math-mid_57779c9939",
];

mkdirSync("tmp", { recursive: true });

async function findPriyaTeacherId() {
  const snap = await db
    .collection(`v2_tenants/${TID}/teachers`)
    .where("email", "==", "priya.sharma@greenwood.edu")
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].id;
  return "tch_greenwood-teacher-t-priya_fix";
}

async function deleteCollectionDocs(collectionPath, filterFn) {
  const snap = await db.collection(collectionPath).get();
  const batch = db.batch();
  let count = 0;
  for (const doc of snap.docs) {
    if (filterFn(doc.id, doc.data())) {
      batch.delete(doc.ref);
      count++;
    }
  }
  if (count > 0) await batch.commit();
  return count;
}

async function main() {
  const report = {
    healedAt: now,
    tenantId: TID,
    studentId: STUDENT_ID,
    mathsExamId: MATHS_EXAM_ID,
    steps: [],
    note: "Did NOT rewrite tenantCodes. v2_ paths only.",
  };

  const teacherId = await findPriyaTeacherId();
  report.teacherId = teacherId;

  const studentRef = db.doc(`v2_tenants/${TID}/students/${STUDENT_ID}`);
  const student = (await studentRef.get()).data() || {};
  const authUid = student.authUid;
  report.authUid = authUid;

  // ── Remove legacy submissions + nested question submissions ──
  for (const subId of LEGACY_SUBMISSION_IDS) {
    const subRef = db.doc(`v2_tenants/${TID}/submissions/${subId}`);
    const qSnap = await subRef.collection("questionSubmissions").get();
    const batch = db.batch();
    for (const q of qSnap.docs) batch.delete(q.ref);
    batch.delete(subRef);
    await batch.commit();
    report.steps.push({ deletedSubmission: subId, questionSubs: qSnap.size });
  }

  // ── Clear demo notifications for Aarav ──
  if (authUid) {
    const notifDeleted = await deleteCollectionDocs(`v2_tenants/${TID}/notifications`, (_id, data) =>
      data.recipientUid === authUid || data.studentId === STUDENT_ID
    );
    report.steps.push({ notificationsDeleted: notifDeleted });
  }

  // ── Reset algebra space progress (keep space itself) ──
  if (authUid) {
    const progId = `${authUid}_${ALGEBRA_SPACE}`;
    await db.doc(`v2_tenants/${TID}/spaceProgress/${progId}`).delete().catch(() => {});
    report.steps.push({ clearedSpaceProgress: progId });
  }

  // ── Map Aarav → Priya + G8 Math class ──
  await studentRef.set(
    {
      classIds: [CLASS_MATH],
      primaryTeacherId: teacherId,
      homeroomClassId: CLASS_MATH,
      updatedAt: now,
    },
    { merge: true }
  );
  report.steps.push({ studentScope: { classIds: [CLASS_MATH], primaryTeacherId: teacherId } });

  // ── Refresh auth claims ──
  if (authUid) {
    const user = await auth.getUser(authUid);
    await auth.setCustomUserClaims(authUid, {
      ...(user.customClaims || {}),
      role: "student",
      tenantId: TID,
      tenantCode: SCHOOL_CODE,
      studentId: STUDENT_ID,
      classIds: [CLASS_MATH],
      classIdsOverflow: false,
    });
    await auth.updateUser(authUid, { password: STUDENT_PASSWORD, disabled: false });
    await auth.revokeRefreshTokens(authUid);
    report.steps.push({ claimsRefreshed: STUDENT_EMAIL });
  }

  // ── Ensure Priya manages G8 Math ──
  const tRef = db.doc(`v2_tenants/${TID}/teachers/${teacherId}`);
  const tData = (await tRef.get()).data() || {};
  const managed = [
    ...new Set([...(tData.classIds || []), ...(tData.managedClassIds || []), CLASS_MATH]),
  ];
  await tRef.set(
    {
      classIds: managed,
      managedClassIds: managed,
      isPrimaryForClassIds: [...new Set([...(tData.isPrimaryForClassIds || []), CLASS_MATH])],
      updatedAt: now,
    },
    { merge: true }
  );
  report.steps.push({ teacherScope: { teacherId, managedClassIds: managed } });

  // ── Maths exam: ensure class assignment + fresh pipeline state ──
  const examRef = db.doc(`v2_tenants/${TID}/exams/${MATHS_EXAM_ID}`);
  const exam = (await examRef.get()).data();
  if (!exam) throw new Error(`Missing Maths exam ${MATHS_EXAM_ID}`);
  await examRef.set(
    {
      classIds: [...new Set([...(exam.classIds || []), CLASS_MATH])],
      teacherId,
      createdBy: exam.createdBy || teacherId,
      linkedSpaceId: admin.firestore.FieldValue.delete(),
      linkedStoryPointId: admin.firestore.FieldValue.delete(),
      updatedAt: now,
    },
    { merge: true }
  );
  report.steps.push({
    exam: MATHS_EXAM_ID,
    title: exam.title,
    status: exam.status,
    questionPaperImages: exam.questionPaper?.images?.length ?? 0,
  });

  // Remove extracted questions if re-extract is needed (status stays uploaded).
  if (exam.status === "question_paper_extracted") {
    const qSnap = await examRef.collection("questions").get();
    const batch = db.batch();
    for (const q of qSnap.docs) batch.delete(q.ref);
    await batch.commit();
    await examRef.set({ status: "question_paper_uploaded", updatedAt: now }, { merge: true });
    report.steps.push({ resetExamQuestions: qSnap.size, status: "question_paper_uploaded" });
  }

  // Archive legacy demo exams (non-destructive — keep for audit).
  for (const legacyExamId of LEGACY_EXAM_IDS) {
    await db.doc(`v2_tenants/${TID}/exams/${legacyExamId}`).set(
      { status: "archived", archivedAt: now, updatedAt: now },
      { merge: true }
    );
  }
  report.steps.push({ archivedLegacyExams: LEGACY_EXAM_IDS });

  writeFileSync("tmp/qa-aarav-journey-heal-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
