import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const IDS = ['185ZdZFs4Fznm5xHFA4i','a2CkPZ6ltrtBPkWIMaR4','oFufvf3BGKJex8j3ysqX'];
const base = 'spaces/mjOdVfY9E1euZpUTITde/storyPoints/501hS6s3g28g4i0S7LRe/items';
for (const id of IDS) {
  for (const root of ['tenants','v2_tenants']) {
    const d=(await db.doc(`${root}/tenant_subhang/${base}/${id}`).get()).data();
    if (!d) { console.log(`${root}/${id}: MISSING`); continue; }
    const p=d.payload||{};
    console.log(`${root}/${id}: type=${d.type} qt=${p.questionType||p.questionData?.questionType} pKeys=[${Object.keys(p).join(',')}] options.len=${(p.options||p.questionData?.options||[]).length}`);
    if (root==='tenants' && !((p.options||p.questionData?.options||[]).length)) console.log('   full payload:', JSON.stringify(p).slice(0,300));
  }
  console.log('');
}
process.exit(0);
