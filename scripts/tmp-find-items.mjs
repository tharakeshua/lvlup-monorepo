import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T = 'v2_tenants/tn_content-levelup_526ba51515';
async function main() {
  const sps = await db.collection(`${T}/storyPoints`).limit(200).get();
  console.log(`storyPoints: ${sps.size}`);
  // subcollections of first few storyPoints
  for (const sp of sps.docs.slice(0, 3)) {
    const c = await sp.ref.listCollections();
    console.log(`SP ${sp.id} (spaceId=${sp.data().spaceId}, type=${sp.data().type}) subcolls: [${c.map(x=>x.id).join(', ')}]`);
  }
  // spaces subcollections
  const spaces = await db.collection(`${T}/spaces`).limit(5).get();
  for (const s of spaces.docs.slice(0,2)) {
    const c = await s.ref.listCollections();
    console.log(`SPACE ${s.id} (${s.data().name}) subcolls: [${c.map(x=>x.id).join(', ')}]`);
  }
  // Count items across ALL storyPoints via items subcoll under each
  let total=0;
  for (const sp of sps.docs) {
    for (const cn of ['items','contentItems','questions']) {
      const it = await db.collection(`${sp.ref.path}/${cn}`).limit(1).get();
      if (it.size>0) { console.log(`  found under ${sp.id}/${cn}`); total+=it.size; }
    }
  }
  console.log('probe total', total);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
