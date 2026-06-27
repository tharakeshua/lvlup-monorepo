/**
 * One-shot recovery: reset submissions stuck in failure states back into the
 * pipeline. Use after rotating the Gemini API key.
 *
 * Run: npx tsx scripts/reset-stuck-submissions.ts <tenantId>
 */
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.resolve(
  __dirname,
  "../lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json"
);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const STUCK_STATES = [
  "scouting_failed",
  "grading_failed",
  "finalization_failed",
  "manual_review_needed",
];

async function reset(tenantId: string) {
  const db = admin.firestore();
  const col = db.collection(`tenants/${tenantId}/submissions`);
  const snap = await col.where("pipelineStatus", "in", STUCK_STATES).get();

  if (snap.empty) {
    console.log(`No stuck submissions in tenant ${tenantId}.`);
    return;
  }

  console.log(`Found ${snap.size} stuck submissions in tenant ${tenantId}:`);
  const now = admin.firestore.FieldValue.serverTimestamp();
  let batch = db.batch();
  let n = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    console.log(`  ${doc.id}  status=${d.pipelineStatus}  retries=${d.retryCount ?? 0}`);
    // onSubmissionUpdated handles `scouting` (re-runs processAnswerMapping).
    // `uploaded` only fires onSubmissionCreated, which won't run here.
    batch.update(doc.ref, {
      pipelineStatus: "scouting",
      retryCount: 0,
      pipelineError: admin.firestore.FieldValue.delete(),
      updatedAt: now,
    });
    n++;
    if (n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (n % 400 !== 0) await batch.commit();

  console.log(`Reset ${n} submissions to "scouting".`);
  console.log(
    "onSubmissionUpdated should pick them up and re-run processAnswerMapping within a few seconds."
  );
}

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: npx tsx scripts/reset-stuck-submissions.ts <tenantId>");
  process.exit(1);
}

reset(tenantId)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
