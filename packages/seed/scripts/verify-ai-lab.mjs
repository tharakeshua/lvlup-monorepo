/**
 * Verify the AI Assessment Lab course is visible + correctly projected to the REAL
 * student via the DEPLOYED callables (asia-south1, lvlup-ff6fa). Read-only.
 */
const API_KEY = "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E";
const REGION = "asia-south1";
const PROJECT = "lvlup-ff6fa";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const SPACE_ID = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const fnUrl = (c) => `https://${REGION}-${PROJECT}.cloudfunctions.net/${c.replace(/\./g, "-")}`;

const BANNED = ["correctAnswer", "acceptableAnswers", "modelAnswer", "isCorrect", "correctOrder", "correctOptionIds", "answerKey", "evaluationGuidance", "privateEvaluationObjectives"];
function findLeak(v, path = "item") {
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const r = findLeak(v[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (v && typeof v === "object") { for (const [k, val] of Object.entries(v)) { if (BANNED.includes(k)) return `${path}.${k}`; const r = findLeak(val, `${path}.${k}`); if (r) return r; } }
  return null;
}
async function signIn() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn failed: ${JSON.stringify(j)}`);
  return j.idToken;
}
async function callable(name, data, idToken) {
  const r = await fetch(fnUrl(name), {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${name} -> HTTP ${r.status}: ${JSON.stringify(j).slice(0, 600)}`);
  if (j.error) throw new Error(`${name} -> ${JSON.stringify(j.error).slice(0, 600)}`);
  return j.result;
}
async function main() {
  console.log("\n===== VERIFY AI Assessment Lab (deployed callables, real student) =====");
  const idToken = await signIn();
  console.log("✓ Signed in as", EMAIL);

  const spacesRes = await callable("v1.levelup.listSpaces", { limit: 100 }, idToken);
  const spaces = spacesRes.items ?? [];
  const mine = spaces.find((s) => s.id === SPACE_ID);
  console.log(`\nlistSpaces -> ${spaces.length} spaces total`);
  if (!mine) { console.log(`❌ AI Assessment Lab (${SPACE_ID}) NOT in listSpaces`); process.exit(1); }
  console.log(`✅ AI Assessment Lab visible: "${mine.title}" [${mine.status}/${mine.type}] stats=${JSON.stringify(mine.stats)}`);

  const getRes = await callable("v1.levelup.getSpace", { spaceId: SPACE_ID }, idToken);
  console.log(`✅ getSpace ok: "${(getRes.space ?? getRes).title}"`);

  const stRes = await callable("v1.levelup.listStoryPoints", { spaceId: SPACE_ID }, idToken);
  const sps = (stRes.items ?? []).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  console.log(`\nlistStoryPoints -> ${sps.length} story points (expect 6)`);
  let totalItems = 0, anyLeak = null;
  const typeByQ = {};
  for (const sp of sps) {
    const itRes = await callable("v1.levelup.listItems", { spaceId: SPACE_ID, storyPointId: sp.id, limit: 100 }, idToken);
    const items = itRes.items ?? [];
    totalItems += items.length;
    const qtypes = new Set();
    for (const it of items) {
      const qt = it.payload?.questionData?.questionType ?? it.payload?.type;
      if (qt) { qtypes.add(qt); typeByQ[qt] = (typeByQ[qt] ?? 0) + 1; }
      const leak = findLeak(it, `item(${it.id})`);
      if (leak && !anyLeak) anyLeak = leak;
    }
    console.log(`  • ${sp.title.padEnd(48)} items=${items.length}  types=${[...qtypes].join(",")}`);
  }
  console.log(`\ntotal items across story points: ${totalItems} (expect 21)`);
  console.log(`question types surfaced: ${JSON.stringify(typeByQ)}`);
  console.log(`TRUST BOUNDARY: ${anyLeak ? "❌ LEAK at " + anyLeak : "✅ no answer/answer-key field leaked to student"}`);
  console.log("\n===== END =====");
  process.exit(sps.length === 6 && totalItems === 21 && !anyLeak ? 0 : 1);
}
main().catch((e) => { console.error("VERIFY ERROR:", e.message); process.exit(1); });
