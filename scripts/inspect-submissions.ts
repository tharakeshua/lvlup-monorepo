/**
 * Inspect submissions for a tenant.
 * Run: npx tsx scripts/inspect-submissions.ts <tenantId>
 */
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccount = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "../lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json"),
    "utf-8"
  )
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function inspect(tenantId: string) {
  const db = admin.firestore();
  const snap = await db
    .collection(`tenants/${tenantId}/submissions`)
    .orderBy("updatedAt", "desc")
    .limit(8)
    .get();

  for (const doc of snap.docs) {
    const d = doc.data();
    const qsSnap = await doc.ref.collection("questionSubmissions").get();
    const graded = qsSnap.docs.filter((q) => q.data().gradingStatus === "graded").length;
    console.log(
      [
        doc.id,
        `status=${d.pipelineStatus}`,
        `retries=${d.retryCount ?? 0}`,
        `score=${d.summary?.totalScore ?? "-"}/${d.summary?.maxScore ?? "-"}`,
        `qSubs=${qsSnap.size}`,
        `graded=${graded}`,
        d.pipelineError ? `err="${String(d.pipelineError).slice(0, 80)}"` : "",
        d.updatedAt?.toDate?.().toISOString?.() ?? "",
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }
}
inspect(process.argv[2] || "tenant_subhang")
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
