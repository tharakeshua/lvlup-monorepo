/**
 * Option A — one-time, idempotent transform-migration of the REAL Subhang Academy
 * tenant from the UNPREFIXED collections into the `v2_`-prefixed collections in
 * lvlup-ff6fa, targeting the CANONICAL @levelup/domain shape.
 *
 *   READ : tenants/tenant_subhang/**  (+ users / userMemberships / tenantCodes)   [UNPREFIXED — never mutated]
 *   WRITE: v2_tenants/tenant_subhang/** (+ v2_users / v2_userMemberships / v2_tenantCodes)
 *
 * Safety rails:
 *   • Writes are 100% confined to v2_ paths (built by the prefixed path helpers below).
 *   • Source is read-only. Document IDs are preserved verbatim.
 *   • Idempotent: deterministic IDs + full-replace `set` (no merge) → re-runnable.
 *   • DRY-RUN by default. `--apply` is required to write. `--verify-only` just checks v2_.
 *
 * Canonical alignment (verified against packages/domain Zod, NOT the migration-plan §2 table):
 *   • Timestamps are ISO-8601 strings at rest (D4 / repo-admin firestore.ts) — we convert
 *     every legacy Firestore Timestamp → ISO via the domain `toTimestamp` helper.
 *   • Tenant keeps `tenantCode` + flat `contactEmail/contactPhone` (NOT `code`/nested `contact`).
 *   • Item answer fields are SPLIT into the deny-all `answerKeys/{itemId}` subcollection; the
 *     item payload is rebuilt by whitelist so it leaks NO answer field (verified by a deep guard).
 *
 * Run from packages/seed:
 *   node scripts/migrate-subhang-to-v2.mjs            # dry-run (default)
 *   node scripts/migrate-subhang-to-v2.mjs --apply    # real write, then auto-verify
 *   node scripts/migrate-subhang-to-v2.mjs --verify-only
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
import {
  toTimestamp,
  TenantSchema,
  TenantCodeIndexSchema,
  UnifiedUserSchema,
  UserMembershipSchema,
  SpaceSchema,
  StoryPointSchema,
  UnifiedItemSchema,
  AnswerKeySchema,
  // U4.2 — legacy enum read-adapters (widen-on-read → canonical). Applied defensively so any
  // future teacher-portal write carrying a dropped legacy enum value still migrates correctly.
  normalizeStoryPointType,
} from '@levelup/domain';

/** First finite orderIndex among the canonical field and its legacy `order` synonym. */
const orderIdx = (o) =>
  Number.isFinite(o?.orderIndex) ? o.orderIndex : Number.isFinite(o?.order) ? o.order : 0;

// ─────────────────────────── config ───────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const SA_PATH = join(REPO_ROOT, 'lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json');
const OUT = join(__dirname, 'out');
mkdirSync(OUT, { recursive: true });

const PFX = 'v2_';
const TENANT = 'tenant_subhang';
const CODE = 'SUB001';
const OWNER = 'd0ZDQvoNBcTtKIIduaZvF2iiwMc2'; // subhang.rocklee@gmail.com — tenant ownerUid; createdBy/updatedBy fallback
const USERS = {
  student: 'lUUkhr5fQMZjrUxvbsIoYmCLrku2',
  admin: 'd0ZDQvoNBcTtKIIduaZvF2iiwMc2',
  parent: 'h1F8ymbn2zfDv8MqjUqt745JdEG2',
};

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERIFY_ONLY = args.includes('--verify-only');
const MODE = VERIFY_ONLY ? 'verify-only' : APPLY ? 'apply' : 'dry-run';

const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'lvlup-ff6fa' });
const db = admin.firestore();

