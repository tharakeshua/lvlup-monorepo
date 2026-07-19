/**
 * MOB-EVAL-FIX repro step 2 — submit a text answer via recordItemAttempt against
 * PROD, capture the RAW wire payload, then run the CURRENT-SOURCE client response
 * validation (getCallable(name).responseSchema.parse) exactly as the app does.
 */
import { signIn, call } from '../tmp-e2e-chaitanya/_lib.mjs';
import { getCallable } from '../packages/api-contract/dist/index.js';

const SPACE = 'spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0';

// [storyPointId, itemId, questionType, answer]
const CASES = {
  text: ['stp_subhang-ai-lab-storypoint-ai-assessment-_0a1cba1a02', 'itm_subhang-ai-lab-item-ai-assessment-lab-sp_0ad693ad9f',
    'A hash map gives average O(1) lookup because keys are hashed to buckets; collisions are handled by chaining or open addressing.'],
  paragraph: ['stp_subhang-ai-lab-storypoint-ai-assessment-_7c4806463e', 'itm_subhang-ai-lab-item-ai-assessment-lab-sp_20fe7f102b',
    'Indexes speed reads by maintaining a sorted structure (B-tree) over a column, turning O(n) scans into O(log n) seeks, at the cost of slower writes and extra storage. Use them on high-selectivity columns queried often.'],
  code: ['stp_subhang-ai-lab-storypoint-ai-assessment-_bcc67829d5', 'itm_subhang-ai-lab-item-ai-assessment-lab-sp_3e98867349',
    'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n    return []'],
};

const which = process.argv[2] ?? 'text';
const [storyPointId, itemId, answer] = CASES[which];

await signIn('student.test@subhang.academy', 'Test@12345');
console.log(`\n=== recordItemAttempt [${which}] item=${itemId} ===`);

const res = await call('v1.levelup.recordItemAttempt', {
  spaceId: SPACE, storyPointId, itemId,
  answer: { text: answer },
  timeSpent: 12,
});

console.log('ok=%s ms=%s code=%s', res.ok, res.ms, res.code ?? '-');
if (!res.ok) {
  console.log('SERVER ERROR:', res.code, res.message, JSON.stringify(res.details));
  process.exit(1);
}

console.log('\n--- RAW WIRE PAYLOAD (res.data) ---');
console.log(JSON.stringify(res.data, null, 2));

console.log('\n--- CLIENT VALIDATION (validateResponses=true, current source) ---');
const def = getCallable('v1.levelup.recordItemAttempt');
try {
  def.responseSchema.parse(res.data);
  console.log('✅ PASS — current-source schema accepts the payload');
} catch (e) {
  console.log('❌ THROW — client would render silent nothing');
  console.log(JSON.stringify(e.issues ?? e.errors ?? e.message, null, 2));
}
