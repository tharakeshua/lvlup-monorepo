import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T = 'v2_tenants/tn_content-levelup_526ba51515';
const DSA = 'spc_content-levelup-space-space-dsa_26218a59b7';
async function main() {
  // space-nested storyPoints
  const nsps = await db.collection(`${T}/spaces/${DSA}/storyPoints`).get();
  console.log(`spaces/${DSA}/storyPoints: ${nsps.size}`);
  for (const sp of nsps.docs.slice(0,3)) {
    const c = await sp.ref.listCollections();
    console.log(` nested SP ${sp.id} type=${sp.data().type} subcolls=[${c.map(x=>x.id).join(', ')}]`);
    for (const cc of c) {
      const s = await cc.ref ? null : null;
    }
  }
  // dump items under first nested sp that has an items subcoll
  for (const sp of nsps.docs) {
    const c = await sp.ref.listCollections();
    for (const cc of c) {
      const snap = await db.collection(`${sp.ref.path}/${cc.id}`).limit(3).get();
      if (cc.id !== 'items') continue;
      console.log(`\nITEMS under ${sp.ref.path}/items: total?`);
      const all = await db.collection(`${sp.ref.path}/items`).get();
      console.log(' count=', all.size);
      let dumped=0;
      for (const it of all.docs) {
        const d = it.data();
        const p = d.payload ?? {};
        const qt = p.questionType ?? p.questionData?.questionType ?? d.type;
        if (String(qt)==='mcq' && dumped<3) {
          dumped++;
          console.log(`\n=== MCQ ${it.id}`);
          console.log('keys:', Object.keys(d).join(','));
          console.log('title:', JSON.stringify(d.title), '| content:', JSON.stringify(d.content));
          console.log('attachments:', JSON.stringify(d.attachments));
          console.log('payload.keys:', Object.keys(p).join(','));
          console.log('payload.title:', JSON.stringify(p.title), '| payload.content:', JSON.stringify(p.content));
          console.log('payload.questionData:', JSON.stringify(p.questionData,null,1).slice(0,1500));
        }
      }
      if(dumped>0) return;
    }
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
