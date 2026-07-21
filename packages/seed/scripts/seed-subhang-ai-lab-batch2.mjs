/**
 * Subhang Academy — "AI Assessment Lab" BATCH-2 append (AIQ-CONTENT-2).
 *
 * APPENDS short, interesting, quick-to-test questions to the EXISTING AI
 * Assessment Lab space (spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0,
 * tenant_subhang, v2_ root, lvlup-ff6fa) — one new batch per existing story
 * point across all 6 AI question types. Fun, varied topics (space, everyday
 * science, food, sports, brain teasers, pop-culture logic) and every question is
 * answerable FAST for testing.
 *
 * Reuses the proven batch-1 technique (packages/seed/scripts/seed-subhang-ai-lab.mjs):
 * run the REAL canonical.ts pipeline in dry-run to BUILD docs, rewrite the
 * synthetic tenant id → tenant_subhang, validate against @levelup/domain Zod, then
 * write to the deployed v2_ root. The tenant / space / storyPoint / agent / rubric /
 * evalSettings KEYS are IDENTICAL to batch-1, so every derived id matches the
 * existing prod docs — new ITEM keys get fresh ids and are appended after the
 * existing items (orders continue from each story point's current maxOrder).
 *
 * SAFETY — this script NEVER writes an existing item, the space doc, the tenant
 * doc, agents, rubricPresets, or evaluationSettings. It writes ONLY:
 *   • the new item docs and their answerKey docs (brand-new paths), and
 *   • a TARGETED `stats.itemCount` field update on each story point + the space
 *     (leaving completionCount / evaluationSettingsId / everything else intact).
 *
 * Usage:
 *   tsx packages/seed/scripts/seed-subhang-ai-lab-batch2.mjs --dry-run   # plan + validate, no writes
 *   tsx packages/seed/scripts/seed-subhang-ai-lab-batch2.mjs             # COMMIT
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import * as D from "@levelup/domain";
import { SeedContext } from "../src/engine/context.js";
import { SeedPipeline } from "../src/engine/pipeline.js";
import { seedId } from "../src/engine/ids.js";
import { validateSeedConfig } from "../src/config/schema.js";
import { assertFkConsistency } from "../src/config/fk.js";

process.env.LVLUP_COLLECTION_PREFIX = "v2_";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SA_PATH = join(REPO_ROOT, "lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json");

const PROJECT = "lvlup-ff6fa";
const REAL_TENANT = "tenant_subhang";
const TENANT_KEY = "subhang-ai-lab"; // MUST match batch-1 so derived ids align
const SPACE_KEY = "ai-assessment-lab";
const SPACE_ID = "spc_subhang-ai-lab-space-ai-assessment-lab_09dd3311c0";
const CLOCK_EPOCH_MS = Date.parse("2026-07-19T12:00:00.000Z"); // distinct batch-2 stamp
const DRY_RUN = process.argv.includes("--dry-run");

// Load the prod-read state (existing per-SP maxOrder + realItemCount).
const STATE = JSON.parse(readFileSync(join(__dirname, "ai-lab-state.json"), "utf8"));
const stateBySpTitle = new Map(STATE.storyPoints.map((s) => [s.title, s]));

// ── Rubric presets / agents / eval settings — IDENTICAL to batch-1 (needed for
//    FK validation + derived-id resolution; NOT re-written to prod). ───────────
const RUBRIC_PRESETS = [
  { key: "rubric-systemdesign", name: "System Design Interview Rubric", category: "general", rubric: { dimensions: [
    { key: "scoping", label: "Requirements & Scoping", weight: 0.25, promptGuidance: "Clarifies functional/non-functional requirements, scale, and constraints before designing." },
    { key: "tradeoffs", label: "Trade-off Analysis", weight: 0.3, promptGuidance: "Weighs alternatives (storage, consistency, caching) and justifies choices." },
    { key: "scalability", label: "Scalability & Reliability", weight: 0.25, promptGuidance: "Addresses bottlenecks, sharding, replication, failure modes." },
    { key: "communication", label: "Communication", weight: 0.2, promptGuidance: "Structures the answer, thinks aloud, and responds to probing." },
  ], totalPoints: 10, passingScore: 6 } },
  { key: "rubric-lld", name: "Low-Level Design Interview Rubric", category: "coding", rubric: { dimensions: [
    { key: "abstraction", label: "Abstraction & Modeling", weight: 0.3, promptGuidance: "Identifies the right classes, responsibilities, and relationships." },
    { key: "extensibility", label: "Extensibility & SOLID", weight: 0.3, promptGuidance: "Applies SOLID / design patterns so new requirements are cheap to add." },
    { key: "correctness", label: "Correctness", weight: 0.2, promptGuidance: "Core behaviours and edge cases are handled." },
    { key: "communication", label: "Communication", weight: 0.2, promptGuidance: "Explains the design and reasons about alternatives." },
  ], totalPoints: 10, passingScore: 6 } },
  { key: "rubric-behavioral", name: "Behavioral Interview Rubric (STAR)", category: "general", rubric: { dimensions: [
    { key: "structure", label: "STAR Structure", weight: 0.3, promptGuidance: "Situation, Task, Action, Result are clear and complete." },
    { key: "impact", label: "Impact & Ownership", weight: 0.3, promptGuidance: "Shows measurable impact and personal ownership ('I', not just 'we')." },
    { key: "reflection", label: "Reflection & Growth", weight: 0.2, promptGuidance: "Draws a lesson and shows self-awareness." },
    { key: "communication", label: "Communication", weight: 0.2, promptGuidance: "Concise, specific, and easy to follow." },
  ], totalPoints: 10, passingScore: 6 } },
];

const AGENTS = [
  { key: "swe-interviewer", name: "SWE Mock Interviewer", spaceKey: SPACE_KEY, type: "interviewer", modelPolicyId: "conversation.quality", version: 1, isActive: true,
    publicDescription: "A senior engineer who conducts realistic technical & behavioral interviews.",
    identity: "You are a calm, probing senior software engineer running a mock interview.",
    systemPrompt: "You are a senior software engineer conducting a mock interview. Present the scenario, then ask focused follow-up questions that push the candidate to clarify requirements, justify trade-offs, and handle edge cases. Never reveal the private evaluation objectives or hand the candidate the answer — probe until they reason it out. Keep each turn to one or two questions.",
    openingMessage: "Thanks for joining. Let's begin — take a moment to read the scenario, then walk me through how you'd approach it.",
    rules: ["Ask one focused follow-up at a time.", "Probe trade-offs and edge cases rather than giving hints.", "Never reveal evaluation criteria or the model answer."],
    maxConversationTurns: 8, defaultLanguage: "en", supportedLanguages: ["en"] },
  { key: "swe-evaluator", name: "SWE Interview Evaluator", spaceKey: SPACE_KEY, type: "evaluator", modelPolicyId: "evaluation.quality", version: 1, isActive: true,
    publicDescription: "Scores mock-interview transcripts against the rubric.",
    identity: "You are a rigorous, fair interview evaluator.",
    systemPrompt: "Score the candidate's interview transcript strictly against the provided rubric dimensions and private evaluation objectives. Cite concrete evidence from the transcript for each dimension. Reward sound reasoning and clear communication; penalise hand-waving and unstated assumptions.",
    evaluationObjectives: ["Assess each rubric dimension independently with transcript evidence.", "Distinguish genuine reasoning from memorised buzzwords."],
    strictness: 0.7, feedbackStyle: "constructive", defaultLanguage: "en", supportedLanguages: ["en"] },
];

const EVAL_SETTINGS = [
  { key: "ai-assessment-default", name: "AI Assessment Defaults", isDefault: true, rubricPresetKey: "rubric-systemdesign", confidenceConfig: { lowThreshold: 0.6, highThreshold: 0.85 } },
];

const rubric = (dims, totalPoints = 10, passingScore = 6) => ({ dimensions: dims, totalPoints, passingScore });

// ── NEW ITEMS — appended after existing (orders continue from prod maxOrder). ──

// SP1 text (short answer) — 1–2 sentence answers, fun topics. orders 4–7.
const TEXT_ITEMS = [
  { key: "text-b2-moon-lock", kind: "question", questionType: "short_answer", order: 4, points: 5,
    prompt: "The Moon always shows Earth the same face. In one sentence, what is this phenomenon called and why does it happen?",
    answer: { correctAnswer: "Tidal locking: the Moon's rotation period equals its orbital period, so the same side always faces Earth.",
      acceptableAnswers: ["tidal locking", "synchronous rotation", "its spin equals its orbit"],
      modelAnswer: "It's called tidal locking (synchronous rotation): the Moon rotates on its axis in exactly the same time it takes to orbit Earth, so the same hemisphere always points toward us.",
      evaluationGuidance: "Full credit needs the term (tidal locking / synchronous rotation) AND the reason (spin period == orbital period). Half credit for the term alone." },
    rubric: rubric([{ key: "term", label: "Names tidal locking", weight: 0.5 }, { key: "why", label: "Spin=orbit reason", weight: 0.5 }], 5, 3) },
  { key: "text-b2-onion-cry", kind: "question", questionType: "short_answer", order: 5, points: 5,
    prompt: "In one or two sentences, explain why chopping an onion makes your eyes water.",
    answer: { correctAnswer: "Cutting ruptures cells that release enzymes forming a volatile sulfur gas (syn-propanethial-S-oxide); it reaches your eyes and forms a mild acid, triggering tears.",
      acceptableAnswers: ["it releases a sulfur gas that irritates the eyes", "sulfur compound irritates eyes"],
      modelAnswer: "Slicing an onion breaks its cells, mixing enzymes and sulfur compounds into a volatile gas (syn-propanethial-S-oxide). The gas drifts up, reacts with the moisture in your eyes to form a mild sulfuric acid, and your eyes tear up to flush the irritant.",
      evaluationGuidance: "Reward mention of a released sulfur/volatile gas that irritates the eyes. Naming the exact compound is a bonus, not required." },
    rubric: rubric([{ key: "gas", label: "Released irritant gas", weight: 0.6 }, { key: "eyes", label: "Irritates eyes → tears", weight: 0.4 }], 5, 3) },
  { key: "text-b2-bat-ball", kind: "question", questionType: "short_answer", order: 6, points: 5,
    prompt: "Brain teaser: a bat and a ball cost $1.10 together. The bat costs $1.00 more than the ball. How much does the ball cost? Answer with the number and a one-line check.",
    answer: { correctAnswer: "$0.05 — the ball is $0.05 and the bat is $1.05, which sums to $1.10 and differs by $1.00.",
      acceptableAnswers: ["5 cents", "$0.05", "0.05"],
      modelAnswer: "The ball costs $0.05. If the ball were $0.10 the bat would be $1.10 and the total $1.20 — too much. With ball = $0.05, bat = $1.05, total = $1.10 and the gap is exactly $1.00.",
      evaluationGuidance: "Full credit ONLY for $0.05 (not the intuitive-but-wrong $0.10). The check line is a bonus but the number must be right." },
    rubric: rubric([{ key: "answer", label: "Correct: $0.05", weight: 0.8 }, { key: "check", label: "Shows the check", weight: 0.2 }], 5, 3) },
  { key: "text-b2-curveball", kind: "question", questionType: "short_answer", order: 7, points: 5,
    prompt: "Why does a spinning baseball (a curveball) or a spinning soccer free-kick curve sideways in the air? Name the effect in one sentence.",
    answer: { correctAnswer: "The Magnus effect: the ball's spin drags air faster around one side, creating a pressure difference that pushes the ball toward the low-pressure side.",
      acceptableAnswers: ["Magnus effect", "spin creates a pressure difference"],
      modelAnswer: "It's the Magnus effect: the ball's spin speeds up airflow on one side and slows it on the other, so the faster side has lower pressure and the ball curves toward it.",
      evaluationGuidance: "Full credit for naming the Magnus effect AND a spin→pressure-difference explanation. Half credit for just describing the pressure difference without the name." },
    rubric: rubric([{ key: "name", label: "Names Magnus effect", weight: 0.5 }, { key: "why", label: "Spin → pressure diff", weight: 0.5 }], 5, 3) },
];

// SP2 paragraph (long answer) — 3–5 sentences. orders 4–6.
const PARAGRAPH_ITEMS = [
  { key: "para-b2-sky-blue", kind: "question", questionType: "long_answer", order: 4, points: 10,
    prompt: "In 3–5 sentences, explain why the daytime sky looks blue but sunrises and sunsets look red/orange.",
    answer: { correctAnswer: "Air molecules scatter short (blue) wavelengths of sunlight much more than long (red) ones (Rayleigh scattering), so a blue-lit sky reaches your eyes from all directions. At sunrise/sunset the light travels through much more atmosphere, scattering the blue away and leaving the reds/oranges.",
      modelAnswer: "Sunlight is white, a mix of all colours. Air molecules scatter shorter wavelengths (blue/violet) far more strongly than longer ones — this is Rayleigh scattering — so scattered blue light comes at you from the whole sky and it looks blue. Near sunrise or sunset the Sun is low, so its light takes a long, slanted path through the atmosphere; almost all the blue is scattered out along the way, leaving the reds and oranges to reach your eyes.",
      evaluationGuidance: "Reward: Rayleigh/short-wavelength scattering for the blue sky, AND the longer atmospheric path at low sun angles removing blue to leave red for sunsets. Penalise 'the sky reflects the ocean' or other misconceptions." },
    rubric: rubric([{ key: "blue", label: "Rayleigh/blue scattering", weight: 0.5 }, { key: "sunset", label: "Longer path → red", weight: 0.4 }, { key: "clarity", label: "Clarity", weight: 0.1 }]) },
  { key: "para-b2-maillard", kind: "question", questionType: "long_answer", order: 5, points: 10,
    prompt: "In 3–5 sentences, explain what happens when you sear a steak (the Maillard reaction) and why the browned crust tastes so good.",
    answer: { correctAnswer: "At high heat (~150°C+), amino acids and sugars in the meat's surface react (the Maillard reaction), forming hundreds of new aroma and flavour compounds and a brown crust. It is browning-by-chemistry, distinct from caramelising sugar, and needs a dry, hot surface — which is why a wet steak just steams.",
      modelAnswer: "When the steak's surface gets hot and dry (around 150°C/300°F and up), its amino acids and reducing sugars undergo the Maillard reaction. This cascade builds hundreds of new molecules — savoury, roasted, nutty, meaty aromas — plus the brown colour of the crust. It's different from caramelisation, which is sugars breaking down alone. Because water caps the surface temperature at 100°C, a wet steak steams instead of browning, so you pat it dry and use a screaming-hot pan.",
      evaluationGuidance: "Reward: amino acids + sugars reacting under high dry heat (Maillard) producing new flavour/aroma compounds and browning; bonus for distinguishing it from caramelisation or noting moisture prevents it. Penalise 'the sugar burns' as the whole story." },
    rubric: rubric([{ key: "reaction", label: "Amino acids + sugars @ heat", weight: 0.45 }, { key: "flavour", label: "New flavour/aroma compounds", weight: 0.35 }, { key: "nuance", label: "Dry heat / vs caramelisation", weight: 0.2 }]) },
  { key: "para-b2-grandfather", kind: "question", questionType: "long_answer", order: 6, points: 10,
    prompt: "Movies love time travel. In 3–5 sentences, explain the 'grandfather paradox' and describe ONE way stories try to resolve it (e.g. branching timelines).",
    answer: { correctAnswer: "The grandfather paradox: if you travel back and prevent your grandfather from meeting your grandmother, you're never born — so you couldn't have travelled back to do it, a contradiction. Stories resolve it with branching/parallel timelines (your change spawns a new timeline, leaving your origin intact), a fixed self-consistent timeline (your actions were always part of history), or a mutable timeline with consequences.",
      modelAnswer: "The grandfather paradox asks: what if you go back in time and stop your own grandfather from having children? Then you'd never be born — but if you were never born, you couldn't have gone back to change anything, which is a logical contradiction. One common fix is the branching/multiverse model: the moment you change the past you split off a new, parallel timeline, so 'your' original timeline still exists and there's no contradiction (this is roughly how films like Avengers: Endgame handle it). Other stories use a self-consistent loop where whatever you do was always what happened, so nothing can actually be changed.",
      evaluationGuidance: "Reward a correct statement of the self-defeating loop AND at least one coherent resolution (branching/multiverse, self-consistency/Novikov, or mutable timeline). This is a reasoning question — a fun pop-culture example is a plus, not required." },
    rubric: rubric([{ key: "paradox", label: "States the paradox", weight: 0.5 }, { key: "resolution", label: "One valid resolution", weight: 0.4 }, { key: "clarity", label: "Clarity", weight: 0.1 }]) },
];

// SP3 code — tiny functions (5–15 lines) with interesting twists. orders 4–7.
const CODE_ITEMS = [
  { key: "code-b2-palindrome", kind: "question", questionType: "code", order: 4, points: 10,
    prompt: "Write `isPalindrome(s)` that returns true if the string reads the same forwards and backwards, IGNORING spaces, punctuation, and letter case. Example: 'A man, a plan, a canal: Panama' → true. State your language.",
    answer: { correctAnswer: "Strip to alphanumerics, l-case, then compare the cleaned string to its reverse.",
      modelAnswer: "def isPalindrome(s):\n    cleaned = [c.lower() for c in s if c.isalnum()]\n    return cleaned == cleaned[::-1]",
      evaluationGuidance: "Full credit for correctly ignoring case + non-alphanumerics. Verify: 'A man, a plan, a canal: Panama' -> True; 'race a car' -> False; '' -> True; 'Was it a car or a cat I saw?' -> True. Penalise solutions that compare the raw string without cleaning." },
    rubric: rubric([{ key: "clean", label: "Ignores case + punctuation", weight: 0.5 }, { key: "correct", label: "Correct on examples", weight: 0.3 }, { key: "quality", label: "Readability", weight: 0.2 }]) },
  { key: "code-b2-roman", kind: "question", questionType: "code", order: 5, points: 10,
    prompt: "Write `toRoman(n)` converting an integer from 1 to 3999 into its Roman-numeral string (e.g. 1994 → 'MCMXCIV'). State your language.",
    answer: { correctAnswer: "Greedy subtraction over value→symbol pairs ordered high→low, including the subtractive pairs (900=CM, 400=CD, 90=XC, 40=XL, 9=IX, 4=IV).",
      modelAnswer: "def toRoman(n):\n    vals = [(1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),\n            (50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I')]\n    out = []\n    for v, sym in vals:\n        while n >= v:\n            out.append(sym); n -= v\n    return ''.join(out)",
      evaluationGuidance: "Full credit requires the subtractive forms (IV, IX, XL, XC, CD, CM). Verify: 3 -> 'III'; 4 -> 'IV'; 58 -> 'LVIII'; 1994 -> 'MCMXCIV'; 3999 -> 'MMMCMXCIX'. Penalise solutions that emit 'IIII' for 4." },
    rubric: rubric([{ key: "subtractive", label: "Handles IV/IX/XL/... ", weight: 0.5 }, { key: "correct", label: "Correct on examples", weight: 0.3 }, { key: "quality", label: "Readability", weight: 0.2 }]) },
  { key: "code-b2-caesar", kind: "question", questionType: "code", order: 6, points: 10,
    prompt: "Write `caesarCipher(text, shift)` that shifts each LETTER forward by `shift` positions (wrapping z→a and Z→A) and leaves any non-letter characters unchanged. State your language.",
    answer: { correctAnswer: "For each char: if a letter, map to base ('a'/'A') + (ord - base + shift) mod 26; otherwise keep it.",
      modelAnswer: "def caesarCipher(text, shift):\n    out = []\n    for c in text:\n        if c.isalpha():\n            base = ord('A') if c.isupper() else ord('a')\n            out.append(chr((ord(c) - base + shift) % 26 + base))\n        else:\n            out.append(c)\n    return ''.join(out)",
      evaluationGuidance: "Full credit for correct wrap-around AND preserving case + non-letters. Verify: caesarCipher('abc', 1) -> 'bcd'; caesarCipher('xyz', 3) -> 'abc'; caesarCipher('Hello, World!', 3) -> 'Khoor, Zruog!'. Penalise solutions that mangle spaces/punctuation or don't wrap." },
    rubric: rubric([{ key: "wrap", label: "Wraps z→a correctly", weight: 0.4 }, { key: "preserve", label: "Keeps case + non-letters", weight: 0.4 }, { key: "quality", label: "Readability", weight: 0.2 }]) },
  { key: "code-b2-leap-year", kind: "question", questionType: "code", order: 7, points: 10,
    prompt: "Write `isLeapYear(year)` returning true iff the year is a leap year: divisible by 4, EXCEPT century years, which must also be divisible by 400 (so 2000 is a leap year but 1900 is not). State your language.",
    answer: { correctAnswer: "Return divisible-by-4 AND (not divisible-by-100 OR divisible-by-400).",
      modelAnswer: "def isLeapYear(year):\n    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)",
      evaluationGuidance: "Full credit for the full century rule. Verify: 2024 -> True; 2023 -> False; 1900 -> False; 2000 -> True. Penalise a bare 'year % 4 == 0' that wrongly returns True for 1900." },
    rubric: rubric([{ key: "century", label: "Handles 100/400 rule", weight: 0.6 }, { key: "correct", label: "Correct on examples", weight: 0.2 }, { key: "quality", label: "Readability", weight: 0.2 }]) },
];

// SP4 audio (spoken) — answerable in a 15–30s reply. orders 3–5.
const AUDIO_ITEMS = [
  { key: "audio-b2-astronaut-float", kind: "question", questionType: "audio_response", order: 3, points: 10,
    prompt: "Record a 15–30 second spoken answer: astronauts float inside the Space Station — is it because there's no gravity up there? Explain what's really going on.",
    answer: { correctAnswer: "There IS gravity in orbit (about 90% of Earth's surface value). Astronauts float because the station and everyone in it are in continuous free-fall — falling around the Earth — so there's no support force, i.e. weightlessness, not zero gravity.",
      modelAnswer: "It's a common myth. Gravity at the Space Station's altitude is still about 90% as strong as on the ground. Astronauts float because the station is in constant free-fall — it's falling toward Earth but moving sideways fast enough to keep missing it, i.e. orbiting. Everything falls together at the same rate, so there's no push from a floor: that free-fall is what we feel as weightlessness.",
      evaluationGuidance: "Evaluate the spoken transcript for CONTENT. Reward: correcting the 'no gravity' myth AND explaining free-fall/orbit as the reason for weightlessness. Penalise 'there's no gravity in space' left uncorrected." },
    rubric: rubric([{ key: "myth", label: "Gravity still present", weight: 0.5 }, { key: "freefall", label: "Free-fall / orbit reason", weight: 0.5 }]) },
  { key: "audio-b2-popcorn", kind: "question", questionType: "audio_response", order: 4, points: 10,
    prompt: "Record a ~20 second spoken explanation of why a popcorn kernel POPS when you heat it.",
    answer: { correctAnswer: "Each kernel has a little water inside a hard hull. Heating turns the water to steam, pressure builds until the hull bursts, and the starch inside expands and sets into the fluffy white puff.",
      modelAnswer: "A popcorn kernel holds a bit of moisture inside a tough, sealed shell. As it heats, that water turns to steam and pressure climbs higher and higher because the hard hull traps it. When the pressure gets too great the hull ruptures with a pop, and the hot, gelatinised starch inside rapidly expands and cools into the fluffy white piece you eat.",
      evaluationGuidance: "Evaluate spoken CONTENT. Reward: trapped water → steam → pressure builds → hull bursts → starch expands. Any 2–3 of those steps in order is strong for a 20-second answer." },
    rubric: rubric([{ key: "steam", label: "Water → steam → pressure", weight: 0.6 }, { key: "burst", label: "Hull bursts / starch expands", weight: 0.4 }]) },
  { key: "audio-b2-weather-climate", kind: "question", questionType: "audio_response", order: 5, points: 10,
    prompt: "Record a 20–30 second answer: what's the difference between WEATHER and CLIMATE? Use a simple everyday analogy.",
    answer: { correctAnswer: "Weather is the short-term, day-to-day state of the atmosphere (today's rain or sun); climate is the long-term average pattern over many years. Analogy: weather is a person's mood on a given day, climate is their personality.",
      modelAnswer: "Weather is what's happening in the atmosphere right now or over a few days — today it's rainy, tomorrow sunny. Climate is the long-term average of that weather over decades for a place. A handy analogy: weather is your mood, which changes hour to hour, while climate is your personality — the stable pattern you can count on. So one cold day doesn't disprove a warming climate, just like one bad mood doesn't change who you are.",
      evaluationGuidance: "Evaluate spoken CONTENT. Reward: weather = short-term, climate = long-term average, PLUS a clear analogy (mood vs personality, or similar). Penalise treating the two as the same thing." },
    rubric: rubric([{ key: "distinction", label: "Short-term vs long-term avg", weight: 0.6 }, { key: "analogy", label: "Clear analogy", weight: 0.4 }]) },
];

// SP5 image_evaluation — photograph/sketch in seconds. orders 3–5.
const IMAGE_ITEMS = [
  { key: "image-b2-client-server-db", kind: "question", questionType: "diagram", order: 3, points: 10,
    prompt: "Sketch 3 boxes in a row labelled CLIENT → SERVER → DATABASE and draw an arrow between each. Label each arrow with what travels along it (e.g. 'HTTP request', 'SQL query') and, if you like, the reply arrows too. Photograph or upload your sketch.",
    answer: { correctAnswer: "Three boxes Client, Server, Database left-to-right; arrow Client→Server labelled with a request (e.g. HTTP request), arrow Server→Database labelled with a data query (e.g. SQL query); ideally return arrows for the response/rows.",
      modelAnswer: "Expected: three labelled boxes in order — Client, Server, Database. A forward arrow Client → Server carrying an HTTP/API request, and Server → Database carrying a data query (SQL/read-write). Bonus: return arrows (Database → Server rows/result, Server → Client HTTP response/JSON), showing the round trip.",
      evaluationGuidance: "Evaluate the uploaded image. Reward: all three boxes present and correctly ORDERED, arrows connecting them, and sensible labels on the arrows (a request from client→server, a query from server→db). Bonus for response/return arrows. Penalise a direct Client→Database arrow that skips the server." },
    rubric: rubric([{ key: "boxes", label: "3 boxes, correct order", weight: 0.4 }, { key: "arrows", label: "Arrows between them", weight: 0.25 }, { key: "labels", label: "Sensible arrow labels", weight: 0.35 }]) },
  { key: "image-b2-water-cycle", kind: "question", questionType: "diagram", order: 4, points: 10,
    prompt: "Draw a simple diagram of the WATER CYCLE. Label at least three stages — evaporation, condensation (clouds), and precipitation (rain) — with arrows showing the loop back to the start. A quick hand sketch is perfect; photograph it.",
    answer: { correctAnswer: "A loop: sun heats water → evaporation (up), vapour cools → condensation into clouds, clouds → precipitation (rain/snow) back down, water collects/returns to complete the cycle.",
      modelAnswer: "Expected labelled stages arranged as a loop: (1) Evaporation — water rising from a lake/ocean as the sun heats it; (2) Condensation — vapour cooling to form clouds; (3) Precipitation — rain or snow falling from the clouds; and arrows returning the water to the surface (collection/runoff) so the cycle repeats. Bonus: collection/runoff or transpiration labelled.",
      evaluationGuidance: "Evaluate the uploaded image. Reward: the three core stages present and LABELLED (evaporation, condensation, precipitation) with arrows forming a closed loop. Penalise a straight line with no loop, or missing/one-word-wrong labels." },
    rubric: rubric([{ key: "stages", label: "3 stages labelled", weight: 0.5 }, { key: "loop", label: "Arrows form a loop", weight: 0.3 }, { key: "clarity", label: "Readable", weight: 0.2 }]) },
  { key: "image-b2-fraction-add", kind: "question", questionType: "file_upload", order: 5, points: 10,
    prompt: "On paper, work out the addition of two simple fractions — for example 1/2 + 1/3 — SHOWING the common-denominator step and the final answer. Photograph your handwritten work and upload it.",
    answer: { correctAnswer: "For 1/2 + 1/3: common denominator 6 → 3/6 + 2/6 = 5/6. Any valid pair of unlike fractions with the common-denominator step shown and a correct (reduced) sum earns full marks.",
      modelAnswer: "For 1/2 + 1/3: find a common denominator (LCD = 6), rewrite each fraction — 1/2 = 3/6 and 1/3 = 2/6 — then add the numerators: 3/6 + 2/6 = 5/6, already in lowest terms. The key shown steps are: the common denominator, the converted fractions, and the final reduced answer.",
      evaluationGuidance: "Evaluate the uploaded handwritten image for ANY two unlike fractions the student chose. Reward: a correct common denominator, correctly converted fractions, and a correct final sum (reduced if possible). Penalise the classic error of adding numerators AND denominators (e.g. 1/2 + 1/3 = 2/5)." },
    rubric: rubric([{ key: "lcd", label: "Common denominator shown", weight: 0.4 }, { key: "convert", label: "Fractions converted correctly", weight: 0.3 }, { key: "answer", label: "Correct final sum", weight: 0.3 }]) },
];

// SP6 chat_agent_question — 2–3 turn micro-interviews (min 1–2 / max 3), <2 min. orders 3–5.
const CHAT_ITEMS = [
  { key: "chat-b2-desert-island", kind: "question", questionType: "chat_agent_question", order: 3, points: 10,
    prompt: "Quick fun interview: if you could bring ONE piece of technology to a deserted island, what would it be and why? The interviewer will push you to justify the trade-offs.",
    scenario: "A friendly interviewer poses a light-hearted judgment question: 'You're stranded on a deserted island and can bring exactly ONE piece of technology. What do you pick, and why that over the alternatives?' They will ask one or two quick follow-ups probing your reasoning and trade-offs. Keep it snappy.",
    publicLearningObjectives: [
      { key: "choice", label: "Make a clear choice and justify it" },
      { key: "tradeoffs", label: "Weigh it against alternatives" },
      { key: "comm", label: "Communicate concisely" },
    ],
    conversationStarters: ["Let me pick one and tell you why it beats the obvious alternatives."],
    interviewerAgentKey: "swe-interviewer", evaluatorAgentKey: "swe-evaluator",
    completionPolicy: { minLearnerTurns: 1, maxLearnerTurns: 3, allowEarlyFinish: true },
    answer: { modelAnswer: "There's no single right pick — a strong answer commits to ONE item (e.g. a satellite phone for rescue, or a solar-powered water purifier for survival), gives a clear reason tied to the goal (getting rescued vs staying alive), and acknowledges why it beats a tempting alternative (e.g. a phone is useless without signal/power, so a sat-phone or a survival tool may win).",
      evaluationGuidance: "Score the transcript against the rubric. Credit a decisive choice, a reason connected to a goal, and at least one trade-off vs an alternative. This is light-hearted — reward clear reasoning over 'correctness'. Penalise refusing to choose or pure hand-waving.",
      privateEvaluationObjectives: [
        { key: "scoping", rubricDimensionKey: "scoping", description: "Frames the goal (rescue vs survival) before or while choosing.", evidenceRequirement: "States what they're optimising for." },
        { key: "tradeoffs", rubricDimensionKey: "tradeoffs", description: "Compares the pick against at least one alternative.", evidenceRequirement: "Mentions why an alternative is worse." },
        { key: "communication", rubricDimensionKey: "communication", description: "Concise and clear under follow-ups." },
      ] },
    rubricPresetKey: "rubric-systemdesign" },
  { key: "chat-b2-pizza-estimate", kind: "question", questionType: "chat_agent_question", order: 4, points: 10,
    prompt: "Estimation mini-interview: you're ordering pizza for an office party of 20 people. Roughly how many pizzas should you order? Walk the interviewer through your reasoning — they'll ask a follow-up.",
    scenario: "The interviewer gives a classic estimation warm-up: 'You need to feed 20 people at an office party with pizza. How many pizzas do you order?' They'll probe your assumptions (slices per person, slices per pizza, dietary variety). It should take only a couple of quick turns.",
    publicLearningObjectives: [
      { key: "assume", label: "State assumptions (slices/person, slices/pizza)" },
      { key: "math", label: "Do the rough arithmetic" },
      { key: "adjust", label: "Adjust for real-world factors" },
    ],
    conversationStarters: ["Let me state a couple of assumptions and then do the quick math."],
    interviewerAgentKey: "swe-interviewer", evaluatorAgentKey: "swe-evaluator",
    completionPolicy: { minLearnerTurns: 1, maxLearnerTurns: 3, allowEarlyFinish: true },
    answer: { modelAnswer: "A solid answer states assumptions (~3 slices/person, ~8 slices per large pizza), computes 20 × 3 = 60 slices ÷ 8 ≈ 7–8 pizzas, and adjusts for reality (round up for big eaters, add a veggie/vegan option, maybe order 8). The exact number matters less than the transparent assumption → arithmetic → adjustment reasoning.",
      evaluationGuidance: "Score the transcript. Credit explicit assumptions, correct back-of-envelope arithmetic, and a sensible real-world adjustment (round up, dietary variety). Penalise a bare number with no reasoning.",
      privateEvaluationObjectives: [
        { key: "scoping", rubricDimensionKey: "scoping", description: "States assumptions before computing.", evidenceRequirement: "Gives slices/person and slices/pizza (or similar)." },
        { key: "tradeoffs", rubricDimensionKey: "tradeoffs", description: "Adjusts for real factors (round up, dietary options).", evidenceRequirement: "Mentions at least one adjustment." },
        { key: "communication", rubricDimensionKey: "communication", description: "Explains the reasoning clearly." },
      ] },
    rubricPresetKey: "rubric-systemdesign" },
  { key: "chat-b2-teach-hobby", kind: "question", questionType: "chat_agent_question", order: 5, points: 10,
    prompt: "Communication mini-interview: pick a hobby or topic you love and explain it to the interviewer as if they were a curious 5-year-old. They'll ask one simple follow-up.",
    scenario: "The interviewer says: 'Tell me about a hobby or subject you enjoy — but explain it like you're talking to a curious five-year-old.' They will ask one childlike follow-up question ('but why?') to see if you can keep it simple and clear. Two short turns is plenty.",
    publicLearningObjectives: [
      { key: "simple", label: "Explain simply, no jargon" },
      { key: "analogy", label: "Use a relatable analogy or example" },
      { key: "adapt", label: "Answer the follow-up at the same level" },
    ],
    conversationStarters: ["Okay! Let me explain it in the simplest way I can, with a little example."],
    interviewerAgentKey: "swe-interviewer", evaluatorAgentKey: "swe-evaluator",
    completionPolicy: { minLearnerTurns: 1, maxLearnerTurns: 3, allowEarlyFinish: true },
    answer: { modelAnswer: "A strong answer takes any topic and strips the jargon, using a concrete everyday analogy a child would get (e.g. 'a database is like a big toy box with labelled drawers so you always find your toy'), then handles the 'but why?' follow-up while staying simple and patient. The skill being tested is audience-adapted communication, not the topic itself.",
      evaluationGuidance: "Score the transcript for communication. Credit jargon-free language, a relatable analogy/example, and keeping the follow-up answer at a child's level. Penalise technical jargon, condescension, or losing the simple framing on the follow-up.",
      privateEvaluationObjectives: [
        { key: "communication", rubricDimensionKey: "communication", description: "Uses simple, jargon-free, well-paced language.", evidenceRequirement: "Avoids unexplained technical terms." },
        { key: "structure", rubricDimensionKey: "structure", description: "Builds the explanation with a clear analogy/example.", evidenceRequirement: "Includes a concrete analogy or example." },
        { key: "reflection", rubricDimensionKey: "reflection", description: "Adapts to the childlike follow-up without breaking the simple framing.", evidenceRequirement: "Answers the follow-up at the same level." },
      ] },
    rubricPresetKey: "rubric-behavioral" },
];

const SP_ITEMS = {
  "Rapid-Fire Fundamentals (Short Answer)": TEXT_ITEMS,
  "Explain Like a Senior (Long Answer)": PARAGRAPH_ITEMS,
  "Write the Function (Code)": CODE_ITEMS,
  "Talk Through It (Audio Response)": AUDIO_ITEMS,
  "Show Your Work (Diagram & Handwriting Upload)": IMAGE_ITEMS,
  "The Interview Room (Live Mock Interview)": CHAT_ITEMS,
};

const tenantConfig = {
  key: TENANT_KEY, name: "Subhang Academy (AI Assessment Lab staging)", code: "SUBAILAB",
  agents: AGENTS, rubricPresets: RUBRIC_PRESETS, evaluationSettings: EVAL_SETTINGS,
  spaces: [{
    key: SPACE_KEY, title: "AI Assessment Lab",
    description: "A showcase course where every question is graded by AI. Practise short answers, essays, coding, spoken responses, diagram uploads, and live mock interviews — one story point per AI-evaluated question type.",
    type: "learning", status: "published", subject: "Software Engineering Interview Prep", accessType: "tenant_wide",
    storyPoints: [
      { key: "sp-text", title: "Rapid-Fire Fundamentals (Short Answer)", type: "practice", order: 0, description: "Concise, AI-graded short-answer questions on core CS fundamentals.", items: TEXT_ITEMS },
      { key: "sp-paragraph", title: "Explain Like a Senior (Long Answer)", type: "practice", order: 1, description: "Long-form written explanations graded by AI against a rubric.", items: PARAGRAPH_ITEMS },
      { key: "sp-code", title: "Write the Function (Code)", type: "practice", order: 2, description: "Implement classic interview functions; AI evaluates correctness and complexity.", items: CODE_ITEMS },
      { key: "sp-audio", title: "Talk Through It (Audio Response)", type: "practice", order: 3, description: "Record spoken answers; AI evaluates the transcript content.", items: AUDIO_ITEMS },
      { key: "sp-image", title: "Show Your Work (Diagram & Handwriting Upload)", type: "practice", order: 4, description: "Upload diagrams or handwritten solutions; AI evaluates the image.", items: IMAGE_ITEMS },
      { key: "sp-chat", title: "The Interview Room (Live Mock Interview)", type: "practice", order: 5, description: "Hold a live conversational mock interview with an AI interviewer, scored on a rubric.", items: CHAT_ITEMS },
    ],
  }],
};

const seedConfig = { version: "1.0.0", tenants: [tenantConfig] };

const ROUTES = [
  [/\/answerKeys\/[^/]+$/, "AnswerKeySchema"],
  [/\/storyPoints\/[^/]+\/items\/[^/]+$/, "UnifiedItemSchema"],
  [/\/storyPoints\/[^/]+$/, "StoryPointSchema"],
  [/\/spaces\/[^/]+$/, "SpaceSchema"],
  [/\/agents\/[^/]+$/, "AgentSchema"],
  [/\/rubricPresets\/[^/]+$/, "RubricPresetSchema"],
  [/\/evaluationSettings\/[^/]+$/, "EvaluationSettingsSchema"],
];
const routeSchema = (p) => { for (const [re, n] of ROUTES) if (re.test(p)) return n; return undefined; };
const issues = (r, n = 6) => r.error.issues.slice(0, n).map((i) => `${i.path.join(".") || "<root>"}: ${i.code}${i.message ? ` (${i.message})` : ""}`);

async function main() {
  const synthTid = seedId("tenant", TENANT_KEY);
  console.log(`\n=== AI Assessment Lab BATCH-2 append (${DRY_RUN ? "DRY-RUN" : "COMMIT"}) ===`);
  console.log(`  project=${PROJECT}  real tenant=${REAL_TENANT}  prefix=v2_  space=${SPACE_ID}`);
  console.log(`  synthetic pipeline tenant id=${synthTid}\n`);

  validateSeedConfig(seedConfig);
  assertFkConsistency(seedConfig);
  console.log("  ✓ config validated (schema + FK)\n");

  const ctx = new SeedContext({ projectId: PROJECT, serviceAccountPath: SA_PATH, dryRun: true, logLevel: "error", clockEpochMs: CLOCK_EPOCH_MS });
  const captured = [];
  const origSet = ctx.batch.set.bind(ctx.batch);
  ctx.batch.set = async (ref, data, options) => { captured.push({ path: ref.path, data }); return origSet(ref, data, options); };
  const pipeline = new SeedPipeline(ctx);
  await pipeline.run(seedConfig);
  await ctx.flush();

  const byPath = new Map();
  for (const { path, data } of captured) byPath.set(path, { ...(byPath.get(path) ?? {}), ...data });

  // Transform synthetic tenant id → real, keep ONLY the new item + answerKey docs.
  const synthBase = `v2_tenants/${synthTid}/`;
  const realBase = `v2_tenants/${REAL_TENANT}/`;
  const itemDocs = [], answerKeyDocs = [], spDocsBuilt = [];
  for (const [path, data] of byPath.entries()) {
    if (!path.startsWith(synthBase)) continue;
    const newPath = path.replace(synthBase, realBase);
    const newData = { ...data };
    if (newData.tenantId === synthTid) newData.tenantId = REAL_TENANT;
    if (/\/storyPoints\/[^/]+\/items\/[^/]+$/.test(newPath)) itemDocs.push({ path: newPath, data: newData });
    else if (/\/answerKeys\/[^/]+$/.test(newPath)) answerKeyDocs.push({ path: newPath, data: newData });
    else if (/\/storyPoints\/[^/]+$/.test(newPath)) spDocsBuilt.push({ path: newPath, data: newData });
  }

  // ── Validate new client-facing docs against domain Zod. ──
  const perKind = {}; const failures = [];
  const validate = (docs) => { for (const { path, data } of docs) {
    const name = routeSchema(path); if (!name) { console.log(`  ! unrouted: ${path}`); continue; }
    const rec = (perKind[name] ??= { total: 0, ok: 0 }); rec.total++;
    let parseData = data; if (name === "AnswerKeySchema") { const { tenantId, spaceId, storyPointId, ...rest } = data; parseData = rest; }
    const r = D[name].safeParse(parseData); if (r.success) rec.ok++; else failures.push({ path, name, issues: issues(r) });
  } };
  validate(itemDocs); validate(answerKeyDocs);

  // ── Safety gate: SP ids must match the prod-read ids; new item ids must NOT
  //    collide with any existing item id. ──
  const existingItemIds = new Set(STATE.storyPoints.flatMap((s) => s.items.map((i) => i.id)));
  const prodSpIds = new Set(STATE.storyPoints.map((s) => s.id));
  const spIdByTitle = new Map(STATE.storyPoints.map((s) => [s.title, s.id]));
  const collisions = itemDocs.filter((d) => existingItemIds.has(d.data.id));
  const builtSpIds = spDocsBuilt.map((d) => d.data.id);
  const spMismatch = builtSpIds.filter((id) => !prodSpIds.has(id));

  // ── Plan report ──
  console.log("── PLAN (new docs only) ──");
  console.log(`  new items:       ${itemDocs.length}`);
  console.log(`  new answerKeys:  ${answerKeyDocs.length}`);
  console.log("── new items per story point (title → new count, appended orders) ──");
  const spUpdates = []; // { spId, title, newTotal }
  let spaceNewTotal = STATE.space?.stats?.itemCount ?? STATE.storyPoints.reduce((a, s) => a + s.realItemCount, 0);
  spaceNewTotal = STATE.storyPoints.reduce((a, s) => a + s.realItemCount, 0); // recompute from real counts
  for (const sp of tenantConfig.spaces[0].storyPoints) {
    const st = stateBySpTitle.get(sp.title);
    const newItems = sp.items ?? [];
    const orders = newItems.map((i) => i.order);
    const spId = spIdByTitle.get(sp.title);
    const newTotal = (st?.realItemCount ?? 0) + newItems.length;
    spUpdates.push({ spId, title: sp.title, newTotal, added: newItems.length, existing: st?.realItemCount ?? 0 });
    console.log(`  ${sp.title.padEnd(48)} +${newItems.length}  orders=[${orders.join(",")}]  existing=${st?.realItemCount} → total=${newTotal}`);
  }
  const spaceTotal = spUpdates.reduce((a, u) => a + u.newTotal, 0);
  console.log(`  space stats.itemCount → ${spaceTotal} (was ${STATE.space?.stats?.itemCount ?? "?"})`);

  console.log("── strict validation ──");
  for (const [name, rec] of Object.entries(perKind)) console.log(`  ${name.padEnd(20)} ${rec.ok}/${rec.total} pass`);
  if (failures.length) {
    console.log(`\n  ✗ ${failures.length} VALIDATION FAILURE(S):`);
    for (const f of failures.slice(0, 12)) console.log(`    [${f.name}] ${f.path}\n      ${f.issues.join("\n      ")}`);
    process.exit(1);
  }
  console.log("  ✓ all new docs strict-clean");
  if (spMismatch.length) { console.log(`\n  ✗ story-point id mismatch vs prod: ${spMismatch.join(", ")}`); process.exit(1); }
  console.log("  ✓ story-point ids match existing prod docs");
  if (collisions.length) { console.log(`\n  ✗ NEW ITEM ID COLLISION with existing: ${collisions.map((c) => c.data.id).join(", ")}`); process.exit(1); }
  console.log("  ✓ no new-item id collides with an existing item\n");

  // ── ID MAP ──
  const idMap = { tenantId: REAL_TENANT, spaceId: SPACE_ID, prefix: "v2_", newItemsByType: {}, chatItems: {} };
  const typeOf = { "Rapid-Fire Fundamentals (Short Answer)": "text", "Explain Like a Senior (Long Answer)": "paragraph", "Write the Function (Code)": "code", "Talk Through It (Audio Response)": "audio", "Show Your Work (Diagram & Handwriting Upload)": "image_evaluation", "The Interview Room (Live Mock Interview)": "chat_agent_question" };
  for (const sp of tenantConfig.spaces[0].storyPoints) {
    const t = typeOf[sp.title];
    idMap.newItemsByType[t] = (sp.items ?? []).map((cfgIt) => {
      const doc = itemDocs.find((d) => d.data.content === cfgIt.prompt);
      return { key: cfgIt.key, id: doc?.data.id, order: cfgIt.order };
    });
  }
  for (const it of CHAT_ITEMS) { const doc = itemDocs.find((d) => d.data.content === it.prompt); idMap.chatItems[it.key] = doc?.data.id; }
  console.log("── ID MAP ──"); console.log(JSON.stringify(idMap, null, 2));

  if (DRY_RUN) { console.log("\n(dry-run) no writes performed.\n"); process.exit(0); }

  // ── COMMIT — write ONLY new items + answerKeys; targeted stats.itemCount bumps. ──
  console.log(`\n── COMMITTING ${itemDocs.length} items + ${answerKeyDocs.length} answerKeys ──`);
  const db = ctx.admin.db;
  let batch = db.batch(), n = 0;
  const flushMaybe = async () => { if (n % 400 === 0) { await batch.commit(); batch = db.batch(); } };
  for (const { path, data } of [...itemDocs, ...answerKeyDocs]) { batch.set(db.doc(path), data, { merge: true }); n++; await flushMaybe(); }
  await batch.commit();
  console.log(`  ✓ wrote ${n} new docs (items + answerKeys)`);

  // targeted stats.itemCount updates — leave completionCount & all else intact
  for (const u of spUpdates) {
    await db.doc(`${realBase}spaces/${SPACE_ID}/storyPoints/${u.spId}`).update({ "stats.itemCount": u.newTotal });
    console.log(`  ✓ SP ${u.title} stats.itemCount = ${u.newTotal}`);
  }
  await db.doc(`${realBase}spaces/${SPACE_ID}`).update({ "stats.itemCount": spaceTotal });
  console.log(`  ✓ space stats.itemCount = ${spaceTotal}`);

  console.log("\n── DONE ──"); console.log(JSON.stringify(idMap, null, 2));
  process.exit(0);
}
main().catch((e) => { console.error("SEED FAILED:", e); process.exit(1); });
