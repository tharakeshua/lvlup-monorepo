/**
 * Seed auth storage state for live demo (bypasses flaky school-code form fill).
 */
import admin from "firebase-admin";
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(ROOT, "../tmp/demo-autograde-5776/auth-state.json");

const TEACHER_URL = process.env.TEACHER_WEB_URL ?? "https://lvlup-ff6fa-teacher.web.app";
const STUDENT_URL = process.env.STUDENT_WEB_URL ?? "https://lvlup-ff6fa-student.web.app";
const API_KEY = readFileSync(join(ROOT, "apps/student-web/.env.production"), "utf8")
  .match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]
  ?.trim();

function initAdmin() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS!;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(readFileSync(credPath, "utf8"))),
      projectId: "lvlup-ff6fa",
    });
  }
}

async function signInEmail(email: string, password: string) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body as { idToken: string; refreshToken: string; localId: string };
}

async function callSwitchTenant(idToken: string, tenantId: string) {
  const url = "https://asia-south1-lvlup-ff6fa.cloudfunctions.net/v1-identity-switchActiveTenant";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data: { targetTenantId: tenantId } }),
  });
  const body = await res.json();
  if (body.error) throw new Error(JSON.stringify(body.error));
  return body.result;
}

async function injectAuth(
  page: import("@playwright/test").Page,
  auth: Awaited<ReturnType<typeof signInEmail>>
) {
  // Firebase v9+ stores session in IndexedDB — use REST sign-in via page script.
  await page.goto("/login");
  await page.evaluate(
    async ({ apiKey, email, password }) => {
      const { getAuth, signInWithEmailAndPassword } =
        await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js");
      const { initializeApp } =
        await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
      const app = initializeApp({
        apiKey,
        authDomain: "lvlup-ff6fa.firebaseapp.com",
        projectId: "lvlup-ff6fa",
      });
      const auth = getAuth(app);
      await signInWithEmailAndPassword(auth, email, password);
    },
    { apiKey: API_KEY, email: "subhang.rocklee@gmail.com", password: "Test@12345" }
  );
}

async function main() {
  initAdmin();
  if (!API_KEY) throw new Error("Missing API key");

  mkdirSync(join(ROOT, "../tmp/demo-autograde-5776"), { recursive: true });

  const teacherAuth = await signInEmail("subhang.rocklee@gmail.com", "Test@12345");
  await callSwitchTenant(teacherAuth.idToken, "tenant_subhang");

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Teacher: manual login via UI with type instead of fill
  await page.goto(`${TEACHER_URL}/login`);
  await page.locator("#schoolCode").click();
  await page.locator("#schoolCode").pressSequentially("SUB001", { delay: 30 });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#email").waitFor({ state: "visible", timeout: 120_000 });
  await page.locator("#email").fill("subhang.rocklee@gmail.com");
  await page.locator("#password").fill("Test@12345");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(dashboard|exams)/, { timeout: 120_000 });

  await ctx.storageState({ path: OUT });
  writeFileSync(
    join(ROOT, "../tmp/demo-autograde-5776/auth-meta.json"),
    JSON.stringify(
      { teacherEmail: "subhang.rocklee@gmail.com", tenantId: "tenant_subhang" },
      null,
      2
    )
  );
  console.log("Saved auth state to", OUT);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
