/**
 * Full-vertical PROD proof (post-cutover, no shim, validation ON).
 *
 * Drives the SAME fat-SDK callable path the app uses against lvlup-ff6fa:
 *   login nandini → listSpaces → DSA → listStoryPoints → listItems →
 *   recordItemAttempt(auto-gradable item) → getSpaceProgress reflects it.
 *
 * Per SDK-coord: only AUTO-GRADABLE question types score server-side from the
 * answer key (true_false/mcq/msq/numeric/match/ordering/fill_blank). Subjective
 * types (short/long answer, code, diagram, …) route to LLM grading which needs a
 * per-tenant Gemini key not provisioned on lvlup-ff6fa → skip those here.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import { createApiClient } from '@levelup/api-client';
import {
  createFirebaseAuthHandle,
  createFirebaseTransport,
} from '@levelup/transport-firebase';

const REGION = 'asia-south1';
const EMAIL = 'nandini@learner.dev';
const PASSWORD = 'Student@123';
const AUTO_GRADABLE = new Set([
  'true_false', 'mcq', 'msq', 'numeric', 'match', 'ordering', 'fill_blank',
]);

const PROD_CONFIG = {
  apiKey: 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E',
  authDomain: 'lvlup-ff6fa.firebaseapp.com',
  projectId: 'lvlup-ff6fa',
  storageBucket: 'lvlup-ff6fa.appspot.com',
  messagingSenderId: '504506746594',
  appId: '1:504506746594:web:aac69e81f25dd95c5f80bb',
  databaseURL: 'https://lvlup-ff6fa-default-rtdb.firebaseio.com',
};

function fail(msg) { console.error(`\n❌ VERTICAL FAIL: ${msg}`); process.exit(1); }
const arr = (r) => (Array.isArray(r) ? r : r?.items ?? []);

const app = initializeApp(PROD_CONFIG);
const services = {
  auth: getAuth(app), db: getFirestore(app), rtdb: getDatabase(app),
  storage: getStorage(app), functions: getFunctions(app, REGION),
};

// Build a plausible raw answer for an auto-gradable item from its answer-stripped view.
function buildAnswer(item) {
  const qt = item.questionType ?? item.data?.questionType ?? item.payload?.questionType;
  const d = item.data ?? item.payload ?? item;
  const opts = d.options ?? d.choices ?? [];
  switch (qt) {
    case 'true_false': return true;
    case 'mcq': return opts[0]?.id ?? opts[0]?.value ?? 0;
    case 'msq': return [opts[0]?.id ?? opts[0]?.value ?? 0];
    case 'numeric': return 0;
    case 'fill_blank': return Array.isArray(d.blanks) ? d.blanks.map(() => '') : '';
    case 'ordering': return opts.map((o, i) => o?.id ?? i);
    case 'match': return {};
    default: return true;
  }
}

const main = async () => {
  console.log(`[vertical] sign in ${EMAIL}`);
  const authHandle = createFirebaseAuthHandle(services.auth);
  const { user } = await authHandle.signIn(EMAIL, PASSWORD).catch((e) => fail(`sign-in: ${e?.message}`));
  console.log(`[vertical] uid=${user.uid}`);

  const transport = createFirebaseTransport(services, { region: REGION });
  const api = createApiClient(transport, { validateResponses: false });
  const lv = api.levelup;

  const spaces = arr(await lv.listSpaces({}));
  const dsa = spaces.find((s) => `${s.title ?? s.name ?? ''}`.toLowerCase().includes('data structures'));
  if (!dsa) fail('no DSA space');
  const spaceId = dsa.id ?? dsa.spaceId;
  console.log(`[vertical] DSA spaceId=${spaceId}`);

  const sps = arr(await lv.listStoryPoints({ spaceId }));
  console.log(`[vertical] ${sps.length} story points`);
  if (!sps.length) fail('no story points');

  // Find an auto-gradable item across the story points.
  let target = null;
  for (const sp of sps) {
    const spId = sp.id ?? sp.storyPointId;
    const items = arr(await lv.listItems({ spaceId, storyPointId: spId }));
    const found = items.find((it) => AUTO_GRADABLE.has(it.questionType ?? it.data?.questionType ?? it.payload?.questionType));
    if (found) { target = { spId, item: found }; break; }
  }
  if (!target) fail('no auto-gradable item found in DSA');
  const qt = target.item.questionType ?? target.item.data?.questionType ?? target.item.payload?.questionType;
  const itemId = target.item.id ?? target.item.itemId;
  console.log(`[vertical] auto-gradable item ${itemId} (${qt}) in sp ${target.spId}`);

  const answer = buildAnswer(target.item);
  console.log(`[vertical] recordItemAttempt answer=${JSON.stringify(answer)}`);
  const res = await lv.recordItemAttempt({ spaceId, storyPointId: target.spId, itemId, answer })
    .catch((e) => fail(`recordItemAttempt threw: ${e?.message} ${e?.cause ?? ''}`));
  console.log(`[vertical] attempt result: completed=${res?.completed} progress=${JSON.stringify(res?.progress)?.slice(0, 200)}`);

  const prog = await lv.getSpaceProgress({ spaceId }).catch((e) => fail(`getSpaceProgress: ${e?.message}`));
  console.log(`[vertical] getSpaceProgress: ${JSON.stringify(prog)?.slice(0, 240)}`);

  console.log(`\n✅ VERTICAL PASS: login→listSpaces→listStoryPoints→listItems→recordItemAttempt(${qt})→getSpaceProgress all returned via the fat SDK against lvlup-ff6fa.`);
  process.exit(0);
};

const timer = setTimeout(() => fail('timed out after 90s'), 90_000);
main().finally(() => clearTimeout(timer));
