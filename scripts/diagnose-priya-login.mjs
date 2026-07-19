/**
 * Diagnose + fix priya.sharma@greenwood.edu teacher login for GRN001.
 */
import admin from 'firebase-admin';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const saFile = readdirSync(root).find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));
if (!saFile) throw new Error('No firebase-adminsdk JSON in monorepo root');
console.log('Using SA:', saFile);
const sa = JSON.parse(readFileSync(join(root, saFile), 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(sa),
  projectId: 'lvlup-ff6fa',
});

const auth = admin.auth();
const db = admin.firestore();
const EMAIL = 'priya.sharma@greenwood.edu';
const PASSWORD = 'Test@12345';
const SCHOOL_CODE = 'GRN001';
const API_KEY = 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';

async function signInWithPassword(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const fix = process.argv.includes('--fix');

  console.log('=== 1. tenantCodes/' + SCHOOL_CODE + ' ===');
  const codeSnap = await db.doc(`tenantCodes/${SCHOOL_CODE}`).get();
  if (!codeSnap.exists) {
    console.log('MISSING tenantCodes index!');
  } else {
    console.log(JSON.stringify(codeSnap.data(), null, 2));
  }
  const indexedTenantId = codeSnap.exists ? codeSnap.data()?.tenantId : null;

  console.log('\n=== 2. Tenant doc ===');
  if (indexedTenantId) {
    const t = await db.doc(`tenants/${indexedTenantId}`).get();
    console.log('exists:', t.exists);
    if (t.exists) {
      const d = t.data();
      console.log({
        id: t.id,
        name: d.name,
        code: d.code ?? d.tenantCode,
        status: d.status,
        trialEndsAt: d.trialEndsAt ?? null,
      });
    }
  }

  // Search for Greenwood tenants by name
  console.log('\n=== 3. Tenants matching Greenwood ===');
  const allTenants = await db.collection('tenants').get();
  for (const doc of allTenants.docs) {
    const d = doc.data();
    const name = (d.name || '').toLowerCase();
    const code = d.code || d.tenantCode || '';
    if (name.includes('greenwood') || code === SCHOOL_CODE || code === 'GRN001') {
      console.log({
        id: doc.id,
        name: d.name,
        code,
        status: d.status,
        isIndexed: doc.id === indexedTenantId,
      });
    }
  }

  console.log('\n=== 4. Auth user ===');
  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log({
      uid: user.uid,
      email: user.email,
      disabled: user.disabled,
      emailVerified: user.emailVerified,
      customClaims: user.customClaims ?? null,
    });
  } catch (e) {
    console.log('Auth user NOT FOUND:', e.message);
    process.exit(1);
  }

  console.log('\n=== 5. Memberships for uid ===');
  const memQ = await db.collection('userMemberships').where('uid', '==', user.uid).get();
  const memberships = [];
  for (const doc of memQ.docs) {
    const d = doc.data();
    memberships.push({ id: doc.id, ...d });
    console.log({
      id: doc.id,
      tenantId: d.tenantId,
      tenantCode: d.tenantCode,
      role: d.role,
      status: d.status,
      matchesIndex: d.tenantId === indexedTenantId,
    });
  }
  if (memberships.length === 0) {
    // also try doc id pattern
    console.log('No memberships via uid query; scanning id prefix...');
    const prefix = await db.collection('userMemberships').where(admin.firestore.FieldPath.documentId(), '>=', user.uid).where(admin.firestore.FieldPath.documentId(), '<=', user.uid + '\uf8ff').get();
    for (const doc of prefix.docs) {
      console.log(doc.id, doc.data());
      memberships.push({ id: doc.id, ...doc.data() });
    }
  }

  // Direct doc for indexed tenant
  if (indexedTenantId) {
    const directId = `${user.uid}_${indexedTenantId}`;
    const direct = await db.doc(`userMemberships/${directId}`).get();
    console.log(`\nDirect membership ${directId}: exists=${direct.exists}`);
    if (direct.exists) console.log(direct.data());
  }

  console.log('\n=== 6. REST signInWithPassword ===');
  let signIn = await signInWithPassword(EMAIL, PASSWORD);
  console.log({
    ok: signIn.ok,
    status: signIn.status,
    error: signIn.body.error?.message ?? null,
    localId: signIn.body.localId ?? null,
  });

  if (!signIn.ok && fix) {
    console.log('\n=== FIX: reset password ===');
    await auth.updateUser(user.uid, { password: PASSWORD, disabled: false });
    signIn = await signInWithPassword(EMAIL, PASSWORD);
    console.log('After reset:', { ok: signIn.ok, error: signIn.body.error?.message ?? null });
  }

  const targetMembership = memberships.find((m) => m.tenantId === indexedTenantId);
  const needsMembershipFix =
    indexedTenantId &&
    (!targetMembership || targetMembership.status !== 'active' || targetMembership.role !== 'teacher');

  // Stale claims pointing at wrong tenant
  const claimsTenant = user.customClaims?.tenantId;
  const claimsMismatch = indexedTenantId && claimsTenant && claimsTenant !== indexedTenantId;

  console.log('\n=== Diagnosis ===');
  console.log({
    indexedTenantId,
    hasActiveTeacherMembershipOnIndex: Boolean(
      targetMembership && targetMembership.status === 'active' && targetMembership.role === 'teacher'
    ),
    claimsTenant,
    claimsMismatch,
    passwordWorks: signIn.ok,
  });

  if (fix) {
    console.log('\n=== APPLYING FIXES ===');
    if (!indexedTenantId) {
      console.log('Cannot fix without tenantCodes/GRN001');
      process.exit(1);
    }

    // Ensure password
    await auth.updateUser(user.uid, { password: PASSWORD, disabled: false });
    console.log('Password set to Test@12345, account enabled');

    // Find teacher entity if any
    let teacherId = targetMembership?.teacherId ?? null;
    if (!teacherId) {
      const teachers = await db.collection(`tenants/${indexedTenantId}/teachers`).where('email', '==', EMAIL).limit(1).get();
      if (!teachers.empty) teacherId = teachers.docs[0].id;
      else {
        // scan all teachers for email match
        const allT = await db.collection(`tenants/${indexedTenantId}/teachers`).get();
        for (const t of allT.docs) {
          if ((t.data().email || '').toLowerCase() === EMAIL) {
            teacherId = t.id;
            break;
          }
        }
      }
    }
    console.log('teacherId:', teacherId);

    const memId = `${user.uid}_${indexedTenantId}`;
    const tenantDoc = (await db.doc(`tenants/${indexedTenantId}`).get()).data();
    const memData = {
      uid: user.uid,
      tenantId: indexedTenantId,
      tenantCode: SCHOOL_CODE,
      role: 'teacher',
      status: 'active',
      teacherId: teacherId ?? null,
      joinSource: 'admin_fix',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const existing = await db.doc(`userMemberships/${memId}`).get();
    if (!existing.exists) {
      memData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }
    await db.doc(`userMemberships/${memId}`).set(memData, { merge: true });
    console.log('Upserted membership', memId, memData);

    // Sync custom claims
    const newClaims = {
      ...(user.customClaims || {}),
      role: 'teacher',
      tenantId: indexedTenantId,
      tenantCode: SCHOOL_CODE,
      teacherId: teacherId ?? undefined,
    };
    // drop stale student/parent fields if any
    delete newClaims.studentId;
    delete newClaims.parentId;
    await auth.setCustomUserClaims(user.uid, newClaims);
    console.log('Set custom claims:', newClaims);

    // Update users doc activeTenantId if present
    const userDoc = await db.doc(`users/${user.uid}`).get();
    if (userDoc.exists) {
      await db.doc(`users/${user.uid}`).set(
        {
          activeTenantId: indexedTenantId,
          displayName: userDoc.data()?.displayName || 'Priya Sharma',
          email: EMAIL,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      console.log('Updated users/' + user.uid + ' activeTenantId');
    } else {
      await db.doc(`users/${user.uid}`).set({
        id: user.uid,
        email: EMAIL,
        displayName: 'Priya Sharma',
        activeTenantId: indexedTenantId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Created users/' + user.uid);
    }

    // Revoke refresh tokens so next login gets fresh claims
    await auth.revokeRefreshTokens(user.uid);
    console.log('Revoked refresh tokens');

    // Re-test password
    const again = await signInWithPassword(EMAIL, PASSWORD);
    console.log('Password retest:', { ok: again.ok, error: again.body.error?.message ?? null });

    // Decode claims from id token if possible
    if (again.ok && again.body.idToken) {
      const decoded = await auth.verifyIdToken(again.body.idToken);
      console.log('ID token claims after fix:', {
        uid: decoded.uid,
        role: decoded.role,
        tenantId: decoded.tenantId,
        tenantCode: decoded.tenantCode,
      });
    }

    // Final membership dump
    const finalUser = await auth.getUser(user.uid);
    console.log('Final customClaims:', finalUser.customClaims);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
