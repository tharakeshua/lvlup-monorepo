import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const T='tenants/tenant_subhang';
async function main(){
  const spaces = await db.collection(`${T}/spaces`).get();
  const stat={ total:0, byType:{}, richWithImgBlock:0, richNoImgBlock:0, questionWithAtt:0, materialWithAtt:0, materialTypes:{}, attTypes:{}, sampleQ:null, sampleImgBlock:null };
  for (const s of spaces.docs){
    const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
    for (const sp of sps.docs){
      const its = await db.collection(`${sp.ref.path}/items`).get();
      for (const it of its.docs){
        const d=it.data(); const att=Array.isArray(d.attachments)?d.attachments.filter(a=>a&&a.url):[];
        if(!att.length) continue;
        stat.total++;
        stat.byType[d.type]=(stat.byType[d.type]||0)+1;
        for(const a of att) stat.attTypes[a.type]=(stat.attTypes[a.type]||0)+1;
        const p=d.payload||{};
        if(d.type==='material'){ stat.materialWithAtt++; stat.materialTypes[p.materialType]=(stat.materialTypes[p.materialType]||0)+1;
          const blocks=p.richContent?.blocks||p.blocks||[];
          const hasImgBlock=blocks.some(b=>b&&b.type==='image');
          if(hasImgBlock){stat.richWithImgBlock++; if(!stat.sampleImgBlock)stat.sampleImgBlock=blocks.find(b=>b.type==='image');}
          else stat.richNoImgBlock++;
        } else if(d.type==='question'){ stat.questionWithAtt++; if(!stat.sampleQ)stat.sampleQ={id:it.id,qt:p.questionType||p.questionData?.questionType,att:att.slice(0,1),payloadKeys:Object.keys(p)}; }
      }
    }
  }
  console.log(JSON.stringify(stat,null,1));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
