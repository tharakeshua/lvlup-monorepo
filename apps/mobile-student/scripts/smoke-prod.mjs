/**
 * GATE-0 LIVE PROD proof.
 *
 * Same data path as smoke-node.mjs (transport-firebase → api-client →
 * repositories) but against the REAL project `lvlup-ff6fa` (region asia-south1,
 * v2_ seeded) — NO emulator connect. This is the proof a physical phone needs:
 * sign in as nandini → spaceRepo.list({}) → assert the seeded DSA space.
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

// Mirror of src/sdk/transport-compat.ts (the app's composition-root shim) — the
// deployed lvlup-ff6fa server strips `idempotencyKey` (no underscore) and rejects
// `__apiVersion`, so normalize the wire envelope to the deployed contract.
function normalizeEnvelope(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return data;
  const obj = data;
  if (!('__apiVersion' in obj) && !('__idempotencyKey' in obj)) return data;
  const { __apiVersion, __idempotencyKey, ...rest } = obj;
  if (__idempotencyKey !== undefined) rest.idempotencyKey = __idempotencyKey;
  return rest;
}
function withEnvelopeCompat(transport) {
  return {
    ...transport,
    invoke: (name, data) => transport.invoke(name, normalizeEnvelope(data)),
    subscribe: transport.subscribe.bind(transport),
    serverTimeOffset: transport.serverTimeOffset.bind(transport),
    refreshToken: transport.refreshToken.bind(transport),
    storage: transport.storage,
  };
}

const REGION = 'asia-south1';
const EMAIL = 'nandini@learner.dev';
const PASSWORD = 'Student@123';

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
  console.error(`\n❌ GATE0-PROD FAIL: ${msg}`);
  process.exit(1);
}

const app = initializeApp(PROD_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const functions = getFunctions(app, REGION);
const storage = getStorage(app);

const services = { auth, db, rtdb, storage, functions };

const main = async () => {
  console.log(`[prod] signing in as ${EMAIL} @ lvlup-ff6fa`);
  const authHandle = createFirebaseAuthHandle(auth);
  const { user } = await authHandle
    .signIn(EMAIL, PASSWORD)
    .catch((e) => fail(`sign-in threw: ${e?.message ?? e}`));
  if (!user?.uid) fail('no uid after sign-in');
  console.log(`[prod] signed in uid=${user.uid}`);

  // Post-cutover: NO envelope shim, response validation ON — proves the deployed
  // lvlup-ff6fa now speaks the canonical contract (envelope + response shape).
  const transport = createFirebaseTransport(services, { region: REGION });
  const api = createApiClient(transport, { validateResponses: true });
  const repos = createRepositories(api);

  console.log(`[prod] calling spaceRepo.list({}) → v1.levelup.listSpaces`);
  const res = await repos.spaceRepo.list({}).catch((e) => {
    console.error('[prod] full error:', JSON.stringify({
      message: e?.message, code: e?.code, name: e?.name,
      details: e?.details, cause: e?.cause?.message,
    }, null, 2));
    fail(`spaceRepo.list threw: ${e?.message ?? e}`);
  });

  const items = Array.isArray(res) ? res : (res?.items ?? []);
  console.log(`[prod] listSpaces returned ${items.length} space(s):`);
  for (const s of items) {
    console.log(`   • ${s.title ?? s.name ?? '(untitled)'}  [${s.id ?? s.spaceId ?? '?'}]`);
  }

  const dsa = items.find((s) =>
    `${s.title ?? s.name ?? ''}`.toLowerCase().includes('data structures'),
  );
  if (!dsa) fail(`seeded DSA space not found among ${items.length} spaces`);

  console.log(`\n✅ GATE0-PROD PASS: DSA space returned from lvlup-ff6fa via the fat SDK → "${dsa.title ?? dsa.name}" [${dsa.id ?? dsa.spaceId}]`);
  process.exit(0);
};

const timer = setTimeout(() => fail('timed out after 60s'), 60_000);
main().finally(() => clearTimeout(timer));
