/** READ-ONLY probe of the repro item across legacy + v2_, replicating SDK-coord's collectionGroup queries. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
const __dirname = dirname(fileURLToPath(import.meta.url));
const SA = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json'), 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(SA), projectId: 'lvlup-ff6fa' });
const db = admin.firestore();

const T = 'tenant_subhang', S = 'ZikR8xEHkqIaIsugmdQg', SP = 'NUDWSZDR9YRnPJX6qoeP', I = 'dPTqKIhlczsSTkiMr7Nw';
const j = (o) => JSON.stringify(o, (k, v) => (v && v._seconds ? { ts: v._seconds } : v));

async function tryGet(label, path) {
  const s = await db.doc(path).get();
  console.log(`${s.exists ? '✓' : '✗'} ${label}: ${path}`);
  return s.exists ? s.data() : null;
}

async function main() {
  console.log('\n=== LEGACY (unprefixed) ===');
  const legNested = await tryGet('legacy nested', `tenants/${T}/spaces/${S}/storyPoints/${SP}/items/${I}`);
  await tryGet('legacy flat spaces/items', `tenants/${T}/spaces/${S}/items/${I}`);
  if (legNested) console.log('  legacy type:', legNested.type, '| qt:', legNested.payload?.questionType, '| payload keys:', Object.keys(legNested.payload || {}));

  console.log('\n=== V2 (v2_ prefixed) ===');
  const v2item = await tryGet('v2 nested item', `v2_tenants/${T}/spaces/${S}/storyPoints/${SP}/items/${I}`);
  if (v2item) {
    console.log('  v2 type:', v2item.type, '| id field:', v2item.id, '| tenantId field:', v2item.tenantId, '| spaceId:', v2item.spaceId, '| storyPointId:', v2item.storyPointId);
    console.log('  v2 payload:', j(v2item.payload).slice(0, 500));
  }
  const v2ak = await tryGet('v2 answerKey', `v2_tenants/${T}/spaces/${S}/storyPoints/${SP}/items/${I}/answerKeys/${I}`);
  if (v2ak) console.log('  v2 answerKey:', j(v2ak).slice(0, 600));

  console.log('\n=== collectionGroup replicas (SDK-coord queries) ===');
  const cgItems = await db.collectionGroup('items').where('id', '==', I).where('tenantId', '==', T).get();
  console.log(`collectionGroup('items').where(id==).where(tenantId==) -> ${cgItems.size} docs`);
  cgItems.docs.forEach((d) => console.log('   path:', d.ref.path));

  const cgAk = await db.collectionGroup('answerKeys').where('itemId', '==', I).get();
  console.log(`collectionGroup('answerKeys').where(itemId==) -> ${cgAk.size} docs`);
  cgAk.docs.forEach((d) => console.log('   path:', d.ref.path, '| correctAnswer:', j(d.data().correctAnswer)));

  // totals for sanity
  const allAk = await db.collectionGroup('answerKeys').get();
  const v2AkCount = allAk.docs.filter((d) => d.ref.path.startsWith(`v2_tenants/${T}/`)).length;
  console.log(`\nTotal v2_ answerKeys (path-filtered): ${v2AkCount}`);
  process.exit(0);
}
main().catch((e) => { console.error('PROBE ERROR:', e.message); process.exit(1); });
