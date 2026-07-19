/**
 * Heal Priya (and Asha) so teacher-web getMe passes validateResponses:true.
 *
 * Root cause of Access Denied:
 *   RequireAuth needs currentMembership.role in [teacher, tenantAdmin].
 *   currentMembership comes from useMe() → getMe. teacher-web sets
 *   validateResponses:true, so a schema-invalid getMe payload throws →
 *   me=null → Access Denied despite valid Auth claims.
 *
 * Live payload failures:
 *   - joinSource "admin_fix"/"seed" not in enum
 *   - permissions stored flat (schema wants nested { permissions, managedClassIds })
 *   - tenant missing tenantCode/ownerUid; features/settings use legacy keys
 *   - tenant was accidentally status:"archived" by qa-heal
 */
import admin from "firebase-admin";
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

const root = process.cwd();
const saFile = readdirSync(root).find(
  (f) => f.includes("firebase-adminsdk") && f.endsWith(".json")
);
if (!saFile) throw new Error("No firebase-adminsdk JSON in monorepo root");
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, saFile), "utf8"))),
  projectId: "lvlup-ff6fa",
});
const auth = admin.auth();
const db = admin.firestore();

const TID = "tn_greenwood_524e429639";
const SCHOOL_CODE = "GRN001";
const CLASS_ID = "cls_greenwood-class-g8-math_db8edee86a";
const API_KEY = "AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E";
const now = new Date().toISOString();

const CANON_PERMS = {
  permissions: {
    canManageSpaces: true,
    canManageStudents: true,
    canManageClasses: true,
    canCreateExams: true,
    canGradeExams: true,
    canViewAnalytics: true,
    canManageContent: true,
    canReleaseResults: true,
  },
  managedClassIds: [CLASS_ID],
};

const CLAIM_PERMS = {
  canManageSpaces: true,
  canManageStudents: true,
  canManageClasses: true,
  canCreateExams: true,
  canGradeExams: true,
  canViewAnalytics: true,
  canManageContent: true,
  canReleaseResults: true,
};

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return res.json();
}

