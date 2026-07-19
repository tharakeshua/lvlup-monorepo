import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const IDS=['185ZdZFs4Fznm5xHFA4i','a2CkPZ6ltrtBPkWIMaR4','oFufvf3BGKJex8j3ysqX','PIZvHmhsWUS048JtP3Gy','TZVWPjBJRJ8C0mxJk9ub','yBq4UZ4UsXtZHrY7khwH'];
const BASE='spaces/mjOdVfY9E1euZpUTITde/storyPoints/501hS6s3g28g4i0S7LRe/items';
for (const id of IDS) {
  for (const root of ['tenants','v2_tenants']) {
    const ref=db.doc(`${root}/tenant_subhang/${BASE}/${id}`);
    const d=await ref.get();
    if (d.exists) { await ref.delete(); console.log(`deleted ${root}/${id}`); }
  }
}
console.log('done');
process.exit(0);
