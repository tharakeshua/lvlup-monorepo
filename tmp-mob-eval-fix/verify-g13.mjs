/**
 * Post-deploy live verification for the sdk-v1 cut:
 *  (1) G13 — getEvaluationConfig as a STUDENT must not leak rubric.holisticGuidance
 *      (nor the other authoring-only legs), and must still pass client validation.
 *  (2) No regression — recordItemAttempt still grades an AI item end-to-end.
 */
import { signIn, call } from '../tmp-e2e-chaitanya/_lib.mjs';
import { getCallable } from '../packages/api-contract/dist/index.js';

const SPACE = 'spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0';
const PARAGRAPH_SP = 'stp_subhang-ai-lab-storypoint-ai-assessment-_7c4806463e';
const PARAGRAPH_ITEM = 'itm_subhang-ai-lab-item-ai-assessment-lab-sp_20fe7f102b';

await signIn('student.test@subhang.academy', 'Test@12345');

// ── (1) G13: student getEvaluationConfig ────────────────────────────────────
console.log('=== G13: getEvaluationConfig as student ===');
const cfg = await call('v1.levelup.getEvaluationConfig', { spaceId: SPACE, itemId: PARAGRAPH_ITEM });
if (!cfg.ok) {
  console.log('❌ getEvaluationConfig FAILED', cfg.code, cfg.message);
} else {
  const config = cfg.data.config;
  const rubric = config.rubric ?? {};
  const agent = config.agent ?? {};
  const settings = config.settings ?? {};
  const leaked = [];
  if ('holisticGuidance' in rubric) leaked.push('rubric.holisticGuidance');
  if ('modelAnswer' in rubric) leaked.push('rubric.modelAnswer');
  if ('evaluatorGuidance' in rubric) leaked.push('rubric.evaluatorGuidance');
  if ('systemPrompt' in agent) leaked.push('agent.systemPrompt');
  if ('rules' in agent) leaked.push('agent.rules');
  if ('confidenceConfig' in settings) leaked.push('settings.confidenceConfig');
  console.log('rubric present:', config.rubric != null, '| rubric keys:', Object.keys(rubric).join(','));
  console.log('LEAKED authoring-only fields:', leaked.length ? '❌ ' + leaked.join(', ') : '✅ none');
  try { getCallable('v1.levelup.getEvaluationConfig').responseSchema.parse(cfg.data); console.log('client validation: ✅ PASS'); }
  catch (e) { console.log('client validation: ❌ THROW', JSON.stringify(e.issues)); }
}

// ── (2) No-regression: recordItemAttempt still grades ───────────────────────
console.log('\n=== recordItemAttempt smoke (no regression) ===');
const rec = await call('v1.levelup.recordItemAttempt', {
  spaceId: SPACE, storyPointId: PARAGRAPH_SP, itemId: PARAGRAPH_ITEM,
  answer: { text: 'Diagnose a memory leak: confirm growth via metrics, take heap snapshots, diff them to find growing retained sets, trace retaining references (unbounded caches, listener leaks), fix retention, then verify the heap plateaus in staging/prod and alert on regrowth.' },
  timeSpent: 25,
});
if (!rec.ok) { console.log('❌ recordItemAttempt FAILED', rec.code, rec.message); }
else {
  const ev = rec.data.progress.evaluation;
  console.log(`✅ graded in ${rec.ms}ms: score=${ev.score}/${ev.maxScore} correctness=${ev.correctness} solved=${rec.data.progress.solved} summary=${ev.summary ? 'present' : 'none'}`);
  try { getCallable('v1.levelup.recordItemAttempt').responseSchema.parse(rec.data); console.log('client validation: ✅ PASS'); }
  catch (e) { console.log('client validation: ❌ THROW', JSON.stringify(e.issues)); }
}
