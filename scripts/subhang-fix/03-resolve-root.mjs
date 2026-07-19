import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const auth=getAuth(app), db=getFirestore(app);
const API_KEY='AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const base='https://asia-south1-lvlup-ff6fa.cloudfunctions.net/';
async function callFn(fn,tok,data){const r=await fetch(base+fn,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},body:JSON.stringify({data})});return (await r.json())?.result;}
const SD='8rPWlVP4kyDp1xd75SnH';
async function main(){
  let token,u;do{const p=await auth.listUsers(1000,token);for(const x of p.users){const c=x.customClaims||{};if(c.tenantCode==='SUB001'&&c.role==='student'){u=x;break;}}token=p.pageToken;}while(token&&!u);
  const ct=await auth.createCustomToken(u.uid);
  const ex=await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:ct,returnSecureToken:true})})).json();
  const tok=ex.idToken;
  const sps=(await callFn('v1-levelup-listStoryPoints',tok,{spaceId:SD}))?.items||[];
  const sp0=sps[0];
  const items=(await callFn('v1-levelup-listItems',tok,{spaceId:SD,storyPointId:sp0.id,limit:50}))?.items||[];
  console.log(`LIVE: SD space -> ${sps.length} storyPoints; storyPoint ${sp0.id} -> ${items.length} items`);
  const ids=items.map(i=>i.id);
  console.log('live item ids sample:',ids.slice(0,3));
  // Where does storyPoint sp0.id physically live?
  for (const root of ['tenants','v2_tenants']){
    const orig = await db.doc(`${root}/tenant_subhang/spaces/${SD}/storyPoints/${sp0.id}`).get();
    const its = orig.exists ? await db.collection(`${orig.ref.path}/items`).get() : {size:'n/a'};
    console.log(`  ${root}/…/spaces/${SD}/storyPoints/${sp0.id} exists=${orig.exists} items=${its.size}`);
    // also does the first live item id exist here?
    const found = orig.exists ? (await db.doc(`${orig.ref.path}/items/${ids[0]}`).get()).exists : false;
    console.log(`     item ${ids[0]} present here: ${found}`);
  }
  // Count SD items WITH attachments in original
  let att=0, tot=0;
  const origSps = await db.collection(`tenants/tenant_subhang/spaces/${SD}/storyPoints`).get();
  for(const sp of origSps.docs){ const its=await db.collection(`${sp.ref.path}/items`).get(); for(const it of its.docs){tot++; if(Array.isArray(it.data().attachments)&&it.data().attachments.length)att++;} }
  console.log(`\nORIGINAL SD space: ${tot} items, ${att} with attachments`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
