import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const ID='I8yX8s8TeE3qF1rNp5qF', P=`spaces/BNgauCHCWi3rfHRLcsFy/storyPoints/9tjs2PcWx2bRpr0gpBAb/items/${ID}`;
for (const root of ['tenants','v2_tenants']) {
  const d = (await db.doc(`${root}/tenant_subhang/${P}`).get()).data();
  console.log(`${root}: content(${d.content?.length||0}ch) marker=${/imgs:auto/.test(d.content||'')} pV2=${d.meta?._imagesPatchedV2||false} updatedAt=${d.updatedAt?.toDate?.() ?? d.updatedAt}`);
}
// Also compare attachments to figure out if v2_ has originals
for (const root of ['tenants','v2_tenants']) {
  const d = (await db.doc(`${root}/tenant_subhang/${P}`).get()).data();
  console.log(`${root} attachments:`, JSON.stringify(d.attachments||[]).length,'ch');
}
process.exit(0);
