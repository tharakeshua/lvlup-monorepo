/** Inspect the UNPREFIXED tenants/tenant_subhang (SSOT) SD space: find image-bearing
 *  items and print their EXACT shape so we know how to restore into v2_ canonical. */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T = 'tenants/tenant_subhang';

const IMG_RE = /image|\.png|\.jpg|\.jpeg|\.svg|\.webp|diagram|firebasestorage|storage\.googleapis|attachment/i;
async function main(){
  const spaces = await db.collection(`${T}/spaces`).get();
  const byShape = {};
  let totalItems=0, imgItems=0;
  const samples=[];
  for (const s of spaces.docs){
    const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
    for (const sp of sps.docs){
      const its = await db.collection(`${sp.ref.path}/items`).get();
      for (const it of its.docs){
        totalItems++;
        const d = it.data();
        const p = d.payload||{};
        // shape signature
        const sig = `type=${d.type||p.kind||p.type}|payloadKeys=${Object.keys(p).sort().join(',')}`;
        byShape[sig]=(byShape[sig]||0)+1;
        // image detection: attachments, imageUrl fields, markdown in content/body, rich blocks
        const js = JSON.stringify(d);
        if (IMG_RE.test(js)){
          imgItems++;
          if (samples.length<6){
            samples.push({ path: it.ref.path.replace(T+'/',''), space: s.data().title||s.data().name,
              type: d.type, attachments: d.attachments, content: (d.content||'').slice(0,120),
              payloadKeys: Object.keys(p), materialType: p.materialType, questionType: p.questionType||p.questionData?.questionType,
              imageBits: (js.match(/(!\[[^\]]*\]\([^)]+\))|(https?:\/\/[^"\\ ]+\.(png|jpe?g|svg|webp))|("imageUrl"\s*:\s*"[^"]+")|("type"\s*:\s*"image")/gi)||[]).slice(0,6),
              richBlocks: p.materialType==='rich'? (p.blocks||[]).map(b=>b.type):undefined,
            });
          }
        }
      }
    }
  }
  console.log('TOTAL items:', totalItems, ' image-ref items:', imgItems);
  console.log('\nSHAPE SIGNATURES:'); for (const [k,v] of Object.entries(byShape).sort((a,b)=>b[1]-a[1])) console.log(` ${v}\t${k}`);
  console.log('\nIMAGE SAMPLES:'); for (const s of samples){ console.log('\n'+JSON.stringify(s,null,1)); }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
