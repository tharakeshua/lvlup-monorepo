/**
 * Probe v1.levelup.getEvaluationConfig for AI Lab items to (a) confirm the hook
 * returns a student-safe config and (b) find a CRITERIA_BASED item for the rich
 * HYE screenshot. Client SDK only, student auth.
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
    return { ok: true, data: (await httpsCallable(fns, name.replace(/\./g, "-"), { timeout: 120000 })(data)).data };
  } catch (e) {
    return { ok: false, code: e?.code, message: e?.message };
  }
};

async function main() {
  await signInWithEmailAndPassword(getAuth(app), "student.test@subhang.academy", "Test@12345");
  console.log("signed in\n");

  // walk story points → items
  const sps = await call("v1.levelup.listStoryPoints", { spaceId: SPACE });
  if (!sps.ok) return console.log("listStoryPoints failed:", sps.code, sps.message);
  const spArr = sps.data?.items ?? sps.data?.storyPoints ?? sps.data?.data ?? [];
  console.log(`listStoryPoints → ${spArr.length} SPs`);
  const arr = [];
  for (const sp of spArr) {
    const its = await call("v1.levelup.listItems", { spaceId: SPACE, storyPointId: sp.id, limit: 60 });
    if (its.ok) (its.data?.items ?? its.data?.data ?? []).forEach((it) => arr.push({ ...it, storyPointId: sp.id }));
  }
  console.log(`items total → ${arr.length}\n`);

  const questions = arr.filter((it) => (it.payload?.type ?? it.type) === "question");
  let criteriaHit = null;
  for (const it of questions.slice(0, 40)) {
    const qType = it.payload?.questionData?.questionType ?? it.payload?.questionType;
    const cfg = await call("v1.levelup.getEvaluationConfig", { spaceId: SPACE, itemId: it.id });
    if (!cfg.ok) {
      console.log(`- ${qType?.padEnd(18)} ${it.id.slice(-8)} → ERR ${cfg.code}`);
      continue;
    }
    const r = cfg.data?.config?.rubric;
    const s = cfg.data?.config?.settings;
    const mode = r?.scoringMode ?? "—";
    const nCrit = r?.criteria?.length ?? 0;
    const nDim = s?.enabledDimensions?.length ?? 0;
    const ladders = (r?.criteria ?? []).some((c) => (c.levels?.length ?? 0) > 0);
    console.log(
      `- ${String(qType).padEnd(18)} ${it.id.slice(-8)} → mode=${mode} criteria=${nCrit}${ladders ? "(ladders)" : ""} dims=${nDim}`
    );
    if (!criteriaHit && (nCrit > 0 || nDim > 0)) {
      criteriaHit = { id: it.id, storyPointId: it.storyPointId ?? it.payload?.storyPointId, qType, mode, nCrit, nDim };
    }
  }
  console.log("\nFIRST rich-HYE item:", JSON.stringify(criteriaHit));
}
main().catch((e) => { console.error(e?.message || e); process.exit(1); });
