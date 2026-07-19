/**
 * Verify AI Assessment Lab BATCH-2 append via the DEPLOYED student callables
 * (asia-south1, lvlup-ff6fa). Read-only except a single cheap start→abandon
 * precondition probe per NEW chat_agent_question item (no real conversation run).
 */
import { randomUUID } from "node:crypto";
const API_KEY = "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E";
const REGION = "asia-south1";
const PROJECT = "lvlup-ff6fa";
const EMAIL = "student.test@subhang.academy";
const PASSWORD = "Test@12345";
const SPACE_ID = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const CHAT_SP_ID = "stp_subhang-ai-lab-storypoint-ai-assessment-_2a0fd86ef0";
const NEW_CHAT_ITEMS = {
  "chat-b2-desert-island": "itm_subhang-ai-lab-item-ai-assessment-lab-sp_275c9c4896",
  "chat-b2-pizza-estimate": "itm_subhang-ai-lab-item-ai-assessment-lab-sp_2433c063ab",
  "chat-b2-teach-hobby": "itm_subhang-ai-lab-item-ai-assessment-lab-sp_919ed9a0bc",
};
const NEW_ITEM_IDS = new Set([
  "itm_subhang-ai-lab-item-ai-assessment-lab-sp_64b4f28634","itm_subhang-ai-lab-item-ai-assessment-lab-sp_74fe91ac24",
  "itm_subhang-ai-lab-item-ai-assessment-lab-sp_414f975690","itm_subhang-ai-lab-item-ai-assessment-lab-sp_3ce005a3c7",
  ...Object.values(NEW_CHAT_ITEMS),
]);
const EXPECT = { total: 41, spCounts: { "Rapid-Fire Fundamentals (Short Answer)": 8, "Explain Like a Senior (Long Answer)": 7, "Write the Function (Code)": 8, "Talk Through It (Audio Response)": 6, "Show Your Work (Diagram & Handwriting Upload)": 6, "The Interview Room (Live Mock Interview)": 6 } };

const fnUrl = (c) => `https://${REGION}-${PROJECT}.cloudfunctions.net/${c.replace(/\./g, "-")}`;
const BANNED = ["correctAnswer", "acceptableAnswers", "modelAnswer", "isCorrect", "correctOrder", "correctOptionIds", "answerKey", "evaluationGuidance", "privateEvaluationObjectives"];
function findLeak(v, path = "item") {
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const r = findLeak(v[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (v && typeof v === "object") { for (const [k, val] of Object.entries(v)) { if (BANNED.includes(k)) return `${path}.${k}`; const r = findLeak(val, `${path}.${k}`); if (r) return r; } }
  return null;
}
async function signIn() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }) });
  const j = await r.json(); if (!r.ok) throw new Error(`signIn: ${JSON.stringify(j)}`); return j.idToken;
}
async function callable(name, data, idToken) {
  const r = await fetch(fnUrl(name), { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ data }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${name} -> HTTP ${r.status}: ${JSON.stringify(j).slice(0, 700)}`);
  if (j.error) throw new Error(`${name} -> ${JSON.stringify(j.error).slice(0, 700)}`);
  return j.result;
}
async function main() {
  console.log("\n===== VERIFY AI Assessment Lab BATCH-2 (deployed callables, real student) =====");
  const idToken = await signIn(); console.log("✓ Signed in as", EMAIL);

  const spacesRes = await callable("v1.levelup.listSpaces", { limit: 100 }, idToken);
  const mine = (spacesRes.items ?? []).find((s) => s.id === SPACE_ID);
  if (!mine) { console.log("❌ space NOT visible"); process.exit(1); }
  console.log(`✅ space visible: "${mine.title}" [${mine.status}] stats=${JSON.stringify(mine.stats)}`);

  const stRes = await callable("v1.levelup.listStoryPoints", { spaceId: SPACE_ID }, idToken);
  const sps = (stRes.items ?? []).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  console.log(`\nlistStoryPoints -> ${sps.length} (expect 6)`);
  let total = 0, anyLeak = null, newSeen = 0; const typeByQ = {}; let countMismatch = null;
  for (const sp of sps) {
    const itRes = await callable("v1.levelup.listItems", { spaceId: SPACE_ID, storyPointId: sp.id, limit: 100 }, idToken);
    const items = (itRes.items ?? []).sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    total += items.length;
    const qtypes = new Set();
    for (const it of items) {
      const qt = it.payload?.questionData?.questionType ?? it.payload?.type;
      if (qt) { qtypes.add(qt); typeByQ[qt] = (typeByQ[qt] ?? 0) + 1; }
      if (NEW_ITEM_IDS.has(it.id)) newSeen++;
      const leak = findLeak(it, `item(${it.id})`); if (leak && !anyLeak) anyLeak = leak;
    }
    const exp = EXPECT.spCounts[sp.title];
    const ok = exp === items.length; if (!ok) countMismatch = `${sp.title}: got ${items.length}, expect ${exp}`;
    console.log(`  ${ok ? "✓" : "✗"} ${sp.title.padEnd(48)} items=${items.length}/${exp} stats.itemCount=${sp.stats?.itemCount} types=${[...qtypes].join(",")}`);
  }
  console.log(`\ntotal items: ${total} (expect ${EXPECT.total})`);
  console.log(`new batch-2 items surfaced: ${newSeen}/7 spot-checked ids`);
  console.log(`question types: ${JSON.stringify(typeByQ)}`);
  console.log(`TRUST BOUNDARY: ${anyLeak ? "❌ LEAK at " + anyLeak : "✅ no answer/answer-key field leaked"}`);

  // ── Chat precondition probes: start → abandon, one per NEW chat item ──
  console.log(`\n── chat_agent_question assessment-START precondition probes (new items) ──`);
  let chatOk = 0; const chatFails = [];
  for (const [key, itemId] of Object.entries(NEW_CHAT_ITEMS)) {
    try {
      const startRes = await callable("v1.levelup.startConversation", {
        clientRequestId: randomUUID(), mode: "agent_assessment",
        context: { kind: "agent_assessment", spaceId: SPACE_ID, storyPointId: CHAT_SP_ID, itemId },
      }, idToken);
      const session = startRes.session ?? startRes;
      const sid = session.id;
      console.log(`  ✓ ${key.padEnd(22)} start OK  session=${sid} status=${session.status}`);
      chatOk++;
      try { await callable("v1.levelup.abandonConversation", { sessionId: sid, clientRequestId: randomUUID() }, idToken); console.log(`      ↳ abandoned (cleanup)`); }
      catch (e) { console.log(`      ↳ abandon note: ${e.message.slice(0, 120)}`); }
    } catch (e) { chatFails.push(`${key}: ${e.message.slice(0, 200)}`); console.log(`  ✗ ${key.padEnd(22)} START FAILED: ${e.message.slice(0, 200)}`); }
  }

  console.log("\n===== SUMMARY =====");
  const pass = sps.length === 6 && total === EXPECT.total && newSeen === 7 && !anyLeak && !countMismatch && chatOk === 3;
  console.log(`storyPoints=6:${sps.length === 6} total=${EXPECT.total}:${total === EXPECT.total} newItems=7:${newSeen === 7} noLeak:${!anyLeak} counts:${!countMismatch} chatStarts=3:${chatOk === 3}`);
  if (countMismatch) console.log("count mismatch:", countMismatch);
  if (chatFails.length) console.log("chat fails:", chatFails.join(" | "));
  console.log(pass ? "\n✅ ALL CHECKS PASS" : "\n❌ SOME CHECKS FAILED");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("VERIFY ERROR:", e.message); process.exit(1); });
