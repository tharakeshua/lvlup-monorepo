import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const auth=getAuth(app);
const API_KEY='AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const base='https://asia-south1-lvlup-ff6fa.cloudfunctions.net/';
async function callFn(fn,tok,data){const r=await fetch(base+fn,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${tok}`},body:JSON.stringify({data})});return (await r.json())?.result;}
const SD='8rPWlVP4kyDp1xd75SnH';
async function main(){
  let token,subUser;do{const p=await auth.listUsers(1000,token);for(const u of p.users){const c=u.customClaims||{};if(c.tenantCode==='SUB001'&&c.role==='student'){subUser=u;break;}}token=p.pageToken;}while(token&&!subUser);
  const ct=await auth.createCustomToken(subUser.uid);
  const ex=await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:ct,returnSecureToken:true})})).json();
  const tok=ex.idToken;
  const sps=(await callFn('v1-levelup-listStoryPoints',tok,{spaceId:SD}))?.items||[];
  console.log(`SD space storyPoints: ${sps.length}`);
  let shown=0, imgShown=0;
  for(const sp of sps){
    const items=(await callFn('v1-levelup-listItems',tok,{spaceId:SD,storyPointId:sp.id,limit:50}))?.items||[];
    for(const it of items){
      const js=JSON.stringify(it);
      const hasImgRef=/image|\.png|\.jpg|diagram|storage|firebasestorage|http/i.test(js);
      if(hasImgRef && imgShown<4){imgShown++;
        console.log(`\n=== [img-ref] item ${it.id} type=${it.type} sp=${sp.title}`);
        console.log(' content:',JSON.stringify((it.content||'').slice(0,160)));
        console.log(' attachments:',JSON.stringify(it.attachments));
        console.log(' payload.type:',it.payload?.type,' materialType:',it.payload?.materialData?.materialType,' qt:',it.payload?.questionData?.questionType);
        console.log(' materialData:',JSON.stringify(it.payload?.materialData||{}).slice(0,300));
        // scan for embedded image markdown / urls in content
        const m=(it.content||'').match(/!\[[^\]]*\]\([^)]+\)|https?:\/\/\S+/g);
        if(m) console.log(' EMBEDDED-IN-CONTENT:',JSON.stringify(m).slice(0,300));
      } else if(shown<3){shown++;
        console.log(`\n--- item ${it.id} type=${it.type} qt=${it.payload?.questionData?.questionType} content="${(it.content||'').slice(0,80)}" attachments=${JSON.stringify(it.attachments)}`);
      }
    }
  }
  console.log(`\nDone. imgRefItems shown=${imgShown}`);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
