/** READ-ONLY: across all 12 legacy spaces, count FLAT items (spaces/{s}/items) vs NESTED
 * (spaces/{s}/storyPoints/{sp}/items), and measure id overlap. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
const __dirname = dirname(fileURLToPath(import.meta.url));
const SA = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json'), 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(SA), projectId: 'lvlup-ff6fa' });
const db = admin.firestore();
const T = 'tenant_subhang';

async function main() {
  const spaces = await db.collection(`tenants/${T}/spaces`).get();
  let totFlat = 0, totNested = 0, totFlatOnly = 0, totBoth = 0;
  const flatTypeCounts = {}, flatQtCounts = {};
  const perSpace = [];
  for (const sp of spaces.docs) {
    const sid = sp.id;
    const flat = await db.collection(`tenants/${T}/spaces/${sid}/items`).get();
    const nestedIds = new Set();
    const sps = await db.collection(`tenants/${T}/spaces/${sid}/storyPoints`).get();
    for (const s of sps.docs) {
      const its = await db.collection(`tenants/${T}/spaces/${sid}/storyPoints/${s.id}/items`).get();
      its.docs.forEach((d) => nestedIds.add(d.id));
    }
    const flatIds = flat.docs.map((d) => d.id);
    const flatOnly = flatIds.filter((id) => !nestedIds.has(id));
    const both = flatIds.filter((id) => nestedIds.has(id));
    totFlat += flat.size; totNested += nestedIds.size; totFlatOnly += flatOnly.length; totBoth += both.length;
    for (const d of flat.docs) {
      const data = d.data(); const ty = data.type ?? '(none)';
      flatTypeCounts[ty] = (flatTypeCounts[ty] ?? 0) + 1;
      if (ty === 'question') { const qt = data.payload?.questionType ?? '(none)'; flatQtCounts[qt] = (flatQtCounts[qt] ?? 0) + 1; }
    }
    if (flat.size) perSpace.push({ space: sp.data().title, id: sid, flat: flat.size, nested: nestedIds.size, flatOnly: flatOnly.length, both: both.length });
  }
  console.log('PER-SPACE (only spaces with flat items):');
  perSpace.forEach((p) => console.log(`  ${p.space} [${p.id}]  flat=${p.flat} nested=${p.nested} flatOnly=${p.flatOnly} both=${p.both}`));
  console.log('\nTOTALS:');
  console.log('  flat items (spaces/{s}/items):', totFlat);
  console.log('  nested items (spaces/{s}/storyPoints/{sp}/items):', totNested);
  console.log('  flat-only (NOT also nested, i.e. MISSED by migration):', totFlatOnly);
  console.log('  flat ids that ALSO exist nested (duplicates):', totBoth);
  console.log('  flat by type:', JSON.stringify(flatTypeCounts));
  console.log('  flat questions by qt:', JSON.stringify(flatQtCounts));
  // sample one flat-only item full
  for (const sp of spaces.docs) {
    const flat = await db.collection(`tenants/${T}/spaces/${sp.id}/items`).limit(1).get();
    if (flat.size) {
      const d = flat.docs[0];
      console.log('\nSAMPLE flat item', d.id, 'in space', sp.id, ':');
      console.log(JSON.stringify({ id: d.id, ...d.data() }, (k, v) => (v && v._seconds ? { ts: v._seconds } : v)).slice(0, 700));
      break;
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
