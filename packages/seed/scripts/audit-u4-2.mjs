/**
 * U4.2 — Canonical validation audit (READ-ONLY, no writes).
 *
 *   PART 1 — Seed pipeline output vs domain Zod (every entity type).
 *     Runs the @levelup/seed pipeline in dry-run, captures every built doc via a
 *     patched BatchWriter.set, routes path→canonical schema, strict-parses.
 *     A doc that only parses once legacy enum values are widened (zLegacy*Read) is
 *     recorded as a TRANSFORM CANDIDATE, not a pass.
 *
 *   PART 2 — SUB001 real-data raw-source classification (READ-ONLY).
 *     Reads a representative sample per source collection from the UNPREFIXED
 *     tenants/tenant_subhang and classifies each raw doc (after the D4 repo-boundary
 *     Timestamp→ISO normalization that EVERY read does) as:
 *        parses-strict            — already canonical
 *        parses-via-legacy-adapter — only enum-value drift; zLegacy*Read fixes it
 *        fails-both               — needs a STRUCTURAL transform (rename/nest/drop)
 *     with per-field failure detail. Timestamp representation is reported globally
 *     (it forces the transform for all docs — the reason Option A is a migration,
 *     not a read-adapter).
 *
 * NO WRITES. NO --apply. Produces out/u4-2-audit-report.json + console summary.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
import * as D from '@levelup/domain';
import { mockSeedConfig } from '../src/data/index.js';
import { SeedContext } from '../src/engine/context.js';
import { SeedPipeline } from '../src/engine/pipeline.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const SA_PATH = join(REPO_ROOT, 'lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json');
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });
const TENANT = 'tenant_subhang';
const CODE = 'SUB001';
const ITEM_SAMPLE_PER_SP = 4;   // representative sample cap per storyPoint
const ITEM_SAMPLE_MAX = 900;

// ─── D4 boundary: collapse Firestore Timestamp → canonical ISO string on read ───
function isoDeep(v) {
  if (v == null) return v;
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(isoDeep);
  if (typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = isoDeep(val);
    return o;
  }
  return v;
}
const issues = (r, n = 6) =>
  r.error.issues.slice(0, n).map((i) => `${i.path.join('.') || '<root>'}: ${i.code}${i.message ? ` (${i.message})` : ''}`);

// ───────────────────────────── PART 1: seed pipeline output ─────────────────────────────
// path-pattern → canonical schema router. Order matters (most-specific first).
const ROUTES = [
  [/\/answerKeys\/[^/]+$/, 'AnswerKeySchema'],
  [/\/storyPoints\/[^/]+\/items\/[^/]+$/, 'UnifiedItemSchema'],
  [/\/storyPoints\/[^/]+$/, 'StoryPointSchema'],   // FLAT tenants/{t}/storyPoints/{id} (canonical) + nested legacy
  [/\/spaces\/[^/]+\/reviews\/[^/]+$/, 'SpaceReviewSchema'],
  [/\/spaces\/[^/]+$/, 'SpaceSchema'],
  [/\/exams\/[^/]+\/questions\/[^/]+$/, 'ExamQuestionSchema'],
  [/\/exams\/[^/]+$/, 'ExamSchema'],
  // SEED-1 routing fix: digitalTestSessions routes MUST precede the generic /submissions
  // route — the nested digitalTestSessions/{id}/submissions/{itemId} path also matches
  // /submissions/[^/]+$ and was being misrouted to SubmissionSchema.
  [/\/digitalTestSessions\/[^/]+\/submissions\/[^/]+$/, 'TestSubmissionSchema'],
  [/\/digitalTestSessions\/[^/]+\/live\/current$/, null],       // live projection — no canonical entity schema
  [/\/digitalTestSessions\/[^/]+$/, 'DigitalTestSessionSchema'],
  [/\/submissions\/[^/]+\/questionSubmissions\/[^/]+$/, 'QuestionSubmissionSchema'],
  [/\/submissions\/[^/]+$/, 'SubmissionSchema'],
  [/\/evaluationSettings\/[^/]+$/, 'EvaluationSettingsSchema'],
  [/\/gradingDeadLetter\/[^/]+$/, 'GradingDeadLetterEntrySchema'],
  [/\/spaceProgress\/[^/]+\/live\/current$/, null],
  [/\/spaceProgress\/[^/]+$/, 'SpaceProgressSchema'],
  [/\/storyPointProgress\/[^/]+$/, 'StoryPointProgressDocSchema'],
  [/\/chatSessions\/[^/]+\/messages\/[^/]+$/, 'ChatMessageSchema'],
  [/\/chatSessions\/[^/]+$/, 'ChatSessionSchema'],
  [/\/academicSessions\/[^/]+$/, 'AcademicSessionSchema'],
  [/\/teachers\/[^/]+$/, 'TeacherSchema'],
  [/\/students\/[^/]+\/achievements\/[^/]+$/, 'StudentAchievementSchema'],
  [/\/students\/[^/]+\/level\/current$/, 'StudentLevelSchema'],
  [/\/students\/[^/]+\/studyGoals\/[^/]+$/, 'StudyGoalSchema'],
  [/\/students\/[^/]+\/studySessions\/[^/]+$/, 'StudySessionSchema'],
  [/\/students\/[^/]+\/devices\/[^/]+$/, null],
  [/\/students\/[^/]+$/, 'StudentSchema'],
  [/\/parents\/[^/]+$/, 'ParentSchema'],
  [/\/staff\/[^/]+$/, 'StaffSchema'],
  [/\/scanners\/[^/]+$/, 'ScannerSchema'],
  [/\/classes\/[^/]+$/, 'ClassSchema'],
  [/\/announcements\/[^/]+\/reads\/[^/]+$/, null],
  [/\/announcements\/[^/]+$/, 'AnnouncementSchema'],
  [/\/notifications\/[^/]+$/, 'NotificationSchema'],
  [/\/notificationPreferences\/[^/]+$/, 'NotificationPreferencesSchema'],
  [/\/agents\/[^/]+$/, 'AgentSchema'],
  [/\/rubricPresets\/[^/]+$/, 'RubricPresetSchema'],
  [/\/questionBank\/[^/]+$/, 'QuestionBankItemSchema'],
  [/\/achievements\/[^/]+$/, 'AchievementSchema'],
  [/\/studentProgressSummaries\/[^/]+$/, 'StudentProgressSummarySchema'],
  [/\/classProgressSummaries\/[^/]+$/, 'ClassProgressSummarySchema'],
  [/\/examAnalytics\/[^/]+$/, 'ExamAnalyticsSchema'],
  [/\/insights\/[^/]+$/, 'LearningInsightSchema'],
  [/\/costSummaries\/daily_/, 'DailyCostSummarySchema'],
  [/\/costSummaries\/monthly_/, 'MonthlyCostSummarySchema'],
  [/\/llmCallLogs\/[^/]+$/, 'LlmCallLogSchema'],
  [/(^|\/)globalEvaluationPresets\/[^/]+$/, 'EvaluationSettingsSchema'],
  [/(^|\/)platformActivityLog\/[^/]+$/, 'PlatformActivityLogSchema'],
  [/^(v2_)?userMemberships\/[^/]+$/, 'UserMembershipSchema'],
  [/^(v2_)?tenantCodes\/[^/]+$/, 'TenantCodeIndexSchema'],
  [/^(v2_)?tenants\/[^/]+$/, 'TenantSchema'],
  [/^(v2_)?users\/[^/]+$/, 'UnifiedUserSchema'],
];
function routeKind(path) {
  for (const [re, schema] of ROUTES) if (re.test(path)) return schema;
  return undefined; // unrouted
}

async function auditSeedPipeline() {
  const ctx = new SeedContext({ projectId: 'lvlup-ff6fa', serviceAccountPath: SA_PATH, dryRun: true, logLevel: 'error' });
  const captured = [];
  const origSet = ctx.batch.set.bind(ctx.batch);
  ctx.batch.set = async (ref, data, options) => { captured.push({ path: ref.path, data }); return origSet(ref, data, options); };

  const pipeline = new SeedPipeline(ctx);
  await pipeline.run(mockSeedConfig);
  await ctx.flush();

  // Firestore merge:true accumulates — collapse multiple sets to the same path (last-write-merge).
  const byPath = new Map();
  for (const { path, data } of captured) byPath.set(path, { ...(byPath.get(path) ?? {}), ...data });
  const merged = [...byPath.entries()].map(([path, data]) => ({ path, data }));

  const perKind = {}; // kind -> { total, strict, failStrict, sampleErrors:[] }
  const unrouted = {}; // pathPattern -> count
  for (const { path, data } of merged) {
    const kind = routeKind(path);
    if (kind === undefined) { const key = path.replace(/[^/]+$/, '{id}'); unrouted[key] = (unrouted[key] ?? 0) + 1; continue; }
    if (kind === null) continue; // intentionally schema-less projection (live/devices/reads)
    const schema = D[kind];
    const rec = (perKind[kind] ??= { total: 0, strict: 0, failStrict: 0, sampleErrors: [] });
    rec.total++;
    const r = schema.safeParse(data);
    if (r.success) rec.strict++;
    else { rec.failStrict++; if (rec.sampleErrors.length < 3) rec.sampleErrors.push({ path, issues: issues(r) }); }
  }
  return { capturedCount: captured.length, mergedDocs: merged.length, perKind, unrouted };
}

// ───────────────────────────── PART 2: SUB001 raw classification ─────────────────────────────
// Enum-drift probes: (field-path getter, zLegacy*Read adapter). If a strict failure is ENTIRELY
// explained by these fields, the doc is "parses-via-legacy-adapter".
const LEGACY_ENUM_FIELDS = {
  StoryPointSchema: [{ get: (d) => d.type, ok: (v) => D.zLegacyStoryPointTypeRead.safeParse(v).success && !D.zStoryPointType?.safeParse?.(v)?.success, path: 'type' }],
  ExamSchema: [{ get: (d) => d.status, path: 'status', ok: (v) => D.zLegacyExamStatusRead.safeParse(v).success }],
};

function classifyRaw(schemaName, raw) {
  const schema = D[schemaName];
  const norm = isoDeep(raw);
  const strict = schema.safeParse(norm);
  if (strict.success) return { cls: 'parses-strict', issues: [] };
  // Try legacy-adapter widening for known enum fields: rewrite the drifted enum to canonical, re-parse.
  const probes = LEGACY_ENUM_FIELDS[schemaName] ?? [];
  if (probes.length) {
    const patched = structuredClone(norm);
    let touched = false;
    for (const p of probes) {
      const v = p.get(patched);
      if (v == null) continue;
      const adapters = { type: D.zLegacyStoryPointTypeRead, status: D.zLegacyExamStatusRead };
      const ad = adapters[p.path];
      const canon = ad?.safeParse(v);
      if (canon?.success && canon.data !== v) { patched[p.path] = canon.data; touched = true; }
    }
    if (touched) {
      const r2 = schema.safeParse(patched);
      if (r2.success) return { cls: 'parses-via-legacy-adapter', issues: [] };
    }
  }
  return { cls: 'fails-both', issues: issues(strict) };
}

function tallyIssues(store, list) {
  for (const s of list) { const key = s.split(':')[0]; store[key] = (store[key] ?? 0) + 1; }
}

async function auditSub001(db) {
  const report = {};
  const rd = async (path) => (await db.doc(path).get()).data();
  const classifyOne = (name, schemaName, raw, bucket) => {
    const c = classifyRaw(schemaName, raw);
    bucket.counts[c.cls]++;
    if (c.cls === 'fails-both') tallyIssues(bucket.failFields, c.issues);
    if (c.issues.length && bucket.samples.length < 3) bucket.samples.push({ name, issues: c.issues });
  };
  const mkBucket = () => ({ read: 0, counts: { 'parses-strict': 0, 'parses-via-legacy-adapter': 0, 'fails-both': 0 }, failFields: {}, samples: [] });

  // identity
  const b = {
    tenant: mkBucket(), tenantCode: mkBucket(), users: mkBucket(), memberships: mkBucket(),
    spaces: mkBucket(), storyPoints: mkBucket(), items: mkBucket(),
  };
  const tenant = await rd(`tenants/${TENANT}`);
  if (tenant) { b.tenant.read++; classifyOne(TENANT, 'TenantSchema', tenant, b.tenant); }
  const code = await rd(`tenantCodes/${CODE}`);
  if (code) { b.tenantCode.read++; classifyOne(CODE, 'TenantCodeIndexSchema', code, b.tenantCode); }
  for (const uid of ['lUUkhr5fQMZjrUxvbsIoYmCLrku2', 'd0ZDQvoNBcTtKIIduaZvF2iiwMc2', 'h1F8ymbn2zfDv8MqjUqt745JdEG2']) {
    const u = await rd(`users/${uid}`);
    if (u) { b.users.read++; classifyOne(uid, 'UnifiedUserSchema', u, b.users); }
    const m = await rd(`userMemberships/${uid}_${TENANT}`);
    if (m) { b.memberships.read++; classifyOne(uid, 'UserMembershipSchema', m, b.memberships); }
  }

  // content
  const spacesSnap = await db.collection(`tenants/${TENANT}/spaces`).get();
  let itemsSampled = 0;
  const spTypeHisto = {};
  const itemFieldNote = { hasOrderIndex: 0, hasOrder: 0 };
  for (const sd of spacesSnap.docs) {
    b.spaces.read++; classifyOne(sd.id, 'SpaceSchema', { id: sd.id, ...sd.data() }, b.spaces);
    const spSnap = await db.collection(`tenants/${TENANT}/spaces/${sd.id}/storyPoints`).get();
    for (const sp of spSnap.docs) {
      b.storyPoints.read++;
      const spData = { id: sp.id, ...sp.data() };
      spTypeHisto[spData.type ?? '<none>'] = (spTypeHisto[spData.type ?? '<none>'] ?? 0) + 1;
      classifyOne(sp.id, 'StoryPointSchema', spData, b.storyPoints);
      if (itemsSampled < ITEM_SAMPLE_MAX) {
        const itSnap = await db.collection(`tenants/${TENANT}/spaces/${sd.id}/storyPoints/${sp.id}/items`).limit(ITEM_SAMPLE_PER_SP).get();
        for (const it of itSnap.docs) {
          const idata = it.data();
          if ('orderIndex' in idata) itemFieldNote.hasOrderIndex++;
          if ('order' in idata) itemFieldNote.hasOrder++;
          b.items.read++; itemsSampled++;
          classifyOne(it.id, 'UnifiedItemSchema', { id: it.id, ...idata }, b.items);
        }
      }
    }
  }
  report.buckets = b;
  report.storyPointTypeHisto = spTypeHisto;
  report.itemFieldNote = itemFieldNote;
  report.itemsSampled = itemsSampled;
  return report;
}

// ───────────────────────────── main ─────────────────────────────
async function main() {
  console.log('\n===== U4.2 CANONICAL VALIDATION AUDIT (read-only) =====\n');

  console.log('PART 1 — Seed pipeline output vs domain Zod …');
  const seedAudit = await auditSeedPipeline();
  const seedFails = Object.entries(seedAudit.perKind).filter(([, v]) => v.failStrict > 0);
  console.log(`  captured ${seedAudit.capturedCount} built docs across ${Object.keys(seedAudit.perKind).length} routed entity types`);
  console.log(`  strict-clean entity types: ${Object.keys(seedAudit.perKind).length - seedFails.length}/${Object.keys(seedAudit.perKind).length}`);
  const seedClean = Object.entries(seedAudit.perKind).filter(([, v]) => v.failStrict === 0).map(([k]) => k);
  console.log(`  CLEAN entity types (${seedClean.length}): ${seedClean.join(', ') || '(none)'}`);
  if (seedFails.length) for (const [k, v] of seedFails) console.log(`  ⚠️  ${k}: ${v.failStrict}/${v.total} fail strict — e.g. ${JSON.stringify(v.sampleErrors[0]?.issues)}`);
  else console.log('  ✅ every routed seed entity type parses domain strict Zod');
  if (Object.keys(seedAudit.unrouted).length) console.log(`  (unrouted paths: ${JSON.stringify(seedAudit.unrouted)})`);

  console.log('\nPART 2 — SUB001 raw-source classification …');
  const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'));
  const auditApp = admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'lvlup-ff6fa' }, 'u4-2-audit');
  const db = auditApp.firestore();
  const sub = await auditSub001(db);
  for (const [coll, bk] of Object.entries(sub.buckets)) {
    console.log(`  ${coll.padEnd(12)} read=${String(bk.read).padStart(4)}  strict=${bk.counts['parses-strict']}  legacy-adapter=${bk.counts['parses-via-legacy-adapter']}  fails-both=${bk.counts['fails-both']}` +
      (Object.keys(bk.failFields).length ? `  topFail=${JSON.stringify(Object.entries(bk.failFields).sort((a, b) => b[1] - a[1]).slice(0, 4))}` : ''));
  }
  console.log(`  storyPoint.type histo: ${JSON.stringify(sub.storyPointTypeHisto)}`);
  console.log(`  item field note: ${JSON.stringify(sub.itemFieldNote)} (sampled ${sub.itemsSampled})`);

  const full = { generatedBy: 'audit-u4-2.mjs', part1_seedPipeline: seedAudit, part2_sub001: sub };
  writeFileSync(join(OUT, 'u4-2-audit-report.json'), JSON.stringify(full, null, 2));
  console.log(`\nwrote out/u4-2-audit-report.json`);
}
main().then(() => process.exit(0)).catch((e) => { console.error('AUDIT ERROR:', e); process.exit(1); });