async function call(name, idToken, data = {}) {
  const res = await fetch(`https://asia-south1-lvlup-ff6fa.cloudfunctions.net/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  return res.json();
}

async function main() {
  const ownerUid = "usr_greenwood-user-teacher-t-asha_92b7b6f880";
  const tenantRef = db.doc(`v2_tenants/${TID}`);
  const before = (await tenantRef.get()).data();
  console.log("BEFORE tenant status:", before?.status, "archivedAt:", before?.archivedAt);

  // Firestore merge DEEP-MERGES maps — delete features/settings first or legacy
  // keys (gamification/defaultLanguage) survive and break validateResponses.
  await tenantRef.set(
    {
      id: TID,
      name: "Greenwood Academy",
      slug: "greenwood-academy",
      code: SCHOOL_CODE,
      tenantCode: SCHOOL_CODE,
      ownerUid,
      status: "active",
      archivedAt: null,
      subscription: { plan: "premium", renewsAt: null },
      features: admin.firestore.FieldValue.delete(),
      settings: admin.firestore.FieldValue.delete(),
      stats: {
        totalClasses: 3,
        totalSpaces: 1,
        totalStudents: 6,
        totalTeachers: 2,
        totalExams: 0,
      },
      branding: { primaryColor: "#2E7D32" },
      contactEmail: "admin@greenwood.edu",
      contactPhone: "+91-80-1111-2222",
      trialEndsAt: null,
      updatedAt: now,
      updatedBy: ownerUid,
      createdAt: before?.createdAt ?? "2026-01-01T00:00:00.000Z",
      createdBy:
        !before?.createdBy || before.createdBy === "seed-system" || before.createdBy === "qa-heal"
          ? ownerUid
          : before.createdBy,
    },
    { merge: true }
  );
  await tenantRef.update({
    features: { autograde: true, levelup: true, analytics: true, store: false },
    settings: {
      timezone: "Asia/Kolkata",
      locale: "en",
      geminiKeyRef: "tenant-tn_greenwood_524e429639-gemini",
      geminiKeySet: false,
    },
  });
  console.log("Healed tenant → active + canonical shape");

  await db.doc(`v2_tenantCodes/${SCHOOL_CODE}`).set(
    {
      code: SCHOOL_CODE,
      tenantId: TID,
      updatedAt: now,
      createdAt: before?.createdAt ?? "2026-01-01T00:00:00.000Z",
    },
    { merge: true }
  );

  const teachers = [
    {
      email: "priya.sharma@greenwood.edu",
      password: "Test@12345",
      teacherId: "tch_greenwood-teacher-t-priya_fix",
      displayName: "Priya Sharma",
    },
    {
      email: "asha.rao@greenwood.edu",
      password: "Teacher@123",
      teacherId: "tch_greenwood-teacher-t-asha_2027e48ab5",
      displayName: "Asha Rao",
    },
  ];

  for (const t of teachers) {
    const user = await auth.getUserByEmail(t.email);
    const uid = user.uid;
    const memId = `${uid}_${TID}`;

    const allMem = await db.collection("v2_userMemberships").where("uid", "==", uid).get();
    for (const doc of allMem.docs) {
      if (doc.id === memId) continue;
      await doc.ref.delete();
      console.log("Deleted stale membership", doc.id);
    }

    await db.doc(`v2_userMemberships/${memId}`).set({
      id: memId,
      uid,
      tenantId: TID,
      tenantCode: SCHOOL_CODE,
      role: "teacher",
      status: "active",
      joinSource: "admin_created",
      teacherId: t.teacherId,
      permissions: CANON_PERMS,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
      lastActive: null,
    });
    console.log("Rewrote membership", memId);

    await db.doc(`v2_users/${uid}`).set(
      {
        id: uid,
        uid,
        email: t.email,
        displayName: t.displayName,
        activeTenantId: TID,
        status: "active",
        isSuperAdmin: false,
        authProviders: ["email"],
        updatedAt: now,
        updatedBy: uid,
        createdAt: now,
        createdBy: uid,
        lastLogin: null,
      },
      { merge: true }
    );

    await auth.setCustomUserClaims(uid, {
      role: "teacher",
      tenantId: TID,
      tenantCode: SCHOOL_CODE,
      teacherId: t.teacherId,
      classIds: [CLASS_ID],
      classIdsOverflow: false,
      permissions: CLAIM_PERMS,
    });
    await auth.updateUser(uid, { password: t.password, disabled: false });
    await auth.revokeRefreshTokens(uid);
    console.log("Claims+password refreshed for", t.email);
  }

  const { getCallable } = await import("../packages/api-contract/dist/index.js");
  const schema = getCallable("v1.identity.getMe").responseSchema;

  for (const t of teachers) {
    const signed = await signIn(t.email, t.password);
    if (!signed.idToken) {
      console.log("SIGNIN FAIL", t.email, signed.error);
      continue;
    }
    await call("v1-identity-switchActiveTenant", signed.idToken, { targetTenantId: TID });
    const refresh = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(signed.refreshToken)}`,
    });
    const refreshed = await refresh.json();
    const idToken = refreshed.id_token || signed.idToken;
    const me = await call("v1-identity-getMe", idToken, {});
    const payload = me.result || me;
    const slug = t.email.split("@")[0];
    writeFileSync(`.ci-logs/${slug}-getme-after.json`, JSON.stringify(me, null, 2));
    const parsed = schema.safeParse(payload);
    const memberships = payload.memberships || [];
    const currentTenantId = payload.claims?.tenantId ?? payload.user?.activeTenantId ?? null;
    const currentMembership = memberships.find((m) => m.tenantId === currentTenantId) ?? null;
    const guardPass =
      !!currentMembership && ["teacher", "tenantAdmin"].includes(currentMembership.role);
    console.log("\n===", t.email, "===");
    console.log("schemaValid:", parsed.success);
    if (!parsed.success) {
      console.log(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    }
    console.log("guardPass:", guardPass, {
      currentTenantId,
      role: currentMembership?.role,
      memCount: memberships.length,
      tenantStatus: payload.activeTenant?.status,
      tenantCode: payload.activeTenant?.tenantCode,
    });
  }

  console.log("\nDONE. Login: GRN001 / priya.sharma@greenwood.edu / Test@12345 → http://127.0.0.1:4569/");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
