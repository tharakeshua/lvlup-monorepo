import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { randomUUID } from 'node:crypto';

const app = initializeApp({ apiKey:'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E', authDomain:'lvlup-ff6fa.firebaseapp.com', projectId:'lvlup-ff6fa', appId:'1:504506746594:web:aac69e81f25dd95c5f80bb' });
const fns = getFunctions(app, 'asia-south1');
const now = () => Date.now();
const call = async (n, d = {}) => {
  const t0 = now();
  try { const r = (await httpsCallable(fns, n.replace(/\./g, '-'), { timeout: 120000 })(d)).data; return { ok: true, ms: now() - t0, data: r }; }
  catch (e) { return { ok: false, ms: now() - t0, code: e?.code, message: e?.message, details: e?.details }; }
};

const SPACE = 'spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0';
const STP = 'stp_subhang-ai-lab-storypoint-ai-assessment-_2a0fd86ef0';
const CHAT_ITEM = 'itm_subhang-ai-lab-item-ai-assessment-lab-sp_18483cd55e';
const tele = [];

async function main() {
  await signInWithEmailAndPassword(getAuth(app), 'student.test@subhang.academy', 'Test@12345');
  console.log('=== signed in as test student ===\n');

  // ── A) TUTOR turn (real model) ──
  console.log('── A) TUTOR (space-scoped) ──');
  const tStart = await call('v1.levelup.startConversation', { clientRequestId: randomUUID(), mode: 'tutor', context: { kind: 'tutor', scope: 'space', spaceId: SPACE } });
  console.log(`start: ok=${tStart.ok} ms=${tStart.ms} ${tStart.ok ? 'session=' + (tStart.data.session?.id) : tStart.code + ' ' + tStart.message}`);
  if (tStart.ok) {
    const sid = tStart.data.session.id;
    const turn = await call('v1.levelup.sendConversationTurn', { sessionId: sid, clientMessageId: randomUUID(), input: { text: 'In one sentence, what is the key idea behind binary search?' } });
    tele.push({ leg: 'tutor.turn', ms: turn.ms, ok: turn.ok });
    if (turn.ok) {
      const reply = (turn.data.assistantMessages || []).map(m => m.content?.map?.(c => c.text).join(' ') ?? m.text ?? JSON.stringify(m.content)).join(' | ');
      console.log(`  turn: ok ms=${turn.ms} replayed=${turn.data.replayed} assistantReply="${(reply||'').slice(0,180)}"`);
      console.log(`  turn.usage=${JSON.stringify(turn.data.turn?.usage ?? turn.data.turn?.cost ?? 'n/a')}`);
    } else console.log(`  turn: FAIL ms=${turn.ms} code=${turn.code} msg=${turn.message} details=${JSON.stringify(turn.details)}`);
  }

  // ── B) ASSESSMENT (chat_agent item) ──
  console.log('\n── B) AGENT ASSESSMENT ──');
  const aStart = await call('v1.levelup.startConversation', { clientRequestId: randomUUID(), mode: 'agent_assessment', context: { kind: 'agent_assessment', spaceId: SPACE, storyPointId: STP, itemId: CHAT_ITEM } });
  console.log(`start: ok=${aStart.ok} ms=${aStart.ms} ${aStart.ok ? 'session=' + aStart.data.session?.id + ' resumed=' + aStart.data.resumed : aStart.code + ' ' + aStart.message + ' details=' + JSON.stringify(aStart.details)}`);
  if (!aStart.ok) { summary(); return; }
  const sid = aStart.data.session.id;
  let lastCmid = null;
  const prompts = [
    'I would use a hash map to store seen values, giving O(n) time and O(n) space.',
    'For the follow-up: if memory is constrained, I could sort first then two-pointer, O(n log n) time and O(1) extra space.',
    'Trade-off: the hash map is faster asymptotically but the two-pointer approach avoids extra allocation.',
  ];
  let turnsDone = 0;
  for (let i = 0; i < prompts.length; i++) {
    const cmid = randomUUID();
    const turn = await call('v1.levelup.sendConversationTurn', { sessionId: sid, clientMessageId: cmid, input: { text: prompts[i] } });
    tele.push({ leg: `assess.turn${i + 1}`, ms: turn.ms, ok: turn.ok });
    if (turn.ok) {
      lastCmid = cmid; turnsDone++;
      const reply = (turn.data.assistantMessages || []).map(m => m.content?.map?.(c => c.text).join(' ') ?? m.text ?? '').join(' | ');
      console.log(`  turn${i + 1}: ok ms=${turn.ms} replayed=${turn.data.replayed} reply="${(reply||'').slice(0,140)}"`);
      const st = turn.data.session?.status;
      if (st && st !== 'active' && st !== 'in_progress') { console.log(`  session status=${st} — stopping turns`); break; }
    } else { console.log(`  turn${i + 1}: FAIL ms=${turn.ms} code=${turn.code} msg=${turn.message} details=${JSON.stringify(turn.details)}`); break; }
  }

  // ── B2) duplicate clientMessageId on a completed turn → replayed:true ──
  if (lastCmid) {
    const dup = await call('v1.levelup.sendConversationTurn', { sessionId: sid, clientMessageId: lastCmid, input: { text: prompts[Math.max(0, turnsDone - 1)] } });
    console.log(`  DUP-REPLAY (same clientMessageId): ok=${dup.ok} replayed=${dup.ok ? dup.data.replayed : 'n/a'} code=${dup.code ?? ''}`);
  }

  // ── B3) finish → exactly-once submission + evaluation ──
  const finReq = { sessionId: sid, clientRequestId: randomUUID(), reason: 'learner_requested', earlyFinishConfirmed: true };
  const fin = await call('v1.levelup.finishConversation', finReq);
  console.log(`  finish: ok=${fin.ok} ms=${fin.ms} status=${fin.ok ? fin.data.status : fin.code + ' ' + fin.message} replayed=${fin.ok ? fin.data.replayed : ''}`);
  if (fin.ok) console.log(`  finish.evaluation=${JSON.stringify(fin.data.evaluation ?? fin.data).slice(0,300)}`);
  // idempotent finish replay
  const fin2 = await call('v1.levelup.finishConversation', finReq);
  console.log(`  finish REPLAY (same clientRequestId): ok=${fin2.ok} status=${fin2.ok ? fin2.data.status : fin2.code} replayed=${fin2.ok ? fin2.data.replayed : ''}`);

  summary();
}

function summary() {
  console.log('\n==== TELEMETRY (per-turn latency) ====');
  tele.forEach(t => console.log(`  ${t.leg}: ${t.ms}ms ok=${t.ok}`));
  const oks = tele.filter(t => t.ok);
  if (oks.length) console.log(`  avg turn latency: ${Math.round(oks.reduce((a, t) => a + t.ms, 0) / oks.length)}ms  n=${oks.length}`);
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e?.message, e?.code); process.exit(2); });