// ─────────────────────── prefixed path helpers (mirror @levelup/seed paths.ts) ───────────────────────
const P = {
  // source (UNPREFIXED)
  srcTenant: () => `tenants/${TENANT}`,
  srcCode: () => `tenantCodes/${CODE}`,
  srcUser: (uid) => `users/${uid}`,
  srcMember: (uid) => `userMemberships/${uid}_${TENANT}`,
  srcSpaces: () => `tenants/${TENANT}/spaces`,
  srcStoryPoints: (s) => `tenants/${TENANT}/spaces/${s}/storyPoints`,
  srcItems: (s, sp) => `tenants/${TENANT}/spaces/${s}/storyPoints/${sp}/items`,
  // target (v2_ prefixed)
  tenant: () => `${PFX}tenants/${TENANT}`,
  code: () => `${PFX}tenantCodes/${CODE}`,
  user: (uid) => `${PFX}users/${uid}`,
  member: (uid) => `${PFX}userMemberships/${uid}_${TENANT}`,
  space: (s) => `${PFX}tenants/${TENANT}/spaces/${s}`,
  // storyPoints are a FLAT tenant-scoped collection (makeEntityRepo('storyPoints'),
  // queried `where spaceId==`). NOT nested under spaces. Items below stay NESTED and
  // are resolved by the callables via collectionGroup('items')/collectionGroup('answerKeys').
  storyPoint: (_s, sp) => `${PFX}tenants/${TENANT}/storyPoints/${sp}`,
  item: (s, sp, id) => `${PFX}tenants/${TENANT}/spaces/${s}/storyPoints/${sp}/items/${id}`,
  answerKey: (s, sp, id) => `${PFX}tenants/${TENANT}/spaces/${s}/storyPoints/${sp}/items/${id}/answerKeys/${id}`,
};

// ─────────────────────── helpers ───────────────────────
const AdminTs = admin.firestore.Timestamp;
/** Deep-walk: collapse every Firestore Timestamp → canonical ISO-8601 string (D4). */
function isoDeep(v) {
  if (v == null) return v;
  if (v instanceof AdminTs) return toTimestamp(v.toDate());
  if (typeof v === 'object' && typeof v.toDate === 'function') return toTimestamp(v.toDate());
  if (Array.isArray(v)) return v.map(isoDeep);
  if (typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = isoDeep(val);
    return o;
  }
  return v;
}
const iso = (v) => (v == null ? null : isoDeep(v));
/** strip undefined (Firestore rejects undefined); keep nulls (canonical nullable fields). */
function clean(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) o[k] = v;
  return o;
}
const put = (obj, k, v) => { if (v !== undefined && v !== null) obj[k] = v; };

// answer-bearing field names that must NEVER appear anywhere in an item doc (security gate).
const BANNED_ITEM_FIELDS = new Set([
  'correctAnswer', 'acceptableAnswers', 'modelAnswer', 'isCorrect', 'correctOrder',
  'correctOptionId', 'correctOptionIds', 'answerKey', 'explanation', 'rubric', 'evaluationGuidance',
]);
function findLeak(value, path = 'item') {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) { const r = findLeak(value[i], `${path}[${i}]`); if (r) return r; }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (BANNED_ITEM_FIELDS.has(k)) return `${path}.${k}`;
      const r = findLeak(v, `${path}.${k}`); if (r) return r;
    }
  }
  return null;
}

// ─────────────────────── transforms ───────────────────────
function transformTenant(src) {
  const f = src.features ?? {};
  const sub = src.subscription ?? {};
  const usage = src.usage ?? {};
  const onb = src.onboarding ?? {};
  const st = src.stats ?? {};
  const doc = clean({
    id: TENANT,
    name: src.name,
    shortName: src.shortName,
    slug: src.slug,
    tenantCode: src.tenantCode ?? CODE,
    ownerUid: src.ownerUid ?? OWNER,
    status: src.status ?? 'active',
    subscription: clean({
      plan: sub.plan ?? 'free',
      maxStudents: sub.maxStudents,
      maxTeachers: sub.maxTeachers,
      maxExamsPerMonth: sub.maxExamsPerMonth,
      maxAiCallsPerMonth: sub.maxAiCallsPerMonth,
      renewsAt: iso(sub.renewsAt ?? sub.expiresAt) ?? null,
    }),
    features: clean({
      autograde: f.autoGradeEnabled ?? f.autograde,
      levelup: f.levelUpEnabled ?? f.levelup,
      analytics: f.analyticsEnabled ?? f.analytics,
      store: f.store,
    }),
    settings: clean({ timezone: src.settings?.timezone, locale: src.settings?.locale, gradingScale: src.settings?.gradingScale }),
    stats: {
      totalStudents: st.totalStudents ?? 0,
      totalTeachers: st.totalTeachers ?? 0,
      totalClasses: st.totalClasses ?? 0,
      totalExams: st.totalExams ?? 0,
      totalSpaces: st.totalSpaces ?? 0,
    },
    usage: clean({ examsThisMonth: usage.examsThisMonth ?? 0, aiCallsThisMonth: usage.aiCallsThisMonth ?? 0, resetAt: iso(usage.resetAt ?? usage.lastUpdated) ?? null }),
    onboarding: clean({ completed: onb.completed ?? false, steps: onb.completedSteps ?? onb.steps, completedAt: iso(onb.completedAt) ?? null }),
    contactEmail: src.contactEmail,
    contactPhone: src.contactPhone,
    trialEndsAt: iso(src.trialEndsAt) ?? null,
    createdAt: iso(src.createdAt),
    updatedAt: iso(src.updatedAt),
    createdBy: src.createdBy ?? src.ownerUid ?? OWNER,
    updatedBy: src.updatedBy ?? src.ownerUid ?? OWNER,
  });
  // optional branding only if it has any non-null value
  const branding = {};
  put(branding, 'logoUrl', src.logoUrl);
  put(branding, 'bannerUrl', src.bannerUrl);
  if (Object.keys(branding).length) doc.branding = branding;
  return doc;
}

