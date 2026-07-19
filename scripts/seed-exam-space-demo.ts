/**
 * Seed a minimal exam-space demo on Subhang Academy (SUB001).
 * Usage: npx tsx scripts/seed-exam-space-demo.ts
 */
import admin from "firebase-admin";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const TENANT = "tenant_subhang";
const TEACHER_EMAIL = "subhang.rocklee@gmail.com";
const STUDENT_ENTITY = "4ETnX1nentEZZiQ4yYXV";
const CLASS_ID = "cls_g10_sysdesign_a";

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
  admin.initializeApp({ credential: resolveCredential(), projectId: "lvlup-ff6fa" });
}

const db = admin.firestore();
const auth = admin.auth();
const REGION = "asia-south1";
const PROJECT = "lvlup-ff6fa";

const QUESTIONS = [
  {
    order: 1,
    text: "Explain the CAP theorem and give a real-world example of choosing CP over AP.",
    maxMarks: 10,
  },
  {
    order: 2,
    text: "What is the difference between horizontal and vertical scaling?",
    maxMarks: 10,
  },
  {
    order: 3,
    text: "Describe one caching strategy for a read-heavy API.",
    maxMarks: 10,
  },
];

const EVALS = [
  { score: 3, maxScore: 10, correctness: 0.3, summary: "Partial" },
  { score: 0, maxScore: 10, correctness: 0, summary: "Incorrect" },
  { score: 8, maxScore: 10, correctness: 0.8, summary: "Mostly correct" },
];

async function teacherToken(): Promise<string> {
  const teacher = await auth.getUserByEmail(TEACHER_EMAIL);
  const token = await auth.createCustomToken(teacher.uid, {
    tenantId: TENANT,
    role: "tenantAdmin",
  });
  const apiKey = readFileSync(join(ROOT, "apps/student-web/.env.production"), "utf8")
    .match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]
    ?.trim();
  if (!apiKey) throw new Error("Missing web API key");
  const signRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, returnSecureToken: true }),
    }
  );
  const signData = (await signRes.json()) as { idToken?: string; error?: unknown };
  if (!signRes.ok || !signData.idToken) throw new Error(JSON.stringify(signData));
  return signData.idToken;
}

async function callAsTeacher(name: string, data: Record<string, unknown>) {
  const idToken = await teacherToken();
  const url = `https://${REGION}-${PROJECT}.cloudfunctions.net/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  const body = (await res.json()) as { result?: unknown; error?: unknown };
  if (body.error) throw new Error(`${name}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function main() {
  console.log("=== Exam-space demo seed (SUB001) ===\n");
  const now = admin.firestore.Timestamp.now();
  const examRef = db.collection(`tenants/${TENANT}/exams`).doc();
  const examId = examRef.id;
  const teacherUid = (await auth.getUserByEmail(TEACHER_EMAIL)).uid;

  await examRef.set({
    id: examId,
    tenantId: TENANT,
    title: "Demo Post-Grade Practice Quiz",
    subject: "System Design",
    classIds: [CLASS_ID],
    status: "published",
    publishedAt: now,
    academicSessionId: "hCOHNuE19nu9187dK400",
    createdBy: teacherUid,
    createdAt: now,
    updatedAt: now,
  });

  const questionIds: string[] = [];
  for (const q of QUESTIONS) {
    const qRef = db.collection(`tenants/${TENANT}/exams`).doc();
    questionIds.push(qRef.id);
    await qRef.set({
      id: qRef.id,
      _kind: "examQuestion",
      examId,
      tenantId: TENANT,
      order: q.order,
      text: q.text,
      maxMarks: q.maxMarks,
      status: "extracted",
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`Exam ${examId} + ${questionIds.length} questions`);

  const subRef = db.collection(`tenants/${TENANT}/submissions`).doc();
  await subRef.set({
    id: subRef.id,
    tenantId: TENANT,
    examId,
    studentId: STUDENT_ENTITY,
    classId: CLASS_ID,
    pipelineStatus: "grading_complete",
    resultsReleased: false,
    createdAt: now,
    updatedAt: now,
  });

  for (let i = 0; i < questionIds.length; i++) {
    const qsRef = db.collection(`tenants/${TENANT}/submissions`).doc();
    await qsRef.set({
      id: qsRef.id,
      _kind: "questionSubmission",
      tenantId: TENANT,
      submissionId: subRef.id,
      examId,
      questionId: questionIds[i],
      studentId: STUDENT_ENTITY,
      evaluation: EVALS[i],
      pipelineStatus: "grading_complete",
      createdAt: now,
      updatedAt: now,
    });
  }
  console.log(`Submission ${subRef.id} (wrong/partial grades)`);

  const spaceResult = (await callAsTeacher("v1-autograde-createSpaceFromExam", { examId })) as {
    spaceId: string;
    storyPointId: string;
    itemsCreated: number;
  };
  console.log("Practice space:", spaceResult);

  const releaseResult = await callAsTeacher("v1-autograde-releaseResults", { examId });
  console.log("Released:", releaseResult);

  const out = {
    tenant: { id: TENANT, code: "SUB001" },
    examId,
    submissionId: subRef.id,
    practiceSpaceId: spaceResult.spaceId,
    practiceStoryPointId: spaceResult.storyPointId,
    teacherUrl: `https://lvlup-ff6fa-teacher.web.app/exams/${examId}`,
    studentSpaceUrl: `https://lvlup-ff6fa-student.web.app/spaces/${spaceResult.spaceId}`,
    studentStoryPointUrl: `https://lvlup-ff6fa-student.web.app/spaces/${spaceResult.spaceId}/story-points/${spaceResult.storyPointId}`,
  };
  console.log("\n=== Demo ready ===\n", JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
