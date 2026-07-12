/** READ-ONLY: dump MCQ items via collection-group query for nandini's tenant. */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(
  readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8')
);
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);

const TENANT = 'tn_content-levelup_526ba51515';

async function main() {
  const snap = await db.collectionGroup('items').where('tenantId', '==', TENANT).get();
  console.log(`collectionGroup(items) tenant=${TENANT}: ${snap.size} docs`);

  // Only keep docs under v2_tenants
  const docs = snap.docs.filter(d => d.ref.path.startsWith('v2_tenants/'));
  console.log(`under v2_tenants: ${docs.length}`);

  const byQt = {};
  const mcqDocs = [];
  for (const d of docs) {
    const data = d.data();
    const qt = data?.payload?.questionData?.questionType
      ?? data?.payload?.questionType
      ?? data?.questionType
      ?? (data?.payload?.kind ? `kind:${data.payload.kind}/${data?.payload?.questionType}` : undefined)
      ?? `type:${data?.type}`;
    byQt[qt] = (byQt[qt] ?? 0) + 1;
    if (String(qt).includes('mcq')) mcqDocs.push(d);
  }
  console.log('\nBy questionType/type:', JSON.stringify(byQt, null, 1));

  for (const d of mcqDocs.slice(0, 3)) {
    console.log(`\n=== FULL DOC: ${d.ref.path}`);
    console.log(JSON.stringify(d.data(), null, 1));
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
