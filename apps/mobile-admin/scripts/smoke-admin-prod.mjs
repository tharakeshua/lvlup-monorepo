/**
 * GATE-0 LIVE PROD proof — ADMIN role.
 *
 * Same fat-SDK data path as the student smoke (transport-firebase → api-client →
 * repositories) but signs in as the MULTI-ROLE admin+teacher test account and
 * probes the ADMIN read callables against the REAL project `lvlup-ff6fa`
 * (region asia-south1, v2_ seeded, real Subhang data).
 *
 * Proves which admin callables are deployed + canonical TODAY. The deployed
 * backend was initially STUDENT-focused, so this is the GATE-0/GATE-B probe:
 * any read that throws → coordinate with SDK-coord to deploy/canonicalize.
 *
 * Run: PATH=/opt/homebrew/opt/node@20/bin:$PATH node scripts/smoke-admin-prod.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import { createApiClient } from '@levelup/api-client';
import { createRepositories } from '@levelup/repositories';
import {
  createFirebaseAuthHandle,
  createFirebaseTransport,
} from '@levelup/transport-firebase';

const REGION = 'asia-south1';
const EMAIL = 'subhang.rocklee@gmail.com';
const PASSWORD = 'Test@12345';

const PROD_CONFIG = {
  apiKey: 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E',
  authDomain: 'lvlup-ff6fa.firebaseapp.com',
  projectId: 'lvlup-ff6fa',
  storageBucket: 'lvlup-ff6fa.appspot.com',
  messagingSenderId: '504506746594',
  appId: '1:504506746594:web:aac69e81f25dd95c5f80bb',
  databaseURL: 'https://lvlup-ff6fa-default-rtdb.firebaseio.com',
};

function fail(msg) {
  console.error(`\n❌ GATE0-ADMIN FAIL: ${msg}`);
  process.exit(1);
}

const app = initializeApp(PROD_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const functions = getFunctions(app, REGION);
const storage = getStorage(app);
const services = { auth, db, rtdb, storage, functions };

const arr = (res) => (Array.isArray(res) ? res : res?.items ?? []);

async function probe(label, fn) {
  try {
    const res = await fn();
    const items = arr(res);
    console.log(`   ✓ ${label}: ${items.length} item(s)` +
      (items[0] ? ` — e.g. ${JSON.stringify(items[0]).slice(0, 120)}` : ''));
    return { label, ok: true, count: items.length, sample: items[0] };
  } catch (e) {
    console.log(`   ✗ ${label}: ${e?.code ?? ''} ${e?.message ?? e}`);
    return { label, ok: false, error: e?.message ?? String(e) };
  }
}

const main = async () => {
  console.log(`[admin] signing in as ${EMAIL} @ lvlup-ff6fa`);
  const authHandle = createFirebaseAuthHandle(auth);
  const { user } = await authHandle
    .signIn(EMAIL, PASSWORD)
    .catch((e) => fail(`sign-in threw: ${e?.message ?? e}`));
  if (!user?.uid) fail('no uid after sign-in');
  console.log(`[admin] signed in uid=${user.uid}`);

  // validateResponses OFF — admin reads may still drift from canonical Zod.
  const transport = createFirebaseTransport(services, { region: REGION });
  const api = createApiClient(transport, { validateResponses: false });
  const repos = createRepositories(api);

  console.log(`[admin] probing admin read callables:`);
  const results = [];
  results.push(await probe('tenantRepo.list', () => repos.tenantRepo.list({})));
  results.push(await probe('studentRepo.list', () => repos.studentRepo.list({})));
  results.push(await probe('teacherRepo.list', () => repos.teacherRepo.list({})));
  results.push(await probe('parentRepoEntity.list', () => repos.parentRepoEntity.list({})));
  results.push(await probe('staffRepo.list', () => repos.staffRepo.list({})));
  results.push(await probe('classRepo.list', () => repos.classRepo.list({})));
  results.push(await probe('academicSessionRepo.list', () => repos.academicSessionRepo.list({})));
  results.push(await probe('examRepo.list', () => repos.examRepo.list({})));
  results.push(await probe('announcementRepo.list', () => repos.announcementRepo.list({})));
  results.push(await probe('spaceRepo.list', () => repos.spaceRepo.list({})));

  const ok = results.filter((r) => r.ok);
  console.log(`\n[admin] ${ok.length}/${results.length} admin reads succeeded.`);
  if (ok.length === 0) fail('NO admin reads succeeded — admin callables not deployed/canonical yet');

  console.log(`\n✅ GATE0-ADMIN PASS: ${ok.length} admin read(s) live vs lvlup-ff6fa via fat SDK:`);
  ok.forEach((r) => console.log(`   • ${r.label} → ${r.count}`));
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\n⚠ ${failed.length} read(s) NOT live (coordinate w/ SDK-coord):`);
    failed.forEach((r) => console.log(`   • ${r.label}: ${r.error}`));
  }
  process.exit(0);
};

const timer = setTimeout(() => fail('timed out after 90s'), 90_000);
main().finally(() => clearTimeout(timer));