function transformCode(src) {
  return clean({ tenantId: TENANT, createdAt: iso(src?.createdAt) ?? iso(new Date()) });
}

function transformUser(src, uid) {
  return clean({
    uid,
    email: src.email ?? undefined,
    phone: src.phone ?? undefined,
    authProviders: Array.isArray(src.authProviders) && src.authProviders.length ? src.authProviders : ['email'],
    displayName: src.displayName ?? src.firstName ?? 'User',
    firstName: src.firstName ?? undefined,
    lastName: src.lastName || undefined,
    photoURL: src.photoURL ?? undefined,
    country: src.country ?? undefined,
    grade: src.grade ?? undefined,
    isSuperAdmin: src.isSuperAdmin ?? false,
    activeTenantId: src.activeTenantId ?? TENANT,
    status: src.status ?? 'active',
    createdAt: iso(src.createdAt),
    updatedAt: iso(src.updatedAt),
    createdBy: src.createdBy ?? uid,
    updatedBy: src.updatedBy ?? uid,
    lastLogin: iso(src.lastLogin) ?? null,
  });
}

function transformMembership(src, uid) {
  const doc = clean({
    id: `${uid}_${TENANT}`,
    uid,
    tenantId: TENANT,
    tenantCode: src.tenantCode ?? CODE,
    role: src.role,
    status: src.status ?? 'active',
    joinSource: src.joinSource ?? 'admin_created',
    teacherId: src.teacherId ?? undefined,
    studentId: src.studentId ?? undefined,
    parentId: src.parentId ?? undefined,
    staffId: src.staffId ?? undefined,
    scannerId: src.scannerId ?? undefined,
    parentLinkedStudentIds: src.parentLinkedStudentIds ?? undefined,
    createdAt: iso(src.createdAt),
    updatedAt: iso(src.updatedAt),
    createdBy: src.createdBy ?? OWNER,
    updatedBy: src.updatedBy ?? OWNER,
    lastActive: iso(src.lastActive) ?? null,
  });
  // permissions only if it's a non-null object
  if (src.permissions && typeof src.permissions === 'object') {
    const perm = clean({
      managedSpaceIds: src.permissions.managedSpaceIds,
      managedClassIds: src.permissions.managedClassIds,
      permissions: src.permissions.permissions,
    });
    if (Object.keys(perm).length) doc.permissions = perm;
  }
  return doc;
}

function transformSpace(src, computed) {
  const doc = clean({
    id: src.id,
    tenantId: TENANT,
    title: src.title,
    description: src.description ?? undefined,
    thumbnailUrl: src.thumbnailUrl ?? undefined,
    slug: src.slug ?? undefined,
    type: src.type,
    subject: src.subject ?? undefined,
    labels: Array.isArray(src.labels) ? src.labels : undefined,
    classIds: Array.isArray(src.classIds) ? src.classIds : [],
    sectionIds: Array.isArray(src.sectionIds) ? src.sectionIds : undefined,
    teacherIds: Array.isArray(src.teacherIds) ? src.teacherIds : [],
    accessType: src.accessType ?? 'class_assigned',
    academicSessionId: src.academicSessionId ?? undefined,
    publishedToStore: src.publishedToStore ?? undefined,
    status: src.status ?? 'draft',
    publishedAt: iso(src.publishedAt) ?? null,
    stats: {
      storyPointCount: computed.storyPointCount,
      itemCount: computed.itemCount,
      enrolledCount: 0,
      completionCount: 0,
    },
    ratingAggregate: { averageRating: 0, totalReviews: 0, distribution: {} },
    createdAt: iso(src.createdAt),
    updatedAt: iso(src.updatedAt),
    createdBy: src.createdBy ?? OWNER,
    updatedBy: src.updatedBy ?? src.createdBy ?? OWNER,
    archivedAt: iso(src.archivedAt) ?? null,
  });
  return doc;
}

