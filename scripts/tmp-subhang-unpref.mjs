import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
async function probe(T){
  const subs = await db.doc(T).listCollections();
  console.log(`\n### ${T} subcolls: ${subs.map(c=>c.id).join(', ')}`);
  // storyPoints structure
  const sps = await db.collection(`${T}/storyPoints`).limit(1).get();
  if (sps.size){ const c = await sps.docs[0].ref.listCollections(); console.log(` storyPoint[0]=${sps.docs[0].id} subcolls=[${c.map(x=>x.id).join(',')}] keys=[${Object.keys(sps.docs[0].data()).join(',')}]`);
    const itc = c.find(x=>x.id==='items'); if(itc){ const its=await itc.ref.limit(200).get(); console.log(`   items subcoll count(<=200)=${its.size}`);} }
  // space nested
  const spaces = await db.collection(`${T}/spaces`).limit(1).get();
  if (spaces.size){ const c=await spaces.docs[0].ref.listCollections(); console.log(` space[0]=${spaces.docs[0].id} subcolls=[${c.map(x=>x.id).join(',')}]`); }
  // items collectionGroup count under this tenant root — sample any items subcoll
}
async function main(){
  await probe('tenants/tenant_subhang');
  // Try to find ANY item doc + image sample in unprefixed
  const T='tenants/tenant_subhang';
  const sps = await db.collection(`${T}/storyPoints`).limit(300).get();
  let found=0, imgShown=0, totalItems=0;
  for (const sp of sps.docs){
    const its = await db.collection(`${sp.ref.path}/items`).get();
    if (its.size){ totalItems+=its.size; found++;
      for (const it of its.docs){ const js=JSON.stringify(it.data());
        if (imgShown<3 && /image|\.png|\.jpg|diagram|storage|firebasestorage/i.test(js)){ imgShown++;
          const d=it.data(); const p=d.payload||{};
          console.log(`\n=== IMG item ${it.ref.path.split('/').slice(-3).join('/')}`);
          console.log(' top keys:',Object.keys(d).join(','));
          console.log(' attachments:',JSON.stringify(d.attachments));
          console.log(' content:',JSON.stringify(d.content||'').slice(0,200));
          console.log(' payload keys:',Object.keys(p).join(','),' kind/qt/mt:',p.kind,p.questionType,p.materialType);
          for (const [k,v] of Object.entries(p)){ const vs=JSON.stringify(v); if(/image|\.png|\.jpg|http|storage|diagram|url|body/i.test(vs)) console.log(`  payload.${k}=`,vs.slice(0,260)); }
        }
      }
    }
    if(imgShown>=3 && found>3) break;
  }
  console.log(`\nunpref subhang: storyPointsScanned=${sps.size} spWithItems=${found} totalItems(partial)=${totalItems}`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
