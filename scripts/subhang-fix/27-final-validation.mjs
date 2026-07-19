/** Marker-aware validation: images-in-content-markdown counts as OK. */
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const auth=getAuth(app), db=getFirestore(app);
const API_KEY='AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const base='https://asia-south1-lvlup-ff6fa.cloudfunctions.net/';
async function callFn(fn,tok,data){const r=await fetch(base+fn,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},body:JSON.stringify({data})});return await r.json();}
const T='tenants/tenant_subhang';
const IMG_MD = /!\[[^\]]*\]\([^)]+\)/;
const MARKER = /<!--\s*imgs:auto\s*-->/;

async function buildRawIdx(){
  const idx=new Map();
  const spaces=await db.collection(`${T}/spaces`).get();
  for(const s of spaces.docs){const sps=await db.collection(`${s.ref.path}/storyPoints`).get();
    for(const sp of sps.docs){const its=await db.collection(`${sp.ref.path}/items`).get();
      for(const it of its.docs) idx.set(it.id, it.data());}}
  return idx;
}

function validate(item, raw){
  const problems=[];
  if(item.type==='question'){
    const text=(typeof item.content==='string' && item.content.trim()) || (typeof item.title==='string' && item.title.trim());
    if(!text) problems.push('MISSING_QUESTION_TEXT');
    const qt=item.payload?.questionData?.questionType;
    if(qt==='mcq'||qt==='mcaq'){
      const opts=item.payload?.questionData?.options;
      if(!Array.isArray(opts)||!opts.length) problems.push('MISSING_OPTIONS');
      else if(opts.some(o=>!o||typeof o.text!=='string'||!o.text.trim())) problems.push('EMPTY_OPTION_TEXT');
    }
  }
  // Attachments check — pass if the marker is present in content OR blocks
  const rawImgs = Array.isArray(raw?.attachments)?raw.attachments.filter(a=>a?.type==='image'&&a?.url):[];
  if (rawImgs.length){
    const contentHasImg = MARKER.test(item.content||'') || IMG_MD.test(item.content||'');
    const blocks = item.payload?.materialData?.blocks || item.payload?.richContent?.blocks || [];
    const blocksHaveImg = blocks.some(b => (b?.type==='paragraph' && MARKER.test(b?.content||'')) || b?.type==='image');
    const uiAtt = (item.attachments||[]).filter(a=>a?.type==='image'&&a?.url);
    if (uiAtt.length===0 && !contentHasImg && !blocksHaveImg) problems.push('IMAGES_STILL_MISSING');
  }
  return problems;
}

async function main(){
  let token,u;do{const p=await auth.listUsers(1000,token);for(const x of p.users){const c=x.customClaims||{};if(c.tenantCode==='SUB001'&&c.role==='student'){u=x;break;}}token=p.pageToken;}while(token&&!u);
  const ct=await auth.createCustomToken(u.uid);
  const ex=await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:ct,returnSecureToken:true})})).json();
  const tok=ex.idToken;
  const raw=await buildRawIdx();
  console.log('raw indexed:',raw.size);
  const summary={items:0,problems:0,byProblem:{},bySpace:{},imagesInjectedInContent:0,imagesInjectedInBlocks:0};
  const spaces=(await callFn('v1-levelup-listSpaces',tok,{limit:50})).result?.items||[];
  for(const sp of spaces){
    const sps=(await callFn('v1-levelup-listStoryPoints',tok,{spaceId:sp.id})).result?.items||[];
    let spProb=0;
    for(const st of sps){
      let cursor;
      do{
        const res=(await callFn('v1-levelup-listItems',tok,{spaceId:sp.id,storyPointId:st.id,limit:50,cursor})).result;
        const items=res?.items||[]; cursor=res?.nextCursor||undefined;
        for(const it of items){
          summary.items++;
          if(MARKER.test(it.content||'')) summary.imagesInjectedInContent++;
          const blocks=it.payload?.materialData?.blocks||[];
          if(blocks.some(b=>b?.type==='paragraph'&&MARKER.test(b?.content||''))) summary.imagesInjectedInBlocks++;
          const probs=validate(it,raw.get(it.id));
          if(probs.length){summary.problems++;spProb++;for(const p of probs)summary.byProblem[p]=(summary.byProblem[p]||0)+1;}
        }
      }while(cursor);
    }
    summary.bySpace[sp.title]={items: undefined, problems: spProb};
  }
  console.log('\n=== FINAL SUMMARY ==='); console.log(JSON.stringify(summary,null,2));
  writeFileSync('subhang-fix/dumps/final-validation.json',JSON.stringify(summary,null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
