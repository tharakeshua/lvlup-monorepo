/**
 * READ-ONLY inspection of the REAL Subhang tenant in lvlup-ff6fa (UNPREFIXED).
 *
 * Dumps: tenant doc, tenantCode, 3 user docs, 3 membership docs, full sample of
 * each space, a sample storyPoint, and ONE full item sample per questionType and
 * per materialType — plus exact source counts (spaces/storyPoints/items by type,
 * material by materialType, question by questionType) and answer-field presence.
 *
 * Writes nothing to Firestore. Samples are written to scripts/out/*.json for
 * finalizing the transform mapping. Run from packages/seed:
 *   node scripts/inspect-subhang.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const SA_PATH = join(REPO_ROOT, 'lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json');
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

const TENANT = 'tenant_subhang';
const CODE = 'SUB001';
const USERS = {
  student: 'lUUkhr5fQMZjrUxvbsIoYmCLrku2',
  admin: 'd0ZDQvoNBcTtKIIduaZvF2iiwMc2',
  parent: 'h1F8ymbn2zfDv8MqjUqt745JdEG2',
};

const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'lvlup-ff6fa' });
const db = admin.firestore();

// JSON replacer that renders Firestore Timestamps and other admin types readably.
function replacer(_k, v) {
  if (v && typeof v === 'object' && typeof v._seconds === 'number' && typeof v._nanoseconds === 'number') {
    return { __ts__: true, seconds: v._seconds, nanos: v._nanoseconds, iso: new Date(v._seconds * 1000).toISOString() };
  }
  return v;
}
const write = (name, obj) => writeFileSync(join(OUT, name), JSON.stringify(obj, replacer, 2));
const short = (obj, max = 1200) => {
  const s = JSON.stringify(obj, replacer);
  return s.length > max ? s.slice(0, max) + `…(+${s.length - max} chars)` : s;
};

async function main() {
  const report = {};

  // ---- identity docs (UNPREFIXED) ----
  const tenantSnap = await db.doc(`tenants/${TENANT}`).get();
  report.tenant = { exists: tenantSnap.exists, data: tenantSnap.data() };
  write('src-tenant.json', report.tenant);

  const codeSnap = await db.doc(`tenantCodes/${CODE}`).get();
  report.tenantCode = { exists: codeSnap.exists, data: codeSnap.data() };
  write('src-tenantCode.json', report.tenantCode);

  report.users = {};
  for (const [role, uid] of Object.entries(USERS)) {
    const s = await db.doc(`users/${uid}`).get();
    report.users[role] = { uid, exists: s.exists, data: s.data() };
  }
  write('src-users.json', report.users);

  report.memberships = {};
  for (const [role, uid] of Object.entries(USERS)) {
    const id = `${uid}_${TENANT}`;
    const s = await db.doc(`userMemberships/${id}`).get();
    report.memberships[role] = { id, exists: s.exists, data: s.data() };
  }
  write('src-memberships.json', report.memberships);

  // ---- v2_ target emptiness check (must be absent for clean first run) ----
  const v2 = {};
  v2.tenant = (await db.doc(`v2_tenants/${TENANT}`).get()).exists;
  v2.tenantCode = (await db.doc(`v2_tenantCodes/${CODE}`).get()).exists;
  v2.membershipStudent = (await db.doc(`v2_userMemberships/${USERS.student}_${TENANT}`).get()).exists;
  v2.userStudent = (await db.doc(`v2_users/${USERS.student}`).get()).exists;
  report.v2TargetsExist = v2;

  // ---- spaces ----
  const spacesSnap = await db.collection(`tenants/${TENANT}/spaces`).get();
  report.spaceCount = spacesSnap.size;
  report.spaces = spacesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  write('src-spaces-all.json', report.spaces);

  // ---- full scan: storyPoints + items, with sampling ----
  let spTotal = 0;
  let itemTotal = 0;
  const itemTypeCounts = {};        // top-level type (question/material/…)
  const questionTypeCounts = {};    // payload.questionType
  const materialTypeCounts = {};    // payload.materialType
  const questionSamples = {};       // first item per questionType
  const materialSamples = {};       // first item per materialType
  const itemTypeSamples = {};       // first item per top-level type
  const answerFieldHisto = {};      // which answer-bearing fields appear & where
  let storyPointSample = null;
  let storyPointWithAssessmentConfig = null;

  for (const space of spacesSnap.docs) {
    const spSnap = await db.collection(`tenants/${TENANT}/spaces/${space.id}/storyPoints`).get();
    spTotal += spSnap.size;
    for (const sp of spSnap.docs) {
      const spData = sp.data();
      if (!storyPointSample) storyPointSample = { id: sp.id, spaceId: space.id, ...spData };
      if (!storyPointWithAssessmentConfig && spData.assessmentConfig) {
        storyPointWithAssessmentConfig = { id: sp.id, spaceId: space.id, ...spData };
      }
      const itemsSnap = await db
        .collection(`tenants/${TENANT}/spaces/${space.id}/storyPoints/${sp.id}/items`)
        .get();
      itemTotal += itemsSnap.size;
      for (const it of itemsSnap.docs) {
        const d = it.data();
        const full = { id: it.id, spaceId: space.id, storyPointId: sp.id, ...d };
        const type = d.type ?? '(none)';
        itemTypeCounts[type] = (itemTypeCounts[type] ?? 0) + 1;
        if (!itemTypeSamples[type]) itemTypeSamples[type] = full;

        const payload = d.payload ?? {};
        if (type === 'question') {
          const qt = payload.questionType ?? '(none)';
          questionTypeCounts[qt] = (questionTypeCounts[qt] ?? 0) + 1;
          if (!questionSamples[qt]) questionSamples[qt] = full;
        } else if (type === 'material') {
          const mt = payload.materialType ?? payload.kind ?? '(none)';
          materialTypeCounts[mt] = (materialTypeCounts[mt] ?? 0) + 1;
          if (!materialSamples[mt]) materialSamples[mt] = full;
        }

        // answer-field presence histogram (deep key scan)
        const scan = (v, path) => {
          if (Array.isArray(v)) return v.forEach((x, i) => scan(x, `${path}[]`));
          if (v && typeof v === 'object') {
            for (const [k, val] of Object.entries(v)) {
              if (['correctAnswer', 'acceptableAnswers', 'isCorrect', 'correctOrder', 'modelAnswer', 'answerKey', 'explanation'].includes(k)) {
                const key = `${path}.${k}`;
                answerFieldHisto[key] = (answerFieldHisto[key] ?? 0) + 1;
              }
              scan(val, `${path}.${k}`);
            }
          }
        };
        scan(d, 'item');
      }
    }
  }

  report.counts = {
    spaces: spacesSnap.size,
    storyPoints: spTotal,
    items: itemTotal,
    byItemType: itemTypeCounts,
    byQuestionType: questionTypeCounts,
    byMaterialType: materialTypeCounts,
  };
  report.answerFieldHisto = answerFieldHisto;

  write('src-storyPoint-sample.json', { first: storyPointSample, withAssessmentConfig: storyPointWithAssessmentConfig });
  write('src-question-samples.json', questionSamples);
  write('src-material-samples.json', materialSamples);
  write('src-itemtype-samples.json', itemTypeSamples);
  write('src-counts.json', report.counts);
  write('src-answerfield-histo.json', answerFieldHisto);

  // ---- console summary ----
  console.log('\n===== SUBHANG SOURCE INSPECTION (read-only) =====');
  console.log('tenant exists:', report.tenant.exists, '| tenantCode exists:', report.tenantCode.exists);
  console.log('tenant data:', short(report.tenant.data, 2000));
  console.log('\nusers exist:', Object.fromEntries(Object.entries(report.users).map(([r, u]) => [r, u.exists])));
  console.log('memberships exist:', Object.fromEntries(Object.entries(report.memberships).map(([r, m]) => [r, m.exists])));
  console.log('\nv2_ targets already exist?', JSON.stringify(report.v2TargetsExist));
  console.log('\nCOUNTS:', JSON.stringify(report.counts, null, 2));
  console.log('\nANSWER-FIELD HISTOGRAM (deep):', JSON.stringify(answerFieldHisto, null, 2));
  console.log('\nmaterialType keys found:', Object.keys(materialTypeCounts));
  console.log('questionType keys found:', Object.keys(questionTypeCounts));
  console.log('\nMEMBERSHIP (student):', short(report.memberships.student.data, 1500));
  console.log('\nUSER (student):', short(report.users.student.data, 1500));
  console.log('\nSPACE[0]:', short(report.spaces[0], 1800));
  console.log('\nSamples written to', OUT);
  console.log('===== END =====\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error('INSPECTION ERROR:', e); process.exit(1); });
