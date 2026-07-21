/**
 * W3 MEDIA end-to-end proof (AIQ) — proves that captured audio + image answers
 * reach the real Gemini grader and that the returned feedback REFERENCES the
 * media content. Runs against PROD (lvlup-ff6fa, tenant_subhang AI Assessment Lab)
 * as the test student.
 *
 * It exercises the EVALUATION half of the seam (media path → gateway bytes →
 * model → feedback) independently of the student-upload authz deploy: the media
 * is placed at a tenant-scoped Storage path via the Admin SDK, then submitted
 * through the student-facing `v1.levelup.evaluateAnswer` callable with a
 * top-level `mediaUrls` (server attaches them as image/audio parts, FIX-1
 * resolves path→bytes). The upload leg itself is proven separately by
 * packages/services request-upload-url.answer-media.test.ts (needs the
 * answer-media kind deployed for the client PUT).
 *
 * Media is SYNTHESIZED with known content so we can assert the model saw it:
 *  • image — a Playwright screenshot of a solved equation (2x+3=7 → x=2)
 *  • audio — `say` TTS of a binary-search explanation → m4a
 *
 * Run: node scripts/w3-media-e2e.mjs
 */
import { initializeApp as adminInit, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SPACE = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const IMAGE_SP = "stp_subhang-ai-lab-storypoint-ai-assessment-_4ac9d255be";
const IMAGE_ITEM = "itm_subhang-ai-lab-item-ai-assessment-lab-sp_0376b3dc11";
const AUDIO_SP = "stp_subhang-ai-lab-storypoint-ai-assessment-_aa4b6e183e";
const AUDIO_ITEM = "itm_subhang-ai-lab-item-ai-assessment-lab-sp_4439a720c1";
const BUCKETS = ["lvlup-ff6fa.appspot.com", "lvlup-ff6fa.firebasestorage.app"];

const work = mkdtempSync(join(tmpdir(), "w3-media-"));

async function makeImage() {
  const html = `<!doctype html><html><body style="margin:0;width:900px;height:1200px;background:#fffdf7;font-family:Georgia,serif">
    <div style="padding:80px;transform:rotate(-1.5deg)">
      <div style="font-size:42px;color:#1a1a1a;margin-bottom:40px">Solve for x:</div>
      <div style="font-size:64px;color:#14306b;line-height:2.1">
        2x + 3 = 7<br>
        2x = 7 − 3<br>
        2x = 4<br>
        x = 4 ÷ 2<br>
        <b>x = 2</b>
      </div>
      <div style="font-size:34px;color:#444;margin-top:60px">— my handwritten working</div>
    </div></body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await page.setContent(html);
  const path = join(work, "answer.png");
  await page.screenshot({ path });
  await browser.close();
  return { path, bytes: readFileSync(path), contentType: "image/png" };
}

function makeAudio() {
  const aiff = join(work, "answer.aiff");
  const m4a = join(work, "answer.m4a");
  const script =
    "Binary search works by repeatedly dividing a sorted array in half. " +
    "You compare the target to the middle element, and discard the half it cannot be in. " +
    "This gives a logarithmic time complexity, O of log n.";
  execFileSync("say", ["-o", aiff, script]);
  // aiff → m4a (aac) so it matches expo-av HIGH_QUALITY output the grader expects.
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", aiff, m4a]);
  return { path: m4a, bytes: readFileSync(m4a), contentType: "audio/mp4" };
}

async function uploadToAll(relPath, bytes, contentType) {
  for (const name of BUCKETS) {
    try {
      await getStorage().bucket(name).file(relPath).save(bytes, { contentType, resumable: false });
      console.log(`  uploaded → gs://${name}/${relPath} (${bytes.length} bytes)`);
    } catch (e) {
      console.log(`  upload FAIL gs://${name}: ${e.message}`);
    }
  }
}

function fmtEval(res) {
  if (!res.ok) return `FAIL code=${res.code} msg=${res.message} details=${JSON.stringify(res.details)}`;
  const e = res.data?.evaluation ?? {};
  const fb = [];
  const push = (label, v) => { if (v) fb.push(`${label}: ${typeof v === "string" ? v : JSON.stringify(v)}`); };
  push("score", `${e.score ?? e.earnedPoints}/${e.maxScore ?? e.totalPoints}`);
  push("summary", e.summary);
  push("feedback", e.feedback);
  push("strengths", e.strengths);
  push("weaknesses", e.weaknesses ?? e.improvements);
  push("structured", e.structuredFeedback);
  return fb.join("\n    ");
}

