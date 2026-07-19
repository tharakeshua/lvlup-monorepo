import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const auth=getAuth(app), db=getFirestore(app);
const API_KEY='AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const base='https://asia-south1-lvlup-ff6fa.cloudfunctions.net/';
async function callFn(fn,tok,data){const r=await fetch(base+fn,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},body:JSON.stringify({data})});return await r.json();}
const SPACE='BNgauCHCWi3rfHRLcsFy', ITEM='I8yX8s8TeE3qF1rNp5qF';
async function main(){
  // find storyPoint of the item
  let SP=null;
  const sps=await db.collection(`tenants/tenant_subhang/spaces/${SPACE}/storyPoints`).get();
  for(const sp of sps.docs){ const d=await db.doc(`${sp.ref.path}/items/${ITEM}`).get(); if(d.exists){SP=sp.id;break;} }
  console.log('item storyPoint:',SP);
  const raw=(await db.doc(`tenants/tenant_subhang/spaces/${SPACE}/storyPoints/${SP}/items/${ITEM}`).get()).data();
  console.log('\nRAW payload:',JSON.stringify(raw.payload,null,1).slice(0,900));
  console.log('RAW attachments:',JSON.stringify(raw.attachments));
  let token,u;do{const p=await auth.listUsers(1000,token);for(const x of p.users){const c=x.customClaims||{};if(c.tenantCode==='SUB001'&&c.role==='student'){u=x;break;}}token=p.pageToken;}while(token&&!u);
  const ct=await auth.createCustomToken(u.uid);
  const ex=await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:ct,returnSecureToken:true})})).json();
  const tok=ex.idToken;
  const resp=await callFn('v1-levelup-listItems',tok,{spaceId:SPACE,storyPointId:SP,limit:50});
  const item=(resp?.result?.items||[]).find(i=>i.id===ITEM);
  console.log('\nLIVE payload:',JSON.stringify(item?.payload,null,1));
  console.log('LIVE content:',JSON.stringify(item?.content));
  console.log('LIVE attachments:',JSON.stringify(item?.attachments));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.stack||e.message);process.exit(1);});
