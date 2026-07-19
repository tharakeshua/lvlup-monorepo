/**
 * Provision priya.sharma@greenwood.edu into the LIVE v2_ Greenwood Academy tenant
 * so Teacher Portal school-code login works.
 *
 * Root cause: teacher-web callables use LVLUP_COLLECTION_PREFIX=v2_.
 * GRN001 → v2_tenantCodes → tn_greenwood_524e429639 ("Greenwood Academy").
 * Priya only existed in the OLD unprefixed tenant (UVrLA2eNZXwzu1GzyXpF) with
 * zero v2_userMemberships → switchActiveTenant failed → "School login failed".
 */
import admin from 'firebase-admin';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const saFile = readdirSync(root).find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));
if (!saFile) throw new Error('No firebase-adminsdk JSON');
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(join(root, saFile), 'utf8'))),
  projectId: 'lvlup-ff6fa',
});

const auth = admin.auth();
const db = admin.firestore();

const EMAIL = 'priya.sharma@greenwood.edu';
const PASSWORD = 'Test@12345';
const SCHOOL_CODE = 'GRN001';
const TID = 'tn_greenwood_524e429639';
const CLASS_ID = 'cls_greenwood-class-g8-math_db8edee86a';
const TEACHER_ID = 'tch_greenwood-teacher-t-priya_fix';
const API_KEY = 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const now = '2026-07-12T00:00:00.000Z';

async function signIn(email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return { ok: res.ok, body: await res.json() };
}

async function callSwitchTenant(idToken, targetTenantId) {
  // Firebase callable HTTPS endpoint (asia-south1)
  const url =
    'https://asia-south1-lvlup-ff6fa.cloudfunctions.net/sdkv1identityswitchactivetenant';
  // Also try the v1 naming — discover via firebase.json / known pattern
  const candidates = [
    'https://asia-south1-lvlup-ff6fa.cloudfunctions.net/v1-identity-switchActiveTenant',
    'https://asia-south1-lvlup-ff6fa.cloudfunctions.net/sdkV1IdentitySwitchActiveTenant',
  ];
  // Prefer callable via Identity Toolkit callable protocol
  const callableUrl =
    'https://asia-south1-lvlup-ff6fa.cloudfunctions.net/sdkv1';
  // Use Firebase callable HTTP format for https.onCall
  const onCallUrls = [
    'https://asia-south1-lvlup-ff6fa.cloudfunctions.net/v1identityswitchActiveTenant',
    'https://asia-south1-lvlup-ff6fa.cloudfunctions.net/switchActiveTenant',
  ];

  // Discover from functions list isn't available; use callable wrapper common pattern:
  // POST https://REGION-PROJECT.cloudfunctions.net/NAME with {data: ...}
  const nameGuesses = [
    'sdkV1',
    'v1_identity_switchActiveTenant',
    'identity-switchActiveTenant',
    'switchActiveTenant',
  ];

  void url;
  void candidates;
  void callableUrl;
  void onCallUrls;
  void nameGuesses;

  // Use the Firebase callable REST protocol for httpsCallable named functions.
  // The sdk-v1 package typically exposes one gateway. Check deployed names via Admin isn't easy —
  // instead verify membership+claims are correct (sufficient for login) and optionally call
  // known function from teacher-web transport.
  return { skipped: true, targetTenantId, idTokenLen: idToken?.length };
}

