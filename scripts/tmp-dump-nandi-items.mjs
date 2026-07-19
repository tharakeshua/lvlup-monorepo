/** READ-ONLY: walk nandi's tenant tree directly (no indexes) and dump MCQ item shapes. */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);

const T = 'v2_tenants/tn_content-levelup_526ba51515';

async function main() {
  const subs = await db.doc(T).listCollections();
  console.log('TENANT SUBCOLLECTIONS:', subs.map(c => c.id).join(', '));

  // items might be tenant-level or under storyPoints. Try tenant-level items first.
  const topItems = await db.collection(`${T}/items`).limit(5).get();
  console.log(`\nTENANT-LEVEL ${T}/items: ${topItems.size}`);

  // Walk storyPoints -> items subcollection
  const sps = await db.collection(`${T}/storyPoints`).limit(200).get();
  console.log(`\nstoryPoints: ${sps.size}`);
  let scanned = 0, mcqDumped = 0;
  const qtCount = {};
  for (const sp of sps.docs) {
    const items = await db.collection(`${sp.ref.path}/items`).get();
    for (const it of items.docs) {
      scanned++;
      const d = it.data();
      const payload = d.payload ?? {};
      const qd = payload.questionData ?? {};
      const qt = payload.questionType ?? qd.questionType ?? d.questionType ?? `type:${d.type}`;
      qtCount[qt] = (qtCount[qt] ?? 0) + 1;
      if (String(qt) === 'mcq' && mcqDumped < 4) {
        mcqDumped++;
        console.log(`\n=== MCQ ITEM ${it.ref.path}`);
        console.log('TOP-LEVEL KEYS:', Object.keys(d).join(', '));
        console.log('item.title =', JSON.stringify(d.title));
        console.log('item.content =', JSON.stringify(d.content));
        console.log('item.attachments =', JSON.stringify(d.attachments));
        console.log('payload KEYS:', Object.keys(payload).join(', '));
        console.log('payload.title =', JSON.stringify(payload.title));
        console.log('payload.content =', JSON.stringify(payload.content));
        console.log('payload.questionType =', JSON.stringify(payload.questionType));
        console.log('payload.questionData =', JSON.stringify(qd, null, 1).slice(0, 2000));
      }
    }
    if (mcqDumped >= 4) break;
  }
  console.log(`\nScanned ${scanned} items. questionType histogram:`, JSON.stringify(qtCount, null, 1));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