function transformStoryPoint(src, spaceId, computed) {
  const doc = clean({
    id: src.id,
    spaceId,
    tenantId: TENANT,
    title: src.title,
    description: src.description ?? undefined,
    orderIndex: orderIdx(src),                                  // U4.2: canonical `orderIndex`, legacy `order` fallback
    type: normalizeStoryPointType(src.type ?? 'standard'),      // U4.2: legacy 'test' → 'timed_test' (AD-4/legacy.ts)
    sections: Array.isArray(src.sections)
      ? src.sections.map((s) => clean({ id: s.id, title: s.title, description: s.description, orderIndex: orderIdx(s) }))
      : [],
    difficulty: src.difficulty ?? undefined,
    estimatedTimeMinutes: Number.isFinite(src.estimatedTimeMinutes) ? src.estimatedTimeMinutes : undefined,
    stats: { itemCount: computed.itemCount, completionCount: 0 },
    createdAt: iso(src.createdAt),
    updatedAt: iso(src.updatedAt),
    createdBy: src.createdBy ?? OWNER,
    updatedBy: src.updatedBy ?? src.createdBy ?? OWNER,
    archivedAt: iso(src.archivedAt) ?? null,
  });
  if (src.assessmentConfig && typeof src.assessmentConfig === 'object') {
    const ac = src.assessmentConfig;
    doc.assessmentConfig = clean({
      durationMinutes: ac.durationMinutes,
      maxAttempts: ac.maxAttempts,
      shuffle: ac.shuffle ?? ac.shuffleQuestions,
      passingPercentage: ac.passingPercentage,
    });
  }
  return doc;
}