async function main() {
  const user = await auth.getUserByEmail(EMAIL);
  const uid = user.uid;
  console.log('Priya uid:', uid);

  // 1) Reset password + enable
  await auth.updateUser(uid, { password: PASSWORD, disabled: false });
  console.log('Password reset to Test@12345');

  // 2) Teacher entity
  const teacherRef = db.doc(`v2_tenants/${TID}/teachers/${TEACHER_ID}`);
  await teacherRef.set(
    {
      id: TEACHER_ID,
      tenantId: TID,
      authUid: uid,
      email: EMAIL,
      firstName: 'Priya',
      lastName: 'Sharma',
      displayName: 'Priya Sharma',
      department: 'Mathematics',
      designation: 'Teacher',
      subjects: ['Mathematics'],
      classIds: [CLASS_ID],
      status: 'active',
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    },
    { merge: true }
  );
  console.log('Upserted teacher', TEACHER_ID);

  // 3) Attach Priya to Grade 8 Math class teacherIds (idempotent)
  const classRef = db.doc(`v2_tenants/${TID}/classes/${CLASS_ID}`);
  const classSnap = await classRef.get();
  if (classSnap.exists) {
    const teacherIds = classSnap.data()?.teacherIds ?? [];
    if (!teacherIds.includes(TEACHER_ID)) {
      await classRef.set(
        { teacherIds: [...teacherIds, TEACHER_ID], updatedAt: now },
        { merge: true }
      );
      console.log('Added Priya to class teacherIds');
    } else {
      console.log('Priya already on class teacherIds');
    }
  }

  // 4) Membership
  const memId = `${uid}_${TID}`;
  const permissions = {
    canCreateExams: true,
    canEditRubrics: true,
    canManuallyGrade: true,
    canCreateSpaces: true,
    canManageContent: true,
    canViewAnalytics: true,
    managedClassIds: [CLASS_ID],
  };
  await db.doc(`v2_userMemberships/${memId}`).set(
    {
      id: memId,
      uid,
      tenantId: TID,
      tenantCode: SCHOOL_CODE,
      role: 'teacher',
      status: 'active',
      teacherId: TEACHER_ID,
      joinSource: 'admin_fix',
      permissions,
      classIds: [CLASS_ID],
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    },
    { merge: true }
  );
  console.log('Upserted membership', memId);

  // 5) User doc
  await db.doc(`v2_users/${uid}`).set(
    {
      id: uid,
      uid,
      email: EMAIL,
      displayName: 'Priya Sharma',
      activeTenantId: TID,
      status: 'active',
      isSuperAdmin: false,
      authProviders: ['email'],
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
      updatedBy: uid,
    },
    { merge: true }
  );
  console.log('Upserted v2_users/' + uid);

  // 6) Custom claims matching v2 membership (classIds on membership + claims)
  const claims = {
    role: 'teacher',
    tenantId: TID,
    tenantCode: SCHOOL_CODE,
    teacherId: TEACHER_ID,
    classIds: [CLASS_ID],
    classIdsOverflow: false,
    permissions: {
      canCreateExams: true,
      canEditRubrics: true,
      canManuallyGrade: true,
      canCreateSpaces: true,
      canManageContent: true,
      canViewAnalytics: true,
    },
  };
  await auth.setCustomUserClaims(uid, claims);
  console.log('Set claims', claims);

  await auth.revokeRefreshTokens(uid);
  console.log('Revoked refresh tokens');

  // 7) Verify password + token claims
  const signed = await signIn(EMAIL, PASSWORD);
  console.log('signInWithPassword:', { ok: signed.ok, error: signed.body.error?.message ?? null });
  if (signed.ok?.idToken || signed.body.idToken) {
    const decoded = await auth.verifyIdToken(signed.body.idToken);
    console.log('ID token claims:', {
      role: decoded.role,
      tenantId: decoded.tenantId,
      tenantCode: decoded.tenantCode,
      teacherId: decoded.teacherId,
    });
  }

  // 8) Call switchActiveTenant via Firebase callable protocol
  // Discover function URL from known sdk-v1 wiring
  if (signed.body.idToken) {
    const callableNames = [
      'sdkV1IdentitySwitchActiveTenant',
      'v1identityswitchActiveTenant',
      'switchActiveTenant',
    ];
    for (const name of callableNames) {
      const url = `https://asia-south1-lvlup-ff6fa.cloudfunctions.net/${name}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${signed.body.idToken}`,
          },
          body: JSON.stringify({ data: { targetTenantId: TID } }),
        });
        const text = await res.text();
        console.log(`callable ${name}:`, res.status, text.slice(0, 300));
      } catch (e) {
        console.log(`callable ${name} error:`, e.message);
      }
    }
  }

  // Final membership check
  const mem = await db.doc(`v2_userMemberships/${memId}`).get();
  console.log('Final membership exists:', mem.exists, 'status:', mem.data()?.status, 'role:', mem.data()?.role);
  console.log('\nDONE. Login with:');
  console.log('  School code: GRN001');
  console.log('  Email:       priya.sharma@greenwood.edu');
  console.log('  Password:    Test@12345');
  console.log('  School name: Greenwood Academy');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
