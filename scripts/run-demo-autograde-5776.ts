/**
 * Full Autograde → practice space demo via Admin SDK + v1 callables (SUB001).
 * Uses sample zip assets from tmp/demo-autograde-5776.
 *
 * Usage:
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="...\lvlup-ff6fa-firebase-adminsdk-....json"
 *   npx tsx scripts/run-demo-autograde-5776.ts
 */
import admin from "firebase-admin";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEMO_ROOT = join(ROOT, "../../tmp/demo-autograde-5776");
const MATH_QP = join(DEMO_ROOT, "nested/compressed-images/compressed_IPE-I-MATH-1A-AP.png");
const ANSWER_DIR = join(DEMO_ROOT, "nested/WhatsApp Unknown 2026-01-06 at 15.22.23");
const OUT_DIR = DEMO_ROOT;

const TENANT = "tenant_subhang";
const TEACHER_EMAIL = "subhang.rocklee@gmail.com";
const STUDENT_ENTITY = "vmP1QTDZBRCqE3Mr6IPK";
const CLASS_ID = "cls_g10_sysdesign_a";
const REGION = "asia-south1";
const PROJECT = "lvlup-ff6fa";

function resolveCredential(): admin.credential.Credential {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && existsSync(envPath)) {
    return admin.credential.cert(JSON.parse(readFileSync(envPath, "utf8")));
  }
  const localKey = readdirSync(ROOT).find(
    (n) => n.includes("firebase-adminsdk") && n.endsWith(".json")
  );
  if (!localKey) throw new Error("No service account JSON");
  return admin.credential.cert(JSON.parse(readFileSync(join(ROOT, localKey), "utf8")));
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: resolveCredential(),
    projectId: PROJECT,
    storageBucket: "lvlup-ff6fa.firebasestorage.app",
  });
}

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

async function getApiKey() {
  const key = readFileSync(join(ROOT, "apps/student-web/.env.production"), "utf8")
    .match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]
    ?.trim();
  if (!key) throw new Error("Missing VITE_FIREBASE_API_KEY");
  return key;
}

