/**
 * Heal production test credentials (passwords, super-admin claims + user doc).
 * Usage: npx tsx scripts/heal-test-credentials.ts
 */
import admin from "firebase-admin";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PASS = "Test@12345";

function resolveCredential(): admin.credential.Credential {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && existsSync(envPath)) {
    return admin.credential.cert(JSON.parse(readFileSync(envPath, "utf8")));
  }

  const localKey = readdirSync(ROOT).find(
    (name) => name.includes("firebase-adminsdk") && name.endsWith(".json")
  );
  if (localKey) {
    return admin.credential.cert(JSON.parse(readFileSync(join(ROOT, localKey), "utf8")));
  }

  return admin.credential.applicationDefault();
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: resolveCredential(),
    projectId: "lvlup-ff6fa",
  });
}

const auth = admin.auth();
const db = admin.firestore();

const accounts: Array<{ email: string; claims?: Record<string, unknown>; healUserDoc?: boolean }> =
  [
    { email: "superadmin@levelup.app", claims: { role: "superAdmin" }, healUserDoc: true },
    { email: "admin@greenwood.edu" },
    { email: "priya.sharma@greenwood.edu" },
    { email: "aarav.patel@greenwood.edu" },
    { email: "suresh.patel@gmail.com" },
    { email: "subhang.rocklee@gmail.com" },
    { email: "student.test@subhang.academy" },
    { email: "parent.test@subhang.academy" },
  ];

async function main() {
  for (const { email, claims, healUserDoc } of accounts) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.updateUser(user.uid, { password: PASS, disabled: false });

      if (claims) {
        const existing = user.customClaims ?? {};
        await auth.setCustomUserClaims(user.uid, { ...existing, ...claims });
      }

      if (healUserDoc) {
        await db.doc(`users/${user.uid}`).set(
          {
            uid: user.uid,
            email,
            displayName: "Super Admin",
            firstName: "Super",
            lastName: "Admin",
            isSuperAdmin: true,
            status: "active",
            authProviders: ["email"],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      console.log(`OK ${email}${claims ? " (+claims)" : ""}${healUserDoc ? " (+userDoc)" : ""}`);
    } catch (err) {
      console.error(`FAIL ${email}:`, err instanceof Error ? err.message : err);
    }
  }
}

main();
