/**
 * AI Assessment Lab — batch-2b: add ONE criteria_based text item (AIQ-CONTENT-2
 * follow-up). The whole lab is dimension_based; the new UI's criteria LADDER needs
 * at least one criteria_based question (with criteria[].levels[]) to demo/verify.
 *
 * The seed engine's canonicalRubric() only emits holistic/dimension_based, so we
 * build the item SHELL via the real pipeline (correct id/paths/questionData/audit),
 * then SWAP its `rubric` for a hand-authored criteria_based UnifiedRubric, re-
 * validate against @levelup/domain UnifiedItemSchema, and write. No engine code
 * changes. Appends after the existing text items; idempotent (stable id).
 *
 * Usage: tsx packages/seed/scripts/seed-subhang-ai-lab-batch2b-criteria.mjs [--dry-run]
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as D from "@levelup/domain";
import { SeedContext } from "../src/engine/context.js";
import { SeedPipeline } from "../src/engine/pipeline.js";
import { seedId } from "../src/engine/ids.js";
import { validateSeedConfig } from "../src/config/schema.js";
import { assertFkConsistency } from "../src/config/fk.js";

process.env.LVLUP_COLLECTION_PREFIX = "v2_";
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SA_PATH = join(REPO_ROOT, "lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json");

const PROJECT = "lvlup-ff6fa";
const REAL_TENANT = "tenant_subhang";
const TENANT_KEY = "subhang-ai-lab";
const SPACE_KEY = "ai-assessment-lab";
const SPACE_ID = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const TEXT_SP_ID = "stp_subhang-ai-lab-storypoint-ai-assessment-_0a1cba1a02"; // orderIndex 0
const CLOCK_EPOCH_MS = Date.parse("2026-07-19T18:00:00.000Z");
const DRY_RUN = process.argv.includes("--dry-run");

// The one criteria_based item (short text, 2 criteria, each with a levels[] ladder).
const NEW_ITEM_KEY = "text-b2c-deadlock-criteria";
const NEW_ITEM_PROMPT =
  "In one or two sentences, explain what a DEADLOCK is in computing, and give a quick everyday analogy (for example, two people stuck in a narrow hallway).";

// Hand-authored criteria_based rubric — this is what the UI ladder renders.
const CRITERIA_RUBRIC = {
  scoringMode: "criteria_based",
  criteria: [
    { id: "definition", name: "Deadlock definition", maxScore: 3, weight: 0.6, levels: [
      { label: "Excellent (3)", score: 3, description: "Describes two or more processes each holding a resource while waiting for one the other holds — a circular wait that halts progress." },
      { label: "Partial (2)", score: 2, description: "Conveys mutual waiting / stuck-forever but misses the circular hold-and-wait detail." },
      { label: "Minimal (1)", score: 1, description: "Vaguely says things get stuck without explaining why." },
      { label: "Incorrect (0)", score: 0, description: "Wrong, or no real definition." },
    ] },
    { id: "analogy", name: "Everyday analogy", maxScore: 2, weight: 0.4, levels: [
      { label: "Clear (2)", score: 2, description: "A concrete analogy that captures mutual blocking (e.g. two people in a hallway each waiting for the other to step aside)." },
      { label: "Weak (1)", score: 1, description: "An analogy that is only loosely relevant to mutual blocking." },
      { label: "None (0)", score: 0, description: "No analogy given." },
    ] },
  ],
  passingPercentage: 60,
  showModelAnswer: false,
  modelAnswer:
    "A deadlock is when two or more processes are each holding a resource and waiting for a resource the other holds, so none can proceed (a circular wait). Analogy: two people meet in a narrow hallway and each waits for the other to move first, so nobody gets through.",
  evaluatorGuidance:
    "Score each criterion on its level ladder. 'definition' needs the circular hold-and-wait idea for full marks; mutual-waiting-without-the-cycle is Partial. 'analogy' rewards a concrete image of mutual blocking (hallway standoff, gridlock intersection). Keep it lenient on wording — this is a 1–2 sentence answer.",
};

// Placeholder rubric (config) — only used so the pipeline builds a valid item shell;
// it is REPLACED by CRITERIA_RUBRIC before writing.
const PLACEHOLDER_RUBRIC = { dimensions: [{ key: "x", label: "placeholder", weight: 1 }], totalPoints: 5, passingScore: 3 };

const RUBRIC_PRESETS = [
  { key: "rubric-systemdesign", name: "System Design Interview Rubric", category: "general", rubric: { dimensions: [
    { key: "scoping", label: "Requirements & Scoping", weight: 0.25 }, { key: "tradeoffs", label: "Trade-off Analysis", weight: 0.3 },
    { key: "scalability", label: "Scalability & Reliability", weight: 0.25 }, { key: "communication", label: "Communication", weight: 0.2 },
  ], totalPoints: 10, passingScore: 6 } },
];
const EVAL_SETTINGS = [{ key: "ai-assessment-default", name: "AI Assessment Defaults", isDefault: true, rubricPresetKey: "rubric-systemdesign", confidenceConfig: { lowThreshold: 0.6, highThreshold: 0.85 } }];

const NEW_ITEM = {
  key: NEW_ITEM_KEY, kind: "question", questionType: "short_answer", order: 8, points: 5,
  prompt: NEW_ITEM_PROMPT,
  answer: {
    correctAnswer: "A deadlock is a circular wait: two+ processes each hold a resource and wait for one the other holds, so none can proceed.",
    acceptableAnswers: ["circular wait", "two processes each waiting on the other's resource"],
    modelAnswer: CRITERIA_RUBRIC.modelAnswer,
    evaluationGuidance: "Full credit needs (a) the mutual/circular hold-and-wait definition AND (b) a concrete everyday analogy of mutual blocking. Half credit for the definition alone.",
  },
  rubric: PLACEHOLDER_RUBRIC,
};

const tenantConfig = {
  key: TENANT_KEY, name: "Subhang Academy (AI Assessment Lab staging)", code: "SUBAILAB",
  rubricPresets: RUBRIC_PRESETS, evaluationSettings: EVAL_SETTINGS,
  spaces: [{
    key: SPACE_KEY, title: "AI Assessment Lab",
    description: "A showcase course where every question is graded by AI. Practise short answers, essays, coding, spoken responses, diagram uploads, and live mock interviews — one story point per AI-evaluated question type.",
    type: "learning", status: "published", subject: "Software Engineering Interview Prep", accessType: "tenant_wide",
    storyPoints: [{ key: "sp-text", title: "Rapid-Fire Fundamentals (Short Answer)", type: "practice", order: 0, description: "Concise, AI-graded short-answer questions on core CS fundamentals.", items: [NEW_ITEM] }],
  }],
};
const seedConfig = { version: "1.0.0", tenants: [tenantConfig] };
const issues = (r, n = 8) => r.error.issues.slice(0, n).map((i) => `${i.path.join(".") || "<root>"}: ${i.code}${i.message ? ` (${i.message})` : ""}`);

async function main() {
  const synthTid = seedId("tenant", TENANT_KEY);
  console.log(`\n=== AI Lab batch-2b criteria_based item (${DRY_RUN ? "DRY-RUN" : "COMMIT"}) ===`);
  validateSeedConfig(seedConfig); assertFkConsistency(seedConfig);
  console.log("  ✓ config validated\n");

  const ctx = new SeedContext({ projectId: PROJECT, serviceAccountPath: SA_PATH, dryRun: true, logLevel: "error", clockEpochMs: CLOCK_EPOCH_MS });
  const captured = [];
  const origSet = ctx.batch.set.bind(ctx.batch);
  ctx.batch.set = async (ref, data, options) => { captured.push({ path: ref.path, data }); return origSet(ref, data, options); };
  await new SeedPipeline(ctx).run(seedConfig); await ctx.flush();

  const byPath = new Map();
  for (const { path, data } of captured) byPath.set(path, { ...(byPath.get(path) ?? {}), ...data });

  const synthBase = `v2_tenants/${synthTid}/`, realBase = `v2_tenants/${REAL_TENANT}/`;
  let itemDoc = null, answerKeyDoc = null;
  for (const [path, data] of byPath.entries()) {
    if (!path.startsWith(synthBase)) continue;
    const newPath = path.replace(synthBase, realBase);
    const d = { ...data }; if (d.tenantId === synthTid) d.tenantId = REAL_TENANT;
    if (/\/storyPoints\/[^/]+\/items\/[^/]+$/.test(newPath) && d.content === NEW_ITEM_PROMPT) itemDoc = { path: newPath, data: d };
    else if (/\/answerKeys\/[^/]+$/.test(newPath) && (d.itemId ? String(d.itemId).length : true)) answerKeyDoc = answerKeyDoc ?? { path: newPath, data: d };
  }
  if (!itemDoc) { console.log("  ✗ item shell not built"); process.exit(1); }

  // SWAP the placeholder rubric → hand-authored criteria_based rubric; drop rubricId (inline).
  itemDoc.data.rubric = CRITERIA_RUBRIC;
  delete itemDoc.data.rubricId;

  // Path must be under the EXISTING text story point.
  const expectPrefix = `${realBase}spaces/${SPACE_ID}/storyPoints/${TEXT_SP_ID}/items/`;
  if (!itemDoc.path.startsWith(expectPrefix)) { console.log(`  ✗ item path ${itemDoc.path} not under text SP ${TEXT_SP_ID}`); process.exit(1); }

  // Validate.
  const ir = D.UnifiedItemSchema.safeParse(itemDoc.data);
  console.log(`  item id: ${itemDoc.data.id}`);
  console.log(`  rubric.scoringMode: ${itemDoc.data.rubric.scoringMode}  criteria=${itemDoc.data.rubric.criteria.length}  levels=[${itemDoc.data.rubric.criteria.map((c) => c.levels.length).join(",")}]`);
  console.log(`  UnifiedItemSchema: ${ir.success ? "✓ pass" : "✗ FAIL"}`);
  if (!ir.success) { console.log("    " + issues(ir).join("\n    ")); process.exit(1); }
  if (answerKeyDoc) {
    const { tenantId, spaceId, storyPointId, ...rest } = answerKeyDoc.data;
    const ar = D.AnswerKeySchema.safeParse(rest);
    console.log(`  AnswerKeySchema: ${ar.success ? "✓ pass" : "✗ FAIL"}`);
    if (!ar.success) { console.log("    " + issues(ar).join("\n    ")); process.exit(1); }
  }

  // Idempotency-aware order/count: read current text-SP items.
  const db = ctx.admin.db;
  const itemsSnap = await db.collection(`${realBase}spaces/${SPACE_ID}/storyPoints/${TEXT_SP_ID}/items`).get();
  const existingIds = new Set(itemsSnap.docs.map((d) => d.id));
  const isReRun = existingIds.has(itemDoc.data.id);
  const newTotal = isReRun ? existingIds.size : existingIds.size + 1;
  const appendOrder = isReRun ? itemDoc.data.orderIndex : existingIds.size;
  itemDoc.data.orderIndex = appendOrder;
  console.log(`\n  text SP currently has ${existingIds.size} items; ${isReRun ? "RE-RUN (no-op count)" : "appending"} → orderIndex=${appendOrder}, stats.itemCount→${newTotal}`);

  if (DRY_RUN) { console.log("\n(dry-run) no writes.\n"); process.exit(0); }

  const batch = db.batch();
  batch.set(db.doc(itemDoc.path), itemDoc.data, { merge: true });
  if (answerKeyDoc) batch.set(db.doc(answerKeyDoc.path), answerKeyDoc.data, { merge: true });
  await batch.commit();
  await db.doc(`${realBase}spaces/${SPACE_ID}/storyPoints/${TEXT_SP_ID}`).update({ "stats.itemCount": newTotal });
  const spaceSnap = await db.doc(`${realBase}spaces/${SPACE_ID}`).get();
  const curSpaceCount = spaceSnap.data()?.stats?.itemCount ?? 0;
  const spaceTotal = isReRun ? curSpaceCount : curSpaceCount + 1;
  await db.doc(`${realBase}spaces/${SPACE_ID}`).update({ "stats.itemCount": spaceTotal });
  console.log(`  ✓ wrote item + answerKey; text SP stats.itemCount=${newTotal}; space stats.itemCount=${spaceTotal}`);
  console.log(`\n── DONE ── criteria_based item id: ${itemDoc.data.id}`);
  process.exit(0);
}
main().catch((e) => { console.error("SEED FAILED:", e); process.exit(1); });
