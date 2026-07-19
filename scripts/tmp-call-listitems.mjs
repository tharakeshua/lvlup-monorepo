/** READ-ONLY: call the DEPLOYED v1-levelup-listItems as nandi and inspect returned item shape. */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const auth = getAuth(app);
const API_KEY = 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const FN = 'https://asia-south1-lvlup-ff6fa.cloudfunctions.net/v1-levelup-listItems';
const SPACE = 'spc_content-levelup-space-space-dsa_26218a59b7';
const SP = 'stp_content-levelup-storypoint-space-dsa-sp-_4cfc722b3f';

async function main() {
  const u = await auth.getUserByEmail('nandini@learner.dev');
  console.log('nandi uid:', u.uid, 'claims:', JSON.stringify(u.customClaims));
  const customToken = await auth.createCustomToken(u.uid);
  // exchange for ID token
  const r1 = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const j1 = await r1.json();
  if (!j1.idToken) { console.log('token exchange failed:', JSON.stringify(j1)); return; }
  const idToken = j1.idToken;

  const r2 = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ data: { spaceId: SPACE, storyPointId: SP, limit: 20 } }),
  });
  const text = await r2.text();
  console.log('HTTP', r2.status);
  let j; try { j = JSON.parse(text); } catch { console.log('raw:', text.slice(0,500)); return; }
  const items = j?.result?.items ?? [];
  console.log(`RETURNED ${items.length} items\n`);
  for (const it of items) {
    console.log(`--- ${it.id} type=${it.type}`);
    console.log('  content =', JSON.stringify(it.content));
    console.log('  title =', JSON.stringify(it.title));
    console.log('  payload.type =', it.payload?.type, ' questionData.questionType =', it.payload?.questionData?.questionType);
    console.log('  options =', JSON.stringify(it.payload?.questionData?.options));
    console.log('  attachments =', JSON.stringify(it.attachments));
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error('ERR', e.message); process.exit(1);});
