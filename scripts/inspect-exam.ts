import admin from "firebase-admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cred = JSON.parse(
  readFileSync(
    "c:/Users/tharakeswara.reddy/Downloads/AI_Brain_Startup/startup-mvp/lvlup/lvlup-ff6fa-firebase-adminsdk-fbsvc-a9c1e3df39_5365.json",
    "utf8"
  )
);
admin.initializeApp({ credential: admin.credential.cert(cred), projectId: "lvlup-ff6fa" });
const db = admin.firestore();

const examId = process.argv[2] ?? "2CLX6gfpiwh8pcPYO98H";

async function main() {
  const exam = await db.doc(`tenants/tenant_subhang/exams/${examId}`).get();
  console.log("exam status", exam.data()?.status);
  console.log("questionPaper", JSON.stringify(exam.data()?.questionPaper, null, 2));
  console.log("extractionStatus", JSON.stringify(exam.data()?.extractionStatus, null, 2));
  const qs = await db.collection(`tenants/tenant_subhang/exams/${examId}/questions`).get();
  console.log("questions count", qs.size);
  for (const q of qs.docs.slice(0, 3)) console.log(" Q", q.id, q.data().text?.slice(0, 80));
}

main();
