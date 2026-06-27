#!/usr/bin/env node
/**
 * Slice B → GATE B verification: exercise the STUDENT vertical through the
 * DEPLOYED `v1-levelup-*` callables on the REAL project `lvlup-ff6fa` against the
 * v2_-prefixed seeded data — the faithful app wire path.
 *
 * Faithful path: the app calls api-client → transport-firebase `invokeViaCallable`,
 * which resolves a callable by its DEPLOYED id, mapping the dotted contract name
 * dots→dashes (`v1.levelup.getSpace` → `v1-levelup-getSpace`). We reproduce that
 * exact carrier here with the firebase client SDK `httpsCallable` (Firebase
 * auto-forwards the signed-in user's ID token; the server derives tenant from the
 * `tenantId=LUC100` claim). No DOM / React / ApiProvider needed.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const cfg = {
  apiKey: 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E',
  authDomain: 'lvlup-ff6fa.firebaseapp.com',
  projectId: 'lvlup-ff6fa',
  appId: '1:504506746594:web:aac69e81f25dd95c5f80bb',
};
const REGION = 'asia-south1';
const DSA_SPACE = 'spc_content-levelup-space-space-dsa_26218a59b7';

// The single dotted→dashed mapping the transport applies (verbatim).
const toDeployedCallableId = (name) => name.replace(/\./g, '-');

const app = initializeApp(cfg);
const auth = getAuth(app);
const fns = getFunctions(app, REGION);

const call = async (dottedName, data = {}) => {
  const fn = httpsCallable(fns, toDeployedCallableId(dottedName));
  const res = await fn(data);
  return res.data;
};

const results = [];
const record = (label, pass, detail) => {
  results.push({ label, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label} :: ${detail}`);
};

const ANSWER_LEAK_KEYS = [
  'answer',
  'correctAnswer',
  'modelAnswer',
  'evaluatorGuidance',
  'rubric',
  'solution',
  'explanation',
  'correctOptionId',
  'correctOptionIds',
  'isCorrect',
];

const findLeakKeys = (obj) => {
  const found = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        if (ANSWER_LEAK_KEYS.includes(k) && v[k] !== undefined && v[k] !== null) found.add(k);
        walk(v[k]);
      }
    }
  };
  walk(obj);
  return [...found];
};

async function main() {
  // ── Auth ──
  const cred = await signInWithEmailAndPassword(auth, 'nandini@learner.dev', 'Student@123');
  const tok = await cred.user.getIdTokenResult();
  record(
    'auth.signIn',
    cred.user.uid?.length > 0,
    `uid=${cred.user.uid} role=${tok.claims.role} tenantId=${tok.claims.tenantId}`,
  );

  // ── (a) seeded v2 data through deployed callables ──
  const spaces = await call('v1.levelup.listSpaces', {});
  const spaceItems = spaces.items ?? spaces.data ?? spaces;
  record(
    'listSpaces',
    Array.isArray(spaceItems) && spaceItems.length >= 1,
    `count=${Array.isArray(spaceItems) ? spaceItems.length : 'n/a'} ids=${(Array.isArray(spaceItems) ? spaceItems : []).map((s) => s.id).join(',')}`,
  );

  const getSpace = await call('v1.levelup.getSpace', { spaceId: DSA_SPACE });
  const space = getSpace.space;
  record(
    'getSpace(DSA)',
    !!space && (space.status === 'published' || space.published === true),
    `id=${space?.id} status=${space?.status} title=${space?.title ?? space?.name}`,
  );

  const sps = await call('v1.levelup.listStoryPoints', { spaceId: DSA_SPACE });
  const storyPoints = sps.storyPoints ?? sps.items ?? sps;
  record(
    'listStoryPoints',
    Array.isArray(storyPoints) && storyPoints.length === 4,
    `count=${Array.isArray(storyPoints) ? storyPoints.length : 'n/a'} (expected 4)`,
  );

  // Aggregate items across all story points (seed: 18 items total).
  let totalItems = 0;
  let sampleItem = null;
  let sampleSp = null;
  const perSp = [];
  for (const sp of storyPoints) {
    const li = await call('v1.levelup.listItems', { spaceId: DSA_SPACE, storyPointId: sp.id });
    const items = li.items ?? li.data ?? li;
    const arr = Array.isArray(items) ? items : [];
    totalItems += arr.length;
    perSp.push(`${sp.id}:${arr.length}`);
    if (!sampleItem && arr.length) {
      sampleItem = arr[0];
      sampleSp = sp.id;
    }
  }
  record(
    'listItems (all storyPoints)',
    totalItems === 18,
    `total=${totalItems} (expected 18) breakdown=[${perSp.join(' ')}]`,
  );

  const prog0 = await call('v1.levelup.getSpaceProgress', { spaceId: DSA_SPACE });
  record(
    'getSpaceProgress (initial)',
    Object.prototype.hasOwnProperty.call(prog0, 'progress'),
    `progress=${JSON.stringify(prog0.progress) === undefined ? 'null' : JSON.stringify(prog0.progress)?.slice(0, 120)}`,
  );

  // ── (b) TRUST BOUNDARY 1: item payload carries NO answer/modelAnswer/guidance ──
  const leak = sampleItem ? findLeakKeys(sampleItem) : ['<no item>'];
  record(
    'TRUST: student item payload has no answer/modelAnswer/evaluatorGuidance',
    sampleItem && leak.length === 0,
    `itemId=${sampleItem?.id} type=${sampleItem?.type} keys=[${sampleItem ? Object.keys(sampleItem).join(',') : ''}] leaked=[${leak.join(',')}]`,
  );

  // ── (b) TRUST BOUNDARY 2: getItemForEdit DENIED for a student ──
  let denied = false;
  let denyDetail = '';
  try {
    await call('v1.levelup.getItemForEdit', {
      spaceId: DSA_SPACE,
      storyPointId: sampleSp,
      itemId: sampleItem?.id,
    });
    denyDetail = 'NOT denied — returned a payload (LEAK)';
  } catch (e) {
    denied = e?.code === 'functions/permission-denied' || /permission-denied|PERMISSION_DENIED/i.test(`${e?.code} ${e?.message}`);
    denyDetail = `code=${e?.code} message=${e?.message}`;
  }
  record('TRUST: getItemForEdit denied for student (permission-denied)', denied, denyDetail);

  // ── (b) TRUST BOUNDARY 3: recordItemAttempt scored SERVER-SIDE (client cannot set score) ──
  // Send a deliberately bogus client-supplied score alongside the answer; the
  // server must ignore it and return its OWN authoritative progress/score.
  let attemptPass = false;
  let attemptDetail = '';
  try {
    const attempt = await call('v1.levelup.recordItemAttempt', {
      spaceId: DSA_SPACE,
      storyPointId: sampleSp,
      itemId: sampleItem?.id,
      answer: { value: 'verification-probe-answer', score: 999, isCorrect: true },
      timeSpent: 3,
    });
    const p = attempt.progress ?? {};
    const clientScoreHonored = p.score === 999;
    attemptPass = !!attempt && typeof attempt.completed === 'boolean' && !clientScoreHonored;
    attemptDetail = `completed=${attempt.completed} server.progress=${JSON.stringify(p).slice(0, 160)} clientScore(999)Honored=${clientScoreHonored}`;
  } catch (e) {
    attemptDetail = `ERROR code=${e?.code} message=${e?.message}`;
  }
  record('TRUST: recordItemAttempt scored server-side (client score ignored)', attemptPass, attemptDetail);

  // ── (a) re-read progress reflects the attempt ──
  const prog1 = await call('v1.levelup.getSpaceProgress', { spaceId: DSA_SPACE });
  const before = JSON.stringify(prog0.progress);
  const after = JSON.stringify(prog1.progress);
  record(
    'getSpaceProgress (after attempt) reflects activity',
    prog1.progress != null && after !== before,
    `before=${(before ?? 'null').slice(0, 80)} after=${(after ?? 'null').slice(0, 140)}`,
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n==== SUMMARY: ${results.length - failed.length}/${results.length} PASS ====`);
  if (failed.length) {
    console.log('FAILURES:', failed.map((f) => f.label).join(' | '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e?.code, e?.message, e?.stack?.split('\n').slice(0, 4).join('\n'));
  process.exit(2);
});
