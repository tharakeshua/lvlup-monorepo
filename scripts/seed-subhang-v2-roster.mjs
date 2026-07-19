/**
 * Subhang Academy — v2_ Roster Seed (Classes + Students for autograde testing)
 *
 * Seeds into the DEPLOYED, canonical `v2_`-prefixed collections
 * (LVLUP_COLLECTION_PREFIX=v2_) that the live app + autograde read/write.
 *
 * Teacher subhang.rocklee@gmail.com (uid d0ZDQvoNBcTtKIIduaZvF2iiwMc2) already
 * exists (tenantAdmin membership + claims). Their real exams live in class
 * `X4gjEaQ22RgilRhaAb1t` ("10th") but there were ZERO student entities — which
 * blocks the autograde flow. This script:
 *   - Creates/repairs the teacher entity doc in v2_ (referenced but missing).
 *   - Creates content-backed classes (matching the 12 existing published spaces).
 *   - Creates 6 students (Auth + v2_users + v2_ student entity + v2_userMemberships
 *     + custom claims), enrolled in ALL classes incl. the exam class.
 *   - Repairs the pre-existing student.test membership (had membership, no entity).
 *   - Updates class rosters (studentIds/studentCount/teacherIds) + tenant stats.
 *
 * All docs use canonical domain-Zod shapes: ISO-8601 UTC string timestamps,
 * strict fields only.  Idempotent (stable ids / merge upserts).
 *
 * Usage:
 *   node scripts/seed-subhang-v2-roster.mjs
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const sa = JSON.parse(
  readFileSync('./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8'),
);
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const auth = getAuth(app);

// ── Constants ────────────────────────────────────────────────────────────────
const T = 'tenant_subhang';
const TENANT_CODE = 'SUB001';
const DEFAULT_PASSWORD = 'Test@12345';
const TEACHER_UID = 'd0ZDQvoNBcTtKIIduaZvF2iiwMc2';
const TEACHER_ENTITY_ID = 'P9NVQNRESE1Tq3L6LzG8'; // referenced by teacher membership/claims
const EXAM_CLASS_ID = 'X4gjEaQ22RgilRhaAb1t'; // the "10th" class all real exams reference
const NOW = new Date().toISOString();

const iso = (daysAgo = 0) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString();

// Content-backed classes (ids match the classIds on the 12 existing v2_ spaces).
const CONTENT_CLASSES = [
  { id: 'cls_g10_sysdesign_a', name: 'System Design Class', grade: '10' },
  { id: 'cls_g10_dsa_a', name: 'DSA Class', grade: '10' },
  { id: 'cls_g10_lld_a', name: 'LLD Class', grade: '10' },
  { id: 'cls_g10_behavioral_a', name: 'Behavioral Interview Class', grade: '10' },
  { id: 'cls_g10_java_a', name: 'Java Programming Class', grade: '10' },
  { id: 'cls_g10_ddd_a', name: 'Domain-Driven Design Class', grade: '10' },
  { id: 'cls_ddia', name: 'DDIA Book Study', grade: '10' },
];

// Every student enrolls in the exam class + all content classes.
const ALL_CLASS_IDS = [EXAM_CLASS_ID, ...CONTENT_CLASSES.map((c) => c.id)];

const STUDENTS = [
  { email: 'aarav@subhang.academy', first: 'Aarav', last: 'Sharma', roll: '2026101' },
  { email: 'diya@subhang.academy', first: 'Diya', last: 'Patel', roll: '2026102' },
  { email: 'arjun@subhang.academy', first: 'Arjun', last: 'Reddy', roll: '2026103' },
  { email: 'ananya@subhang.academy', first: 'Ananya', last: 'Iyer', roll: '2026104' },
  { email: 'rohan@subhang.academy', first: 'Rohan', last: 'Gupta', roll: '2026105' },
  { email: 'isha@subhang.academy', first: 'Isha', last: 'Nair', roll: '2026106' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
async function ensureAuthUser(email, password, displayName) {
  try {
    const u = await auth.getUserByEmail(email);
    return u.uid;
  } catch {
    const u = await auth.createUser({ email, password, displayName });
    return u.uid;
  }
}

const studentClaims = (studentId) => ({
  role: 'student',
  tenantId: T,
  tenantCode: TENANT_CODE,
  studentId,
  classIds: ALL_CLASS_IDS.slice(0, 15),
  classIdsOverflow: ALL_CLASS_IDS.length > 15,
});

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== Subhang v2_ roster seed ===\n');

  // 1) Teacher entity doc (referenced by membership/claims but missing in v2_).
  await db.doc(`v2_tenants/${T}/teachers/${TEACHER_ENTITY_ID}`).set(
    {
      id: TEACHER_ENTITY_ID,
      tenantId: T,
      authUid: TEACHER_UID,
      email: 'subhang.rocklee@gmail.com',
      firstName: 'Subhang',
      lastName: '',
      displayName: 'Subhang',
      employeeId: 'SUB-T001',
      department: 'Computer Science',
      subjects: ['System Design', 'DSA', 'Low-Level Design', 'Behavioral Interviews', 'Java'],
      classIds: ALL_CLASS_IDS,
      status: 'active',
      lastLogin: null,
      createdAt: iso(60),
      updatedAt: NOW,
      createdBy: TEACHER_UID,
      updatedBy: TEACHER_UID,
    },
    { merge: true },
  );
  console.log(`  teacher entity ensured: ${TEACHER_ENTITY_ID}`);

  // 2) Create students (Auth + user + entity + membership + claims).
  const seeded = [];
  for (const s of STUDENTS) {
    const uid = await ensureAuthUser(s.email, DEFAULT_PASSWORD, `${s.first} ${s.last}`);
    const displayName = `${s.first} ${s.last}`;
    // Deterministic student entity id (idempotent re-runs) keyed off uid.
    const entityId = `stu_${uid.slice(0, 20)}`;

    // v2_users/{uid}
    await db.doc(`v2_users/${uid}`).set(
      {
        uid,
        email: s.email,
        authProviders: ['email'],
        displayName,
        firstName: s.first,
        lastName: s.last,
        grade: '10',
        isSuperAdmin: false,
        activeTenantId: T,
        status: 'active',
        createdAt: iso(30),
        updatedAt: NOW,
        createdBy: TEACHER_UID,
        updatedBy: TEACHER_UID,
        lastLogin: null,
      },
      { merge: true },
    );

    // v2_tenants/{T}/students/{entityId}
    await db.doc(`v2_tenants/${T}/students/${entityId}`).set(
      {
        id: entityId,
        tenantId: T,
        authUid: uid,
        firstName: s.first,
        lastName: s.last,
        displayName,
        email: s.email,
        rollNumber: s.roll,
        section: 'A',
        classIds: ALL_CLASS_IDS,
        parentIds: [],
        grade: '10',
        status: 'active',
        createdAt: iso(30),
        updatedAt: NOW,
        createdBy: TEACHER_UID,
        updatedBy: TEACHER_UID,
      },
      { merge: true },
    );

    // v2_userMemberships/{uid}_{T}
    await db.doc(`v2_userMemberships/${uid}_${T}`).set(
      {
        id: `${uid}_${T}`,
        uid,
        tenantId: T,
        tenantCode: TENANT_CODE,
        role: 'student',
        status: 'active',
        joinSource: 'admin_created',
        studentId: entityId,
        createdAt: iso(30),
        updatedAt: NOW,
        createdBy: TEACHER_UID,
        updatedBy: TEACHER_UID,
        lastActive: null,
      },
      { merge: true },
    );

    // Custom claims
    await auth.setCustomUserClaims(uid, studentClaims(entityId));

    seeded.push({ email: s.email, uid, entityId, roll: s.roll, name: displayName });
    console.log(`  student: ${s.email}  uid=${uid}  entity=${entityId}`);
  }

  // 3) Repair pre-existing student.test membership (membership existed, entity did not).
  try {
    const testUid = 'lUUkhr5fQMZjrUxvbsIoYmCLrku2';
    const testEntityId = '4ETnX1nentEZZiQ4yYXV';
    const testUser = await auth.getUser(testUid).catch(() => null);
    if (testUser) {
      await db.doc(`v2_tenants/${T}/students/${testEntityId}`).set(
        {
          id: testEntityId,
          tenantId: T,
          authUid: testUid,
          firstName: 'Test',
          lastName: 'Student',
          displayName: 'Test Student',
          email: testUser.email ?? 'student.test@subhang.academy',
          rollNumber: '2026001',
          section: 'A',
          classIds: ALL_CLASS_IDS,
          parentIds: [],
          grade: '10',
          status: 'active',
          createdAt: iso(45),
          updatedAt: NOW,
          createdBy: TEACHER_UID,
          updatedBy: TEACHER_UID,
        },
        { merge: true },
      );
      await auth.setCustomUserClaims(testUid, studentClaims(testEntityId));
      seeded.push({
        email: testUser.email,
        uid: testUid,
        entityId: testEntityId,
        roll: '2026001',
        name: 'Test Student',
      });
      console.log(`  repaired pre-existing student: ${testUser.email} entity=${testEntityId}`);
    }
  } catch (e) {
    console.log('  (skip test-student repair):', e.message);
  }

  const allEntityIds = seeded.map((s) => s.entityId);

  // 4) Ensure content classes exist with full roster.
  for (const c of CONTENT_CLASSES) {
    await db.doc(`v2_tenants/${T}/classes/${c.id}`).set(
      {
        id: c.id,
        tenantId: T,
        name: c.name,
        grade: c.grade,
        section: 'A',
        teacherIds: [TEACHER_UID],
        studentIds: allEntityIds,
        studentCount: allEntityIds.length,
        status: 'active',
        createdAt: iso(55),
        updatedAt: NOW,
        createdBy: TEACHER_UID,
        updatedBy: TEACHER_UID,
      },
      { merge: true },
    );
    console.log(`  class ensured: ${c.id} (${c.name}) roster=${allEntityIds.length}`);
  }

  // 5) Update the exam class "10th" roster (existing doc — merge counts + roster).
  await db.doc(`v2_tenants/${T}/classes/${EXAM_CLASS_ID}`).set(
    {
      teacherIds: [TEACHER_UID],
      studentIds: allEntityIds,
      studentCount: allEntityIds.length,
      updatedAt: NOW,
      updatedBy: TEACHER_UID,
    },
    { merge: true },
  );
  console.log(`  exam class ${EXAM_CLASS_ID} roster updated -> ${allEntityIds.length} students`);

  // 6) Update tenant stats.
  await db.doc(`v2_tenants/${T}`).set(
    {
      stats: {
        totalStudents: allEntityIds.length,
        totalTeachers: 1,
        totalClasses: 1 + CONTENT_CLASSES.length,
        totalExams: 0,
        totalSpaces: 12,
      },
      updatedAt: NOW,
      updatedBy: TEACHER_UID,
    },
    { merge: true },
  );
  console.log('  tenant stats updated');

  console.log('\n=== Seed complete ===');
  console.log(`  Students (${seeded.length}), password: ${DEFAULT_PASSWORD}`);
  for (const s of seeded) console.log(`    ${s.roll}  ${s.name}  <${s.email}>`);
  console.log(`  Classes: ${ALL_CLASS_IDS.length} (incl. exam class ${EXAM_CLASS_ID})`);
  process.exit(0);
}

main().catch((e) => {
  console.error('SEED FAILED:', e);
  process.exit(1);
});
