/**
 * Subhang Academy — Full Seed Script (Tenant + Accounts + Content)
 *
 * Creates:
 *   - 1 Tenant (Subhang Academy, code: SUB001, premium plan)
 *   - 1 Academic Session (2025-26)
 *   - 4 Classes (System Design, DSA, LLD, Behavioral)
 *   - 1 Admin/Teacher (subhang.rocklee@gmail.com — tenantAdmin + teacher entity)
 *   - 1 Student (student.test@subhang.academy)
 *   - 1 Parent (parent.test@subhang.academy → linked to student)
 *   - 4 Learning Spaces with Story Points and Items
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json \
 *     npx tsx scripts/seed-subhang.ts
 *
 * WARNING: This writes to PRODUCTION Firestore. Not emulators.
 */

import admin from "firebase-admin";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Configs
import {
  seedAccounts,
  TENANT_CODE,
  SCHOOL_NAME,
  DEFAULT_PASSWORD,
  ADMIN_TEACHER,
  STUDENT,
  PARENT,
  ALL_CLASSES,
} from "./seed-configs/subhang-accounts.js";
import { systemDesignSpace } from "./seed-configs/subhang-content.js";
import { dsaSpace } from "./seed-configs/subhang-dsa-content.js";
import { lldSpace } from "./seed-configs/subhang-lld-content.js";
import { behavioralSpace } from "./seed-configs/subhang-behavioral-content.js";
import type { SpaceSeed } from "./seed-configs/subhang-content.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// 1. Initialize Firebase Admin (PRODUCTION)
// ---------------------------------------------------------------------------
const SERVICE_ACCOUNT_PATH = resolve(
  __dirname,
  "../lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json"
);

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf-8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "lvlup-ff6fa",
  databaseURL: "https://lvlup-ff6fa-default-rtdb.firebaseio.com",
});

const db = admin.firestore();
const auth = admin.auth();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const now = Date.now();

