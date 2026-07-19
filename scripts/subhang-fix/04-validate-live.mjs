/** Mechanical end-to-end validation: for every subhang space/storyPoint/item, fetch what the
 *  UI receives (live deployed API) AND the raw source doc, then flag UI-shape problems. */
import { readFileSync, writeFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const auth=getAuth(app), db=getFirestore(app);
const API_KEY='AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const base='https://asia-south1-lvlup-ff6fa.cloudfunctions.net/';
const T='tenants/tenant_subhang';
async function callFn(fn,tok,data){const r=await fetch(base+fn,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},body:JSON.stringify({data})});const j=await r.json();return {status:r.status,result:j?.result,error:j?.error};}

// build a map itemId -> raw source doc (attachments etc.)
async function buildRawIndex(){
  const idx = new Map();
  const spaces = await db.collection(`${T}/spaces`).get();
  for (const s of spaces.docs){
    const sps = await db.collection(`${s.ref.path}/storyPoints`).get();
    for (const sp of sps.docs){
      const its = await db.collection(`${sp.ref.path}/items`).get();
      for (const it of its.docs){ idx.set(it.id, it.data()); }
    }
  }
  return idx;
}

const OPTION_TYPES = new Set(['mcq','mcaq']);
function validate(item, raw){
  const problems=[];
  const type = item.type;
  const qt = item.payload?.questionData?.questionType;
  if (type==='question'){
    const text = (typeof item.content==='string' && item.content.trim()) || (typeof item.title==='string'&&item.title.trim());
    if (!text) problems.push('MISSING_QUESTION_TEXT');
    if (OPTION_TYPES.has(qt)){
      const opts = item.payload?.questionData?.options;
      if (!Array.isArray(opts)||opts.length===0) problems.push('MISSING_OPTIONS');
      else if (opts.some(o=>!o || typeof o.text!=='string' || !o.text.trim())) problems.push('EMPTY_OPTION_TEXT');
    }
  }
  // attachments dropped by projection?
  const rawAtt = Array.isArray(raw?.attachments)?raw.attachments.filter(a=>a&&a.type==='image'&&a.url):[];
  const uiAtt = Array.isArray(item.attachments)?item.attachments.filter(a=>a&&a.type==='image'&&a.url):[];
  if (rawAtt.length>0 && uiAtt.length===0) problems.push(`ATTACHMENTS_DROPPED(${rawAtt.length})`);
  if (rawAtt.length>0 && uiAtt.length>0 && uiAtt.length<rawAtt.length) problems.push(`ATTACHMENTS_PARTIAL(${uiAtt.length}/${rawAtt.length})`);
  return {problems, qt, type, hasRawImg: rawAtt.length};
}

async function main(){
  let token,u;do{const p=await auth.listUsers(1000,token);for(const x of p.users){const c=x.customClaims||{};if(c.tenantCode==='SUB001'&&c.role==='student'){u=x;break;}}token=p.pageToken;}while(token&&!u);
  const ct=await auth.createCustomToken(u.uid);
  const ex=await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:ct,returnSecureToken:true})})).json();
  const tok=ex.idToken;
  console.log('auth as', u.email);
  const raw = await buildRawIndex();
  console.log('raw source items indexed:', raw.size);

  const spaces=(await callFn('v1-levelup-listSpaces',tok,{limit:50})).result?.items||[];
  console.log('live spaces:', spaces.length);
  const report={ generatedFor:'tenants/tenant_subhang', spaces:[], summary:{items:0, withProblems:0, byProblem:{}, byQt:{}, attachmentsDropped:0, rawImgItems:0} };
  const flagged=[];
  for (const sp of spaces){
    const storyPoints=(await callFn('v1-levelup-listStoryPoints',tok,{spaceId:sp.id})).result?.items||[];
    let spItems=0, spProblem=0;
    for (const st of storyPoints){
      let cursor=undefined;
      do{
        const res=(await callFn('v1-levelup-listItems',tok,{spaceId:sp.id,storyPointId:st.id,limit:50,cursor})).result;
        const items=res?.items||[]; cursor=res?.nextCursor||undefined;
        for (const it of items){
          report.summary.items++; spItems++;
          const v=validate(it, raw.get(it.id));
          report.summary.byQt[v.qt||v.type]=(report.summary.byQt[v.qt||v.type]||0)+1;
          if (v.hasRawImg) report.summary.rawImgItems++;
          if (v.problems.length){
            report.summary.withProblems++; spProblem++;
            for (const p of v.problems){ const key=p.split('(')[0]; report.summary.byProblem[key]=(report.summary.byProblem[key]||0)+1; if(key==='ATTACHMENTS_DROPPED')report.summary.attachmentsDropped++; }
            flagged.push({ space:sp.title, spaceId:sp.id, storyPointId:st.id, itemId:it.id, type:v.type, qt:v.qt, problems:v.problems });
          }
        }
      }while(cursor);
    }
    report.spaces.push({ id:sp.id, title:sp.title, storyPoints:storyPoints.length, items:spItems, problemItems:spProblem });
    console.log(` ${sp.title}: sps=${storyPoints.length} items=${spItems} problems=${spProblem}`);
  }
  report.flagged=flagged;
  writeFileSync('subhang-fix/dumps/validation-report.json', JSON.stringify(report,null,2));
  console.log('\n=== SUMMARY ===');
  console.log('items:', report.summary.items, 'withProblems:', report.summary.withProblems);
  console.log('rawImgItems:', report.summary.rawImgItems, 'attachmentsDropped:', report.summary.attachmentsDropped);
  console.log('byProblem:', JSON.stringify(report.summary.byProblem,null,1));
  console.log('byQt:', JSON.stringify(report.summary.byQt));
  console.log('\nreport -> scripts/subhang-fix/dumps/validation-report.json');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
