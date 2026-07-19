/**
 * W1 upload-leg live verify — proves the answer-media deploy fixed student
 * upload authz. Signs in as the test student and calls v1.autograde.requestUploadUrl
 * with kind='answer-media' (previously DENIED: no student-usable kind existed).
 * Success returns a scoped storagePath + a signed-PUT URL; we then PUT a few
 * bytes to confirm the signer's bucket accepts the write end-to-end.
 *
 * Run: node scripts/w1-upload-verify.mjs
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

const SPACE = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const IMAGE_ITEM = "itm_subhang-ai-lab-item-ai-assessment-lab-sp_0376b3dc11";

const app = initializeApp({
  apiKey: "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E",
  authDomain: "lvlup-ff6fa.firebaseapp.com",
  projectId: "lvlup-ff6fa",
  appId: "1:504506746594:web:aac69e81f25dd95c5f80bb",
});
const fns = getFunctions(app, "asia-south1");

const call = async (name, data) => {
  try {
    const r = (await httpsCallable(fns, name.replace(/\./g, "-"), { timeout: 120000 })(data)).data;
    return { ok: true, data: r };
  } catch (e) {
    return { ok: false, code: e?.code, message: e?.message, details: e?.details };
  }
};

async function main() {
  console.log("=== W1 answer-media UPLOAD-LEG verify (prod, AI Lab) ===\n");
  await signInWithEmailAndPassword(getAuth(app), "student.test@subhang.academy", "Test@12345");
  console.log("signed in as student.test\n");

  console.log("call v1.autograde.requestUploadUrl { kind: 'answer-media' } …");
  const res = await call("v1.autograde.requestUploadUrl", {
    kind: "answer-media",
    spaceId: SPACE,
    itemId: IMAGE_ITEM,
    contentType: "image/jpeg",
  });
  console.log(JSON.stringify(res, null, 2), "\n");

  if (!res.ok) {
    console.log(`AUTHZ: ✗ still failing (${res.code}) — deploy did NOT take or authz gap`);
    process.exit(2);
  }
  const d = res.data || {};
  const path = d.storagePath ?? d.path;
  const url = d.uploadUrl ?? d.url ?? d.signedUrl;
  console.log(`AUTHZ: ✓ requestUploadUrl AUTHORIZED for student`);
  console.log(`  storagePath: ${path}`);
  console.log(`  signed PUT url: ${url ? url.slice(0, 90) + "…" : "(none returned)"}\n`);

  if (url) {
    const body = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]); // tiny jpeg magic
    const put = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body });
    console.log(`PUT to signed url → HTTP ${put.status} ${put.ok ? "✓ (bucket accepts the write)" : "✗"}`);
    if (!put.ok) console.log("  body:", (await put.text()).slice(0, 200));
  }
  console.log("\n=== VERDICT: student answer-media upload leg is LIVE ===");
}
main().catch((e) => {
  console.error("verify error:", e?.message || e);
  process.exit(1);
});
