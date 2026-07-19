/**
 * MOB-EVAL-FIX verification — submit GOOD answers to AI items against PROD, then
 * run the NEW client mapping (mirrors ContentViewerScreen.toOutcome +
 * lyceum.toFeedbackProps) AND the OLD mapping to prove the fix renders rich
 * feedback where the old code rendered nothing. Also re-runs client validation.
 */
import { signIn, call } from '../tmp-e2e-chaitanya/_lib.mjs';
import { getCallable } from '../packages/api-contract/dist/index.js';

const SPACE = 'spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0';

// ── NEW mapping (mirrors the fixed source) ──────────────────────────────────
function toOutcomeNEW(data) {
  const d = data ?? {};
  const progress = d.progress ?? {};
  const ev = progress.evaluation ?? undefined;
  const correctness = typeof ev?.correctness === 'number' ? ev.correctness : undefined;
  const percentage =
    typeof ev?.percentage === 'number' ? ev.percentage
    : typeof progress.percentage === 'number' ? progress.percentage : undefined;
  const status =
    progress.solved === true || (correctness != null && correctness >= 1) ? 'correct'
    : (correctness != null && correctness > 0) || (percentage != null && percentage > 0) ? 'partial'
    : ev ? 'incorrect' : undefined;
  const feedback = ev?.summary?.overallComment ?? ev?.summary?.keyTakeaway;
  return { status, completed: Boolean(d.completed), feedback };
}
function toFeedbackPropsNEW(raw) {
  const p = (raw ?? {}).progress ?? {};
  const ev = p.evaluation ?? {};
  const str = (v) => (typeof v === 'string' && v.trim() ? v : null);
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const summary = ev.summary ?? {};
  return {
    score: ev.score ?? null, maxScore: ev.maxScore ?? null,
    comment: str(summary.overallComment) ?? str(summary.keyTakeaway) ?? str(ev.feedback),
    strengths: arr(ev.strengths), weaknesses: arr(ev.weaknesses), missingConcepts: arr(ev.missingConcepts),
  };
}
// ── OLD mapping (what shipped) ──────────────────────────────────────────────
function toOutcomeOLD(data) {
  const progress = (data ?? {}).progress ?? {};
  const status = progress.questionData?.status;
  const feedback = progress.lastEvaluation?.feedback ?? progress.feedback;
  return { status, completed: Boolean((data ?? {}).completed), feedback };
}
function toFeedbackPropsOLD(raw) {
  const ev = ((raw ?? {}).progress ?? {}).lastEvaluation ?? {};
  return { comment: ev.feedback ?? ev.summary?.overallComment ?? null,
    strengths: ev.strengths ?? [], weaknesses: ev.weaknesses ?? [] };
}

const CASES = [
  { name: 'paragraph (GOOD memory-leak answer)',
    sp: 'stp_subhang-ai-lab-storypoint-ai-assessment-_7c4806463e',
    item: 'itm_subhang-ai-lab-item-ai-assessment-lab-sp_20fe7f102b',
    answer: 'To diagnose a memory leak in a production service: first confirm growth via memory/RSS and GC metrics and dashboards. Reproduce under load in staging, take periodic heap snapshots, and diff them to find objects whose retained size keeps growing. Trace the retaining references (caches without eviction, unbounded queues, event-listener leaks, closures holding large scopes). Fix the retention (bound caches, remove listeners), then verify the heap plateaus in staging and production and add an alert on sustained growth.' },
  { name: 'code (GOOD two-sum)',
    sp: 'stp_subhang-ai-lab-storypoint-ai-assessment-_bcc67829d5',
    item: 'itm_subhang-ai-lab-item-ai-assessment-lab-sp_3e98867349',
    answer: 'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []  # O(n) time, O(n) space' },
];

await signIn('student.test@subhang.academy', 'Test@12345');
const def = getCallable('v1.levelup.recordItemAttempt');

for (const c of CASES) {
  console.log(`\n=================== ${c.name} ===================`);
  const res = await call('v1.levelup.recordItemAttempt', {
    spaceId: SPACE, storyPointId: c.sp, itemId: c.item, answer: { text: c.answer }, timeSpent: 30,
  });
  if (!res.ok) { console.log('SERVER ERROR', res.code, res.message); continue; }
  const ev = res.data.progress.evaluation;
  console.log(`server: ${res.ms}ms score=${ev.score}/${ev.maxScore} correctness=${ev.correctness} pct=${ev.percentage} solved=${res.data.progress.solved}`);

  try { def.responseSchema.parse(res.data); console.log('validation: ✅ PASS'); }
  catch (e) { console.log('validation: ❌ THROW', JSON.stringify(e.issues)); }

  const oN = toOutcomeNEW(res.data), fN = toFeedbackPropsNEW(res.data);
  const oO = toOutcomeOLD(res.data), fO = toFeedbackPropsOLD(res.data);
  console.log('NEW → verdict=%s comment=%s | score=%s strengths=%d weaknesses=%d missing=%d',
    oN.status ?? '(undef→incorrect)', JSON.stringify((fN.comment ?? '').slice(0,60)+'…'),
    `${fN.score}/${fN.maxScore}`, fN.strengths.length, fN.weaknesses.length, fN.missingConcepts.length);
  console.log('OLD → verdict=%s comment=%s strengths=%d weaknesses=%d  (renders blank verdict + no rich feedback)',
    oO.status ?? '(undef→incorrect)', JSON.stringify(fO.comment), fO.strengths.length, fO.weaknesses.length);
}
