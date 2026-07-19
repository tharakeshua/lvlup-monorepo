import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
async function main(){
  // Question item
  const q = (await db.doc('tenants/tenant_subhang/spaces/BNgauCHCWi3rfHRLcsFy/storyPoints/9tjs2PcWx2bRpr0gpBAb/items/I8yX8s8TeE3qF1rNp5qF').get()).data();
  console.log('QUESTION top-level content =',JSON.stringify(q.content?.slice(0,140)),'... [len:', q.content?.length,']');
  console.log('QUESTION payload.content contains marker?', /imgs:auto/.test(q.payload?.content||''),' [len:',q.payload?.content?.length,']');
  console.log('QUESTION meta._imagesPatched=',q.meta?._imagesPatched);
  // Material item
  const m = (await db.doc('tenants/tenant_subhang/spaces/BNgauCHCWi3rfHRLcsFy/storyPoints/9tjs2PcWx2bRpr0gpBAb/items/5eIFRnFmtSubC9bO0qPZ').get()).data();
  const blocks = m.payload?.richContent?.blocks || [];
  console.log('MATERIAL richContent.blocks image count=',blocks.filter(b=>b?.type==='image').length,'/',blocks.length);
  console.log('MATERIAL meta._imagesPatched=',m.meta?._imagesPatched);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
