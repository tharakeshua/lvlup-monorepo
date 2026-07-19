import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const P='spaces/BNgauCHCWi3rfHRLcsFy/storyPoints/9tjs2PcWx2bRpr0gpBAb/items/5eIFRnFmtSubC9bO0qPZ';
for (const root of ['tenants','v2_tenants']){
  const d=(await db.doc(`${root}/tenant_subhang/${P}`).get()).data();
  console.log(`\n=== ${root} ===`);
  console.log('type:',d.type,'  payload keys:',Object.keys(d.payload||{}).join(','));
  console.log('payload.type:',d.payload?.type,'  materialType:',d.payload?.materialType||d.payload?.materialData?.materialType);
  console.log('has richContent:',!!d.payload?.richContent,'  has materialData:',!!d.payload?.materialData);
  console.log('blocks source: richContent.blocks:',d.payload?.richContent?.blocks?.length||0,' materialData.blocks:',d.payload?.materialData?.blocks?.length||0);
}
process.exit(0);