/** Build the canonical questionData (answer-stripped) + the answerKey core for a question. */
function buildQuestion(qt, q) {
  const ak = {}; // answerKey core: correctAnswer / acceptableAnswers / modelAnswer
  let qd;
  switch (qt) {
    case 'mcq':
    case 'mcaq': {
      const optsSrc = Array.isArray(q.options) ? q.options : [];
      const options = optsSrc.map((o) => clean({ id: String(o.id), text: o.text ?? '', imageUrl: o.imageUrl }));
      qd = clean({ questionType: qt, options, shuffleOptions: q.shuffleOptions });
      if (qt === 'mcaq') { put(qd, 'minSelections', q.minSelections); put(qd, 'maxSelections', q.maxSelections); }
      const flagged = optsSrc.filter((o) => o.isCorrect === true).map((o) => String(o.id));
      let correct = flagged;
      if (!correct.length && qt === 'mcq' && q.correctOptionId != null) correct = [String(q.correctOptionId)];
      if (!correct.length && qt === 'mcaq' && Array.isArray(q.correctOptionIds)) correct = q.correctOptionIds.map(String);
      ak.correctAnswer = qt === 'mcq' ? (correct[0] ?? null) : correct;
      break;
    }
    case 'true-false':
      qd = { questionType: 'true-false' };
      ak.correctAnswer = typeof q.correctAnswer === 'boolean' ? q.correctAnswer : (q.correctAnswer ?? null);
      break;
    case 'numerical':
      qd = clean({ questionType: 'numerical', tolerance: q.tolerance, unit: q.unit });
      ak.correctAnswer = q.correctAnswer ?? null;
      if (q.tolerance != null) ak.tolerance = q.tolerance;
      break;
    case 'text':
      qd = clean({ questionType: 'text', maxLength: q.maxLength });
      if (q.correctAnswer != null) ak.correctAnswer = q.correctAnswer;
      if (q.modelAnswer != null) ak.modelAnswer = q.modelAnswer;
      if (Array.isArray(q.acceptableAnswers)) ak.acceptableAnswers = q.acceptableAnswers;
      break;
    case 'paragraph':
      qd = clean({ questionType: 'paragraph', minWords: q.minWords, maxWords: q.maxWords });
      if (q.modelAnswer != null) ak.modelAnswer = q.modelAnswer;
      break;
    case 'code':
      qd = clean({
        questionType: 'code',
        language: q.language,
        starterCode: q.starterCode,
        testCases: Array.isArray(q.testCases) ? q.testCases.map((t) => ({ input: String(t.input ?? ''), output: String(t.output ?? '') })) : undefined,
      });
      if (q.modelAnswer != null) ak.modelAnswer = q.modelAnswer;
      break;
    case 'fill-blanks':
    case 'fill-blanks-dd': {
      const blanksSrc = Array.isArray(q.blanks) ? q.blanks : [];
      const template = q.textWithBlanks ?? q.template ?? q.content ?? q.question ?? '';
      qd = clean({ questionType: qt, template, blanks: blanksSrc.map((b) => ({ id: String(b.id) })), optionPool: qt === 'fill-blanks-dd' && Array.isArray(q.optionPool) ? q.optionPool : undefined });
      ak.correctAnswer = blanksSrc.map((b) => clean({ id: String(b.id), correctAnswer: b.correctAnswer, acceptableAnswers: b.acceptableAnswers, caseSensitive: b.caseSensitive }));
      break;
    }
    case 'matching': {
      const pairsSrc = Array.isArray(q.pairs) ? q.pairs : [];
      qd = clean({ questionType: 'matching', pairs: pairsSrc.map((p) => ({ left: p.left ?? '', right: p.right ?? '' })), shufflePairs: q.shufflePairs });
      ak.correctAnswer = pairsSrc.map((p) => clean({ id: p.id, left: p.left, right: p.right }));
      break;
    }
    case 'jumbled': {
      const orderSrc = Array.isArray(q.correctOrder) ? q.correctOrder : [];
      const tokens = orderSrc.map((t) => (typeof t === 'string' ? t : (t.text ?? '')));
      qd = { questionType: 'jumbled', tokens };
      ak.correctAnswer = tokens; // ordered tokens = the correct sequence (client shuffles tokens for display)
      break;
    }
    default:
      qd = clean({ questionType: qt });
      if (q.correctAnswer != null) ak.correctAnswer = q.correctAnswer;
      break;
  }
  return { questionData: qd, ak };
}

function buildMaterial(p) {
  const mt = p.materialType ?? p.kind;
  if (mt === 'video') return clean({ type: 'material', materialData: clean({ materialType: 'video', url: p.url ?? '', durationSeconds: p.duration ?? p.durationSeconds }) });
  if (mt === 'rich') {
    const blocks = p.richContent?.blocks ?? p.blocks ?? [];
    return { type: 'material', materialData: { materialType: 'rich', blocks } };
  }
  if (mt === 'text') return { type: 'material', materialData: { materialType: 'text', body: p.body ?? p.content ?? '' } };
  if (mt === 'pdf') return { type: 'material', materialData: { materialType: 'pdf', url: p.url ?? '' } };
  if (mt === 'link') return clean({ type: 'material', materialData: clean({ materialType: 'link', url: p.url ?? '', label: p.label }) });
  // fallback: wrap as rich with a single passthrough block-less body
  return { type: 'material', materialData: { materialType: 'rich', blocks: p.richContent?.blocks ?? p.blocks ?? [] } };
}