async function callAsTeacher(name: string, data: Record<string, unknown>) {
  const teacher = await auth.getUserByEmail(TEACHER_EMAIL);
  const token = await auth.createCustomToken(teacher.uid, {
    tenantId: TENANT,
    role: "tenantAdmin",
  });
  const apiKey = await getApiKey();
  const signRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, returnSecureToken: true }),
    }
  );
  const signData = await signRes.json();
  if (!signRes.ok) throw new Error(JSON.stringify(signData));
  const idToken = signData.idToken as string;

  const url = `https://${REGION}-${PROJECT}.cloudfunctions.net/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${name}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function uploadFile(localPath: string, dest: string): Promise<string> {
  await bucket.upload(localPath, { destination: dest, metadata: { contentType: "image/png" } });
  return dest;
}

function answerPaths(): string[] {
  if (!existsSync(ANSWER_DIR)) {
    const fallback = join(DEMO_ROOT, "extracted2/Autograde - Testing/chaitanya/chaitanya-answers");
    return readdirSync(fallback)
      .filter((f) => f.endsWith(".jpeg"))
      .slice(0, 6)
      .map((f) => join(fallback, f));
  }
  return readdirSync(ANSWER_DIR)
    .filter((f) => f.endsWith(".jpeg"))
    .map((f) => join(ANSWER_DIR, f));
}

async function waitForQuestions(examId: string, timeoutMs = 600_000): Promise<number> {
  const examRef = db.doc(`tenants/${TENANT}/exams/${examId}`);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const examSnap = await examRef.get();
    const count =
      (examSnap.data()?.questionPaper as { questionCount?: number } | undefined)?.questionCount ??
      0;
    if (count > 0) return count;
    const qs = await db.collection(`tenants/${TENANT}/exams/${examId}/questions`).get();
    if (qs.size > 0) return qs.size;
    console.log("  waiting for extraction...", examSnap.data()?.extractionStatus ?? count);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error("extractQuestions timed out");
}

async function waitForSubmission(submissionId: string, timeoutMs = 600_000): Promise<string> {
  const ref = db.doc(`tenants/${TENANT}/submissions/${submissionId}`);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await ref.get();
    const status = snap.data()?.pipelineStatus as string | undefined;
    console.log("  pipeline:", status ?? "<none>");
    if (status && ["grading_complete", "ready_for_review", "reviewed"].includes(status)) {
      return status;
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  throw new Error("grading pipeline timed out");
}

async function approveSubmission(submissionId: string) {
  const qsSnap = await db
    .collection(`tenants/${TENANT}/submissions/${submissionId}/questionSubmissions`)
    .get();
  const batch = db.batch();
  for (const doc of qsSnap.docs) {
    batch.update(doc.ref, {
      gradingStatus: "manual",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  batch.update(db.doc(`tenants/${TENANT}/submissions/${submissionId}`), {
    pipelineStatus: "reviewed",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (!existsSync(MATH_QP)) throw new Error(`Missing math QP: ${MATH_QP}`);

  console.log("=== Demo Autograde 5776 (callable path) ===\n");

  const title = `Math Demo 5776 ${Date.now()}`;
  const examResult = await callAsTeacher("v1-autograde-saveExam", {
    data: {
      title,
      subject: "Mathematics",
      topics: ["Algebra", "Geometry", "Trigonometry"],
      classIds: [CLASS_ID],
      totalMarks: 50,
      passingMarks: 20,
      duration: 90,
      examDate: new Date().toISOString(),
      gradingConfig: {
        autoGrade: true,
        allowRubricEdit: true,
        allowManualOverride: true,
        requireOverrideReason: true,
        releaseResultsAutomatically: false,
      },
    },
  });
  const examId = examResult.id as string;
  console.log("Created exam:", examId);

  const qpDest = `tenants/${TENANT}/question-papers/${examId}/${Date.now()}_${basename(MATH_QP)}`;
  const qpPath = await uploadFile(MATH_QP, qpDest);
  await callAsTeacher("v1-autograde-saveExam", {
    id: examId,
    data: { questionPaperImages: [qpPath] },
  });
  console.log("Uploaded question paper:", qpPath);

  console.log("Extracting questions...");
  await callAsTeacher("v1-autograde-extractQuestions", { examId });
  const qCount = await waitForQuestions(examId);
  console.log(`Extracted ${qCount} questions`);

  await callAsTeacher("v1-autograde-saveExam", { id: examId, data: { status: "published" } });
  console.log("Published exam");

  const answers = answerPaths();
  const imageUrls: string[] = [];
  for (const local of answers) {
    const dest = `tenants/${TENANT}/submissions/${examId}/${Date.now()}_${basename(local)}`;
    imageUrls.push(await uploadFile(local, dest));
  }
  console.log(`Uploading ${imageUrls.length} answer sheet images...`);
  const uploadResult = await callAsTeacher("v1-autograde-uploadAnswerSheets", {
    examId,
    studentId: STUDENT_ENTITY,
    classId: CLASS_ID,
    imageUrls,
  });
  const submissionId = uploadResult.submissionId as string;
  console.log("Submission:", submissionId);

  await waitForSubmission(submissionId);
  console.log("Approving grades...");
  await approveSubmission(submissionId);

  console.log("Creating practice space...");
  const spaceResult = await callAsTeacher("v1-autograde-createSpaceFromExam", { examId });
  console.log("Practice space:", spaceResult);

  console.log("Releasing results...");
  await callAsTeacher("v1-autograde-releaseResults", { examId });

  const out = {
    tenant: { id: TENANT, code: "SUB001" },
    examId,
    submissionId,
    practiceSpaceId: spaceResult.spaceId,
    practiceStoryPointId: spaceResult.storyPointId,
    itemsCreated: spaceResult.itemsCreated,
    teacherUrl: `https://lvlup-ff6fa-teacher.web.app/exams/${examId}`,
    studentSpaceUrl: `https://lvlup-ff6fa-student.web.app/spaces/${spaceResult.spaceId}`,
    studentPracticeUrl: `https://lvlup-ff6fa-student.web.app/spaces/${spaceResult.spaceId}/practice/${spaceResult.storyPointId}`,
  };

  writeFileSync(join(OUT_DIR, "demo-result.json"), JSON.stringify(out, null, 2));
  console.log("\n=== DEMO READY ===");
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
