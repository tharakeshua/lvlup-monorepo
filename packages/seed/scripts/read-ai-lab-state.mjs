/**
 * READ-ONLY: dump the current prod state of the AI Assessment Lab space
 * (tenant_subhang, v2_ root, lvlup-ff6fa) so a batch-2 append knows the exact
 * existing per-story-point item orders, counts, and ids. No writes.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SeedContext } from "../src/engine/context.js";

process.env.LVLUP_COLLECTION_PREFIX = "v2_";
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SA_PATH = join(REPO_ROOT, "lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json");

const PROJECT = "lvlup-ff6fa";
const TENANT = "tenant_subhang";
const SPACE_ID = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";

async function main() {
  const ctx = new SeedContext({ projectId: PROJECT, serviceAccountPath: SA_PATH, dryRun: true, logLevel: "error" });
  const db = ctx.admin.db;
  const base = `v2_tenants/${TENANT}`;

  const spaceSnap = await db.doc(`${base}/spaces/${SPACE_ID}`).get();
  console.log("SPACE exists:", spaceSnap.exists);
  const space = spaceSnap.data() ?? {};
  console.log("  title:", space.title, "| status:", space.status, "| evaluationSettingsId:", space.evaluationSettingsId);
  console.log("  stats:", JSON.stringify(space.stats));

  const spSnap = await db.collection(`${base}/spaces/${SPACE_ID}/storyPoints`).get();
  const sps = spSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  console.log(`\nSTORY POINTS: ${sps.length}`);
  const out = { space: { id: SPACE_ID, evaluationSettingsId: space.evaluationSettingsId }, storyPoints: [] };
  for (const sp of sps) {
    const itSnap = await db.collection(`${base}/spaces/${SPACE_ID}/storyPoints/${sp.id}/items`).get();
    const items = itSnap.docs.map((d) => {
      const x = d.data();
      const qt = x.questionData?.questionType ?? x.payload?.questionData?.questionType ?? x.type;
      return { id: d.id, orderIndex: x.orderIndex, points: x.points, questionType: qt, contentHead: String(x.content ?? "").slice(0, 55) };
    }).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const maxOrder = items.reduce((m, i) => Math.max(m, i.orderIndex ?? 0), -1);
    console.log(`\n• ${sp.title}`);
    console.log(`    id=${sp.id} orderIndex=${sp.orderIndex} stats.itemCount=${JSON.stringify(sp.stats?.itemCount)} realItems=${items.length} maxOrder=${maxOrder}`);
    for (const it of items) console.log(`      [ord ${it.orderIndex}] ${it.questionType?.padEnd(20)} pts=${it.points} ${it.id}  "${it.contentHead}"`);
    out.storyPoints.push({ title: sp.title, id: sp.id, orderIndex: sp.orderIndex, statsItemCount: sp.stats?.itemCount, realItemCount: items.length, maxOrder, items });
  }

  // existing agents + rubric presets (confirm keys/ids we must reuse for chat FK)
  const agSnap = await db.collection(`${base}/agents`).get();
  console.log(`\nAGENTS: ${agSnap.size}`);
  for (const d of agSnap.docs) { const a = d.data(); console.log(`  ${d.id}  type=${a.type} model=${a.modelPolicyId ?? a.modelPolicy?.id} active=${a.isActive} name="${a.name}" spaceId=${a.spaceId ?? a.spaceKey ?? "-"}`); }
  const rpSnap = await db.collection(`${base}/rubricPresets`).get();
  console.log(`\nRUBRIC PRESETS: ${rpSnap.size}`);
  for (const d of rpSnap.docs) { const r = d.data(); console.log(`  ${d.id}  name="${r.name}" dims=${(r.rubric?.dimensions ?? []).map((x) => x.key).join(",")}`); }
  const esSnap = await db.collection(`${base}/evaluationSettings`).get();
  console.log(`\nEVALUATION SETTINGS: ${esSnap.size}`);
  for (const d of esSnap.docs) { const e = d.data(); console.log(`  ${d.id}  name="${e.name}" isDefault=${e.isDefault}`); }

  const fs = await import("node:fs");
  fs.writeFileSync(join(__dirname, "ai-lab-state.json"), JSON.stringify(out, null, 2));
  console.log("\nwrote ai-lab-state.json");
  process.exit(0);
}
main().catch((e) => { console.error("READ FAILED:", e); process.exit(1); });
