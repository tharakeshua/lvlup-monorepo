/**
 * Headless GATE-0 data-path proof.
 *
 * Drives the EXACT SDK packages the app uses (transport-firebase → api-client →
 * repositories) against the local emulator: sign in as the seeded student, then
 * `spaceRepo.list({})` — the same call `useSpaces()` wraps. Asserts the seeded
 * DSA space comes back. Run inside `firebase emulators:exec` (emulator already up).
 *
 * This complements the Hermes-bytecode compile proof: bytecode = "SDK runs under
 * Hermes"; this = "SDK data round-trip returns seeded v2 data through the callable".
 */
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import { createApiClient } from '@levelup/api-client';
import { createRepositories } from '@levelup/repositories';
import {
  createFirebaseAuthHandle,
  createFirebaseTransport,
} from '@levelup/transport-firebase';

const HOST = process.env.EMULATOR_HOST ?? '127.0.0.1';
const REGION = 'asia-south1';
const EMAIL = 'nandini@learner.dev';
const PASSWORD = 'Student@123';

function fail(msg) {
  console.error(`\n❌ GATE0-SMOKE FAIL: ${msg}`);
  process.exit(1);
}

const app = initializeApp({
  apiKey: 'demo-api-key',
  authDomain: 'demo-levelup.firebaseapp.com',
  projectId: 'demo-levelup',
  storageBucket: 'demo-levelup.appspot.com',
  messagingSenderId: '0',
  appId: '1:0:web:demo',
  databaseURL: `https://demo-levelup-default-rtdb.firebaseio.com`,
});

const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const functions = getFunctions(app, REGION);
const storage = getStorage(app);

connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
connectFirestoreEmulator(db, HOST, 8080);
connectDatabaseEmulator(rtdb, HOST, 9000);
connectFunctionsEmulator(functions, HOST, 5001);

const services = { auth, db, rtdb, storage, functions };

const main = async () => {
  console.log(`[smoke] signing in as ${EMAIL} @ emulator ${HOST}`);
  const authHandle = createFirebaseAuthHandle(auth);
  const { user } = await authHandle.signIn(EMAIL, PASSWORD).catch((e) =>
    fail(`sign-in threw: ${e?.message ?? e}`),
  );
  if (!user?.uid) fail('no uid after sign-in');
  console.log(`[smoke] signed in uid=${user.uid}`);

  const transport = createFirebaseTransport(services, { region: REGION });
  const api = createApiClient(transport, { validateResponses: true });
  const repos = createRepositories(api);

  console.log(`[smoke] calling spaceRepo.list({}) → v1.levelup.listSpaces`);
  const res = await repos.spaceRepo.list({}).catch((e) =>
    fail(`spaceRepo.list threw: ${e?.message ?? e}`),
  );

  const items = Array.isArray(res) ? res : (res?.items ?? []);
  console.log(`[smoke] listSpaces returned ${items.length} space(s):`);
  for (const s of items) {
    console.log(`   • ${s.title ?? s.name ?? '(untitled)'}  [${s.id ?? s.spaceId ?? '?'}]`);
  }

  const dsa = items.find((s) =>
    `${s.title ?? s.name ?? ''}`.toLowerCase().includes('data structures'),
  );
  if (!dsa) fail(`seeded DSA space not found among ${items.length} spaces`);

  console.log(`\n✅ GATE0-SMOKE PASS: DSA space returned via the fat SDK → "${dsa.title ?? dsa.name}"`);
  process.exit(0);
};

const timer = setTimeout(() => fail('timed out after 60s'), 60_000);
main().finally(() => clearTimeout(timer));