/** Transform a legacy item → { item, answerKey|null }. */
function transformItem(src, spaceId) {
  const p = src.payload ?? {};
  const type = src.type ?? (p.questionType ? 'question' : 'material');
  // Merge: payload-level fields (Shape B) overlaid by questionData (Shape A wins when present).
  const q = { ...p, ...(p.questionData && typeof p.questionData === 'object' ? p.questionData : {}) };
  const questionText = q.content ?? q.question ?? src.content ?? undefined;
  const difficulty = src.difficulty ?? p.difficulty ?? undefined;
  const labels = Array.isArray(src.meta?.tags) ? src.meta.tags : undefined;

  let payload;
  let ak = null;
  if (type === 'question') {
    const qt = p.questionType;
    const built = buildQuestion(qt, q);
    payload = clean({ type: 'question', basePoints: p.basePoints ?? p.points ?? q.basePoints ?? q.points, questionData: built.questionData });
    // assemble answerKey doc (server-only); include explanation/rubric as evaluationGuidance
    const guidance = [p.explanation ?? q.explanation, q.rubric].filter((x) => typeof x === 'string' && x.trim()).join('\n\n') || undefined;
    const core = built.ak;
    const hasAnswer =
      core.correctAnswer !== undefined || core.acceptableAnswers !== undefined || core.modelAnswer !== undefined || guidance !== undefined;
    if (hasAnswer) {
      ak = clean({
        id: src.id,
        itemId: src.id,
        tenantId: TENANT,
        spaceId,
        storyPointId: src.storyPointId,
        questionType: qt,
        correctAnswer: core.correctAnswer,
        acceptableAnswers: core.acceptableAnswers,
        modelAnswer: core.modelAnswer,
        evaluationGuidance: guidance,
        tolerance: core.tolerance,
        createdAt: iso(src.createdAt),
        updatedAt: iso(src.updatedAt),
      });
    }
  } else {
    payload = buildMaterial(p);
  }

  const meta = clean({ totalPoints: src.meta?.totalPoints, migrationSource: 'subhang-legacy' });
  const item = clean({
    id: src.id,
    spaceId,
    storyPointId: src.storyPointId,
    sectionId: src.sectionId ?? undefined,
    tenantId: TENANT,
    type,
    payload,
    title: src.title ?? undefined,
    content: questionText,
    difficulty,
    labels,
    orderIndex: orderIdx(src),                                  // U4.2: canonical `orderIndex`, legacy `order` fallback
    meta: Object.keys(meta).length ? meta : undefined,
    createdAt: iso(src.createdAt),
    updatedAt: iso(src.updatedAt),
    createdBy: src.createdBy ?? OWNER,
    updatedBy: src.updatedBy ?? OWNER,
    archivedAt: iso(src.archivedAt) ?? null,
  });
  return { item, answerKey: ak };
}

