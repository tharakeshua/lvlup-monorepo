import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const P = 'v2_tenants/tn_content-levelup_526ba51515/spaces/spc_content-levelup-space-space-dsa_26218a59b7/storyPoints/stp_content-levelup-storypoint-space-dsa-sp-_4cfc722b3f/items';
async function main() {
  const all = await db.collection(P).get();
  console.log('total items in this SP:', all.size);
  for (const it of all.docs) {
    const d = it.data();
    const p = d.payload ?? {};
    console.log(`\n--- ${it.id}`);
    console.log('  type=', d.type, ' payload.questionType=', p.questionType, ' payload.kind=', p.kind);
    console.log('  item.content=', JSON.stringify(d.content), ' item.title=', JSON.stringify(d.title));
    console.log('  payload keys=', Object.keys(p).join(','));
    if (String(p.questionType)==='mcq') {
      console.log('  FULL PAYLOAD:', JSON.stringify(p, null, 1));
    }
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
