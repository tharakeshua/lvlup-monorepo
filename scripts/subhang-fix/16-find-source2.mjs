import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const ID='I8yX8s8TeE3qF1rNp5qF';
// Try all common item paths across both roots
const paths = [
  'tenants/tenant_subhang/spaces/BNgauCHCWi3rfHRLcsFy/storyPoints/9tjs2PcWx2bRpr0gpBAb/items/'+ID,
  'v2_tenants/tenant_subhang/spaces/BNgauCHCWi3rfHRLcsFy/storyPoints/9tjs2PcWx2bRpr0gpBAb/items/'+ID,
  'v2_tenants/tenant_subhang/items/'+ID,
  'tenants/tenant_subhang/items/'+ID,
];
for (const p of paths) {
  const d = await db.doc(p).get().catch(e=>({exists:false, err:e.message}));
  console.log(p.replace('tenant_subhang','tn'), '->', d.exists?`content: ${JSON.stringify(String(d.data().content||'').slice(0,80))}`:'not found');
}
// Try collectionGroup(items) — likely needs index but let's try
try {
  const cg = await db.collectionGroup('items').where('__name__','>=',ID).where('__name__','<=',ID+'').limit(10).get();
  console.log('cg count:', cg.size);
  for (const d of cg.docs) console.log(' ', d.ref.path);
} catch(e){ console.log('cg failed:', e.message.slice(0,80)); }
// try tenant-level storyPoints items (v2_ has storyPoints tenant-level)
const tlSps = await db.collection('v2_tenants/tenant_subhang/storyPoints').get();
console.log('v2 tenant-level sps:', tlSps.size);
let found = 0;
for (const sp of tlSps.docs.slice(0, 50)) {
  const d = await db.doc(`${sp.ref.path}/items/${ID}`).get().catch(()=>null);
  if (d?.exists) { console.log(' FOUND at', d.ref.path); found++; break; }
}
if (!found) console.log(' not in v2 tenant-level storyPoints');
process.exit(0);
