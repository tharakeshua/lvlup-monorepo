import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T='v2_tenants/tenant_subhang';
// Does v2_ have space-nested storyPoints with items?
const spaces = await db.collection(`${T}/spaces`).get();
for (const s of spaces.docs.slice(0,3)) {
  const c = await s.ref.listCollections();
  console.log(`${s.id} subcolls: [${c.map(x=>x.id).join(',')}]`);
  const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
  console.log(`  nested storyPoints: ${sps.size}`);
  for (const sp of sps.docs.slice(0,1)) {
    const its = await db.collection(`${sp.ref.path}/items`).get();
    console.log(`    ${sp.id} items: ${its.size}`);
  }
}
// Also check: does the ID we saw at that path actually exist as a listable doc?
const ref = db.doc(`${T}/spaces/BNgauCHCWi3rfHRLcsFy/storyPoints/9tjs2PcWx2bRpr0gpBAb/items/I8yX8s8TeE3qF1rNp5qF`);
const d = await ref.get();
console.log('\ndirect fetch of the item:');
console.log(' exists:', d.exists, ' content:', JSON.stringify(String(d.data()?.content||'').slice(0,80)));
// List items under that storyPoint
const its = await db.collection(`${T}/spaces/BNgauCHCWi3rfHRLcsFy/storyPoints/9tjs2PcWx2bRpr0gpBAb/items`).get();
console.log(' items listed at that path:', its.size);
process.exit(0);
