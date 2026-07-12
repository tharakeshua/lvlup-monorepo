/** READ-ONLY: broad search for 'nandi' across auth + firestore. */
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

async function main() {
  // 1. Scan all auth users for 'nandi'
  let token = undefined;
  const hits = [];
  do {
    const page = await auth.listUsers(1000, token);
    for (const u of page.users) {
      const s = `${u.email ?? ''} ${u.displayName ?? ''}`.toLowerCase();
      if (s.includes('nandi') || s.includes('learner.dev')) hits.push(u);
    }
    token = page.pageToken;
  } while (token);
  console.log(`AUTH matches (${hits.length}):`);
  for (const u of hits) {
    console.log(JSON.stringify({ uid: u.uid, email: u.email, displayName: u.displayName, claims: u.customClaims }, null, 1));
  }

  // 2. collection-group queries on email
  for (const cg of ['students', 'members', 'memberships', 'users', 'identities']) {
    try {
      const q = await db.collectionGroup(cg).where('email', '==', 'nandi@learner.dev').limit(5).get();
      console.log(`\ncollectionGroup(${cg}) email==nandi@learner.dev: ${q.size}`);
      for (const d of q.docs) console.log(' PATH:', d.ref.path);
    } catch (e) {
      console.log(`collectionGroup(${cg}) error:`, e.message?.slice(0, 120));
    }
  }

  // 3. top-level identity-ish collections
  const roots = await db.listCollections();
  console.log('\nTOP-LEVEL COLLECTIONS:', roots.map(c => c.id).join(', '));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
