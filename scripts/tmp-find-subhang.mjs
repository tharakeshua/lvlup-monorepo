import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const sa = JSON.parse(readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'));
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
async function main() {
  for (const root of ['tenants','v2_tenants']) {
    const ts = await db.collection(root).listDocuments();
    const names = [];
    for (const t of ts) {
      if (/subhang/i.test(t.id)) names.push(t.id);
    }
    console.log(`${root}: ${ts.length} tenants; subhang matches: ${names.join(', ') || '(none)'}`);
    // also read tenantCode / name for each to find SUB001
    for (const t of ts) {
      const d = await t.get();
      const dd = d.data() || {};
      if (/sub/i.test(dd.tenantCode||'') || /subhang/i.test(dd.name||dd.title||'') || /subhang/i.test(t.id)) {
        console.log(`   -> ${root}/${t.id} code=${dd.tenantCode} name=${dd.name||dd.title}`);
      }
    }
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1);});
