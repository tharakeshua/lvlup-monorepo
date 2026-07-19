import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const auth = getAuth(app), db = getFirestore(app);
const API_KEY='AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const base='https://asia-south1-lvlup-ff6fa.cloudfunctions.net/';
async function callFn(fn, idToken, data){
  const r=await fetch(base+fn,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${idToken}`},body:JSON.stringify({data})});
  const t=await r.text(); try{return {status:r.status,json:JSON.parse(t)};}catch{return {status:r.status,raw:t.slice(0,300)};}
}
async function main(){
  // find a subhang student auth user
  let token, subUser;
  do{ const p=await auth.listUsers(1000,token);
    for(const u of p.users){ const c=u.customClaims||{}; if(c.tenantCode==='SUB001' && c.role==='student'){subUser=u;break;} }
    token=p.pageToken;
  }while(token && !subUser);
  if(!subUser){console.log('no SUB001 student found');return;}
  console.log('subhang student:',subUser.email,'uid=',subUser.uid,'claims=',JSON.stringify(subUser.customClaims));
  const ct=await auth.createCustomToken(subUser.uid);
  const ex=await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:ct,returnSecureToken:true})})).json();
  const idToken=ex.idToken; if(!idToken){console.log('exchange failed',JSON.stringify(ex));return;}
  const spaces=await callFn('v1-levelup-listSpaces',idToken,{limit:20});
  const items=spaces.json?.result?.items||[];
  console.log(`\nlistSpaces -> ${items.length} spaces`);
  const sp0=items[0]; if(sp0){ console.log(' space0:',sp0.id,sp0.title);
    const sps=await callFn('v1-levelup-listStoryPoints',idToken,{spaceId:sp0.id});
    const spList=sps.json?.result?.items||[];
    console.log(` listStoryPoints(${sp0.id}) -> ${spList.length} storyPoints`);
    if(spList[0]){ const it=await callFn('v1-levelup-listItems',idToken,{spaceId:sp0.id,storyPointId:spList[0].id,limit:20});
      console.log(` listItems(${spList[0].id}) -> ${(it.json?.result?.items||[]).length} items; status=${it.status}`); }
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
