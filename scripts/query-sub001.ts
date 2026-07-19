import admin from "firebase-admin";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function resolveCredential(): admin.credential.Credential {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && existsSync(envPath)) {
    return admin.credential.cert(JSON.parse(readFileSync(envPath, "utf8")));
  }
  const localKey = readdirSync(ROOT).find(
    (n) => n.includes("firebase-adminsdk") && n.endsWith(".json")
  );
  if (!localKey) throw new Error("No service account JSON");
  return admin.credential.cert(JSON.parse(readFileSync(join(ROOT, localKey), "utf8")));
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: resolveCredential(), projectId: "lvlup-ff6fa" });
}

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  const tenants = await db.collection("tenants").where("tenantCode", "==", "SUB001").get();
  for (const t of tenants.docs) {
    console.log("TENANT", t.id, t.data().name);
    const classes = await db.collection(`tenants/${t.id}/classes`).get();
    for (const c of classes.docs) console.log(" CLASS", c.id, c.data().name);
    const students = await db.collection(`tenants/${t.id}/students`).limit(10).get();
    for (const s of students.docs) {
      const d = s.data();
      console.log(
        " STUDENT",
        s.id,
        d.firstName,
        d.lastName,
        d.email,
        d.rollNumber,
        "authUid",
        d.authUid
      );
    }
  }
  const teacher = await auth.getUserByEmail("subhang.rocklee@gmail.com");
  console.log("TEACHER UID", teacher.uid, "claims", JSON.stringify(teacher.customClaims));
  const student = await auth.getUserByEmail("student.test@subhang.academy");
  console.log("STUDENT UID", student.uid, "claims", JSON.stringify(student.customClaims));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
