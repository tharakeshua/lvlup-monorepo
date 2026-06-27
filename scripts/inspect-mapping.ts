/**
 * Inspect mapping artifacts for one or more submissions.
 * Run: npx tsx scripts/inspect-mapping.ts <tenantId> <subId> [<subId>...]
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

async function inspect(tenantId: string, subIds: string[]) {
  const db = admin.firestore();
  for (const subId of subIds) {
    console.log(`\n══════════ ${subId} ══════════`);
    const sub = await db.doc(`tenants/${tenantId}/submissions/${subId}`).get();
    if (!sub.exists) {
      console.log("  (not found)");
      continue;
    }
    const d = sub.data()!;
    console.log(`pipelineStatus      = ${d.pipelineStatus}`);
    console.log(`retryCount          = ${d.retryCount ?? 0}`);
    console.log(`pipelineError       = ${d.pipelineError ?? "(none)"}`);
    console.log(`answerSheets.images = ${d.answerSheets?.images?.length ?? 0} files`);
    if (d.answerSheets?.images?.length) {
      for (const [i, p] of (d.answerSheets.images as string[]).entries()) {
        console.log(`    [${i}] ${p}`);
      }
    }
    console.log(`scoutingResult      = ${d.scoutingResult ? "YES" : "NO"}`);
    if (d.scoutingResult) {
      const rm = d.scoutingResult.routingMap ?? {};
      console.log(`  routingMap keys   = ${Object.keys(rm).length}`);
      for (const [qid, pages] of Object.entries(rm)) {
        console.log(`    ${qid}: ${JSON.stringify(pages)}`);
      }
      const conf = d.scoutingResult.confidence ?? {};
      if (Object.keys(conf).length) {
        const avg =
          Object.values(conf).reduce((a: number, c) => a + (c as number), 0) /
          Object.keys(conf).length;
        console.log(`  avg confidence    = ${avg.toFixed(2)}`);
      }
    }

    const qsSnap = await sub.ref.collection("questionSubmissions").get();
    console.log(`questionSubmissions = ${qsSnap.size}`);
    if (qsSnap.size > 0 && qsSnap.size <= 30) {
      for (const q of qsSnap.docs) {
        const qd = q.data();
        const mapped = qd.mapping?.pageIndices?.length ?? 0;
        console.log(
          `    ${q.id}  status=${qd.gradingStatus}  pages=${JSON.stringify(qd.mapping?.pageIndices ?? [])}  imgs=${qd.mapping?.imageUrls?.length ?? 0}  score=${qd.evaluation?.score ?? "-"}/${qd.evaluation?.maxScore ?? "-"}`
        );
      }
    }
  }
}

const tenantId = process.argv[2];
const subIds = process.argv.slice(3);
if (!tenantId || subIds.length === 0) {
  console.error("Usage: npx tsx scripts/inspect-mapping.ts <tenantId> <subId> [<subId>...]");
  process.exit(1);
}
inspect(tenantId, subIds)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
