/**
 * READ-ONLY inspection: find nandi@learner.dev, their tenant, and MCQ items.
 * No writes anywhere.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const sa = JSON.parse(
  readFileSync('/Users/subhang/Desktop/Projects/auto-levleup/lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json', 'utf8')
);
const app = initializeApp({ credential: cert(sa), projectId: 'lvlup-ff6fa' });
const db = getFirestore(app);
const auth = getAuth(app);

const EMAIL = 'nandi@learner.dev';

async function main() {
  // 1. Auth user
  let user;
  try {
    user = await auth.getUserByEmail(EMAIL);
    console.log('AUTH USER:', JSON.stringify({
      uid: user.uid, email: user.email, displayName: user.displayName,
      customClaims: user.customClaims,
    }, null, 2));
  } catch (e) {
    console.log('AUTH USER not found:', e.message);
  }

  // 2. Identity docs — top-level users collections (prefixed + unprefixed)
  for (const coll of ['users', 'v2_users']) {
    if (!user) break;
    const doc = await db.collection(coll).doc(user.uid).get();
    console.log(`\n${coll}/${user.uid}: exists=${doc.exists}`);
    if (doc.exists) console.log(JSON.stringify(doc.data(), null, 2).slice(0, 3000));
  }

  // 3. Search memberships / students by email across tenants (both prefixes)
  for (const root of ['tenants', 'v2_tenants']) {
    const tenants = await db.collection(root).listDocuments();
    console.log(`\n=== ${root}: ${tenants.length} tenants:`, tenants.map(t => t.id).join(', '));
    for (const t of tenants) {
      for (const sub of ['students', 'members', 'memberships', 'users']) {
        try {
          const q = await db.collection(`${root}/${t.id}/${sub}`).where('email', '==', EMAIL).limit(3).get();
          if (!q.empty) {
            for (const d of q.docs) {
              console.log(`\nFOUND ${root}/${t.id}/${sub}/${d.id}:`);
              console.log(JSON.stringify(d.data(), null, 2).slice(0, 2500));
            }
          }
        } catch { /* subcoll may not exist */ }
      }
      // also by uid
      if (user) {
        for (const sub of ['students', 'members']) {
          try {
            const d = await db.doc(`${root}/${t.id}/${sub}/${user.uid}`).get();
            if (d.exists) {
              console.log(`\nFOUND-BY-UID ${root}/${t.id}/${sub}/${user.uid}:`);
              console.log(JSON.stringify(d.data(), null, 2).slice(0, 2500));
            }
          } catch { }
        }
      }
    }
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
