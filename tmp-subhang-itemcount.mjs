import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
async function countTenant(T){
  const spaces = await db.collection(`${T}/spaces`).get();
  let spTotal=0, itemTotal=0, spWithItems=0;
  for (const s of spaces.docs){
    const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
    spTotal += sps.size;
    for (const sp of sps.docs){
      const its = await db.collection(`${sp.ref.path}/items`).get();
      if (its.size){ itemTotal+=its.size; spWithItems++; }
    }
  }
  console.log(`${T}: spaces=${spaces.size} storyPoints(nested)=${spTotal} spWithItems=${spWithItems} items=${itemTotal}`);
}
async function main(){
  await countTenant('v2_tenants/tenant_subhang');
  await countTenant('tenants/tenant_subhang');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
