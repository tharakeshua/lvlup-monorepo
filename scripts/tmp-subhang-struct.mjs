import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T = 'v2_tenants/tenant_subhang';
const SD = '8rPWlVP4kyDp1xd75SnH';
async function main() {
  const subs = await db.doc(T).listCollections();
  console.log('SUBHANG tenant subcolls:', subs.map(c=>c.id).join(', '));
  // tenant-level storyPoints filtered by spaceId?
  const spCol = subs.find(c=>c.id==='storyPoints');
  if (spCol) {
    const all = await db.collection(`${T}/storyPoints`).limit(500).get();
    const forSD = all.docs.filter(d=>d.data().spaceId===SD);
    console.log(`tenant storyPoints total=${all.size}, forSD=${forSD.length}`);
    if (forSD[0]) {
      const c = await forSD[0].ref.listCollections();
      console.log(` SD storyPoint ${forSD[0].id} subcolls=[${c.map(x=>x.id).join(',')}]`);
    }
  }
  // tenant-level items?
  const itCol = subs.find(c=>c.id==='items');
  if (itCol) {
    const q = await db.collection(`${T}/items`).where('spaceId','==',SD).limit(3).get().catch(async()=>await db.collection(`${T}/items`).limit(3).get());
    console.log(`\ntenant-level items sample (${q.size}):`);
    for (const it of q.docs) {
      const d=it.data(); const p=d.payload||{};
      console.log(` ${it.id}: spaceId=${d.spaceId} keys=[${Object.keys(d).join(',')}] payloadKeys=[${Object.keys(p).join(',')}]`);
    }
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