function ts(daysAgo = 0): admin.firestore.Timestamp {
  return Timestamp.fromMillis(now - daysAgo * 86400000);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Seed Result Type
// ---------------------------------------------------------------------------
interface SpaceResult {
  id: string;
  title: string;
  classId: string;
  storyPoints: { id: string; title: string; type: string; itemCount: number }[];
}

interface SeedResult {
  tenant: {
    id: string;
    code: string;
    name: string;
  };
  academicSession: {
    id: string;
    name: string;
  };
  classes: { id: string; name: string }[];
  accounts: {
    admin: { uid: string; email: string; role: string; teacherEntityId: string };
    student: { uid: string; email: string; role: string; studentEntityId: string };
    parent: { uid: string; email: string; role: string; parentEntityId: string };
  };
  credentials: {
    admin: { email: string; password: string };
    student: { email: string; password: string };
    parent: { email: string; password: string };
  };
  spaces: SpaceResult[];
  entityCounts: {
    tenants: number;
    classes: number;
    authUsers: number;
    teachers: number;
    students: number;
    parents: number;
    memberships: number;
    spaces: number;
    storyPoints: number;
    items: number;
  };
  seededAt: string;
}

// ---------------------------------------------------------------------------
// Seed a single space with its story points and items
// ---------------------------------------------------------------------------
async function seedSpace(
  space: SpaceSeed,
  tenantId: string,
  classId: string,
  adminUid: string,
  academicSessionId: string
): Promise<SpaceResult> {
  space.classIds = [classId];

  let totalItems = 0;
  for (const sp of space.storyPoints) totalItems += sp.items.length;

  console.log(`  Creating space: ${space.title}...`);
  const spaceRef = db.collection(`tenants/${tenantId}/spaces`).doc();
  const spaceId = spaceRef.id;

  await spaceRef.set({
    id: spaceId,
    tenantId,
    title: space.title,
    description: space.description,
    thumbnailUrl: null,
    slug: generateSlug(space.title),
    type: space.type,
    classIds: space.classIds,
    teacherIds: [adminUid],
    accessType: "class_assigned",
    subject: space.subject,
    labels: [space.subject.toLowerCase()],
    academicSessionId,
    defaultTimeLimitMinutes: 30,
    allowRetakes: true,
    maxRetakes: 3,
    status: "published",
    publishedAt: ts(30),
    stats: {
      totalStoryPoints: space.storyPoints.length,
      totalItems,
      totalStudents: 0,
      avgCompletionRate: 0,
    },
    createdBy: adminUid,
    createdAt: ts(35),
    updatedAt: ts(0),
  });

  console.log(`    Space ID: ${spaceId}`);

  const storyPointResults: SpaceResult["storyPoints"] = [];

  for (let spi = 0; spi < space.storyPoints.length; spi++) {
    const sp = space.storyPoints[spi];
    const spRef = db.collection(`tenants/${tenantId}/spaces/${spaceId}/storyPoints`).doc();

    const spDoc: Record<string, unknown> = {
      id: spRef.id,
      courseId: spaceId,
      spaceId,
      tenantId,
      title: sp.title,
      description: sp.description,
      orderIndex: spi,
      type: sp.type,
      sections: sp.sections,
      createdAt: ts(30),
      updatedAt: ts(0),
    };

    if (sp.assessmentConfig) {
      spDoc.assessmentConfig = sp.assessmentConfig;
    }

    await spRef.set(spDoc);
    console.log(`    SP${spi + 1}: ${sp.title} [${sp.type}] (${sp.items.length} items)`);

    storyPointResults.push({
      id: spRef.id,
      title: sp.title,
      type: sp.type,
      itemCount: sp.items.length,
    });

    for (let ii = 0; ii < sp.items.length; ii++) {
      const item = sp.items[ii];
      const itemRef = db
        .collection(`tenants/${tenantId}/spaces/${spaceId}/storyPoints/${spRef.id}/items`)
        .doc();

      const flatPayload = (item.payload as any)?.data ?? item.payload;
      const basePoints = flatPayload?.basePoints ?? 10;

      await itemRef.set({
        id: itemRef.id,
        courseId: spaceId,
        storyPointId: spRef.id,
        sectionId: item.sectionId || null,
        type: item.type,
        title: item.title,
        content: flatPayload?.content || null,
        difficulty: item.difficulty || null,
        payload: flatPayload,
        meta: {
          totalPoints: item.type === "question" ? basePoints : 0,
          tags: [space.subject.toLowerCase()],
        },
        sect_order_idx: ii,
        orderIndex: ii,
        createdAt: ts(28),
        updatedAt: ts(0),
      });
    }
  }

  return {
    id: spaceId,
    title: space.title,
    classId,
    storyPoints: storyPointResults,
  };
}

// ===========================================================================
// MAIN SEED
// ===========================================================================
async function main(): Promise<void> {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Subhang Academy — Full Production Seed (4 Spaces)         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // =========================================================================
  // Phase 1: Tenant + Accounts + Classes
  // =========================================================================
  const accountsResult = await seedAccounts(db, auth, FieldValue, Timestamp);
  const {
    tenantId,
    classIds,
    teacherEntityId,
    adminUid,
    studentUid,
    studentEntityId,
    parentUid,
    parentEntityId,
    academicSessionId,
  } = accountsResult;

  // =========================================================================
  // Phase 2: All Spaces
  // =========================================================================
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Phase 2: Creating 4 Learning Spaces                       ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Map: classId → space config
  // cls_g10_sysdesign_a → System Design
  // cls_g10_dsa_a → DSA
  // cls_g10_lld_a → LLD
  // cls_g10_behavioral_a → Behavioral
  const spaceConfigs: { space: SpaceSeed; classId: string }[] = [
    { space: systemDesignSpace, classId: "cls_g10_sysdesign_a" },
    { space: dsaSpace, classId: "cls_g10_dsa_a" },
    { space: lldSpace, classId: "cls_g10_lld_a" },
    { space: behavioralSpace, classId: "cls_g10_behavioral_a" },
  ];

  const spaceResults: SpaceResult[] = [];
  let totalStoryPoints = 0;
  let totalItems = 0;

  for (const { space, classId } of spaceConfigs) {
    const result = await seedSpace(space, tenantId, classId, adminUid, academicSessionId);
    spaceResults.push(result);
    totalStoryPoints += result.storyPoints.length;
    for (const sp of result.storyPoints) totalItems += sp.itemCount;
    console.log(`  ✓ ${space.title}: ${result.storyPoints.length} story points\n`);
  }

  // Update tenant stats
  await db.doc(`tenants/${tenantId}`).update({
    "stats.totalSpaces": spaceResults.length,
  });

  // =========================================================================
  // Phase 3: Validation
  // =========================================================================
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Validation                                                ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  let validationPassed = true;

  // 1. Tenant exists
  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  const tenantOk = tenantSnap.exists;
  console.log(`  [${tenantOk ? "✓" : "✗"}] Tenant exists: ${tenantId}`);
  if (!tenantOk) validationPassed = false;

  // 2. Tenant code index
  const codeSnap = await db.doc(`tenantCodes/${TENANT_CODE}`).get();
  const codeOk = codeSnap.exists && codeSnap.data()?.tenantId === tenantId;
  console.log(`  [${codeOk ? "✓" : "✗"}] Tenant code index: ${TENANT_CODE}`);
  if (!codeOk) validationPassed = false;

  // 3. Auth users + custom claims
  for (const { uid, label, expectedRole } of [
    { uid: adminUid, label: "Admin/Teacher", expectedRole: "tenantAdmin" },
    { uid: studentUid, label: "Student", expectedRole: "student" },
    { uid: parentUid, label: "Parent", expectedRole: "parent" },
  ]) {
    const userRecord = await auth.getUser(uid);
    const claims = userRecord.customClaims || {};
    const claimsOk = claims.role === expectedRole && claims.tenantId === tenantId;
    console.log(
      `  [${claimsOk ? "✓" : "✗"}] ${label} claims: role=${claims.role}, tenantId=${claims.tenantId}`
    );
    if (!claimsOk) validationPassed = false;
  }

  // 4. All classes exist
  for (const cls of ALL_CLASSES) {
    const classSnap = await db.doc(`tenants/${tenantId}/classes/${cls.id}`).get();
    const classOk = classSnap.exists;
    console.log(`  [${classOk ? "✓" : "✗"}] Class exists: ${cls.id} (${cls.name})`);
    if (!classOk) validationPassed = false;
  }

  // 5. Memberships
  for (const { uid, label } of [
    { uid: adminUid, label: "Admin" },
    { uid: studentUid, label: "Student" },
    { uid: parentUid, label: "Parent" },
  ]) {
    const membershipId = `${uid}_${tenantId}`;
    const mSnap = await db.doc(`userMemberships/${membershipId}`).get();
    const mOk = mSnap.exists;
    console.log(`  [${mOk ? "✓" : "✗"}] ${label} membership: ${membershipId}`);
    if (!mOk) validationPassed = false;
  }

  // 6. All spaces exist with correct counts
  for (const sr of spaceResults) {
    const spaceSnap = await db.doc(`tenants/${tenantId}/spaces/${sr.id}`).get();
    const spaceOk = spaceSnap.exists;
    console.log(`  [${spaceOk ? "✓" : "✗"}] Space exists: ${sr.title} (${sr.id})`);
    if (!spaceOk) validationPassed = false;

    const spSnap = await db.collection(`tenants/${tenantId}/spaces/${sr.id}/storyPoints`).get();
    const spCountOk = spSnap.size === sr.storyPoints.length;
    console.log(
      `  [${spCountOk ? "✓" : "✗"}]   Story points: ${spSnap.size}/${sr.storyPoints.length}`
    );
    if (!spCountOk) validationPassed = false;

    let spaceItems = 0;
    for (const spDoc of spSnap.docs) {
      const itemsSnap = await db
        .collection(`tenants/${tenantId}/spaces/${sr.id}/storyPoints/${spDoc.id}/items`)
        .get();
      spaceItems += itemsSnap.size;
    }
    const expectedItems = sr.storyPoints.reduce((sum, s) => sum + s.itemCount, 0);
    const itemCountOk = spaceItems === expectedItems;
    console.log(`  [${itemCountOk ? "✓" : "✗"}]   Items: ${spaceItems}/${expectedItems}`);
    if (!itemCountOk) validationPassed = false;
  }

  console.log("");
  console.log(
    validationPassed
      ? "  ✅ ALL VALIDATIONS PASSED"
      : "  ⚠️  SOME VALIDATIONS FAILED — check output above"
  );
  console.log("");

  // =========================================================================
  // Write seed result JSON
  // =========================================================================
  const seedResult: SeedResult = {
    tenant: {
      id: tenantId,
      code: TENANT_CODE,
      name: SCHOOL_NAME,
    },
    academicSession: {
      id: academicSessionId,
      name: "2025-26",
    },
    classes: ALL_CLASSES.map((c) => ({ id: c.id, name: c.name })),
    accounts: {
      admin: { uid: adminUid, email: ADMIN_TEACHER.email, role: "tenantAdmin", teacherEntityId },
      student: { uid: studentUid, email: STUDENT.email, role: "student", studentEntityId },
      parent: { uid: parentUid, email: PARENT.email, role: "parent", parentEntityId },
    },
    credentials: {
      admin: { email: ADMIN_TEACHER.email, password: DEFAULT_PASSWORD },
      student: { email: STUDENT.email, password: DEFAULT_PASSWORD },
      parent: { email: PARENT.email, password: DEFAULT_PASSWORD },
    },
    spaces: spaceResults,
    entityCounts: {
      tenants: 1,
      classes: ALL_CLASSES.length,
      authUsers: 3,
      teachers: 1,
      students: 1,
      parents: 1,
      memberships: 3,
      spaces: spaceResults.length,
      storyPoints: totalStoryPoints,
      items: totalItems,
    },
    seededAt: new Date().toISOString(),
  };

  const resultPath = resolve(__dirname, "seed-results/subhang.json");
  mkdirSync(dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, JSON.stringify(seedResult, null, 2));

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Seed Complete — Summary                                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`  Tenant:     ${SCHOOL_NAME} (${tenantId})`);
  console.log(`  Classes:    ${ALL_CLASSES.length} classes`);
  console.log(`  Accounts:   3 auth users, 3 memberships`);
  console.log(`  Spaces:     ${spaceResults.length} spaces`);
  for (const sr of spaceResults) {
    const itemCount = sr.storyPoints.reduce((sum, s) => sum + s.itemCount, 0);
    console.log(`    - ${sr.title}: ${sr.storyPoints.length} SPs, ${itemCount} items (${sr.id})`);
  }
  console.log(`  Total:      ${totalStoryPoints} story points, ${totalItems} items`);
  console.log(`  Results:    ${resultPath}`);
  console.log(`  Validated:  ${validationPassed ? "PASS" : "FAIL"}`);
  console.log("");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
