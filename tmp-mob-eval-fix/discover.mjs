/**
 * MOB-EVAL-FIX repro step 1 — discover AI Assessment Lab text/paragraph/code
 * items as the test student against PROD deployed callables.
 */
import { signIn, call, j } from '../tmp-e2e-chaitanya/_lib.mjs';

const SPACE = 'spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0';

const who = await signIn('student.test@subhang.academy', 'Test@12345');
console.log('signed in uid=', who.uid, 'claims=', JSON.stringify(who.claims));

const sp = await call('v1.levelup.listStoryPoints', { spaceId: SPACE });
console.log('\n== listStoryPoints ok=%s ms=%s ==', sp.ok, sp.ms);
if (!sp.ok) { console.log('ERR', sp.code, sp.message, j(sp.details)); process.exit(1); }
const sps = sp.data?.items ?? sp.data?.storyPoints ?? sp.data ?? [];
console.log('storyPoints count=', Array.isArray(sps) ? sps.length : 'N/A');
for (const s of (Array.isArray(sps) ? sps : [])) {
  console.log(' SP', s.id, '|', s.title, '| order=', s.order ?? s.orderIndex);
}

// list items per story point, collect question types
for (const s of (Array.isArray(sps) ? sps : [])) {
  const it = await call('v1.levelup.listItems', { spaceId: SPACE, storyPointId: s.id });
  const items = it.data?.items ?? it.data ?? [];
  const arr = Array.isArray(items) ? items : [];
  console.log(`\n-- SP ${s.title} (${s.id}) items=${arr.length} ok=${it.ok}`);
  for (const item of arr) {
    const p = item.payload ?? {};
    const qd = p.questionData ?? {};
    const qtype = item.questionType ?? qd.questionType ?? p.questionType ?? p.question?.type ?? item.type;
    console.log(`   item ${item.id} | type=${item.type} qtype=${qtype} | title="${(item.title??'').slice(0,50)}"`);
  }
}
