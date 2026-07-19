/**
 * Provision Greenwood / platform Gemini keys for live autograde extraction.
 *
 * Root cause addressed:
 *   - A broken tenant secret (`tenant-{tenantId}-gemini`) blocked the resolver
 *     before platform fallback ("Failed to access the tenant Gemini key").
 *   - Platform default `levelup-default-gemini` was never provisioned in prod.
 *
 * Usage (requires a valid Google AI Studio / Gemini API key):
 *   $env:GEMINI_API_KEY="your-key"
 *   node scripts/heal-greenwood-gemini-key.mjs
 *
 * Optional:
 *   $env:PROVISION_TENANT_KEY="1"   # also rotate tenant key (not just platform)
 */
import admin from "firebase-admin";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const saFile =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  readdirSync(root).find((f) => f.includes("firebase-adminsdk") && f.endsWith(".json"));
if (!saFile) throw new Error("No firebase-adminsdk JSON in monorepo root");
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, saFile), "utf8"))),
  projectId: "lvlup-ff6fa",
});
const db = admin.firestore();

const TID = "tn_greenwood_524e429639";
const TENANT_SECRET = `tenant-${TID}-gemini`;
const API_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E";
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.LEVELUP_AI_KEY;
const PROVISION_TENANT = process.env.PROVISION_TENANT_KEY === "1";
const now = new Date().toISOString();

mkdirSync("tmp", { recursive: true });

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return res.json();
}

async function refreshToken(refreshToken) {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  return res.json();
}

async function call(name, idToken, data = {}) {
  const res = await fetch(`https://asia-south1-lvlup-ff6fa.cloudfunctions.net/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  return res.json();
}

async function tokenFor(email, password, tenantId) {
  const signed = await signIn(email, password);
  if (!signed.idToken) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(signed)}`);
  if (tenantId) {
    await call("v1-identity-switchActiveTenant", signed.idToken, { targetTenantId: tenantId });
    const refreshed = await refreshToken(signed.refreshToken);
    return refreshed.id_token || signed.idToken;
  }
  return signed.idToken;
}

async function main() {
  if (!GEMINI_KEY?.trim()) {
    throw new Error(
      "Set GEMINI_API_KEY (or LEVELUP_AI_KEY) to a valid Google Gemini API key before running."
    );
  }

  const report = {
    healedAt: now,
    tenantId: TID,
    steps: [],
    note: "Uses v1.identity.* callables; never prints the API key.",
  };

  // 1) Revoke any broken tenant secret so resolver can fall back to platform key.
  const adminToken = await tokenFor("admin@greenwood.edu", "Test@12345", TID);
  const revoke = await call("v1-identity-revokeTenantKey", adminToken, { provider: "google" });
  report.steps.push({ revokeTenantKey: revoke.result ?? revoke.error ?? revoke });

  // 2) Write platform default secret via super-admin callable.
  const superToken = await tokenFor("superadmin@levelup.app", "Test@12345");
  const platform = await call("v1-identity-savePlatformKey", superToken, {
    provider: "google",
    apiKey: GEMINI_KEY.trim(),
  });
  report.steps.push({ savePlatformKey: platform.result ?? platform.error ?? platform });

  if (platform.error) {
    writeFileSync("tmp/qa-gemini-key-heal-report.json", JSON.stringify(report, null, 2));
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  // 3) Optionally provision a fresh tenant key (same value) for Greenwood billing isolation.
  if (PROVISION_TENANT) {
    const rotate = await call("v1-identity-rotateTenantKey", adminToken, {
      provider: "google",
      apiKey: GEMINI_KEY.trim(),
    });
    report.steps.push({ rotateTenantKey: rotate.result ?? rotate.error ?? rotate });
    await db.doc(`v2_tenants/${TID}`).set(
      {
        settings: {
          timezone: "Asia/Kolkata",
          locale: "en",
          geminiKeyRef: TENANT_SECRET,
          geminiKeySet: true,
        },
        updatedAt: now,
      },
      { merge: true }
    );
  } else {
    await db.doc(`v2_tenants/${TID}`).set(
      {
        settings: {
          timezone: "Asia/Kolkata",
          locale: "en",
          geminiKeyRef: null,
          geminiKeySet: false,
        },
        updatedAt: now,
      },
      { merge: true }
    );
    report.steps.push({
      tenantSettings: "platform fallback only (geminiKeyRef cleared, geminiKeySet false)",
    });
  }

  // 4) Smoke: platform + tenant key status (never returns key material).
  const platStatus = await call("v1-identity-getPlatformKeyStatus", superToken, {
    provider: "google",
  });
  const tenantStatus = await call("v1-identity-getTenantKeyStatus", adminToken, {
    provider: "google",
  });
  report.steps.push({
    platformKeyStatus: platStatus.result ?? platStatus.error,
    tenantKeyStatus: tenantStatus.result ?? tenantStatus.error,
  });

  writeFileSync("tmp/qa-gemini-key-heal-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
