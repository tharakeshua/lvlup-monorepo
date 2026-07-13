/**
 * Heal Greenwood parent notification for Aarav's upcoming/assigned test.
 *
 * Writes ONE parent-visible notification under
 *   v2_tenants/tn_greenwood_524e429639/notifications/{id}
 * for Suresh Patel (authUid), so parent-web /notifications can list it.
 *
 * Does NOT rewrite tenantCodes. Does NOT full-reseed.
 *
 * Usage: node scripts/heal-parent-test-notification.mjs
 */
import admin from "firebase-admin";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = process.cwd();
const saFile = readdirSync(root).find(
  (f) => f.includes("firebase-adminsdk") && f.endsWith(".json")
);
if (!saFile) throw new Error("No firebase-adminsdk JSON in monorepo root");

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, saFile), "utf8"))),
  projectId: "lvlup-ff6fa",
});
const db = admin.firestore();

const TID = "tn_greenwood_524e429639";
const PREFIX = "v2_";
const NOTIF_ID = "ntf_greenwood-parent-aarav-test_handover01";
const EXAM_ID = "exm_greenwood-demo-math-mid_handover01";
const now = new Date().toISOString();

mkdirSync("tmp", { recursive: true });

async function findParentAuthUid() {
  const byEmail = await db
    .collection(`${PREFIX}tenants/${TID}/parents`)
    .where("email", "==", "suresh.patel@gmail.com")
    .limit(1)
    .get();
  if (!byEmail.empty) {
    const d = byEmail.docs[0].data();
    return {
      parentId: byEmail.docs[0].id,
      authUid: d.authUid ?? null,
      displayName: d.displayName ?? `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim(),
    };
  }
  // Fallback: Auth lookup
  try {
    const user = await admin.auth().getUserByEmail("suresh.patel@gmail.com");
    return { parentId: null, authUid: user.uid, displayName: "Suresh Patel" };
  } catch {
    return { parentId: null, authUid: null, displayName: null };
  }
}

async function main() {
  const report = { healedAt: now, tenantId: TID, steps: [] };
  const parent = await findParentAuthUid();
  report.parent = parent;

  if (!parent.authUid) {
    report.error = "Could not resolve Suresh Patel authUid";
    writeFileSync("tmp/heal-parent-test-notification.json", JSON.stringify(report, null, 2));
    throw new Error(report.error);
  }

  const notifRef = db.doc(`${PREFIX}tenants/${TID}/notifications/${NOTIF_ID}`);
  const notif = {
    id: NOTIF_ID,
    tenantId: TID,
    recipientUid: parent.authUid,
    recipientId: parent.authUid,
    recipientRole: "parent",
    type: "new_exam_assigned",
    title: "Test assigned to your child",
    body: 'Aarav was assigned the test "Greenwood Demo — Grade 8 Math Midterm".',
    entityType: "exam",
    entityId: EXAM_ID,
    actionUrl: "/results",
    isRead: false,
    readAt: null,
    createdAt: now,
  };
  await notifRef.set(notif, { merge: true });
  report.steps.push({ notification: NOTIF_ID, recipientUid: parent.authUid });

  // Soft badge bump (best-effort; RTDB may be unavailable in some envs)
  try {
    const rtdb = admin.database();
    const path = `notifications/${TID}/${parent.authUid}`;
    await rtdb.ref(`${path}/latest`).set({
      id: NOTIF_ID,
      title: notif.title,
      type: notif.type,
      createdAt: Date.now(),
    });
    await rtdb.ref(`${path}/unreadCount`).transaction((c) => (c ?? 0) + 1);
    report.steps.push({ rtdb: "badge-updated" });
  } catch (e) {
    report.steps.push({ rtdb: "skipped", reason: String(e?.message ?? e) });
  }

  writeFileSync("tmp/heal-parent-test-notification.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