// ─────────────────────── validation ───────────────────────
const ANSWER_KEY_CORE = ['id', 'itemId', 'questionType', 'correctAnswer', 'acceptableAnswers', 'evaluationGuidance', 'modelAnswer', 'createdAt', 'updatedAt'];
function validate(schema, doc, kind, id, errors, opts = {}) {
  // For schemas with intentional denormalized supersets (answerKey), validate the canonical core only.
  const subject = opts.pick ? Object.fromEntries(Object.entries(doc).filter(([k]) => opts.pick.includes(k))) : doc;
  const r = schema.safeParse(subject);
  if (!r.success) errors.push({ kind, id, issues: r.error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`) });
  return r.success;
}

// ─────────────────────── batch writer ───────────────────────
async function writeAll(targets) {
  let batch = db.batch();
  let n = 0, commits = 0, total = 0;
  for (const { path, data } of targets) {
    batch.set(db.doc(path), data); // full replace (no merge) — deterministic idempotent overwrite
    n++; total++;
    if (n >= 450) { await batch.commit(); commits++; batch = db.batch(); n = 0; }
  }
  if (n > 0) { await batch.commit(); commits++; }
  return { total, commits };
}

// ─────────────────────── main ───────────────────────
async function build() {
  // identity
  const tenantSrc = (await db.doc(P.srcTenant()).get()).data();
  const codeSrc = (await db.doc(P.srcCode()).get()).data();
  const tenant = transformTenant(tenantSrc);
  const code = transformCode(codeSrc);
  const users = {}, members = {};
  for (const [role, uid] of Object.entries(USERS)) {
    users[role] = transformUser((await db.doc(P.srcUser(uid)).get()).data() ?? {}, uid);
    members[role] = transformMembership((await db.doc(P.srcMember(uid)).get()).data() ?? {}, uid);
  }

  // content (scan source)
  const spacesSnap = await db.collection(P.srcSpaces()).get();
  const spaces = [], storyPoints = [], items = [], answerKeys = [];
  const srcCounts = { spaces: spacesSnap.size, storyPoints: 0, items: 0, questions: 0, materials: 0, answerKeysExpected: 0 };
  for (const spaceDoc of spacesSnap.docs) {
    const sid = spaceDoc.id;
    const spSnap = await db.collection(P.srcStoryPoints(sid)).get();
    let spaceItemCount = 0;
    for (const sp of spSnap.docs) {
      const spid = sp.id;
      const itemsSnap = await db.collection(P.srcItems(sid, spid)).get();
      srcCounts.storyPoints++;
      for (const it of itemsSnap.docs) {
        srcCounts.items++; spaceItemCount++;
        const raw = { id: it.id, storyPointId: spid, ...it.data() };
        const { item, answerKey } = transformItem(raw, sid);
        items.push({ spaceId: sid, storyPointId: spid, doc: item });
        if (item.type === 'question') srcCounts.questions++; else srcCounts.materials++;
        if (answerKey) { answerKeys.push({ spaceId: sid, storyPointId: spid, doc: answerKey }); srcCounts.answerKeysExpected++; }
      }
      storyPoints.push({ spaceId: sid, doc: transformStoryPoint({ id: spid, ...sp.data() }, sid, { itemCount: itemsSnap.size }) });
    }
    spaces.push({ doc: transformSpace({ id: sid, ...spaceDoc.data() }, { storyPointCount: spSnap.size, itemCount: spaceItemCount }) });
  }
  return { tenant, code, users, members, spaces, storyPoints, items, answerKeys, srcCounts };
}

function validateAll(b) {
  const errors = [];
  validate(TenantSchema, b.tenant, 'tenant', TENANT, errors);
  validate(TenantCodeIndexSchema, b.code, 'tenantCode', CODE, errors);
  for (const role of Object.keys(USERS)) {
    validate(UnifiedUserSchema, b.users[role], 'user', `${role}:${USERS[role]}`, errors);
    validate(UserMembershipSchema, b.members[role], 'membership', `${role}`, errors);
  }
  for (const s of b.spaces) validate(SpaceSchema, s.doc, 'space', s.doc.id, errors);
  for (const sp of b.storyPoints) validate(StoryPointSchema, sp.doc, 'storyPoint', sp.doc.id, errors);
  let leaks = 0;
  for (const it of b.items) {
    validate(UnifiedItemSchema, it.doc, 'item', it.doc.id, errors);
    const leak = findLeak(it.doc.payload, `item(${it.doc.id}).payload`);
    if (leak) { leaks++; errors.push({ kind: 'LEAK', id: it.doc.id, issues: [leak] }); }
  }
  for (const ak of b.answerKeys) validate(AnswerKeySchema, ak.doc, 'answerKey', ak.doc.id, errors, { pick: ANSWER_KEY_CORE });
  return { errors, leaks };
}

function toTargets(b) {
  const t = [];
  t.push({ path: P.tenant(), data: b.tenant });
  t.push({ path: P.code(), data: b.code });
  for (const role of Object.keys(USERS)) {
    t.push({ path: P.user(USERS[role]), data: b.users[role] });
    t.push({ path: P.member(USERS[role]), data: b.members[role] });
  }
  for (const s of b.spaces) t.push({ path: P.space(s.doc.id), data: s.doc });
  for (const sp of b.storyPoints) t.push({ path: P.storyPoint(sp.spaceId, sp.doc.id), data: sp.doc });
  for (const it of b.items) t.push({ path: P.item(it.spaceId, it.storyPointId, it.doc.id), data: it.doc });
  for (const ak of b.answerKeys) t.push({ path: P.answerKey(ak.spaceId, ak.storyPointId, ak.doc.id), data: ak.doc });
  return t;
}

async function verifyV2() {
  const out = { tenant: false, code: false, users: {}, members: {}, spaces: 0, storyPoints: 0, items: 0, questions: 0, materials: 0, answerKeys: 0, leakSampleChecked: 0, leakFound: [] };
  out.tenant = (await db.doc(P.tenant()).get()).exists;
  out.code = (await db.doc(P.code()).get()).exists;
  for (const [role, uid] of Object.entries(USERS)) {
    out.users[role] = (await db.doc(P.user(uid)).get()).exists;
    out.members[role] = (await db.doc(P.member(uid)).get()).exists;
  }
  // spaces (flat) + storyPoints (FLAT tenant-scoped collection, as the callable reads).
  out.spaces = (await db.collection(`${PFX}tenants/${TENANT}/spaces`).get()).size;
  const spsSnap = await db.collection(`${PFX}tenants/${TENANT}/storyPoints`).get();
  out.storyPoints = spsSnap.size;
  out.storyPointsWithSpaceId = spsSnap.docs.filter((d) => d.data().spaceId).length;
  // Items live nested at v2_tenants/{t}/spaces/{spaceId}/storyPoints/{spid}/items (resolved by the
  // callables via collectionGroup('items').where(tenantId==) — which needs a composite index). Here
  // we verify via DIRECT subcollection reads (index-free) walking flat storyPoints by their spaceId.
  for (const sp of spsSnap.docs) {
    const spaceId = sp.data().spaceId;
    if (!spaceId) continue;
    const its = await db.collection(`${PFX}tenants/${TENANT}/spaces/${spaceId}/storyPoints/${sp.id}/items`).get();
    out.items += its.size;
    for (const it of its.docs) {
      const d = it.data();
      if (d.type === 'question') out.questions++; else if (d.type === 'material') out.materials++;
      const aks = await db.collection(`${PFX}tenants/${TENANT}/spaces/${spaceId}/storyPoints/${sp.id}/items/${it.id}/answerKeys`).get();
      out.answerKeys += aks.size;
      if (out.leakSampleChecked < 300) {
        out.leakSampleChecked++;
        const leak = findLeak(d.payload, `v2item(${it.id}).payload`);
        if (leak) out.leakFound.push(leak);
      }
    }
  }
  return out;
}

async function main() {
  console.log(`\n===== Subhang → v2_ MIGRATION  [mode: ${MODE}] =====`);

  if (VERIFY_ONLY) {
    const v = await verifyV2();
    console.log(JSON.stringify(v, null, 2));
    writeFileSync(join(OUT, 'verify-report.json'), JSON.stringify(v, null, 2));
    return;
  }

  const b = await build();
  const { errors, leaks } = validateAll(b);
  const targets = toTargets(b);

  const summary = {
    mode: MODE,
    sourceCounts: b.srcCounts,
    targetCounts: {
      tenant: 1, tenantCode: 1, users: Object.keys(USERS).length, memberships: Object.keys(USERS).length,
      spaces: b.spaces.length, storyPoints: b.storyPoints.length, items: b.items.length, answerKeys: b.answerKeys.length,
      totalWrites: targets.length,
    },
    validation: { totalErrors: errors.length, leaks, errorsByKind: errors.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {}) },
    firstErrors: errors.slice(0, 25),
  };
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync(join(OUT, 'migration-dryrun-report.json'), JSON.stringify({ summary, sampleDocs: {
    tenant: b.tenant, tenantCode: b.code, studentUser: b.users.student, studentMembership: b.members.student,
    space: b.spaces[0]?.doc, storyPoint: b.storyPoints[0]?.doc,
    sampleItems: b.items.slice(0, 3).map((i) => i.doc), sampleAnswerKeys: b.answerKeys.slice(0, 3).map((a) => a.doc),
  }, allErrors: errors }, null, 2));

  if (errors.length > 0) {
    console.log(`\n⚠️  ${errors.length} validation error(s) / ${leaks} leak(s). See out/migration-dryrun-report.json`);
  } else {
    console.log('\n✅ All built docs pass canonical Zod validation. 0 answer-field leaks in item payloads.');
  }

  if (MODE === 'dry-run') {
    console.log('\nDRY-RUN only — no writes. Re-run with --apply to write to v2_.');
    return;
  }

  // APPLY gate: refuse to write if validation failed or any leak.
  if (errors.length > 0) {
    console.error('\n❌ Refusing to APPLY: validation errors / leaks present. Fix transforms first.');
    process.exit(2);
  }
  console.log(`\nAPPLYING ${targets.length} writes to v2_ …`);
  const w = await writeAll(targets);
  console.log(`Wrote ${w.total} docs in ${w.commits} batches.`);

  console.log('\nVerifying v2_ …');
  const v = await verifyV2();
  const ok =
    v.tenant && v.code && Object.values(v.users).every(Boolean) && Object.values(v.members).every(Boolean) &&
    v.spaces === b.spaces.length && v.storyPoints === b.storyPoints.length && v.items === b.items.length &&
    v.answerKeys === b.answerKeys.length && v.leakFound.length === 0;
  console.log(JSON.stringify(v, null, 2));
  console.log(ok ? '\n✅ VERIFY OK — counts match, no leaks.' : '\n❌ VERIFY MISMATCH — see report.');
  writeFileSync(join(OUT, 'verify-report.json'), JSON.stringify({ verifyOk: ok, v, expected: summary.targetCounts }, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error('MIGRATION ERROR:', e); process.exit(1); });
