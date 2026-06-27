/**
 * ONE-SHOT scoped upsert: writes exactly 4 ClassProgressSummary docs
 * to lvlup-ff6fa production Firestore (v2_ prefix).
 * ONLY touches synthetic tenant classProgressSummaries — zero SUB001/tenant_subhang refs.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── SAFETY: must be v2_ ──────────────────────────────────────────────────────
const PREFIX = process.env['LVLUP_COLLECTION_PREFIX'] ?? '';
if (PREFIX !== 'v2_') {
  console.error('ABORT: LVLUP_COLLECTION_PREFIX is not "v2_". Got:', JSON.stringify(PREFIX));
  process.exit(1);
}

// ── ID helpers (mirrors packages/seed/src/engine/ids.ts) ────────────────────
function slugify(raw) {
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s.length > 0 ? s : 'x';
}
const KIND_PREFIX = { tenant: 'tn', class: 'cls', student: 'stu' };
function seedId(kind, key) {
  const p = KIND_PREFIX[kind];
  const slug = slugify(key).slice(0, 40);
  const digest = createHash('sha256').update(`${kind} ${key}`).digest('hex').slice(0, 10);
  return `${p}_${slug}_${digest}`;
}

// ── Tenant / class IDs (deterministic) ──────────────────────────────────────
const GREENWOOD_TENANT = seedId('tenant', 'greenwood');
const RIVERSIDE_TENANT = seedId('tenant', 'riverside');

function gwClassId(k) { return seedId('class', `greenwood:class:${k}`); }
function rvClassId(k) { return seedId('class', `riverside:class:${k}`); }
function gwStudentId(k) { return seedId('student', `greenwood:student:${k}`); }

// ── Canonical domain shape data (matches fixed classSummaryDoc in seed) ──────
const NOW = new Date().toISOString();

function classDoc(tenantId, classId, className, studentCount, autogradeAvg, levelupAvg, atRiskStudentIds) {
  return {
    id: classId,
    tenantId,
    classId,
    className,
    studentCount,
    autograde: {
      averageClassScore: autogradeAvg / 100,
      examCompletionRate: autogradeAvg > 0 ? 0.8 : 0,
      topPerformers: [],
      bottomPerformers: [],
    },
    levelup: {
      averageClassCompletion: levelupAvg,
      activeStudentRate: studentCount > 0 ? 1 : 0,
      topPointEarners: [],
    },
    atRiskStudentIds,
    atRiskCount: atRiskStudentIds.length,
    lastUpdatedAt: NOW,
  };
}

const DOCS = [
  // Greenwood GRN001 — 3 classes
  {
    path: `${PREFIX}tenants/${GREENWOOD_TENANT}/classProgressSummaries/${gwClassId('g8-math')}`,
    data: classDoc(GREENWOOD_TENANT, gwClassId('g8-math'), 'Grade 8 - Mathematics', 3, 87.5, 75, [gwStudentId('s-diya')]),
  },
  {
    path: `${PREFIX}tenants/${GREENWOOD_TENANT}/classProgressSummaries/${gwClassId('g8-sci')}`,
    data: classDoc(GREENWOOD_TENANT, gwClassId('g8-sci'), 'Grade 8 - Science', 3, 0, 41, [gwStudentId('s-diya')]),
  },
  {
    path: `${PREFIX}tenants/${GREENWOOD_TENANT}/classProgressSummaries/${gwClassId('g10-phy')}`,
    data: classDoc(GREENWOOD_TENANT, gwClassId('g10-phy'), 'Grade 10 - Physics', 2, 0, 48, [gwStudentId('s-karan')]),
  },
  // Riverside — 1 class
  {
    path: `${PREFIX}tenants/${RIVERSIDE_TENANT}/classProgressSummaries/${rvClassId('g8-math')}`,
    data: classDoc(RIVERSIDE_TENANT, rvClassId('g8-math'), 'Grade 8 - Mathematics', 2, 0, 45, []),
  },
];

// ── SAFETY PRECHECK ──────────────────────────────────────────────────────────
console.log('\n=== SAFETY PRECHECK ===');
console.log('Collection prefix:', PREFIX);
console.log('Doc count:', DOCS.length);
DOCS.forEach((d, i) => console.log(`  [${i + 1}] ${d.path}`));
const hasBadRef = DOCS.some(d => d.path.includes('subhang') || d.path.includes('SUB001') || d.data.tenantId.includes('subhang'));
if (hasBadRef) {
  console.error('ABORT: tenant_subhang/SUB001 reference detected!');
  process.exit(1);
}
if (DOCS.length !== 4) {
  console.error('ABORT: Expected 4 docs, got', DOCS.length);
  process.exit(1);
}
console.log('Precheck: PASSED — no tenant_subhang refs, exactly 4 docs, prefix v2_\n');

// ── Firebase Admin init ──────────────────────────────────────────────────────
const SA_PATH = '/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json';
const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore();

// ── Write ────────────────────────────────────────────────────────────────────
console.log('=== WRITING ===');
let written = 0;
let errors = 0;
for (const doc of DOCS) {
  try {
    await db.doc(doc.path).set(doc.data, { merge: true });
    console.log(`  ✓ wrote ${doc.path}`);
    written++;
  } catch (err) {
    console.error(`  ✗ FAILED ${doc.path}:`, err.message);
    errors++;
  }
}

console.log(`\n=== RESULT: ${written} written, ${errors} errors ===`);
if (errors > 0 || written !== 4) {
  console.error('Write incomplete — check errors above');
  process.exit(1);
}
console.log('Done.');