async function main() {
  const sa = JSON.parse(readFileSync("./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json", "utf8"));
  adminInit({ credential: cert(sa), storageBucket: BUCKETS[0] });

  console.log("=== W3 MEDIA E2E (prod, tenant_subhang AI Lab) ===\n");

  console.log("1) synthesize media");
  const img = await makeImage();
  const aud = makeAudio();
  console.log(`   image ${img.bytes.length}B · audio ${aud.bytes.length}B\n`);

  const stamp = Date.now().toString(36);
  const imgPath = `tenants/tenant_subhang/spaces/${SPACE}/items/${IMAGE_ITEM}/answers/e2e-w3/${stamp}.png`;
  const audPath = `tenants/tenant_subhang/spaces/${SPACE}/items/${AUDIO_ITEM}/answers/e2e-w3/${stamp}.m4a`;

  console.log("2) admin-upload to tenant-scoped Storage paths (both buckets)");
  await uploadToAll(imgPath, img.bytes, img.contentType);
  await uploadToAll(audPath, aud.bytes, aud.contentType);
  console.log("");

  console.log("3) sign in as test student + evaluate");
  const app = initializeApp({
    apiKey: "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E",
    authDomain: "lvlup-ff6fa.firebaseapp.com",
    projectId: "lvlup-ff6fa",
    appId: "1:504506746594:web:aac69e81f25dd95c5f80bb",
  });
  const fns = getFunctions(app, "asia-south1");
  await signInWithEmailAndPassword(getAuth(app), "student.test@subhang.academy", "Test@12345");
  const call = async (name, data) => {
    const t0 = Date.now();
    try {
      const r = (await httpsCallable(fns, name.replace(/\./g, "-"), { timeout: 180000 })(data)).data;
      return { ok: true, ms: Date.now() - t0, data: r };
    } catch (e) {
      return { ok: false, ms: Date.now() - t0, code: e?.code, message: e?.message, details: e?.details };
    }
  };

  console.log("\n── IMAGE answer (image_evaluation) ──");
  const imgRes = await call("v1.levelup.evaluateAnswer", {
    spaceId: SPACE,
    storyPointId: IMAGE_SP,
    itemId: IMAGE_ITEM,
    answer: { text: "My handwritten working is attached." },
    mediaUrls: [imgPath],
    mode: "practice",
  });
  console.log(`   ms=${imgRes.ms}\n    ${fmtEval(imgRes)}`);

  console.log("\n── AUDIO answer (audio) ──");
  const audRes = await call("v1.levelup.evaluateAnswer", {
    spaceId: SPACE,
    storyPointId: AUDIO_SP,
    itemId: AUDIO_ITEM,
    answer: { text: "" },
    mediaUrls: [audPath],
    mode: "practice",
  });
  console.log(`   ms=${audRes.ms}\n    ${fmtEval(audRes)}`);

  // content-reference assertions
  const blob = (r) => JSON.stringify(r.data?.evaluation ?? {}).toLowerCase();
  const imgRef = imgRes.ok && /(x\s*=\s*2|equation|solve|algebra|2x|handwrit|working)/i.test(blob(imgRes));
  const audRef = audRes.ok && /(binary search|log|middle|half|divid|sorted|o\(log)/i.test(blob(audRes));
  console.log("\n=== VERDICT ===");
  console.log(`IMAGE references media content: ${imgRef ? "YES ✓" : "NO ✗"}`);
  console.log(`AUDIO references media content: ${audRef ? "YES ✓" : "NO ✗"}`);

  writeFileSync(
    "./scripts/w3-media-e2e.result.json",
    JSON.stringify({ imgPath, audPath, image: imgRes, audio: audRes, imgRef, audRef }, null, 2)
  );
  console.log("\nfull result → scripts/w3-media-e2e.result.json");
  process.exit(imgRef && audRef ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E ERROR:", e);
  process.exit(2);
});
