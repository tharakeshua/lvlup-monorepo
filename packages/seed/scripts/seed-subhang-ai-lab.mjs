/**
 * Subhang Academy — "AI Assessment Lab" course seed (CONV-CONTENT).
 *
 * Creates ONE new space under tenant_subhang (SUB001, project lvlup-ff6fa) that
 * showcases every AI-evaluatable question type. 6 story points, one per
 * AI_EVALUATABLE_TYPE (text, paragraph, code, audio, image_evaluation,
 * chat_agent_question), 3–4 SWE-interview questions each, with rubrics, answer
 * keys and evaluation config.
 *
 * WHY a bespoke applier (not `pnpm seed`): the seed engine derives the tenant
 * DOC id from the tenant KEY via a hash (`seedId('tenant', key)`), so the vanilla
 * pipeline cannot target the pre-existing real tenant id `tenant_subhang`. This
 * script therefore:
 *   1. Runs the REAL pipeline (canonical.ts SSOT) in dry-run to BUILD every doc
 *      (space / storyPoints / items / answerKeys / agents / rubricPresets) — so
 *      all config→canonical mapping + strict-shape guarantees are reused verbatim.
 *   2. Rewrites ONLY the synthetic tenant-id path segment + `tenantId` field to the
 *      real `tenant_subhang` (all other ids — space/sp/item/agent/rubric — are
 *      tenant-KEY-derived, not tenant-DOC-derived, so they are already stable and
 *      collision-free with the 12 existing spaces).
 *   3. Validates the client-facing docs against the @levelup/domain Zod schemas.
 *   4. Writes into the DEPLOYED, canonical `v2_`-prefixed root that the live
 *      student callables (v1-levelup-listSpaces/getSpace/listStoryPoints/listItems)
 *      actually read (LVLUP_COLLECTION_PREFIX=v2_).
 *
 * It NEVER writes the tenant doc, tenantCode index, users, memberships, classes,
 * or any existing space. Idempotent (stable ids + merge upserts + fixed clock).
 *
 * Usage:
 *   tsx packages/seed/scripts/seed-subhang-ai-lab.mjs --dry-run   # plan + validate, no writes
 *   tsx packages/seed/scripts/seed-subhang-ai-lab.mjs             # COMMIT writes to lvlup-ff6fa v2_
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as D from "@levelup/domain";
import { SeedContext } from "../src/engine/context.js";
import { SeedPipeline } from "../src/engine/pipeline.js";
import { seedId } from "../src/engine/ids.js";
import { validateSeedConfig } from "../src/config/schema.js";
import { assertFkConsistency } from "../src/config/fk.js";

// v2_ is the deployed canonical root the live student callables read/write.
process.env.LVLUP_COLLECTION_PREFIX = "v2_";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");
const SA_PATH = join(REPO_ROOT, "lvlup-ff6fa-firebase-adminsdk-fbsvc-ecf4e4fdb0.json");

const PROJECT = "lvlup-ff6fa";
const REAL_TENANT = "tenant_subhang";
const TENANT_KEY = "subhang-ai-lab"; // synthetic key used only to drive the dry-run pipeline
const SPACE_KEY = "ai-assessment-lab";
// Fixed epoch → deterministic createdAt/updatedAt so re-runs are true no-ops.
const CLOCK_EPOCH_MS = Date.parse("2026-07-19T00:00:00.000Z");

const DRY_RUN = process.argv.includes("--dry-run");

// ─────────────────────────────────────────────────────────────────────────────
// Rubric presets (dimension-based) — the "criteria ids + maxScore" evaluation seam.
// Chat-agent private objectives resolve their rubricDimensionKey against these.
// ─────────────────────────────────────────────────────────────────────────────
const RUBRIC_PRESETS = [
  {
    key: "rubric-systemdesign",
    name: "System Design Interview Rubric",
    category: "general",
    rubric: {
      dimensions: [
        { key: "scoping", label: "Requirements & Scoping", weight: 0.25, promptGuidance: "Clarifies functional/non-functional requirements, scale, and constraints before designing." },
        { key: "tradeoffs", label: "Trade-off Analysis", weight: 0.3, promptGuidance: "Weighs alternatives (storage, consistency, caching) and justifies choices." },
        { key: "scalability", label: "Scalability & Reliability", weight: 0.25, promptGuidance: "Addresses bottlenecks, sharding, replication, failure modes." },
        { key: "communication", label: "Communication", weight: 0.2, promptGuidance: "Structures the answer, thinks aloud, and responds to probing." },
      ],
      totalPoints: 10,
      passingScore: 6,
    },
  },
  {
    key: "rubric-lld",
    name: "Low-Level Design Interview Rubric",
    category: "coding",
    rubric: {
      dimensions: [
        { key: "abstraction", label: "Abstraction & Modeling", weight: 0.3, promptGuidance: "Identifies the right classes, responsibilities, and relationships." },
        { key: "extensibility", label: "Extensibility & SOLID", weight: 0.3, promptGuidance: "Applies SOLID / design patterns so new requirements are cheap to add." },
        { key: "correctness", label: "Correctness", weight: 0.2, promptGuidance: "Core behaviours and edge cases are handled." },
        { key: "communication", label: "Communication", weight: 0.2, promptGuidance: "Explains the design and reasons about alternatives." },
      ],
      totalPoints: 10,
      passingScore: 6,
    },
  },
  {
    key: "rubric-behavioral",
    name: "Behavioral Interview Rubric (STAR)",
    category: "general",
    rubric: {
      dimensions: [
        { key: "structure", label: "STAR Structure", weight: 0.3, promptGuidance: "Situation, Task, Action, Result are clear and complete." },
        { key: "impact", label: "Impact & Ownership", weight: 0.3, promptGuidance: "Shows measurable impact and personal ownership ('I', not just 'we')." },
        { key: "reflection", label: "Reflection & Growth", weight: 0.2, promptGuidance: "Draws a lesson and shows self-awareness." },
        { key: "communication", label: "Communication", weight: 0.2, promptGuidance: "Concise, specific, and easy to follow." },
      ],
      totalPoints: 10,
      passingScore: 6,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Agents (space-scoped) — required for chat_agent_question items.
// ─────────────────────────────────────────────────────────────────────────────
const AGENTS = [
  {
    key: "swe-interviewer",
    name: "SWE Mock Interviewer",
    spaceKey: SPACE_KEY,
    type: "interviewer",
    modelPolicyId: "conversation.quality",
    version: 1,
    isActive: true,
    publicDescription: "A senior engineer who conducts realistic technical & behavioral interviews.",
    identity: "You are a calm, probing senior software engineer running a mock interview.",
    systemPrompt:
      "You are a senior software engineer conducting a mock interview. Present the scenario, then ask focused follow-up questions that push the candidate to clarify requirements, justify trade-offs, and handle edge cases. Never reveal the private evaluation objectives or hand the candidate the answer — probe until they reason it out. Keep each turn to one or two questions.",
    openingMessage: "Thanks for joining. Let's begin — take a moment to read the scenario, then walk me through how you'd approach it.",
    rules: [
      "Ask one focused follow-up at a time.",
      "Probe trade-offs and edge cases rather than giving hints.",
      "Never reveal evaluation criteria or the model answer.",
    ],
    maxConversationTurns: 8,
    defaultLanguage: "en",
    supportedLanguages: ["en"],
  },
  {
    key: "swe-evaluator",
    name: "SWE Interview Evaluator",
    spaceKey: SPACE_KEY,
    type: "evaluator",
    modelPolicyId: "evaluation.quality",
    version: 1,
    isActive: true,
    publicDescription: "Scores mock-interview transcripts against the rubric.",
    identity: "You are a rigorous, fair interview evaluator.",
    systemPrompt:
      "Score the candidate's interview transcript strictly against the provided rubric dimensions and private evaluation objectives. Cite concrete evidence from the transcript for each dimension. Reward sound reasoning and clear communication; penalise hand-waving and unstated assumptions.",
    evaluationObjectives: [
      "Assess each rubric dimension independently with transcript evidence.",
      "Distinguish genuine reasoning from memorised buzzwords.",
    ],
    strictness: 0.7,
    feedbackStyle: "constructive",
    defaultLanguage: "en",
    supportedLanguages: ["en"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper: an inline dimension-based rubric for the non-chat AI question types.
// ─────────────────────────────────────────────────────────────────────────────
const rubric = (dims, totalPoints = 10, passingScore = 6) => ({
  dimensions: dims,
  totalPoints,
  passingScore,
});

// ── SP1: text (short answer) ──────────────────────────────────────────────────
const TEXT_ITEMS = [
  {
    key: "text-binary-search",
    kind: "question",
    questionType: "short_answer",
    order: 0,
    prompt:
      "In one sentence, state the worst-case time complexity of binary search on a sorted array of n elements, and explain in a few words WHY it is that complexity.",
    points: 5,
    answer: {
      correctAnswer: "O(log n) because the search space is halved on every comparison.",
      acceptableAnswers: ["O(log n)", "logarithmic", "log n"],
      modelAnswer:
        "O(log n): each comparison discards half of the remaining search space, so the number of steps grows logarithmically with n.",
      evaluationGuidance:
        "Full credit requires BOTH the correct complexity (O(log n)/logarithmic) AND the halving justification. Half credit for the complexity alone.",
    },
    rubric: rubric([
      { key: "accuracy", label: "Correctness", weight: 0.7, promptGuidance: "States O(log n)." },
      { key: "justification", label: "Justification", weight: 0.3, promptGuidance: "Explains the halving of the search space." },
    ], 5, 3),
  },
  {
    key: "text-process-thread",
    kind: "question",
    questionType: "short_answer",
    order: 1,
    prompt:
      "In one or two sentences, describe the key difference between a process and a thread.",
    points: 5,
    answer: {
      correctAnswer:
        "A process has its own isolated memory/address space, while threads live inside a process and share its memory but each has its own stack.",
      acceptableAnswers: ["threads share memory, processes do not", "shared address space"],
      modelAnswer:
        "A process is an independent program with its own address space and resources; a thread is a unit of execution within a process that shares the process's memory (heap, code) but keeps its own stack and registers.",
      evaluationGuidance:
        "Award full credit if the answer captures memory isolation (process) vs shared memory (threads). Do not require mention of scheduling.",
    },
    rubric: rubric([
      { key: "accuracy", label: "Correctness", weight: 0.8, promptGuidance: "Captures memory isolation vs sharing." },
      { key: "clarity", label: "Clarity", weight: 0.2 },
    ], 5, 3),
  },
  {
    key: "text-acid-durability",
    kind: "question",
    questionType: "short_answer",
    order: 2,
    prompt:
      "ACID has four properties. Name the property that guarantees a committed transaction survives a subsequent power failure or crash, and name one mechanism databases use to provide it.",
    points: 5,
    answer: {
      correctAnswer: "Durability — provided by write-ahead logging (WAL) / a durable commit log flushed to disk.",
      acceptableAnswers: ["Durability", "durability - write ahead log", "WAL"],
      modelAnswer:
        "Durability. Once a transaction commits, its effects persist through crashes. It is typically provided by a write-ahead log (WAL) / redo log flushed (fsync'd) to non-volatile storage before commit is acknowledged.",
      evaluationGuidance:
        "Full credit requires the word 'Durability' PLUS a valid mechanism (WAL / redo log / fsync'd commit log / replication to durable storage). Half credit for 'Durability' alone.",
    },
    rubric: rubric([
      { key: "property", label: "Names Durability", weight: 0.6 },
      { key: "mechanism", label: "Valid mechanism", weight: 0.4, promptGuidance: "WAL/redo log/fsync/replication." },
    ], 5, 3),
  },
  {
    key: "text-hashmap-insert",
    kind: "question",
    questionType: "short_answer",
    order: 3,
    prompt:
      "What is the AVERAGE-case time complexity of inserting a key into a hash map, and what is the WORST case? Answer in one line.",
    points: 5,
    answer: {
      correctAnswer: "Average O(1); worst case O(n) (all keys collide into one bucket / rehash).",
      acceptableAnswers: ["O(1) average, O(n) worst", "amortized O(1)"],
      modelAnswer:
        "Average case O(1) thanks to a good hash distribution and amortised resizing; worst case O(n) when many keys hash to the same bucket (or during a full rehash).",
      evaluationGuidance:
        "Full credit requires BOTH O(1) average AND O(n) worst. Half credit for only the average case.",
    },
    rubric: rubric([
      { key: "average", label: "Average O(1)", weight: 0.5 },
      { key: "worst", label: "Worst O(n)", weight: 0.5 },
    ], 5, 3),
  },
];

// ── SP2: paragraph (long answer) ──────────────────────────────────────────────
const PARAGRAPH_ITEMS = [
  {
    key: "para-hashmap-collisions",
    kind: "question",
    questionType: "long_answer",
    order: 0,
    prompt:
      "Explain how a hash map handles collisions. Compare separate chaining and open addressing, and describe at least one trade-off between them. Aim for 4–8 sentences.",
    points: 10,
    answer: {
      correctAnswer:
        "Collisions occur when two keys hash to the same bucket. Separate chaining stores colliding entries in a per-bucket list (or tree); open addressing probes for the next free slot (linear/quadratic probing, double hashing).",
      modelAnswer:
        "A collision happens when distinct keys map to the same bucket index. Separate chaining keeps a secondary structure (linked list, or a balanced tree once a bucket gets large) at each bucket, so inserts are simple and the table degrades gracefully under high load. Open addressing stores all entries in the array itself and, on collision, probes subsequent slots (linear probing, quadratic probing, or double hashing). Open addressing is more cache-friendly and memory-compact but suffers from clustering and requires careful handling of deletions (tombstones) and a low load factor. Chaining tolerates load factors > 1 and simpler deletion but costs extra pointers/allocations and worse cache locality.",
      evaluationGuidance:
        "Reward: correct definition of a collision; both strategies described; at least one concrete trade-off (cache locality, load factor, deletion complexity, memory). Penalise vague answers that only name the strategies without contrasting them.",
    },
    rubric: rubric([
      { key: "definition", label: "Collision definition", weight: 0.2 },
      { key: "strategies", label: "Both strategies explained", weight: 0.4 },
      { key: "tradeoffs", label: "Concrete trade-off", weight: 0.3 },
      { key: "clarity", label: "Clarity", weight: 0.1 },
    ]),
  },
  {
    key: "para-cap-theorem",
    kind: "question",
    questionType: "long_answer",
    order: 1,
    prompt:
      "State the CAP theorem and explain its practical implication for a distributed database during a network partition. Give a concrete example of a CP system and an AP system.",
    points: 10,
    answer: {
      correctAnswer:
        "CAP: in the presence of a network Partition, a distributed system can guarantee at most one of Consistency or Availability. During a partition you must choose CP (reject/parts unavailable to stay consistent) or AP (stay available, risk stale reads).",
      modelAnswer:
        "The CAP theorem states that a distributed data store can simultaneously provide at most two of Consistency, Availability, and Partition tolerance. Because partitions are unavoidable in real networks, the practical choice during a partition is between Consistency and Availability. A CP system (e.g. HBase, ZooKeeper, etcd, a strongly-consistent Spanner config) refuses or blocks requests on the minority side to avoid divergent state. An AP system (e.g. Cassandra, DynamoDB with eventual consistency, Riak) keeps serving reads/writes on both sides and reconciles later (e.g. via last-write-wins or CRDTs), accepting temporary staleness. The real-world nuance (PACELC) is that even without partitions you trade latency vs consistency.",
      evaluationGuidance:
        "Reward: correct CAP statement; recognition that partition tolerance is mandatory so the trade is C vs A; at least one valid CP and one valid AP example. Bonus for eventual consistency / PACELC nuance.",
    },
    rubric: rubric([
      { key: "statement", label: "Correct CAP statement", weight: 0.35 },
      { key: "implication", label: "Partition implication (C vs A)", weight: 0.35 },
      { key: "examples", label: "Valid CP & AP examples", weight: 0.3 },
    ]),
  },
  {
    key: "para-memory-leak",
    kind: "question",
    questionType: "long_answer",
    order: 2,
    prompt:
      "You are on-call and a production service's memory grows steadily until it is OOM-killed every few hours. Describe, step by step, how you would diagnose and confirm the root cause of the memory leak.",
    points: 10,
    answer: {
      correctAnswer:
        "Confirm the trend with metrics, capture heap snapshots/profiles over time, diff them to find the growing object type, trace retaining references back to the leaking code path, reproduce, and verify the fix by watching memory flatten.",
      modelAnswer:
        "1) Confirm it's a real leak vs. expected caching: look at RSS/heap metrics over time and correlate with traffic and deploys. 2) Reproduce in a lower environment or capture live: enable a heap profiler / take periodic heap dumps (e.g. pprof, jmap/MAT, Chrome/Node --inspect, tracemalloc). 3) Diff two snapshots taken minutes apart to find the object type whose retained size grows unboundedly. 4) Walk the retaining/dominator references to the owning data structure (unbounded cache/map, event-listener registry, connection pool, thread-locals, static collections). 5) Form a hypothesis, correlate with a recent change (git bisect / deploy timeline). 6) Fix (bound the cache with TTL/size, remove listeners, close resources), then verify memory flattens under the same load and add an alert/regression test.",
      evaluationGuidance:
        "Reward a methodical process: confirm via metrics, capture heap snapshots, DIFF over time, trace retaining references, correlate with changes, verify the fix. Penalise 'just restart it' or guessing without measurement.",
    },
    rubric: rubric([
      { key: "confirm", label: "Confirms via metrics", weight: 0.2 },
      { key: "capture", label: "Heap snapshots / profiling", weight: 0.3 },
      { key: "rootcause", label: "Trace retaining refs / diff", weight: 0.3 },
      { key: "verify", label: "Verify fix", weight: 0.2 },
    ]),
  },
  {
    key: "para-optimistic-pessimistic",
    kind: "question",
    questionType: "long_answer",
    order: 3,
    prompt:
      "Explain the difference between optimistic and pessimistic locking. For each, describe a scenario where it is the better choice.",
    points: 10,
    answer: {
      correctAnswer:
        "Pessimistic locking acquires a lock before mutating (blocks others); optimistic locking detects conflicts at commit via a version/timestamp and retries on mismatch. Pessimistic suits high-contention/short critical sections; optimistic suits low-contention/high-read workloads.",
      modelAnswer:
        "Pessimistic locking assumes conflicts are likely: a transaction acquires a lock (row/record) before reading-for-update, so others block until it releases. It prevents lost updates but reduces concurrency and risks deadlocks — good for high-contention hotspots or long critical sections (e.g. decrementing scarce inventory). Optimistic locking assumes conflicts are rare: it reads a version/timestamp, does its work, and at commit checks the version is unchanged (compare-and-set); if it changed, the write is rejected and the caller retries. It maximises concurrency with no locks held — ideal for read-heavy, low-contention systems and stateless web request handlers. The trade-off is wasted work/retries under high contention.",
      evaluationGuidance:
        "Reward: correct mechanism for each (lock-before vs version-check-at-commit); a sensible high-contention scenario for pessimistic and a low-contention/read-heavy scenario for optimistic.",
    },
    rubric: rubric([
      { key: "pessimistic", label: "Pessimistic mechanism + scenario", weight: 0.4 },
      { key: "optimistic", label: "Optimistic mechanism + scenario", weight: 0.4 },
      { key: "clarity", label: "Clarity", weight: 0.2 },
    ]),
  },
];

// ── SP3: code ─────────────────────────────────────────────────────────────────
const CODE_ITEMS = [
  {
    key: "code-linked-list-cycle",
    kind: "question",
    questionType: "code",
    order: 0,
    prompt:
      "Write a function `hasCycle(head)` that returns true if a singly linked list contains a cycle, else false. Target O(n) time and O(1) extra space. You may use any mainstream language (Python/Java/JS/C++); state your language at the top.",
    points: 10,
    answer: {
      correctAnswer:
        "Use Floyd's tortoise-and-hare: advance one pointer by 1 and another by 2; they meet iff there is a cycle.",
      modelAnswer:
        "def hasCycle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow = slow.next\n        fast = fast.next.next\n        if slow is fast:\n            return True\n    return False",
      evaluationGuidance:
        "Full credit for Floyd's two-pointer (O(1) space). Accept a hash-set solution but note it uses O(n) space (max ~8/10). Verify: empty list → False; single node no cycle → False; two-node cycle → True. Penalise solutions that mutate/erase the list or infinite-loop on acyclic input.",
    },
    rubric: rubric([
      { key: "correctness", label: "Correct on all cases", weight: 0.5, promptGuidance: "empty, single, cyclic, acyclic." },
      { key: "complexity", label: "O(n) time / O(1) space", weight: 0.3 },
      { key: "quality", label: "Readability", weight: 0.2 },
    ]),
  },
  {
    key: "code-two-sum",
    kind: "question",
    questionType: "code",
    order: 1,
    prompt:
      "Write `twoSum(nums, target)` returning the indices of the two numbers that add up to `target` (exactly one solution; you may not reuse the same element). Aim for O(n). State your language.",
    points: 10,
    answer: {
      correctAnswer:
        "Single pass with a hash map from value → index; for each x check if (target - x) was already seen.",
      modelAnswer:
        "def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i\n    return []",
      evaluationGuidance:
        "Full credit for the O(n) hash-map pass. O(n^2) brute force is correct but max ~7/10 (note complexity). Verify: nums=[2,7,11,15], target=9 → [0,1]; nums=[3,3], target=6 → [0,1] (must not reuse an index).",
    },
    rubric: rubric([
      { key: "correctness", label: "Correct indices", weight: 0.5 },
      { key: "complexity", label: "O(n) approach", weight: 0.3 },
      { key: "quality", label: "Readability", weight: 0.2 },
    ]),
  },
  {
    key: "code-valid-parentheses",
    kind: "question",
    questionType: "code",
    order: 2,
    prompt:
      "Write `isValid(s)` that returns true iff a string containing only the characters ()[]{} is correctly balanced and properly nested. State your language.",
    points: 10,
    answer: {
      correctAnswer:
        "Push opening brackets on a stack; on a closing bracket, pop and confirm it matches the expected opener. Valid iff every close matches and the stack is empty at the end.",
      modelAnswer:
        "def isValid(s):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for c in s:\n        if c in '([{':\n            stack.append(c)\n        else:\n            if not stack or stack.pop() != pairs[c]:\n                return False\n    return not stack",
      evaluationGuidance:
        "Full credit for a correct stack solution. Verify: '()[]{}' → True; '(]' → False; '([)]' → False; '' → True; '(' → False. Penalise counting-only solutions that ignore nesting order.",
    },
    rubric: rubric([
      { key: "correctness", label: "Handles nesting + edge cases", weight: 0.6 },
      { key: "approach", label: "Uses a stack", weight: 0.2 },
      { key: "quality", label: "Readability", weight: 0.2 },
    ]),
  },
  {
    key: "code-lru-cache",
    kind: "question",
    questionType: "code",
    order: 3,
    prompt:
      "Design an LRU cache class with `get(key)` and `put(key, value)` both in O(1) average time, evicting the least-recently-used entry when capacity is exceeded. Sketch the data structures and implement the two methods. State your language.",
    points: 10,
    answer: {
      correctAnswer:
        "Hash map (key → node) + doubly linked list ordered by recency. get/put move the node to the front; put evicts the tail when over capacity. (In Python, collections.OrderedDict / move_to_end gives O(1).)",
      modelAnswer:
        "from collections import OrderedDict\nclass LRUCache:\n    def __init__(self, capacity):\n        self.cap = capacity\n        self.d = OrderedDict()\n    def get(self, key):\n        if key not in self.d:\n            return -1\n        self.d.move_to_end(key)\n        return self.d[key]\n    def put(self, key, value):\n        if key in self.d:\n            self.d.move_to_end(key)\n        self.d[key] = value\n        if len(self.d) > self.cap:\n            self.d.popitem(last=False)",
      evaluationGuidance:
        "Full credit requires O(1) get AND put — hashmap + doubly-linked-list (or OrderedDict). Verify: capacity 2, put(1,1),put(2,2),get(1)=1,put(3,3) evicts key 2, get(2)=-1. Penalise O(n) eviction scans.",
    },
    rubric: rubric([
      { key: "structures", label: "Hashmap + DLL (O(1))", weight: 0.4 },
      { key: "correctness", label: "Correct eviction + updates", weight: 0.4 },
      { key: "quality", label: "Readability", weight: 0.2 },
    ]),
  },
];

// ── SP4: audio (spoken response) ──────────────────────────────────────────────
const AUDIO_ITEMS = [
  {
    key: "audio-url-shortener",
    kind: "question",
    questionType: "audio_response",
    order: 0,
    prompt:
      "Record a 2–3 minute spoken walkthrough: how would you design a URL shortener (like bit.ly)? Talk through the API, how you generate short codes, the storage schema, and how you'd handle very high read traffic. Think out loud as you would in a real interview.",
    points: 10,
    answer: {
      correctAnswer:
        "A strong spoken answer covers: write API (POST long URL → short code) and read/redirect path; short-code generation (base62 of an auto-increment id, or a hash with collision handling); a key-value store mapping code → long URL; heavy caching (CDN/edge + in-memory) for the read-dominant redirect path; and analytics/expiry as extensions.",
      modelAnswer:
        "Requirements: shorten a long URL to a short code and redirect on lookup; read-heavy (~100:1). API: POST /shorten {url} → {code}; GET /{code} → 301/302. Code generation: base62 encode a globally-unique auto-increment id (7 chars ≈ 3.5T URLs) or hash+truncate with collision retry. Storage: a KV/NoSQL table code→{url, createdAt, expiry, owner}; the id counter can be sharded (e.g. per-host ranges) to avoid a hotspot. Reads: cache aggressively (in-memory LRU + CDN) since redirects dominate; the store is the source of truth. Scale: stateless app tier behind a load balancer, replicated/sharded store, and optional async analytics on redirects. Extensions: custom aliases, rate limiting, expiry, and abuse detection.",
      evaluationGuidance:
        "Since this is spoken (audio transcript), evaluate CONTENT not delivery polish. Reward: clear API, a sound code-generation scheme, a suitable storage model, and a caching strategy for read-heavy traffic. Bonus for discussing collisions, sharding the id counter, or analytics.",
    },
    rubric: rubric([
      { key: "api", label: "API & flow", weight: 0.2 },
      { key: "codegen", label: "Short-code generation", weight: 0.3 },
      { key: "storage", label: "Storage model", weight: 0.2 },
      { key: "scale", label: "Caching / scale", weight: 0.3 },
    ]),
  },
  {
    key: "audio-explain-recursion",
    kind: "question",
    questionType: "audio_response",
    order: 1,
    prompt:
      "Record a 60–90 second explanation of RECURSION as if you were explaining it to a smart non-technical stakeholder. Use an analogy, and mention the base case. Clarity of communication is what matters here.",
    points: 10,
    answer: {
      correctAnswer:
        "Recursion is when something is defined in terms of a smaller version of itself, with a base case that stops the process (e.g. Russian nesting dolls, or standing-in-line asking the person ahead).",
      modelAnswer:
        "Recursion is solving a problem by having it call a smaller copy of itself until it reaches a case simple enough to answer directly. Analogy: Russian nesting dolls — to count them you open one, count the dolls inside (a smaller version of the same task), and stop when you reach the solid doll with nothing inside (the base case). Without a base case it would go forever, like a hall of mirrors. Software uses it to break big problems (searching a folder tree, sorting) into identical smaller problems.",
      evaluationGuidance:
        "Evaluate spoken CONTENT for a general audience. Reward: a correct plain-language definition, a concrete analogy, and mention of the base case / stopping condition. Penalise jargon-heavy or circular explanations.",
    },
    rubric: rubric([
      { key: "correctness", label: "Correct concept", weight: 0.4 },
      { key: "analogy", label: "Effective analogy", weight: 0.3 },
      { key: "basecase", label: "Mentions base case", weight: 0.3 },
    ]),
  },
  {
    key: "audio-disagreement",
    kind: "question",
    questionType: "audio_response",
    order: 2,
    prompt:
      "Behavioral (spoken): Record a 2–3 minute answer to 'Tell me about a time you disagreed with a technical decision. What did you do and what was the outcome?' Use the STAR structure (Situation, Task, Action, Result).",
    points: 10,
    answer: {
      correctAnswer:
        "A concrete STAR story: the situation and the decision disagreed with, the speaker's specific actions (data, respectful escalation, prototype), and a measurable outcome plus a reflection.",
      modelAnswer:
        "A strong answer names a specific situation (e.g. team chose to hand-roll auth), the task/stake (security + timeline risk), the speaker's ACTIONS (raised concerns with data, built a small proof-of-concept comparing options, escalated respectfully to the lead), and a RESULT (adopted a vetted library, shipped on time, fewer incidents) with a brief reflection on what they'd do again. It shows disagreement handled professionally and backed by evidence — not stubbornness.",
      evaluationGuidance:
        "Evaluate the spoken transcript for STAR completeness and professionalism. Reward: clear Situation/Task, specific personal Actions (first person), a concrete Result, and evidence-based, respectful disagreement. Penalise blaming others or a vague, structureless story.",
    },
    rubricPresetKey: "rubric-behavioral",
  },
];

// ── SP5: image_evaluation (diagram / handwritten upload) ──────────────────────
const IMAGE_ITEMS = [
  {
    key: "image-rate-limiter",
    kind: "question",
    questionType: "diagram",
    order: 0,
    prompt:
      "Upload a single image of an ARCHITECTURE DIAGRAM for a distributed API rate limiter. It should show: the client → gateway/service path, where the limit is enforced, the shared counter store (e.g. Redis), and which algorithm you use (token bucket / sliding window). Hand-drawn or digital is fine.",
    points: 10,
    answer: {
      correctAnswer:
        "A correct diagram shows clients hitting an API gateway/middleware that checks and decrements a counter in a shared low-latency store (e.g. Redis) keyed by client/API key, using token-bucket or sliding-window, allowing or 429-rejecting the request.",
      modelAnswer:
        "Expected elements: (1) client(s) → load balancer → API gateway / rate-limit middleware; (2) the enforcement point BEFORE the backend service; (3) a shared, low-latency counter store (Redis/Memcached) so limits are global across instances, keyed by user/API key/IP; (4) a named algorithm (token bucket, leaky bucket, or sliding-window log/counter); (5) the allow path vs the reject path returning HTTP 429 with Retry-After. Bonus: atomic increment/Lua script to avoid races, and per-tier limits.",
      evaluationGuidance:
        "Evaluate the uploaded image. Reward diagrams that include: the enforcement point in the request path, a SHARED counter store (so it works across instances), a named algorithm, and an allow-vs-reject (429) path. Penalise a purely per-instance in-memory counter (fails when horizontally scaled) or a missing store.",
    },
    rubric: rubric([
      { key: "enforcement", label: "Enforcement in request path", weight: 0.25 },
      { key: "store", label: "Shared counter store", weight: 0.3 },
      { key: "algorithm", label: "Named algorithm", weight: 0.25 },
      { key: "paths", label: "Allow vs 429 reject", weight: 0.2 },
    ]),
  },
  {
    key: "image-mergesort-derivation",
    kind: "question",
    questionType: "file_upload",
    order: 1,
    prompt:
      "Upload a photo of your HANDWRITTEN work deriving the time complexity of merge sort. Write the recurrence relation T(n) = 2T(n/2) + O(n), show the recursion-tree or Master-Theorem reasoning, and conclude with the Big-O result.",
    points: 10,
    answer: {
      correctAnswer:
        "T(n) = 2T(n/2) + cn. There are log2(n) levels, each doing O(n) merging work, so T(n) = O(n log n). (Master theorem case 2: a=2, b=2, f(n)=n ⇒ n^log_b(a)=n ⇒ Θ(n log n).)",
      modelAnswer:
        "Recurrence: T(n) = 2·T(n/2) + cn (two halves + linear merge). Recursion tree: each level's merge work sums to cn, and the tree has log2(n) + 1 levels (halving until size 1), so total = cn·log2(n) = Θ(n log n). By the Master Theorem with a=2, b=2, f(n)=Θ(n): since n^{log_b a}=n^1=n matches f(n), we are in case 2 ⇒ T(n)=Θ(n log n). Space is O(n) for the merge buffer.",
      evaluationGuidance:
        "Evaluate the uploaded handwritten image. Reward: the correct recurrence T(n)=2T(n/2)+O(n); a valid derivation (recursion tree with log n levels × O(n) per level, OR correct Master-Theorem application); and the correct conclusion O(n log n). Penalise a bare 'O(n log n)' with no derivation, or an incorrect recurrence.",
    },
    rubric: rubric([
      { key: "recurrence", label: "Correct recurrence", weight: 0.3 },
      { key: "derivation", label: "Valid derivation", weight: 0.4 },
      { key: "result", label: "Concludes O(n log n)", weight: 0.3 },
    ]),
  },
  {
    key: "image-er-diagram",
    kind: "question",
    questionType: "diagram",
    order: 2,
    prompt:
      "Upload an image of an ENTITY-RELATIONSHIP (ER) diagram for a simple library management system. Model at least: Member, Book, BookCopy (physical copies), and Loan. Show primary keys, the relationships, and cardinalities (e.g. one Book has many BookCopies; a Member can have many Loans).",
    points: 10,
    answer: {
      correctAnswer:
        "Entities: Member(id), Book(id, ISBN, title), BookCopy(id, book_id→Book, status), Loan(id, copy_id→BookCopy, member_id→Member, borrowed_at, due_at, returned_at). Book 1—N BookCopy; Member 1—N Loan; BookCopy 1—N Loan (over time).",
      modelAnswer:
        "A correct ER diagram distinguishes the abstract Book (title/ISBN/author) from its physical BookCopy instances. Expected: Member(member_id PK); Book(book_id PK, isbn, title); BookCopy(copy_id PK, book_id FK→Book, status); Loan(loan_id PK, copy_id FK→BookCopy, member_id FK→Member, borrowed_at, due_at, returned_at). Cardinalities: Book (1)—(N) BookCopy; Member (1)—(N) Loan; BookCopy (1)—(N) Loan across time. Bonus: Author/Category tables, a reservation entity.",
      evaluationGuidance:
        "Evaluate the uploaded ER diagram. Reward: the four core entities with primary keys; the crucial Book-vs-BookCopy separation; foreign keys on Loan to both BookCopy and Member; and sensible cardinalities. Penalise conflating Book and BookCopy, or missing the Loan join between members and copies.",
    },
    rubric: rubric([
      { key: "entities", label: "Core entities + PKs", weight: 0.3 },
      { key: "bookcopy", label: "Book vs BookCopy separation", weight: 0.25 },
      { key: "relationships", label: "FKs / relationships", weight: 0.25 },
      { key: "cardinality", label: "Correct cardinalities", weight: 0.2 },
    ]),
  },
];

// ── SP6: chat_agent_question (conversational assessment) ──────────────────────
const CHAT_ITEMS = [
  {
    key: "chat-news-feed",
    kind: "question",
    questionType: "chat_agent_question",
    order: 0,
    prompt:
      "System design interview: design a social media news feed. The interviewer will probe your approach — clarify requirements, then discuss the feed generation strategy and how it scales.",
    scenario:
      "You're interviewing for a senior backend role. The interviewer asks you to design the news feed for a social app with 100M daily active users. They will push on fan-out strategy, storage, and how the design behaves for celebrity accounts.",
    publicLearningObjectives: [
      { key: "scoping", label: "Clarify requirements and scale before designing" },
      { key: "feedgen", label: "Reason about fan-out-on-write vs fan-out-on-read" },
      { key: "scale", label: "Handle hot-spots (celebrity fan-out) and caching" },
    ],
    conversationStarters: [
      "Before I design, can I confirm a few requirements about scale and what goes in the feed?",
    ],
    interviewerAgentKey: "swe-interviewer",
    evaluatorAgentKey: "swe-evaluator",
    completionPolicy: { minLearnerTurns: 3, maxLearnerTurns: 6, allowEarlyFinish: true },
    answer: {
      modelAnswer:
        "Strong candidates clarify requirements (read/write ratio, ordering, media), then compare fan-out-on-write (precompute each user's feed — fast reads, expensive for celebrities) vs fan-out-on-read (assemble at query time — cheap writes, slower reads), and land on a HYBRID: fan-out-on-write for normal users, fan-out-on-read (pull) for celebrity/high-follower accounts, with heavy caching and pagination.",
      evaluationGuidance:
        "Score against the rubric using the transcript. Credit clarifying questions, the write-vs-read fan-out trade-off, the celebrity hot-spot problem, and caching/pagination. Penalise jumping to a design without requirements or ignoring the celebrity fan-out issue.",
      privateEvaluationObjectives: [
        { key: "scoping", rubricDimensionKey: "scoping", description: "Asks about scale, read/write ratio, ordering, and feed contents before designing.", evidenceRequirement: "At least one clarifying question about requirements or scale." },
        { key: "tradeoffs", rubricDimensionKey: "tradeoffs", description: "Compares fan-out-on-write vs fan-out-on-read and justifies a choice.", evidenceRequirement: "Names both strategies and a trade-off." },
        { key: "scalability", rubricDimensionKey: "scalability", description: "Addresses the celebrity/hot-key fan-out problem and caching.", evidenceRequirement: "Mentions the high-follower edge case or a hybrid/pull approach." },
        { key: "communication", rubricDimensionKey: "communication", description: "Structures the design and responds to probing.", },
      ],
    },
    rubricPresetKey: "rubric-systemdesign",
  },
  {
    key: "chat-parking-lot",
    kind: "question",
    questionType: "chat_agent_question",
    order: 1,
    prompt:
      "Low-level design interview: design the classes for a parking lot system. The interviewer will probe your object model and how it extends to new requirements.",
    scenario:
      "The interviewer asks you to design a parking lot supporting multiple vehicle sizes (motorcycle, car, bus) and multiple spot types, issuing tickets and computing fees. They will ask how you'd add electric-charging spots later without rewriting everything.",
    publicLearningObjectives: [
      { key: "model", label: "Identify the right classes and responsibilities" },
      { key: "extend", label: "Design for extensibility (new spot/vehicle types)" },
      { key: "behavior", label: "Handle core behaviours: assign spot, issue ticket, compute fee" },
    ],
    conversationStarters: [
      "Let me start with the core entities — ParkingLot, Level, ParkingSpot, Vehicle, and Ticket — and I'll ask about fee rules as I go.",
    ],
    interviewerAgentKey: "swe-interviewer",
    evaluatorAgentKey: "swe-evaluator",
    completionPolicy: { minLearnerTurns: 3, maxLearnerTurns: 6, allowEarlyFinish: true },
    answer: {
      modelAnswer:
        "Strong answers model ParkingLot → Levels → ParkingSpots (with a SpotType/size), a Vehicle hierarchy, and Ticket/Payment. Spot assignment uses a strategy per vehicle size. Extensibility comes from polymorphism/strategy + open-closed: adding an ELECTRIC spot type or a new fee strategy should not modify existing classes.",
      evaluationGuidance:
        "Score from the transcript. Credit a clean class model with clear responsibilities, use of enums/polymorphism/strategy for spot & vehicle types, and an extensibility story (open-closed) for the electric-charging follow-up. Penalise a god-class or hard-coded conditionals that must be edited for every new type.",
      privateEvaluationObjectives: [
        { key: "model", rubricDimensionKey: "abstraction", description: "Defines ParkingLot/Level/Spot/Vehicle/Ticket with clear responsibilities.", evidenceRequirement: "Names the core classes and their roles." },
        { key: "extend", rubricDimensionKey: "extensibility", description: "Uses polymorphism/strategy + open-closed so new spot/vehicle types are additive.", evidenceRequirement: "Explains adding electric spots without editing existing classes." },
        { key: "behavior", rubricDimensionKey: "correctness", description: "Covers assign-spot, issue-ticket, and fee computation.", evidenceRequirement: "Describes the main flows." },
        { key: "communication", rubricDimensionKey: "communication", description: "Explains and defends the design.", },
      ],
    },
    rubricPresetKey: "rubric-lld",
  },
  {
    key: "chat-conflict-behavioral",
    kind: "question",
    questionType: "chat_agent_question",
    order: 2,
    prompt:
      "Behavioral interview: the interviewer will ask you about a time you had a conflict with a coworker. Answer conversationally; they will follow up for specifics.",
    scenario:
      "A hiring-manager-style interviewer asks: 'Tell me about a conflict you had with a teammate and how you resolved it.' They will probe for what YOU specifically did and what the outcome was.",
    publicLearningObjectives: [
      { key: "star", label: "Answer with STAR structure" },
      { key: "ownership", label: "Show personal ownership and impact" },
      { key: "growth", label: "Reflect on what you learned" },
    ],
    conversationStarters: [
      "Sure — let me set the situation first, then walk you through what I did.",
    ],
    interviewerAgentKey: "swe-interviewer",
    evaluatorAgentKey: "swe-evaluator",
    completionPolicy: { minLearnerTurns: 2, maxLearnerTurns: 5, allowEarlyFinish: true },
    answer: {
      modelAnswer:
        "A strong answer follows STAR: a specific Situation and the conflict, the candidate's own Actions (listening to understand, using data, finding common ground), and a concrete Result plus a lesson. It demonstrates empathy and ownership rather than blame.",
      evaluationGuidance:
        "Score the transcript against the STAR rubric. Credit a specific situation, first-person actions, a concrete result, and a reflection. Penalise blaming the coworker, vagueness, or a story with no resolution.",
      privateEvaluationObjectives: [
        { key: "star", rubricDimensionKey: "structure", description: "Gives Situation, Task, Action, and Result clearly.", evidenceRequirement: "All four STAR elements are present." },
        { key: "ownership", rubricDimensionKey: "impact", description: "Shows first-person ownership and a concrete outcome.", evidenceRequirement: "Uses 'I' and states a measurable/observable result." },
        { key: "growth", rubricDimensionKey: "reflection", description: "Reflects on a lesson learned.", evidenceRequirement: "States what they'd do again or differently." },
        { key: "communication", rubricDimensionKey: "communication", description: "Concise and specific.", },
      ],
    },
    rubricPresetKey: "rubric-behavioral",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Assemble the tenant config (drives the dry-run pipeline).
// ─────────────────────────────────────────────────────────────────────────────
// evaluationSettings — REQUIRED for chat_agent_question assessment START:
// resolveEvaluator() throws PRECONDITION_FAILED unless space.evaluationSettingsId
// is set AND tenants/{t}/evaluationSettings/{id} exists (packages/services/src/
// conversation/context-builder.ts resolveEvaluator, lines 418-420).
const EVAL_SETTINGS = [
  {
    key: "ai-assessment-default",
    name: "AI Assessment Defaults",
    isDefault: true,
    rubricPresetKey: "rubric-systemdesign", // seeds enabledDimensions
    confidenceConfig: { lowThreshold: 0.6, highThreshold: 0.85 },
  },
];

const tenantConfig = {
  key: TENANT_KEY,
  name: "Subhang Academy (AI Assessment Lab staging)",
  code: "SUBAILAB", // never written to prod — only the dry-run tenant doc uses it
  agents: AGENTS,
  rubricPresets: RUBRIC_PRESETS,
  evaluationSettings: EVAL_SETTINGS,
  spaces: [
    {
      key: SPACE_KEY,
      title: "AI Assessment Lab",
      description:
        "A showcase course where every question is graded by AI. Practise short answers, essays, coding, spoken responses, diagram uploads, and live mock interviews — one story point per AI-evaluated question type.",
      type: "learning",
      status: "published",
      subject: "Software Engineering Interview Prep",
      accessType: "tenant_wide",
      storyPoints: [
        { key: "sp-text", title: "Rapid-Fire Fundamentals (Short Answer)", type: "practice", order: 0, description: "Concise, AI-graded short-answer questions on core CS fundamentals.", items: TEXT_ITEMS },
        { key: "sp-paragraph", title: "Explain Like a Senior (Long Answer)", type: "practice", order: 1, description: "Long-form written explanations graded by AI against a rubric.", items: PARAGRAPH_ITEMS },
        { key: "sp-code", title: "Write the Function (Code)", type: "practice", order: 2, description: "Implement classic interview functions; AI evaluates correctness and complexity.", items: CODE_ITEMS },
        { key: "sp-audio", title: "Talk Through It (Audio Response)", type: "practice", order: 3, description: "Record spoken answers; AI evaluates the transcript content.", items: AUDIO_ITEMS },
        { key: "sp-image", title: "Show Your Work (Diagram & Handwriting Upload)", type: "practice", order: 4, description: "Upload diagrams or handwritten solutions; AI evaluates the image.", items: IMAGE_ITEMS },
        { key: "sp-chat", title: "The Interview Room (Live Mock Interview)", type: "practice", order: 5, description: "Hold a live conversational mock interview with an AI interviewer, scored on a rubric.", items: CHAT_ITEMS },
      ],
    },
  ],
};

const seedConfig = { version: "1.0.0", tenants: [tenantConfig] };

// ─────────────────────────────────────────────────────────────────────────────
// path → domain schema router (mirrors packages/seed/scripts/audit-u4-2.mjs).
// ─────────────────────────────────────────────────────────────────────────────
const ROUTES = [
  [/\/answerKeys\/[^/]+$/, "AnswerKeySchema"],
  [/\/storyPoints\/[^/]+\/items\/[^/]+$/, "UnifiedItemSchema"],
  [/\/storyPoints\/[^/]+$/, "StoryPointSchema"],
  [/\/spaces\/[^/]+$/, "SpaceSchema"],
  [/\/agents\/[^/]+$/, "AgentSchema"],
  [/\/rubricPresets\/[^/]+$/, "RubricPresetSchema"],
  [/\/evaluationSettings\/[^/]+$/, "EvaluationSettingsSchema"],
];
const routeSchema = (path) => {
  for (const [re, name] of ROUTES) if (re.test(path)) return name;
  return undefined;
};
const issues = (r, n = 6) =>
  r.error.issues.slice(0, n).map((i) => `${i.path.join(".") || "<root>"}: ${i.code}${i.message ? ` (${i.message})` : ""}`);

async function main() {
  const synthTid = seedId("tenant", TENANT_KEY);
  console.log(`\n=== AI Assessment Lab seed (${DRY_RUN ? "DRY-RUN" : "COMMIT"}) ===`);
  console.log(`  project=${PROJECT}  real tenant=${REAL_TENANT}  prefix=v2_`);
  console.log(`  synthetic pipeline tenant id=${synthTid}\n`);

  // 0) Validate the config (input-shape + cross-fragment FK, incl. chat_agent invariants).
  validateSeedConfig(seedConfig);
  assertFkConsistency(seedConfig);
  console.log("  ✓ config validated (schema + FK)\n");

  // 1) Build every doc via the REAL pipeline in dry-run; capture batch.set payloads.
  const ctx = new SeedContext({
    projectId: PROJECT,
    serviceAccountPath: SA_PATH,
    dryRun: true,
    logLevel: "error",
    clockEpochMs: CLOCK_EPOCH_MS,
  });
  const captured = [];
  const origSet = ctx.batch.set.bind(ctx.batch);
  ctx.batch.set = async (ref, data, options) => {
    captured.push({ path: ref.path, data });
    return origSet(ref, data, options);
  };
  const pipeline = new SeedPipeline(ctx);
  await pipeline.run(seedConfig);
  await ctx.flush();

  // Collapse merge sets by path (last-write-merge), like Firestore.
  const byPath = new Map();
  for (const { path, data } of captured) byPath.set(path, { ...(byPath.get(path) ?? {}), ...data });

  // 2) Filter to the new-course subtree and transform synthetic tenant id → real.
  const SKIP = [
    new RegExp(`^v2_tenants/${synthTid}$`),
    /^v2_tenantCodes\//,
    /^v2_users\//,
    /^v2_userMemberships\//,
  ];
  const writeDocs = [];
  for (const [path, data] of byPath.entries()) {
    if (SKIP.some((re) => re.test(path))) continue;
    if (!path.startsWith(`v2_tenants/${synthTid}/`)) {
      console.log(`  ! unexpected path (skipped): ${path}`);
      continue;
    }
    const newPath = path.replace(`v2_tenants/${synthTid}/`, `v2_tenants/${REAL_TENANT}/`);
    const newData = { ...data };
    if (newData.tenantId === synthTid) newData.tenantId = REAL_TENANT;
    writeDocs.push({ path: newPath, data: newData });
  }

  // 2b) Wire the space → evaluationSettings link (required for assessment START).
  const evalDoc = writeDocs.find((d) => /\/evaluationSettings\/[^/]+$/.test(d.path));
  const evalSettingsId = evalDoc?.data.id;
  const spaceLinkDoc = writeDocs.find((d) => /\/spaces\/[^/]+$/.test(d.path));
  if (!evalSettingsId || !spaceLinkDoc) {
    console.log("  ✗ missing evaluationSettings doc or space doc — cannot wire assessment link");
    process.exit(1);
  }
  spaceLinkDoc.data.evaluationSettingsId = evalSettingsId;
  console.log(`  ✓ space.evaluationSettingsId = ${evalSettingsId}`);

  // 3) Validate client-facing docs against domain Zod. AnswerKey write-shape carries
  //    server-only {tenantId, spaceId, storyPointId} beyond the read entity schema —
  //    validate its canonical subset (these fields are required by repos.answerKeys.put).
  const perKind = {};
  const failures = [];
  for (const { path, data } of writeDocs) {
    const name = routeSchema(path);
    if (!name) {
      console.log(`  ! unrouted (not validated): ${path}`);
      continue;
    }
    const schema = D[name];
    const rec = (perKind[name] ??= { total: 0, ok: 0 });
    rec.total++;
    let parseData = data;
    if (name === "AnswerKeySchema") {
      const { tenantId, spaceId, storyPointId, ...rest } = data;
      parseData = rest;
    }
    const r = schema.safeParse(parseData);
    if (r.success) rec.ok++;
    else failures.push({ path, name, issues: issues(r) });
  }

  // ── Plan report ──
  const spaceDoc = writeDocs.find((d) => /\/spaces\/[^/]+$/.test(d.path));
  const spaceId = spaceDoc?.data.id;
  const storyPointDocs = writeDocs.filter((d) => /\/spaces\/[^/]+\/storyPoints\/[^/]+$/.test(d.path));
  const itemDocs = writeDocs.filter((d) => /\/items\/[^/]+$/.test(d.path));
  const answerKeyDocs = writeDocs.filter((d) => /\/answerKeys\/[^/]+$/.test(d.path));
  const agentDocs = writeDocs.filter((d) => /\/agents\/[^/]+$/.test(d.path));
  const rubricDocs = writeDocs.filter((d) => /\/rubricPresets\/[^/]+$/.test(d.path));

  console.log("── PLAN ──");
  console.log(`  space:          ${spaceId}`);
  console.log(`  storyPoints:    ${storyPointDocs.length} (nested)`);
  console.log(`  items:          ${itemDocs.length}`);
  console.log(`  answerKeys:     ${answerKeyDocs.length}`);
  console.log(`  agents:         ${agentDocs.length}`);
  console.log(`  rubricPresets:  ${rubricDocs.length}`);
  console.log(`  total docs to write: ${writeDocs.length}`);
  console.log("── per-storypoint item counts ──");
  for (const sp of tenantConfig.spaces[0].storyPoints) {
    console.log(`  ${sp.key.padEnd(14)} ${(sp.items?.length ?? 0)} items  (${sp.title})`);
  }
  console.log("── strict validation ──");
  for (const [name, rec] of Object.entries(perKind)) {
    console.log(`  ${name.padEnd(20)} ${rec.ok}/${rec.total} pass`);
  }
  if (failures.length) {
    console.log(`\n  ✗ ${failures.length} VALIDATION FAILURE(S):`);
    for (const f of failures.slice(0, 12)) console.log(`    [${f.name}] ${f.path}\n      ${f.issues.join("\n      ")}`);
    console.log("\n  ABORTING — fix schema drift before writing.");
    process.exit(1);
  }
  console.log("  ✓ all client-facing docs strict-clean\n");

  // Emit id map for downstream verification / QA targeting.
  const idMap = {
    tenantId: REAL_TENANT,
    spaceId,
    evaluationSettingsId: evalSettingsId,
    prefix: "v2_",
    storyPoints: {},
    chatItems: {},
    agents: {},
  };
  for (const sp of tenantConfig.spaces[0].storyPoints) {
    const spDoc = storyPointDocs.find((d) => d.data.title === sp.title);
    idMap.storyPoints[sp.key] = spDoc?.data.id;
  }
  for (const it of CHAT_ITEMS) {
    const itDoc = itemDocs.find((d) => d.data.content === it.prompt);
    idMap.chatItems[it.key] = itDoc?.data.id;
  }
  for (const ag of AGENTS) {
    const agDoc = agentDocs.find((d) => d.data.name === ag.name);
    idMap.agents[ag.key] = agDoc?.data.id;
  }
  console.log("── ID MAP ──");
  console.log(JSON.stringify(idMap, null, 2));

  if (DRY_RUN) {
    console.log("\n(dry-run) no writes performed.\n");
    process.exit(0);
  }

  // 4) COMMIT — write to the real v2_ root via the (real) admin db handle.
  console.log(`\n── COMMITTING ${writeDocs.length} docs to ${PROJECT} (v2_ root) ──`);
  const db = ctx.admin.db;
  let n = 0;
  let batch = db.batch();
  for (const { path, data } of writeDocs) {
    batch.set(db.doc(path), data, { merge: true });
    n++;
    if (n % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
  console.log(`  ✓ wrote ${n} docs`);
  console.log("\n── DONE ──");
  console.log(JSON.stringify(idMap, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED FAILED:", e);
  process.exit(1);
});
