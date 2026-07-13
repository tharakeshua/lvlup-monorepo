/**
 * End-to-end auth flow integration tests.
 *
 * These test the full login flows against the Firebase Emulator Suite.
 * Requires: `firebase emulators:start`
 *
 * Covers scenarios from §10.4 of the design doc:
 *  - Full school-code login flow
 *  - Roll number login
 *  - Multi-org switch
 *  - SuperAdmin login
 *  - Unauthorized access
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { signInWithEmailAndPassword, getIdTokenResult, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  setupClientSDK,
  getAdminApp,
  getClientAuth,
  getClientFirestore,
  getClientFunctions,
  resetEmulators,
} from "./setup";
import {
  seedTenant,
  seedUser,
  seedMembership,
  setUserClaims,
  seedTeacherEntity,
  seedStudentEntity,
} from "./seed-helpers";

beforeAll(() => {
  getAdminApp();
  setupClientSDK();
});

beforeEach(async () => {
  await resetEmulators();
});

// ══════════════════════════════════════════════════════════════════════════
// 1. Full School-Code Login Flow
// ══════════════════════════════════════════════════════════════════════════

describe("Full School-Code Login Flow", () => {
  it("teacher logs in with school code, gets correct claims, reads own tenant", async () => {
    // Seed
    const owner = await seedUser({
      email: "owner@test.com",
      password: "owner123",
      displayName: "Owner",
    });
    const { tenantId, tenantCode } = await seedTenant({
      name: "Springfield School",
      tenantCode: "SPR001",
      ownerUid: owner.uid,
    });
    const teacher = await seedUser({
      email: "teacher@springfield.edu",
      password: "teach123",
      displayName: "Ms. Smith",
    });
    const teacherEntityId = await seedTeacherEntity(tenantId, teacher.uid, {
      firstName: "Ms.",
      lastName: "Smith",
      subjects: ["Math"],
    });
    await seedMembership({
      uid: teacher.uid,
      tenantId,
      tenantCode,
      role: "teacher",
      teacherId: teacherEntityId,
      classIds: ["class-a", "class-b"],
    });
    await setUserClaims(teacher.uid, {
      role: "teacher",
      tenantId,
      tenantCode,
      teacherId: teacherEntityId,
      classIds: ["class-a", "class-b"],
      classIdsOverflow: false,
    });

    // 1. Look up tenant code
    const clientDb = getClientFirestore();
    const codeSnap = await getDoc(doc(clientDb, "tenantCodes", "SPR001"));
    expect(codeSnap.exists()).toBe(true);
    expect(codeSnap.data()!["tenantId"]).toBe(tenantId);

    // 2. Sign in
    const auth = getClientAuth();
    const cred = await signInWithEmailAndPassword(auth, "teacher@springfield.edu", "teach123");
    expect(cred.user.uid).toBe(teacher.uid);

    // 3. Verify claims
    const tokenResult = await getIdTokenResult(cred.user, true);
    expect(tokenResult.claims["role"]).toBe("teacher");
    expect(tokenResult.claims["tenantId"]).toBe(tenantId);
    expect(tokenResult.claims["tenantCode"]).toBe(tenantCode);
    expect(tokenResult.claims["teacherId"]).toBe(teacherEntityId);
    expect(tokenResult.claims["classIds"]).toEqual(["class-a", "class-b"]);

    // 4. Can read own tenant
    const tenantSnap = await getDoc(doc(clientDb, "tenants", tenantId));
    expect(tenantSnap.exists()).toBe(true);
    expect(tenantSnap.data()!["name"]).toBe("Springfield School");

    await signOut(auth);
  });

  it("student cannot read a different tenant", async () => {
    // Create two tenants
    const owner = await seedUser({
      email: "owner@test.com",
      password: "testpw123",
      displayName: "Owner",
    });
    const { tenantId: t1 } = await seedTenant({
      name: "School A",
      tenantCode: "SCHL_A",
      ownerUid: owner.uid,
    });
    const { tenantId: t2 } = await seedTenant({
      name: "School B",
      tenantCode: "SCHL_B",
      ownerUid: owner.uid,
    });

    // Student belongs to t1 only
    const student = await seedUser({
      email: "student@a.com",
      password: "stu123",
      displayName: "Stu",
    });
    const stuId = await seedStudentEntity(t1, student.uid, {
      firstName: "Stu",
      lastName: "Dent",
      rollNumber: "R001",
    });
    await seedMembership({
      uid: student.uid,
      tenantId: t1,
      tenantCode: "SCHL_A",
      role: "student",
      studentId: stuId,
    });
    await setUserClaims(student.uid, {
      role: "student",
      tenantId: t1,
      tenantCode: "SCHL_A",
      studentId: stuId,
      classIds: [],
      classIdsOverflow: false,
    });

    // Sign in
    const auth = getClientAuth();
    await signInWithEmailAndPassword(auth, "student@a.com", "stu123");

    // Cannot read other tenant
    const clientDb = getClientFirestore();
    await expect(getDoc(doc(clientDb, "tenants", t2))).rejects.toThrow();

    await signOut(auth);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 2. Roll Number Login
// ══════════════════════════════════════════════════════════════════════════

describe("Roll Number Login", () => {
  it("student logs in with derived synthetic email from roll number", async () => {
    const owner = await seedUser({
      email: "owner@test.com",
      password: "testpw123",
      displayName: "Owner",
    });
    const { tenantId, tenantCode } = await seedTenant({
      name: "Maple School",
      tenantCode: "MPL001",
      ownerUid: owner.uid,
    });

    // The synthetic email for roll "STU-042" in tenant tenantId
    const syntheticEmail = `stu-042@${tenantId}.levelup.internal`;
    const tempPassword = "tempPass1";

    const student = await seedUser({
      email: syntheticEmail,
      password: tempPassword,
      displayName: "Student Forty-Two",
    });
    const stuEntityId = await seedStudentEntity(tenantId, student.uid, {
      firstName: "Student",
      lastName: "Forty-Two",
      rollNumber: "STU-042",
    });
    await seedMembership({
      uid: student.uid,
      tenantId,
      tenantCode,
      role: "student",
      studentId: stuEntityId,
    });
    await setUserClaims(student.uid, {
      role: "student",
      tenantId,
      tenantCode,
      studentId: stuEntityId,
      classIds: [],
      classIdsOverflow: false,
    });

    // Sign in with synthetic email
    const auth = getClientAuth();
    const cred = await signInWithEmailAndPassword(auth, syntheticEmail, tempPassword);
    expect(cred.user.uid).toBe(student.uid);

    // Verify claims
    const tokenResult = await getIdTokenResult(cred.user, true);
    expect(tokenResult.claims["role"]).toBe("student");
    expect(tokenResult.claims["tenantId"]).toBe(tenantId);
    expect(tokenResult.claims["studentId"]).toBe(stuEntityId);

    // Verify membership exists
    const clientDb = getClientFirestore();
    const membershipSnap = await getDoc(
      doc(clientDb, "userMemberships", `${student.uid}_${tenantId}`)
    );
    expect(membershipSnap.exists()).toBe(true);
    expect(membershipSnap.data()!["role"]).toBe("student");

    await signOut(auth);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 3. Multi-Org Switch
// ══════════════════════════════════════════════════════════════════════════

describe("Multi-Org Switch", () => {
  it("user switches between two tenants and claims update", async () => {
    const owner = await seedUser({
      email: "owner@test.com",
      password: "testpw123",
      displayName: "Owner",
    });
    const { tenantId: t1, tenantCode: tc1 } = await seedTenant({
      name: "School Alpha",
      tenantCode: "ALPHA1",
      ownerUid: owner.uid,
    });
    const { tenantId: t2, tenantCode: tc2 } = await seedTenant({
      name: "School Beta",
      tenantCode: "BETA01",
      ownerUid: owner.uid,
    });

    // Teacher in both schools
    const teacher = await seedUser({
      email: "multiorg@test.com",
      password: "multi123",
      displayName: "Multi Teacher",
    });
    const tch1 = await seedTeacherEntity(t1, teacher.uid, {
      firstName: "Multi",
      lastName: "Teacher",
    });
    const tch2 = await seedTeacherEntity(t2, teacher.uid, {
      firstName: "Multi",
      lastName: "Teacher",
    });
    await seedMembership({
      uid: teacher.uid,
      tenantId: t1,
      tenantCode: tc1,
      role: "teacher",
      teacherId: tch1,
      classIds: ["c1"],
    });
    await seedMembership({
      uid: teacher.uid,
      tenantId: t2,
      tenantCode: tc2,
      role: "teacher",
      teacherId: tch2,
      classIds: ["c2"],
    });

    // Start with tenant 1 claims
    await setUserClaims(teacher.uid, {
      role: "teacher",
      tenantId: t1,
      tenantCode: tc1,
      teacherId: tch1,
      classIds: ["c1"],
      classIdsOverflow: false,
    });

    // Login
    const auth = getClientAuth();
    const cred = await signInWithEmailAndPassword(auth, "multiorg@test.com", "multi123");

    // Verify initial claims point to t1
    let tokenResult = await getIdTokenResult(cred.user, true);
    expect(tokenResult.claims["tenantId"]).toBe(t1);
    expect(tokenResult.claims["teacherId"]).toBe(tch1);

    // Simulate switch: admin updates claims to t2
    await setUserClaims(teacher.uid, {
      role: "teacher",
      tenantId: t2,
      tenantCode: tc2,
      teacherId: tch2,
      classIds: ["c2"],
      classIdsOverflow: false,
    });

    // Force token refresh
    await cred.user.getIdToken(true);
    tokenResult = await getIdTokenResult(cred.user, true);

    // Claims now reflect t2
    expect(tokenResult.claims["tenantId"]).toBe(t2);
    expect(tokenResult.claims["tenantCode"]).toBe(tc2);
    expect(tokenResult.claims["teacherId"]).toBe(tch2);
    expect(tokenResult.claims["classIds"]).toEqual(["c2"]);

    // Can read t2 data
    const clientDb = getClientFirestore();
    const t2Snap = await getDoc(doc(clientDb, "tenants", t2));
    expect(t2Snap.exists()).toBe(true);

    await signOut(auth);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 4. SuperAdmin Login
// ══════════════════════════════════════════════════════════════════════════

describe("SuperAdmin Login", () => {
  it("superAdmin logs in with email/password and can read any tenant", async () => {
    const admin = await seedUser({
      email: "superadmin@platform.com",
      password: "super123",
      displayName: "Platform Admin",
      isSuperAdmin: true,
    });
    const { tenantId: t1 } = await seedTenant({
      name: "Tenant One",
      tenantCode: "TNT001",
      ownerUid: admin.uid,
    });
    const { tenantId: t2 } = await seedTenant({
      name: "Tenant Two",
      tenantCode: "TNT002",
      ownerUid: admin.uid,
    });

    // Sign in
    const auth = getClientAuth();
    const cred = await signInWithEmailAndPassword(auth, "superadmin@platform.com", "super123");

    // Verify superAdmin claim
    const tokenResult = await getIdTokenResult(cred.user, true);
    expect(tokenResult.claims["role"]).toBe("superAdmin");

    // Can read any tenant
    const clientDb = getClientFirestore();
    const snap1 = await getDoc(doc(clientDb, "tenants", t1));
    expect(snap1.exists()).toBe(true);

    const snap2 = await getDoc(doc(clientDb, "tenants", t2));
    expect(snap2.exists()).toBe(true);

    await signOut(auth);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 5. Unauthorized Access
// ══════════════════════════════════════════════════════════════════════════

describe("Unauthorized Access", () => {
  it("student cannot read another tenant data", async () => {
    const owner = await seedUser({
      email: "owner@test.com",
      password: "testpw123",
      displayName: "Owner",
    });
    const { tenantId: myTenant, tenantCode: myCode } = await seedTenant({
      name: "My School",
      tenantCode: "MYSCH1",
      ownerUid: owner.uid,
    });
    const { tenantId: otherTenant } = await seedTenant({
      name: "Other School",
      tenantCode: "OTHER1",
      ownerUid: owner.uid,
    });

    const student = await seedUser({
      email: "stu@my.com",
      password: "stu123",
      displayName: "Student",
    });
    await seedMembership({
      uid: student.uid,
      tenantId: myTenant,
      tenantCode: myCode,
      role: "student",
      studentId: "stu1",
    });
    await setUserClaims(student.uid, {
      role: "student",
      tenantId: myTenant,
      tenantCode: myCode,
      studentId: "stu1",
      classIds: [],
      classIdsOverflow: false,
    });

    const auth = getClientAuth();
    await signInWithEmailAndPassword(auth, "stu@my.com", "stu123");

    const clientDb = getClientFirestore();
    await expect(getDoc(doc(clientDb, "tenants", otherTenant))).rejects.toThrow();

    await signOut(auth);
  });

  it("teacher cannot write to userMemberships", async () => {
    const owner = await seedUser({
      email: "owner@test.com",
      password: "testpw123",
      displayName: "Owner",
    });
    const { tenantId, tenantCode } = await seedTenant({
      name: "School",
      tenantCode: "SCHOO1",
      ownerUid: owner.uid,
    });
    const teacher = await seedUser({
      email: "teach@test.com",
      password: "teach123",
      displayName: "Teacher",
    });
    await seedMembership({
      uid: teacher.uid,
      tenantId,
      tenantCode,
      role: "teacher",
      teacherId: "tch1",
    });
    await setUserClaims(teacher.uid, {
      role: "teacher",
      tenantId,
      tenantCode,
      teacherId: "tch1",
      classIds: [],
      classIdsOverflow: false,
    });

    const auth = getClientAuth();
    await signInWithEmailAndPassword(auth, "teach@test.com", "teach123");

    const clientDb = getClientFirestore();
    const { setDoc: fsSetDoc } = await import("firebase/firestore");
    await expect(
      fsSetDoc(doc(clientDb, "userMemberships", `${teacher.uid}_${tenantId}`), {
        role: "tenantAdmin",
      })
    ).rejects.toThrow();

    await signOut(auth);
  });

  it("non-member gets permission denied on tenant read", async () => {
    const owner = await seedUser({
      email: "owner@test.com",
      password: "testpw123",
      displayName: "Owner",
    });
    const { tenantId } = await seedTenant({
      name: "Private School",
      tenantCode: "PRIV01",
      ownerUid: owner.uid,
    });
    const outsider = await seedUser({
      email: "outsider@test.com",
      password: "out123",
      displayName: "Outsider",
    });
    // No membership, no claims

    const auth = getClientAuth();
    await signInWithEmailAndPassword(auth, "outsider@test.com", "out123");

    const clientDb = getClientFirestore();
    await expect(getDoc(doc(clientDb, "tenants", tenantId))).rejects.toThrow();

    await signOut(auth);
  });
});
