/** READ-ONLY: dump nandini's tenant content structure + MCQ items. */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(
  readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8')
);
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);

const T = 'v2_tenants/tn_content-levelup_526ba51515';
const STUDENT = 'stu_content-levelup-student-s-nandini_92700ac9c2';
const UID = 'usr_content-levelup-user-student-s-nandini_7aed9c9e37';

async function main() {
  // student doc
  for (const p of [`${T}/students/${STUDENT}`, `v2_users/${UID}`]) {
    const d = await db.doc(p).get();
    console.log(`\n--- ${p} exists=${d.exists}`);
    if (d.exists) console.log(JSON.stringify(d.data(), null, 1).slice(0, 1500));
  }

  // tenant subcollections
  const subs = await db.doc(T).listCollections();
  console.log('\nTENANT SUBCOLLECTIONS:', subs.map(c => c.id).join(', '));

  // spaces
  const spaces = await db.collection(`${T}/spaces`).limit(20).get();
  console.log(`\nSPACES (${spaces.size}):`);
  for (const s of spaces.docs) {
    const d = s.data();
    console.log(` ${s.id}: name=${d.name ?? d.title} status=${d.status} classIds=${JSON.stringify(d.classIds ?? d.assignedClassIds ?? null)}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
