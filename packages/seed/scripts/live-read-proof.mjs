/**
 * LIVE-READ PROOF — sign in as the REAL student via Firebase Auth REST and call the
 * DEPLOYED callables (asia-south1, lvlup-ff6fa) to prove:
 *   1. listSpaces returns the real Subhang spaces (from v2_, through the realigned callable).
 *   2. drill-down listStoryPoints -> listItems works.
 *   3. trust boundary: NO answer field leaks in the items the student receives.
 * Read-only. No writes.
 */
const API_KEY = 'AIzaSyCnH1XXcLRVMPCvtjBGotCh_86hOJ2AV2E';
const REGION = 'asia-south1';
const PROJECT = 'lvlup-ff6fa';
const EMAIL = 'student.test@subhang.academy';
const PASSWORD = 'Test@12345';
const fnUrl = (callable) => `https://${REGION}-${PROJECT}.cloudfunctions.net/${callable.replace(/\./g, '-')}`;

const BANNED = ['correctAnswer', 'acceptableAnswers', 'modelAnswer', 'isCorrect', 'correctOrder', 'correctOptionId', 'correctOptionIds', 'answerKey', 'evaluationGuidance'];
function findLeak(v, path = 'item') {
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const r = findLeak(v[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (v && typeof v === 'object') { for (const [k, val] of Object.entries(v)) { if (BANNED.includes(k)) return `${path}.${k}`; const r = findLeak(val, `${path}.${k}`); if (r) return r; } }
  return null;
}

async function signIn() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`signIn failed: ${JSON.stringify(j)}`);
  return j.idToken;
}

async function callable(name, data, idToken) {
  const r = await fetch(fnUrl(name), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${name} -> HTTP ${r.status}: ${JSON.stringify(j).slice(0, 600)}`);
  if (j.error) throw new Error(`${name} -> ${JSON.stringify(j.error).slice(0, 600)}`);
  return j.result;
}

async function main() {
  console.log('\n===== LIVE-READ PROOF (deployed callables, signed in as the real student) =====');
  const idToken = await signIn();
  console.log('✓ Signed in as', EMAIL);

  const spacesRes = await callable('v1.levelup.listSpaces', { limit: 100 }, idToken);
  const spaces = spacesRes.items ?? spacesRes.spaces ?? [];
  console.log(`\n✓ listSpaces -> ${spaces.length} spaces:`);
  for (const s of spaces) console.log(`   • ${s.title}  [${s.status}/${s.type}]  stats=${JSON.stringify(s.stats)}  id=${s.id}`);

  // drill down on the first space with story points
  let proof = null;
  for (const sp of spaces) {
    const stRes = await callable('v1.levelup.listStoryPoints', { spaceId: sp.id }, idToken);
    const sps = stRes.items ?? [];
    if (!sps.length) continue;
    const first = sps[0];
    const itRes = await callable('v1.levelup.listItems', { spaceId: sp.id, storyPointId: first.id, limit: 100 }, idToken);
    const items = itRes.items ?? [];
    proof = { space: sp.title, storyPointCount: sps.length, storyPoint: first.title, itemCount: items.length, items };
    break;
  }
  if (!proof) { console.log('\n⚠️  No story points returned to drill into.'); return; }

  console.log(`\n✓ listStoryPoints("${proof.space}") -> ${proof.storyPointCount} story points`);
  console.log(`✓ listItems("${proof.storyPoint}") -> ${proof.itemCount} items`);
  // trust boundary
  let leak = null;
  for (const it of proof.items) { leak = findLeak(it, `item(${it.id})`); if (leak) break; }
  console.log(`\nTRUST BOUNDARY: ${leak ? '❌ LEAK at ' + leak : '✅ no answer field in any returned item'}`);
  const sample = proof.items[0];
  if (sample) console.log('sample item payload:', JSON.stringify(sample.payload).slice(0, 400));
  console.log('\n===== END =====');
}
main().then(() => process.exit(0)).catch((e) => { console.error('LIVE-READ ERROR:', e.message); process.exit(1); });
