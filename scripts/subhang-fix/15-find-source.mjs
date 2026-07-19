import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
// The live API returned item id=I8yX8s8TeE3qF1rNp5qF for subhang. Search all paths.
const ID='I8yX8s8TeE3qF1rNp5qF';
// Try _generic
const g1=await db.doc(`v2_tenants/tenant_subhang/_generic/items/entities/${ID}`).get().catch(()=>null);
console.log('v2 _generic/items/entities:',g1?.exists);
const g2=await db.doc(`v2_tenants/tenant_subhang/_generic/${ID}`).get().catch(()=>null);
console.log('v2 _generic/{id}:',g2?.exists);
// List _generic subcolls
const gCol = await db.collection('v2_tenants/tenant_subhang/_generic').listDocuments().catch(()=>[]);
console.log('v2 _generic docs:', gCol.map(d=>d.id));
for (const doc of gCol) {
  const subs = await doc.listCollections();
  console.log(` _generic/${doc.id} subcolls:`, subs.map(c=>c.id));
  for (const sc of subs) {
    const it = await sc.doc(ID).get().catch(()=>null);
    if (it?.exists) {
      console.log(` !! FOUND at ${it.ref.path}`);
      const d=it.data(); console.log('   content:',JSON.stringify(d.content?.slice(0,100)));
      console.log('   updatedAt:',d.updatedAt);
      console.log('   payload keys:',Object.keys(d.payload||{}));
    }
  }
}
process.exit(0);
