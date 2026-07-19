/**
 * Minimal Greenwood demo exam heal (v2_ SSOT only).
 *
 * Creates/updates ONE results_released exam + Aarav submission under
 * v2_tenants/tn_greenwood_524e429639 so student/parent results are non-empty.
 *
 * Does NOT rewrite tenantCodes. Does NOT full-reseed.
 *
 * Usage: node scripts/heal-greenwood-demo-exam.mjs
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
});
const db = admin.firestore();

const TID = "tn_greenwood_524e429639";
const CLASS_MATH = "cls_greenwood-class-g8-math_db8edee86a";
const STUDENT_ID = "stu_greenwood-student-s-aarav_80317ac983";
const TEACHER_ID = "tch_greenwood-teacher-t-priya_fix";
const EXAM_ID = "exm_greenwood-demo-math-mid_handover01";
const SUB_ID = "sub_greenwood-demo-aarav-mid_handover01";
const Q1 = "eq_greenwood-demo-q1_handover01";
const now = new Date().toISOString();

mkdirSync("tmp", { recursive: true });

async function findPriyaTeacherId() {
  const snap = await db
    .collection(`v2_tenants/${TID}/teachers`)
    .where("email", "==", "priya.sharma@greenwood.edu")
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0].id;
  const any = await db.collection(`v2_tenants/${TID}/teachers`).limit(1).get();
  return any.empty ? TEACHER_ID : any.docs[0].id;
}

async function main() {
  const report = { healedAt: now, tenantId: TID, steps: [] };
  const teacherId = await findPriyaTeacherId();
  report.teacherId = teacherId;

  const examRef = db.doc(`v2_tenants/${TID}/exams/${EXAM_ID}`);
  const existing = (await examRef.get()).data();
  const exam = {
    id: EXAM_ID,
    title: "Greenwood Demo — Grade 8 Math Midterm",
    subject: "Mathematics",
    classIds: [CLASS_MATH],
    teacherId,
    createdBy: teacherId,
    status: "results_released",
    totalMarks: 20,
    passingMarks: 8,
    questionCount: 1,
    duration: 45,
    examDate: now.slice(0, 10),
    questionPaperImages: existing?.questionPaperImages ?? [],
    settings: existing?.settings ?? {
      releaseResultsAutomatically: false,
    },
    publishedAt: existing?.publishedAt || now,
    resultsReleasedAt: now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    archivedAt: null,
  };
  await examRef.set(exam, { merge: true });
  report.steps.push({ exam: EXAM_ID, status: exam.status });

  const qRef = db.doc(`v2_tenants/${TID}/exams/${EXAM_ID}/questions/${Q1}`);
  await qRef.set(
    {
      id: Q1,
      examId: EXAM_ID,
      orderIndex: 0,
      type: "short_answer",
      prompt: "Solve for x: 2x + 4 = 10",
      maxMarks: 20,
      modelAnswer: "x = 3",
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
  report.steps.push({ question: Q1 });

  const subRef = db.doc(`v2_tenants/${TID}/submissions/${SUB_ID}`);
  await subRef.set(
    {
      id: SUB_ID,
      examId: EXAM_ID,
      studentId: STUDENT_ID,
      classId: CLASS_MATH,
      status: "results_released",
      submittedAt: now,
      gradedAt: now,
      resultsReleasedAt: now,
      summary: {
        totalScore: 18,
        maxScore: 20,
        percentage: 90,
        passed: true,
      },
      answers: {
        [Q1]: {
          questionId: Q1,
          score: 18,
          maxMarks: 20,
          feedback: "Correct method; minor arithmetic note.",
          status: "graded",
        },
      },
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    },
    { merge: true }
  );
  report.steps.push({ submission: SUB_ID, studentId: STUDENT_ID, percentage: 90 });

  // Bump tenant stats without touching tenantCodes.
  const tenantRef = db.doc(`v2_tenants/${TID}`);
  const tenant = (await tenantRef.get()).data() || {};
  const stats = { ...(tenant.stats || {}) };
  const prev = Number(stats.totalExams || 0);
  stats.totalExams = Math.max(prev, 1);
  await tenantRef.set({ stats, updatedAt: now }, { merge: true });
  report.steps.push({ stats: { totalExams: stats.totalExams, previous: prev } });
  report.note = "Did NOT rewrite tenantCodes. v2_ paths only.";

  writeFileSync("tmp/qa-demo-exam-heal-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
