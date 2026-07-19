import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T = 'v2_tenants/tenant_subhang';
async function main() {
  const spaces = await db.collection(`${T}/spaces`).get();
  console.log(`SUBHANG spaces (${spaces.size}):`);
  for (const s of spaces.docs) console.log(`  ${s.id}: ${s.data().title||s.data().name} subject=${s.data().subject}`);
  // find system design space
  const sd = spaces.docs.find(s => /system|design|hld|sd/i.test(`${s.data().title||''} ${s.data().name||''} ${s.data().subject||''} ${s.id}`));
  if (!sd) { console.log('no SD space found'); return; }
  console.log(`\nScanning SD space ${sd.id} for image-bearing items...`);
  const sps = await db.collection(`${sd.ref.path}/storyPoints`).get();
  let scanned=0, withImg=0, samples=0;
  for (const sp of sps.docs) {
    const items = await db.collection(`${sp.ref.path}/items`).get();
    for (const it of items.docs) {
      scanned++;
      const d = it.data();
      const json = JSON.stringify(d);
      const hasImg = /image|imageUrl|attachment|\.png|\.jpg|\.jpeg|\.svg|diagram|storage\.googleapis|firebasestorage/i.test(json);
      if (hasImg) {
        withImg++;
        if (samples < 4) {
          samples++;
          console.log(`\n=== IMG ITEM ${it.id}`);
          console.log('  top keys:', Object.keys(d).join(','));
          console.log('  attachments:', JSON.stringify(d.attachments));
          const p = d.payload||{};
          console.log('  payload keys:', Object.keys(p).join(','));
          console.log('  payload.kind/questionType/materialType:', p.kind, p.questionType, p.materialType);
          // find image-ish fields
          for (const [k,v] of Object.entries(p)) {
            const vs = JSON.stringify(v);
            if (/image|\.png|\.jpg|http|storage|diagram|url/i.test(vs)) console.log(`   payload.${k} =`, vs.slice(0,300));
          }
          for (const [k,v] of Object.entries(d)) {
            if (k==='payload') continue;
            const vs = JSON.stringify(v);
            if (/image|\.png|\.jpg|http|storage|diagram/i.test(vs)) console.log(`   item.${k} =`, vs.slice(0,300));
          }
        }
      }
    }
  }
  console.log(`\nSD scanned=${scanned} withImageRefs=${withImg}`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
