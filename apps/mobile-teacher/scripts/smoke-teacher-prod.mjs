/**
 * GATE-0 LIVE PROD proof — TEACHER role.
 *
 * Signs in as the real multi-role admin+teacher (subhang.rocklee@gmail.com) and
 * probes the teacher data slice against prod `lvlup-ff6fa` (asia-south1, v2_):
 *   • spaceRepo.list   — MUST pass (teacher authors spaces; real Subhang = 12)
 *   • classRepo.list   — best-effort (teacher slice; may need deploy)
 *   • studentRepo.list — best-effort
 *   • examRepo.list    — best-effort
 * Reports which teacher callables are LIVE so the coordinator can scope the
 * GATE-B deploy/canonicalization with SDK-BUILD-COORD.
 */
import { initializeApp } from 'firebase/app';

import { createApiClient } from '@levelup/api-client';
import { createRepositories } from '@levelup/repositories';
import {
  createFirebaseAuthHandle,
  createFirebaseTransport,
} from '@levelup/transport-firebase';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

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
  console.error(`\n❌ GATE0-TEACHER FAIL: ${msg}`);
  process.exit(1);
}

const app = initializeApp(PROD_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const functions = getFunctions(app, REGION);
const storage = getStorage(app);
const services = { auth, db, rtdb, storage, functions };

async function probe(label, fn) {
  try {
    const res = await fn();
    const items = Array.isArray(res) ? res : (res?.items ?? []);
    console.log(`   ✅ ${label}: ${items.length} item(s)`);
    for (const it of items.slice(0, 3)) {
      console.log(`        • ${it.title ?? it.name ?? it.displayName ?? it.fullName ?? '(untitled)'}  [${it.id ?? '?'}]`);
    }
    return { label, ok: true, count: items.length };
  } catch (e) {
    console.log(`   ⚠️  ${label}: ${e?.code ?? ''} ${e?.message ?? e}`);
    return { label, ok: false, error: e?.message ?? String(e) };
  }
}

const main = async () => {
  console.log(`[prod] signing in as ${EMAIL} @ lvlup-ff6fa (teacher role)`);
  const authHandle = createFirebaseAuthHandle(auth);
  const { user } = await authHandle
    .signIn(EMAIL, PASSWORD)
    .catch((e) => fail(`sign-in threw: ${e?.message ?? e}`));
  if (!user?.uid) fail('no uid after sign-in');
  console.log(`[prod] signed in uid=${user.uid}`);

  // Response validation OFF during discovery — teacher reads may be only
  // partially canonicalized (mirrors the student GATE-B saga). Screens code
  // defensively regardless.
  const transport = createFirebaseTransport(services, { region: REGION });
  const api = createApiClient(transport, { validateResponses: false });
  const repos = createRepositories(api);

  console.log(`\n[prod] probing teacher data slice:`);
  const results = [];
  results.push(await probe('spaceRepo.list', () => repos.spaceRepo.list({})));
  results.push(await probe('classRepo.list', () => repos.classRepo.list({})));
  results.push(await probe('studentRepo.list', () => repos.studentRepo.list({})));
  results.push(await probe('examRepo.list', () => repos.examRepo.list({})));
  results.push(await probe('announcementRepo.list', () => repos.announcementRepo.list({})));

  const spaces = results.find((r) => r.label === 'spaceRepo.list');
  if (!spaces?.ok || !spaces.count) {
    fail(`spaceRepo.list (the required teacher authoring read) returned nothing`);
  }

  const live = results.filter((r) => r.ok).map((r) => r.label);
  const dead = results.filter((r) => !r.ok).map((r) => r.label);
  console.log(`\n✅ GATE0-TEACHER PASS: signed in as teacher, spaceRepo.list returned ${spaces.count} space(s) from lvlup-ff6fa via the fat SDK.`);
  console.log(`   LIVE teacher reads: ${live.join(', ')}`);
  if (dead.length) console.log(`   NEEDS DEPLOY/CANON (coordinate w/ SDK-coord): ${dead.join(', ')}`);
  process.exit(0);
};

const timer = setTimeout(() => fail('timed out after 60s'), 60_000);
main().finally(() => clearTimeout(timer));
