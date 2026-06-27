/** READ-ONLY: find items whose answer fields live at payload-level (not under questionData),
 * and items missing questionData. Dumps a few full samples. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
const __dirname = dirname(fileURLToPath(import.meta.url));
const SA = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json'), 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(SA), projectId: 'lvlup-ff6fa' });
const db = admin.firestore();
const T = 'tenant_subhang';
function rep(_k,v){ if(v&&typeof v==='object'&&typeof v._seconds==='number') return {__ts__:v._seconds}; return v; }
const oddNoQD = [], oddPayloadAns = [], qtWithoutQD = {};
const spaces = await db.collection(`tenants/${T}/spaces`).get();
for (const sp of spaces.docs) {
  const sps = await db.collection(`tenants/${T}/spaces/${sp.id}/storyPoints`).get();
  for (const s of sps.docs) {
    const items = await db.collection(`tenants/${T}/spaces/${sp.id}/storyPoints/${s.id}/items`).get();
    for (const it of items.docs) {
      const d = it.data(); const p = d.payload || {};
      const hasQD = p.questionData && typeof p.questionData === 'object';
      const payloadAns = ['correctAnswer','blanks','options','correctOrder','acceptableAnswers','modelAnswer','pairs'].some(k => p[k] !== undefined);
      if (d.type === 'question' && !hasQD) {
        qtWithoutQD[p.questionType ?? '(none)'] = (qtWithoutQD[p.questionType ?? '(none)'] ?? 0) + 1;
        if (oddNoQD.length < 6) oddNoQD.push({ id: it.id, spaceId: sp.id, storyPointId: s.id, ...d });
      }
      if (payloadAns && oddPayloadAns.length < 6) oddPayloadAns.push({ id: it.id, qt: p.questionType, payloadKeys: Object.keys(p), ...d });
    }
  }
}
console.log('question items WITHOUT questionData, by questionType:', JSON.stringify(qtWithoutQD, null, 2));
console.log('\nSamples without questionData (up to 6):');
oddNoQD.forEach(s => console.log(JSON.stringify(s, rep).slice(0, 900)));
console.log('\nSamples with payload-level answer fields (up to 6):');
oddPayloadAns.forEach(s => console.log('qt=', s.qt, 'payloadKeys=', s.payloadKeys, '|', JSON.stringify(s.payload, rep).slice(0, 700)));
writeFileSync(join(__dirname, 'out', 'src-odd-items.json'), JSON.stringify({ qtWithoutQD, oddNoQD, oddPayloadAns }, rep, 2));
process.exit(0);
