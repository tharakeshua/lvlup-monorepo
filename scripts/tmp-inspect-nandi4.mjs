/** READ-ONLY: locate items and dump MCQ item docs for nandini's DSA space. */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(
  readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8')
);
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);

const T = 'v2_tenants/tn_content-levelup_526ba51515';
const DSA = 'spc_content-levelup-space-space-dsa_26218a59b7';

async function main() {
  // storyPoints for DSA space
  const sps = await db.collection(`${T}/storyPoints`).where('spaceId', '==', DSA).limit(10).get();
  console.log(`STORYPOINTS for DSA (${sps.size}):`);
  for (const sp of sps.docs) {
    const d = sp.data();
    console.log(` ${sp.id}: title=${d.title ?? d.name} type=${d.type}`);
  }

  const sp0 = sps.docs[0];
  if (sp0) {
    const subs = await sp0.ref.listCollections();
    console.log(`\nSubcollections of storyPoint ${sp0.id}:`, subs.map(c => c.id).join(', '));
  }

  // look for items: try storyPoint subcollection 'items', tenant-level 'items'
  for (const sp of sps.docs.slice(0, 3)) {
    const items = await db.collection(`${sp.ref.path}/items`).limit(50).get();
    if (items.size > 0) {
      console.log(`\nITEMS under ${sp.ref.path}/items: ${items.size}`);
      let dumped = 0;
      for (const it of items.docs) {
        const d = it.data();
        const qt = d?.payload?.questionData?.questionType ?? d?.payload?.questionType ?? d?.questionType;
        if ((String(qt) === 'mcq' || String(qt) === 'mcaq') && dumped < 3) {
          console.log(`\n=== FULL DOC ${it.ref.path}`);
          console.log(JSON.stringify(d, null, 1));
          dumped++;
        }
      }
      if (dumped === 0) {
        console.log('No MCQ found; first item sample:');
        console.log(JSON.stringify(items.docs[0].data(), null, 1).slice(0, 2500));
      }
      if (dumped > 0) break;
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
