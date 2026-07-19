/**
 * vc9 P0 repro — submit a solid answer to the binary-search text question via
 * v1.levelup.recordItemAttempt and inspect the returned progress.evaluation to
 * isolate client-vs-server for the "Not quite yet + empty feedback" report.
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const SPACE = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const app = initializeApp({
  apiKey: "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E",
  authDomain: "lvlup-ff6fa.firebaseapp.com",
  projectId: "lvlup-ff6fa",
  appId: "1:504506746594:web:aac69e81f25dd95c5f80bb",
});
const fns = getFunctions(app, "asia-south1");
const call = async (name, data) => {
  try {
    return { ok: true, data: (await httpsCallable(fns, name.replace(/\./g, "-"), { timeout: 180000 })(data)).data };
  } catch (e) {
    return { ok: false, code: e?.code, message: e?.message };
  }
};

async function main() {
  await signInWithEmailAndPassword(getAuth(app), "student.test@subhang.academy", "Test@12345");
  console.log("signed in\n");

  const sps = await call("v1.levelup.listStoryPoints", { spaceId: SPACE });
  const spArr = sps.data?.items ?? sps.data?.data ?? [];
  let target = null;
  for (const sp of spArr) {
    const its = await call("v1.levelup.listItems", { spaceId: SPACE, storyPointId: sp.id, limit: 60 });
    for (const it of its.data?.items ?? its.data?.data ?? []) {
      const content = (it.content ?? it.payload?.prompt ?? it.title ?? "").toLowerCase();
      if (content.includes("binary search") && content.includes("worst-case")) {
        target = { ...it, storyPointId: sp.id };
        break;
      }
    }
    if (target) break;
  }
  if (!target) return console.log("binary-search item not found");
  console.log("target item:", target.id, "| SP:", target.storyPointId);
  console.log("prompt:", (target.content ?? target.payload?.prompt ?? "").slice(0, 120), "\n");

  const answer =
    "The worst-case time complexity is O(log n). Binary search halves the search space each comparison: " +
    "after k comparisons at most n/2^k candidates remain, and it stops when that reaches 1, so k ≈ log2(n). " +
    "It's logarithmic because each step discards half the remaining sorted array.";

  console.log("submitting recordItemAttempt…\n");
  const res = await call("v1.levelup.recordItemAttempt", {
    spaceId: SPACE,
    storyPointId: target.storyPointId,
    itemId: target.id,
    answer,
    timeSpent: 30,
  });
  if (!res.ok) return console.log("recordItemAttempt FAILED:", res.code, res.message);

  const ev = res.data?.progress?.evaluation;
  console.log("=== progress.evaluation ===");
  console.log(JSON.stringify(ev, null, 2), "\n");
  console.log("=== SHAPE ANALYSIS ===");
  if (!ev) {
    console.log("evaluation is NULL/absent → client would fall back; SERVER thin/none");
  } else {
    console.log("score:", ev.score, "maxScore:", ev.maxScore, "percentage:", ev.percentage, "correctness:", ev.correctness);
    console.log("summary:", JSON.stringify(ev.summary));
    console.log("strengths:", (ev.strengths ?? []).length, "weaknesses:", (ev.weaknesses ?? []).length, "missingConcepts:", (ev.missingConcepts ?? []).length);
    console.log("structuredFeedback keys:", Object.keys(ev.structuredFeedback ?? {}));
    console.log("rubricBreakdown:", (ev.rubricBreakdown ?? []).length);
    const rich = ev.summary?.overallComment || ev.summary?.keyTakeaway || (ev.strengths ?? []).length || Object.keys(ev.structuredFeedback ?? {}).length;
    console.log(rich ? "→ SERVER returned RICH feedback (empty-feedback bug is CLIENT-side rendering)" : "→ SERVER returned THIN eval (empty-feedback is SERVER-side)");
  }
}
main().catch((e) => { console.error(e?.message || e); process.exit(1); });
