/**
 * content-levelup — the FULL content-focused mock tenant for the LevelUp domain.
 *
 * Purpose: exercise EVERY content entity + the entire ItemType / QuestionType /
 * MaterialType / StoryPointType range with REAL discriminated payloads, so every
 * authoring + learner screen has data behind it.
 *
 * Coverage in this fragment:
 *   • 5 spaces — DSA (published), System Design (published), LLD (draft),
 *     Behavioral (published), and a B2C store space "Interview Mastery" (published).
 *     Statuses respect ALLOWED_TRANSITIONS.space (draft→published→archived→draft);
 *     one archived legacy space is included to exercise the archived state.
 *   • Each space: 3–5 storyPoints across ALL 4 StoryPointTypes
 *     (standard | timed_test | quiz | practice).
 *   • Each storyPoint: 4–8 UnifiedItems spanning the FULL type range —
 *     all 15 question types (mcq, msq, true_false, fill_blank, short_answer,
 *     long_answer, code, numeric, match, ordering, essay, diagram, audio_response,
 *     file_upload, oral) and all 7 material types (reading, video, pdf, slides,
 *     link, image, audio), authored with real discriminated payloads.
 *   • effectiveRubric snapshot + rubricId on graded items; AnswerKey docs land in
 *     the server-only `answerKeys` subcollection (the engine strips answers).
 *   • 3 rubric presets, 10 question-bank items, an evaluator + a tutor agent.
 *   • A few space reviews + 2 chat sessions with messages (subcollection — D6).
 *   • Enough learners/classes/progress/test-sessions to render learner dashboards.
 *
 * Every reference is by LOGICAL KEY; the engine resolves keys → deterministic
 * branded ids in dependency order, so re-seeding is idempotent.
 */

import type { TenantConfig } from "../config/types.js";

export const contentLevelupTenant: TenantConfig = {
  key: "content-levelup",
  name: "LevelUp Content Studio",
  code: "LUC100",
  status: "active",
  plan: "enterprise",
  contact: { email: "studio@levelup.dev", phone: "+91-80-4444-5555" },
  features: { exams: true, spaces: true, gamification: true, ai: true, store: true },
  branding: { primaryColor: "#5B21B6" },
  geminiKeyRef: "tenant-content-levelup-gemini",

  academicSessions: [
    {
      key: "2025-26",
      name: "2025-2026",
      startDate: "2025-06-01",
      endDate: "2026-04-30",
      isCurrent: true,
      status: "active",
    },
  ],

  classes: [
    {
      key: "cohort-interview",
      name: "Interview Prep Cohort",
      grade: "Pro",
      section: "A",
      academicSessionKey: "2025-26",
      teacherKeys: ["t-content"],
      studentKeys: ["s-nandini", "s-arjun", "s-fatima"],
      schedule: { days: ["Tue", "Thu"], startTime: "19:00", endTime: "20:30", room: "Online" },
    },
  ],

  admins: [
    {
      key: "admin-studio",
      email: "admin@levelup.dev",
      password: "Admin@12345",
      firstName: "Studio",
      lastName: "Admin",
      staffPermissions: {
        canManageUsers: true,
        canManageClasses: true,
        canViewAnalytics: true,
      },
    },
  ],

  teachers: [
    {
      key: "t-content",
      email: "mentor@levelup.dev",
      password: "Teacher@123",
      firstName: "Maya",
      lastName: "Sengupta",
      subjects: ["Computer Science", "Interview Prep"],
      department: "Content",
      designation: "Lead Content Author",
      classKeys: ["cohort-interview"],
      permissions: {
        canManageSpaces: true,
        canManageContent: true,
        canGradeExams: true,
        canViewAnalytics: true,
      },
    },
  ],

  students: [
    {
      key: "s-nandini",
      email: "nandini@learner.dev",
      password: "Student@123",
      firstName: "Nandini",
      lastName: "Rao",
      rollNumber: "L-001",
      grade: "Pro",
      classKeys: ["cohort-interview"],
    },
    {
      key: "s-arjun",
      email: "arjun@learner.dev",
      password: "Student@123",
      firstName: "Arjun",
      lastName: "Mehta",
      rollNumber: "L-002",
      grade: "Pro",
      classKeys: ["cohort-interview"],
    },
    {
      key: "s-fatima",
      email: "fatima@learner.dev",
      password: "Student@123",
      firstName: "Fatima",
      lastName: "Khan",
      rollNumber: "L-003",
      grade: "Pro",
      classKeys: ["cohort-interview"],
    },
  ],

  parents: [],
  staff: [],
  scanners: [],

  // ── Agents (tutor + evaluator — systemPrompt/rules are ⚷ authoring-only) ──
  agents: [
    {
      key: "dsa-evaluator",
      name: "DSA Answer Evaluator",
      spaceKey: "space-dsa",
      type: "evaluator",
      purpose: "answer_grading",
      systemPrompt:
        "You grade data-structures & algorithms answers. Reward correct complexity analysis and edge-case handling. Award partial credit for a correct approach with minor bugs.",
      rules: [
        "Always state the expected time/space complexity",
        "Penalize O(n^2) when O(n log n) is expected",
        "Give partial credit for a correct but unoptimized solution",
      ],
      model: "gemini-2.0-flash",
      isActive: true,
    },
    {
      key: "interview-tutor",
      name: "Interview Coach",
      spaceKey: "space-behavioral",
      type: "tutor",
      purpose: "tutoring",
      systemPrompt:
        "You are a friendly senior-engineer interview coach. Use the Socratic method; never give the full answer immediately. Nudge the learner toward the optimal approach.",
      rules: [
        "Ask a guiding question before revealing the answer",
        "Keep responses under 120 words",
      ],
      model: "gemini-2.0-flash",
      isActive: true,
    },
  ],

  // ── Rubric presets (3) ──
  rubricPresets: [
    {
      key: "coding-rubric",
      name: "Coding Solution (10 pts)",
      description: "Correctness, complexity, and code quality for coding answers.",
      rubric: {
        dimensions: [
          {
            key: "correctness",
            label: "Correctness",
            weight: 0.5,
            promptGuidance: "Does it pass all cases incl. edge cases?",
          },
          {
            key: "complexity",
            label: "Time/Space Complexity",
            weight: 0.3,
            promptGuidance: "Is the optimal complexity achieved?",
          },
          { key: "quality", label: "Code Quality", weight: 0.2 },
        ],
        totalPoints: 10,
        passingScore: 6,
        evaluatorGuidance: "Reward optimal complexity; deduct for unhandled edge cases.",
      },
    },
    {
      key: "design-rubric",
      name: "System Design (15 pts)",
      description: "Tradeoffs, scalability, and clarity for design answers.",
      rubric: {
        dimensions: [
          {
            key: "tradeoffs",
            label: "Tradeoff Analysis",
            weight: 0.4,
            promptGuidance: "Are CAP/consistency tradeoffs discussed?",
          },
          { key: "scalability", label: "Scalability", weight: 0.4 },
          { key: "clarity", label: "Communication", weight: 0.2 },
        ],
        totalPoints: 15,
        passingScore: 9,
      },
    },
    {
      key: "behavioral-rubric",
      name: "Behavioral STAR (5 pts)",
      description: "Situation-Task-Action-Result structure scoring.",
      rubric: {
        dimensions: [
          {
            key: "structure",
            label: "STAR Structure",
            weight: 0.5,
            promptGuidance: "Are all four STAR parts present?",
          },
          { key: "impact", label: "Measurable Impact", weight: 0.3 },
          { key: "reflection", label: "Self-Reflection", weight: 0.2 },
        ],
        totalPoints: 5,
        passingScore: 3,
        modelAnswer:
          "A strong answer names a concrete situation, the task, the specific action taken, and a quantified result.",
      },
    },
  ],

  // ── Question bank (10) ──
  questionBank: [
    {
      key: "qb-bigo",
      questionType: "mcq",
      prompt: "What is the time complexity of binary search?",
      options: [
        { id: "a", text: "O(n)" },
        { id: "b", text: "O(log n)" },
        { id: "c", text: "O(n log n)" },
        { id: "d", text: "O(1)" },
      ],
      points: 1,
      answer: { correctAnswer: "b" },
      tags: ["dsa", "complexity"],
    },
    {
      key: "qb-stack",
      questionType: "true_false",
      prompt: "A stack follows FIFO ordering.",
      points: 1,
      answer: { correctAnswer: false },
      tags: ["dsa", "stack"],
    },
    {
      key: "qb-hash",
      questionType: "short_answer",
      prompt: "Name one collision-resolution strategy for hash tables.",
      points: 2,
      answer: {
        correctAnswer: "chaining",
        acceptableAnswers: ["chaining", "open addressing", "linear probing"],
      },
      tags: ["dsa", "hashing"],
    },
    {
      key: "qb-graph",
      questionType: "msq",
      prompt: "Which traversals can detect a cycle in a directed graph?",
      options: [
        { id: "a", text: "DFS with colors" },
        { id: "b", text: "BFS topological sort" },
        { id: "c", text: "Union-Find (undirected only)" },
        { id: "d", text: "In-order traversal" },
      ],
      points: 2,
      answer: { correctAnswer: ["a", "b"] },
      tags: ["dsa", "graphs"],
    },
    {
      key: "qb-cap",
      questionType: "mcq",
      prompt: "In CAP theorem, a network partition forces a choice between?",
      options: [
        { id: "a", text: "Consistency and Availability" },
        { id: "b", text: "Latency and Throughput" },
        { id: "c", text: "Read and Write" },
        { id: "d", text: "SQL and NoSQL" },
      ],
      points: 1,
      answer: { correctAnswer: "a" },
      tags: ["system-design", "cap"],
    },
    {
      key: "qb-index",
      questionType: "fill_blank",
      prompt: "A database ______ speeds up reads at the cost of slower writes.",
      points: 1,
      answer: { correctAnswer: "index", acceptableAnswers: ["index", "indexes"] },
      tags: ["system-design", "database"],
    },
    {
      key: "qb-solid",
      questionType: "match",
      prompt: "Match the SOLID principle to its meaning.",
      options: [
        { id: "s", text: "Single Responsibility" },
        { id: "o", text: "Open/Closed" },
        { id: "l", text: "Liskov Substitution" },
        { id: "d", text: "Dependency Inversion" },
      ],
      points: 4,
      answer: {
        correctAnswer: {
          s: "One reason to change",
          o: "Open for extension",
          l: "Subtypes substitutable",
          d: "Depend on abstractions",
        },
      },
      tags: ["lld", "solid"],
    },
    {
      key: "qb-pattern",
      questionType: "mcq",
      prompt: "Which pattern ensures a single shared instance?",
      options: [
        { id: "a", text: "Factory" },
        { id: "b", text: "Singleton" },
        { id: "c", text: "Observer" },
        { id: "d", text: "Strategy" },
      ],
      points: 1,
      answer: { correctAnswer: "b" },
      tags: ["lld", "patterns"],
    },
    {
      key: "qb-star",
      questionType: "long_answer",
      prompt: "Describe a time you resolved a conflict on your team (use STAR).",
      points: 5,
      answer: {
        correctAnswer: "A structured STAR narrative.",
        evaluationGuidance: "Look for Situation, Task, Action, Result and a measurable outcome.",
        modelAnswer:
          "When two engineers disagreed on an API design (S/T), I facilitated a spike (A) that reduced latency 30% (R).",
      },
      tags: ["behavioral", "conflict"],
    },
    {
      key: "qb-numeric",
      questionType: "numeric",
      prompt: "A hash table with 1000 slots and 750 entries has what load factor (2 dp)?",
      points: 1,
      answer: { correctAnswer: 0.75, acceptableAnswers: [0.75, "0.75"] },
      tags: ["dsa", "hashing"],
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // SPACES — every StoryPointType + every Question/Material type appears below.
  // ─────────────────────────────────────────────────────────────────────────
  spaces: [
    // ════════════════════ SPACE 1 — DSA (published) ════════════════════
    {
      key: "space-dsa",
      title: "Data Structures & Algorithms",
      description: "Master arrays, trees, graphs, and algorithmic complexity.",
      type: "course",
      status: "published",
      subject: "Computer Science",
      classKeys: ["cohort-interview"],
      ownerTeacherKey: "t-content",
      storyPoints: [
        {
          // StoryPointType: standard — mixed materials + intro questions
          key: "sp-dsa-foundations",
          title: "Foundations & Complexity",
          type: "standard",
          order: 0,
          items: [
            {
              key: "m-read-bigo",
              kind: "material",
              materialType: "reading",
              title: "Big-O Notation",
              body: "Big-O describes the upper bound of an algorithm’s growth rate.",
              order: 0,
            },
            {
              key: "m-video-arrays",
              kind: "material",
              materialType: "video",
              title: "Arrays in 10 Minutes",
              url: "https://cdn.levelup.dev/videos/arrays.mp4",
              durationSeconds: 600,
              order: 1,
            },
            {
              key: "m-pdf-cheatsheet",
              kind: "material",
              materialType: "pdf",
              title: "Complexity Cheat Sheet",
              url: "tenants/content-levelup/materials/complexity-cheatsheet.pdf",
              order: 2,
            },
            {
              key: "q-mcq-bigo",
              kind: "question",
              questionType: "mcq",
              prompt: "What is the worst-case time complexity of bubble sort?",
              options: [
                { id: "a", text: "O(n)" },
                { id: "b", text: "O(n log n)" },
                { id: "c", text: "O(n^2)" },
                { id: "d", text: "O(log n)" },
              ],
              points: 1,
              order: 3,
              answer: { correctAnswer: "c" },
            },
            {
              key: "q-tf-stack",
              kind: "question",
              questionType: "true_false",
              prompt: "A queue follows FIFO ordering.",
              points: 1,
              order: 4,
              answer: { correctAnswer: true },
            },
            {
              key: "q-numeric-load",
              kind: "question",
              questionType: "numeric",
              prompt: "A hash table with 200 slots and 150 entries has what load factor (2 dp)?",
              points: 1,
              order: 5,
              answer: { correctAnswer: 0.75, acceptableAnswers: [0.75, "0.75"] },
            },
          ],
        },
        {
          // StoryPointType: quiz — short/long/fill/msq question coverage
          key: "sp-dsa-trees",
          title: "Trees & Recursion Quiz",
          type: "quiz",
          order: 1,
          durationSeconds: 900,
          items: [
            {
              key: "q-msq-traversal",
              kind: "question",
              questionType: "msq",
              prompt: "Which are depth-first tree traversals?",
              options: [
                { id: "a", text: "Pre-order" },
                { id: "b", text: "In-order" },
                { id: "c", text: "Level-order" },
                { id: "d", text: "Post-order" },
              ],
              points: 2,
              order: 0,
              answer: { correctAnswer: ["a", "b", "d"] },
            },
            {
              key: "q-fill-bst",
              kind: "question",
              questionType: "fill_blank",
              prompt: "An in-order traversal of a BST yields nodes in ______ order.",
              points: 1,
              order: 1,
              answer: { correctAnswer: "sorted", acceptableAnswers: ["sorted", "ascending"] },
            },
            {
              key: "q-short-balance",
              kind: "question",
              questionType: "short_answer",
              prompt: "Why do we balance binary search trees?",
              points: 2,
              order: 2,
              answer: {
                correctAnswer: "To keep operations O(log n).",
                evaluationGuidance: "Accept any mention of preventing O(n) degeneration.",
                modelAnswer:
                  "Balancing keeps height O(log n) so search/insert/delete stay logarithmic.",
              },
              rubricPresetKey: "coding-rubric",
            },
            {
              key: "q-long-recursion",
              kind: "question",
              questionType: "long_answer",
              prompt: "Explain how recursion uses the call stack, with an example.",
              points: 5,
              order: 3,
              answer: {
                correctAnswer: "Each call pushes a frame; base case unwinds.",
                modelAnswer:
                  "Recursion pushes a stack frame per call holding locals/return address; the base case stops recursion and frames pop as results return.",
              },
              rubric: {
                dimensions: [
                  { key: "accuracy", label: "Accuracy", weight: 0.6 },
                  { key: "example", label: "Example Quality", weight: 0.4 },
                ],
                totalPoints: 5,
                passingScore: 3,
              },
            },
          ],
        },
        {
          // StoryPointType: timed_test — code + diagram + ordering + match
          key: "sp-dsa-graphs",
          title: "Graphs Timed Test",
          type: "timed_test",
          order: 2,
          durationSeconds: 1800,
          items: [
            {
              key: "q-code-bfs",
              kind: "question",
              questionType: "code",
              prompt: "Implement BFS over an adjacency list and return the visit order.",
              points: 10,
              order: 0,
              answer: {
                correctAnswer:
                  "function bfs(adj, start){ const q=[start], seen=new Set([start]), out=[]; while(q.length){ const n=q.shift(); out.push(n); for(const m of adj[n]||[]) if(!seen.has(m)){ seen.add(m); q.push(m);} } return out; }",
                evaluationGuidance: "Must use a queue and a visited set; O(V+E).",
              },
              rubricPresetKey: "coding-rubric",
            },
            {
              key: "q-ordering-dijkstra",
              kind: "question",
              questionType: "ordering",
              prompt: "Order the steps of Dijkstra’s algorithm.",
              options: [
                { id: "1", text: "Init distances to infinity" },
                { id: "2", text: "Pick min-distance unvisited node" },
                { id: "3", text: "Relax neighbors" },
                { id: "4", text: "Mark node visited" },
              ],
              points: 4,
              order: 1,
              answer: { correctAnswer: ["1", "2", "3", "4"] },
            },
            {
              key: "q-match-traversal",
              kind: "question",
              questionType: "match",
              prompt: "Match the algorithm to its use.",
              options: [
                { id: "bfs", text: "BFS" },
                { id: "dfs", text: "DFS" },
                { id: "dij", text: "Dijkstra" },
                { id: "kru", text: "Kruskal" },
              ],
              points: 4,
              order: 2,
              answer: {
                correctAnswer: {
                  bfs: "Shortest unweighted path",
                  dfs: "Cycle detection",
                  dij: "Shortest weighted path",
                  kru: "Minimum spanning tree",
                },
              },
            },
            {
              key: "q-diagram-graph",
              kind: "question",
              questionType: "diagram",
              prompt: "Draw the adjacency-list representation of the given directed graph.",
              points: 5,
              order: 3,
              answer: {
                correctAnswer: "Adjacency list mapping each vertex to its out-neighbors.",
                evaluationGuidance: "Award full marks if every directed edge appears exactly once.",
              },
              rubric: {
                dimensions: [
                  { key: "completeness", label: "Completeness", weight: 0.7 },
                  { key: "clarity", label: "Clarity", weight: 0.3 },
                ],
                totalPoints: 5,
                passingScore: 3,
              },
            },
          ],
        },
        {
          // StoryPointType: practice — file_upload + audio_response + slides
          key: "sp-dsa-practice",
          title: "Mixed Practice",
          type: "practice",
          order: 3,
          items: [
            {
              key: "m-slides-sorting",
              kind: "material",
              materialType: "slides",
              title: "Sorting Algorithms Deck",
              url: "tenants/content-levelup/materials/sorting.pptx",
              order: 0,
            },
            {
              key: "q-fileupload-soln",
              kind: "question",
              questionType: "file_upload",
              prompt: "Upload your solution file for the merge-sort exercise.",
              points: 5,
              order: 1,
              answer: {
                correctAnswer: "A working merge-sort implementation.",
                evaluationGuidance: "Accept any language; verify stable O(n log n) sort.",
              },
            },
            {
              key: "q-audio-explain",
              kind: "question",
              questionType: "audio_response",
              prompt: "Record a 60-second explanation of quicksort’s pivot choice.",
              points: 3,
              order: 2,
              answer: {
                correctAnswer: "Explanation covering pivot selection and partitioning.",
                evaluationGuidance:
                  "Reward mention of worst-case avoidance via randomized/median pivot.",
              },
            },
            {
              key: "q-numeric-comparisons",
              kind: "question",
              questionType: "numeric",
              prompt: "Merge sort on 8 elements does how many merge levels?",
              points: 1,
              order: 3,
              answer: { correctAnswer: 3, acceptableAnswers: [3, "3"] },
            },
          ],
        },
      ],
    },

    // ══════════════ SPACE 2 — System Design (published) ══════════════
    {
      key: "space-sysdesign",
      title: "System Design Interviews",
      description: "Scalability, consistency, caching, and real-world architectures.",
      type: "course",
      status: "published",
      subject: "Computer Science",
      classKeys: ["cohort-interview"],
      ownerTeacherKey: "t-content",
      storyPoints: [
        {
          key: "sp-sd-fundamentals",
          title: "Scalability Fundamentals",
          type: "standard",
          order: 0,
          items: [
            {
              key: "m-read-scaling",
              kind: "material",
              materialType: "reading",
              title: "Horizontal vs Vertical Scaling",
              body: "Vertical scaling adds power to one machine; horizontal scaling adds machines.",
              order: 0,
            },
            {
              key: "m-link-primer",
              kind: "material",
              materialType: "link",
              title: "The System Design Primer",
              url: "https://github.com/donnemartin/system-design-primer",
              order: 1,
            },
            {
              key: "m-image-arch",
              kind: "material",
              materialType: "image",
              title: "Reference Architecture Diagram",
              url: "tenants/content-levelup/materials/ref-arch.png",
              order: 2,
            },
            {
              key: "q-mcq-cap",
              kind: "question",
              questionType: "mcq",
              prompt: "Under a partition, an AP system prioritizes?",
              options: [
                { id: "a", text: "Availability" },
                { id: "b", text: "Consistency" },
                { id: "c", text: "Partition tolerance" },
                { id: "d", text: "Latency" },
              ],
              points: 1,
              order: 3,
              answer: { correctAnswer: "a" },
            },
            {
              key: "q-fill-cache",
              kind: "question",
              questionType: "fill_blank",
              prompt: "A ______ cache eviction policy removes the least-recently-used entry.",
              points: 1,
              order: 4,
              answer: { correctAnswer: "LRU", acceptableAnswers: ["LRU", "lru"] },
            },
          ],
        },
        {
          key: "sp-sd-deepdive",
          title: "Design a URL Shortener (Quiz)",
          type: "quiz",
          order: 1,
          durationSeconds: 1200,
          items: [
            {
              key: "q-long-urlshort",
              kind: "question",
              questionType: "long_answer",
              prompt:
                "Design a URL shortener handling 100M writes/day. Cover encoding, storage, and caching.",
              points: 15,
              order: 0,
              answer: {
                correctAnswer: "Base-62 ID, KV store, read-through cache, CDN.",
                modelAnswer:
                  "Use a base-62 counter or hash for short codes, a KV store (e.g. DynamoDB) keyed by code, a read-through cache for hot links, and a CDN for redirects.",
              },
              rubricPresetKey: "design-rubric",
            },
            {
              key: "q-msq-consistency",
              kind: "question",
              questionType: "msq",
              prompt: "Which improve read availability?",
              options: [
                { id: "a", text: "Read replicas" },
                { id: "b", text: "Caching" },
                { id: "c", text: "Synchronous cross-region writes" },
                { id: "d", text: "CDN" },
              ],
              points: 2,
              order: 1,
              answer: { correctAnswer: ["a", "b", "d"] },
            },
            {
              key: "q-tf-sharding",
              kind: "question",
              questionType: "true_false",
              prompt: "Sharding by user-id can cause hot partitions for power users.",
              points: 1,
              order: 2,
              answer: { correctAnswer: true },
            },
            {
              key: "q-short-idempotency",
              kind: "question",
              questionType: "short_answer",
              prompt: "Why are idempotency keys important in payment APIs?",
              points: 2,
              order: 3,
              answer: {
                correctAnswer: "They prevent duplicate charges on retries.",
                evaluationGuidance: "Accept any mention of safe retries / exactly-once effect.",
              },
            },
          ],
        },
        {
          key: "sp-sd-architecture",
          title: "Architecture Design (Timed)",
          type: "timed_test",
          order: 2,
          durationSeconds: 2400,
          items: [
            {
              key: "q-diagram-chat",
              kind: "question",
              questionType: "diagram",
              prompt: "Draw a high-level architecture for a real-time chat app.",
              points: 15,
              order: 0,
              answer: {
                correctAnswer:
                  "WebSocket gateway, message service, pub/sub, persistence, presence.",
                evaluationGuidance:
                  "Reward a WebSocket layer, a message broker, and a durable store.",
              },
              rubricPresetKey: "design-rubric",
            },
            {
              key: "q-essay-tradeoffs",
              kind: "question",
              questionType: "essay",
              prompt: "Write an essay comparing SQL vs NoSQL for a social feed, with tradeoffs.",
              points: 15,
              order: 1,
              answer: {
                correctAnswer: "A balanced essay covering consistency, scale, and access patterns.",
                modelAnswer:
                  "SQL gives strong consistency and joins but is harder to scale horizontally; NoSQL favors denormalized, partition-friendly access for feeds at the cost of consistency.",
              },
              rubric: {
                dimensions: [
                  { key: "depth", label: "Depth of Analysis", weight: 0.5 },
                  { key: "balance", label: "Balance", weight: 0.3 },
                  { key: "writing", label: "Writing", weight: 0.2 },
                ],
                totalPoints: 15,
                passingScore: 9,
              },
            },
            {
              key: "q-ordering-request",
              kind: "question",
              questionType: "ordering",
              prompt: "Order a request’s path through a typical web stack.",
              options: [
                { id: "1", text: "CDN" },
                { id: "2", text: "Load balancer" },
                { id: "3", text: "App server" },
                { id: "4", text: "Database" },
              ],
              points: 4,
              order: 2,
              answer: { correctAnswer: ["1", "2", "3", "4"] },
            },
            {
              key: "q-code-ratelimit",
              kind: "question",
              questionType: "code",
              prompt: "Implement a token-bucket rate limiter (allow(now) → boolean).",
              points: 10,
              order: 3,
              answer: {
                correctAnswer: "Token bucket refilling at a fixed rate, capped at capacity.",
                evaluationGuidance: "Verify refill math and capacity cap.",
              },
              rubricPresetKey: "coding-rubric",
            },
          ],
        },
        {
          key: "sp-sd-practice",
          title: "Estimation Practice",
          type: "practice",
          order: 3,
          items: [
            {
              key: "m-audio-podcast",
              kind: "material",
              materialType: "audio",
              title: "Back-of-Envelope Estimation (Podcast)",
              url: "tenants/content-levelup/materials/estimation.mp3",
              durationSeconds: 1200,
              order: 0,
            },
            {
              key: "q-numeric-qps",
              kind: "question",
              questionType: "numeric",
              prompt:
                "1M daily active users each making 10 reads/day ≈ how many reads/sec (round to nearest 10)?",
              points: 2,
              order: 1,
              answer: { correctAnswer: 120, acceptableAnswers: [115, 116, 120] },
            },
            {
              key: "q-oral-tradeoff",
              kind: "question",
              questionType: "oral",
              prompt: "Verbally justify choosing eventual consistency for a like-counter.",
              points: 3,
              order: 2,
              answer: {
                correctAnswer:
                  "Likes tolerate staleness; eventual consistency maximizes availability/throughput.",
                evaluationGuidance:
                  "Reward acknowledging acceptable staleness for a non-critical counter.",
              },
            },
            {
              key: "q-fileupload-design",
              kind: "question",
              questionType: "file_upload",
              prompt: "Upload your capacity-estimation spreadsheet.",
              points: 3,
              order: 3,
              answer: {
                correctAnswer: "A spreadsheet with QPS, storage, and bandwidth estimates.",
              },
            },
          ],
        },
      ],
    },

    // ══════════════ SPACE 3 — LLD (DRAFT — not yet published) ══════════════
    {
      key: "space-lld",
      title: "Low-Level Design & OOP",
      description: "SOLID principles, design patterns, and clean object modeling.",
      type: "course",
      status: "draft",
      subject: "Computer Science",
      classKeys: ["cohort-interview"],
      ownerTeacherKey: "t-content",
      storyPoints: [
        {
          key: "sp-lld-solid",
          title: "SOLID Principles",
          type: "standard",
          order: 0,
          items: [
            {
              key: "m-read-solid",
              kind: "material",
              materialType: "reading",
              title: "The SOLID Principles",
              body: "SOLID is five principles for maintainable OOP design.",
              order: 0,
            },
            {
              key: "m-slides-solid",
              kind: "material",
              materialType: "slides",
              title: "SOLID Deck",
              url: "tenants/content-levelup/materials/solid.pptx",
              order: 1,
            },
            {
              key: "q-match-solid",
              kind: "question",
              questionType: "match",
              prompt: "Match each SOLID principle to its definition.",
              options: [
                { id: "s", text: "S — Single Responsibility" },
                { id: "o", text: "O — Open/Closed" },
                { id: "l", text: "L — Liskov" },
                { id: "d", text: "D — Dependency Inversion" },
              ],
              points: 4,
              order: 2,
              answer: {
                correctAnswer: {
                  s: "One reason to change",
                  o: "Open for extension, closed for modification",
                  l: "Subtypes substitutable for base",
                  d: "Depend on abstractions",
                },
              },
            },
            {
              key: "q-mcq-srp",
              kind: "question",
              questionType: "mcq",
              prompt: "A class that both formats and persists a report violates which principle?",
              options: [
                { id: "a", text: "Single Responsibility" },
                { id: "b", text: "Liskov" },
                { id: "c", text: "Interface Segregation" },
                { id: "d", text: "None" },
              ],
              points: 1,
              order: 3,
              answer: { correctAnswer: "a" },
            },
          ],
        },
        {
          key: "sp-lld-patterns",
          title: "Design Patterns Quiz",
          type: "quiz",
          order: 1,
          durationSeconds: 900,
          items: [
            {
              key: "q-mcq-singleton",
              kind: "question",
              questionType: "mcq",
              prompt: "Which pattern guarantees one instance?",
              options: [
                { id: "a", text: "Builder" },
                { id: "b", text: "Singleton" },
                { id: "c", text: "Adapter" },
                { id: "d", text: "Proxy" },
              ],
              points: 1,
              order: 0,
              answer: { correctAnswer: "b" },
            },
            {
              key: "q-msq-creational",
              kind: "question",
              questionType: "msq",
              prompt: "Which are creational patterns?",
              options: [
                { id: "a", text: "Factory Method" },
                { id: "b", text: "Builder" },
                { id: "c", text: "Observer" },
                { id: "d", text: "Prototype" },
              ],
              points: 2,
              order: 1,
              answer: { correctAnswer: ["a", "b", "d"] },
            },
            {
              key: "q-tf-observer",
              kind: "question",
              questionType: "true_false",
              prompt: "The Observer pattern decouples subject from its subscribers.",
              points: 1,
              order: 2,
              answer: { correctAnswer: true },
            },
            {
              key: "q-short-strategy",
              kind: "question",
              questionType: "short_answer",
              prompt: "When would you prefer Strategy over inheritance?",
              points: 2,
              order: 3,
              answer: {
                correctAnswer: "When behavior should vary at runtime without subclass explosion.",
                evaluationGuidance:
                  "Accept any mention of runtime swap / composition over inheritance.",
              },
              rubricPresetKey: "coding-rubric",
            },
          ],
        },
        {
          key: "sp-lld-modeling",
          title: "Model a Parking Lot (Timed)",
          type: "timed_test",
          order: 2,
          durationSeconds: 2700,
          items: [
            {
              key: "q-code-parking",
              kind: "question",
              questionType: "code",
              prompt:
                "Design the class structure for a parking-lot system (classes + key methods).",
              points: 10,
              order: 0,
              answer: {
                correctAnswer:
                  "ParkingLot, Level, Spot, Vehicle hierarchy, Ticket; assign/release methods.",
                evaluationGuidance:
                  "Reward clear class boundaries and a sound spot-assignment method.",
              },
              rubricPresetKey: "coding-rubric",
            },
            {
              key: "q-diagram-uml",
              kind: "question",
              questionType: "diagram",
              prompt: "Draw the UML class diagram for your parking-lot design.",
              points: 5,
              order: 1,
              answer: {
                correctAnswer: "UML with associations and multiplicities.",
                evaluationGuidance: "Reward correct associations and multiplicities.",
              },
              rubricPresetKey: "design-rubric",
            },
            {
              key: "q-long-extensibility",
              kind: "question",
              questionType: "long_answer",
              prompt: "Explain how your design supports adding electric-vehicle charging spots.",
              points: 5,
              order: 2,
              answer: {
                correctAnswer: "Extend Spot/Vehicle types; Open/Closed keeps core logic untouched.",
                modelAnswer:
                  "Introduce an ElectricSpot subtype and EV vehicle type; the assignment strategy is open for extension, so no existing class changes.",
              },
            },
            {
              key: "q-ordering-designflow",
              kind: "question",
              questionType: "ordering",
              prompt: "Order the steps of an LLD interview.",
              options: [
                { id: "1", text: "Clarify requirements" },
                { id: "2", text: "Identify entities" },
                { id: "3", text: "Define relationships" },
                { id: "4", text: "Refine with patterns" },
              ],
              points: 4,
              order: 3,
              answer: { correctAnswer: ["1", "2", "3", "4"] },
            },
          ],
        },
      ],
    },

    // ══════════════ SPACE 4 — Behavioral (published) ══════════════
    {
      key: "space-behavioral",
      title: "Behavioral Interview Prep",
      description: "STAR storytelling, leadership principles, and self-reflection.",
      type: "subject",
      status: "published",
      subject: "Soft Skills",
      classKeys: ["cohort-interview"],
      ownerTeacherKey: "t-content",
      storyPoints: [
        {
          key: "sp-beh-star",
          title: "The STAR Method",
          type: "standard",
          order: 0,
          items: [
            {
              key: "m-read-star",
              kind: "material",
              materialType: "reading",
              title: "STAR Storytelling",
              body: "STAR = Situation, Task, Action, Result — a structure for behavioral answers.",
              order: 0,
            },
            {
              key: "m-video-star",
              kind: "material",
              materialType: "video",
              title: "STAR Walkthrough",
              url: "https://cdn.levelup.dev/videos/star.mp4",
              durationSeconds: 480,
              order: 1,
            },
            {
              key: "q-tf-star",
              kind: "question",
              questionType: "true_false",
              prompt: 'The "R" in STAR stands for Result.',
              points: 1,
              order: 2,
              answer: { correctAnswer: true },
            },
            {
              key: "q-fill-star",
              kind: "question",
              questionType: "fill_blank",
              prompt: "In STAR, the ______ describes the specific steps you personally took.",
              points: 1,
              order: 3,
              answer: { correctAnswer: "Action", acceptableAnswers: ["Action", "action"] },
            },
            {
              key: "q-ordering-star",
              kind: "question",
              questionType: "ordering",
              prompt: "Order the STAR components.",
              options: [
                { id: "s", text: "Situation" },
                { id: "t", text: "Task" },
                { id: "a", text: "Action" },
                { id: "r", text: "Result" },
              ],
              points: 4,
              order: 4,
              answer: { correctAnswer: ["s", "t", "a", "r"] },
            },
          ],
        },
        {
          key: "sp-beh-stories",
          title: "Craft Your Stories",
          type: "practice",
          order: 1,
          items: [
            {
              key: "q-essay-conflict",
              kind: "question",
              questionType: "essay",
              prompt: "Write a STAR story about resolving a disagreement with a teammate.",
              points: 5,
              order: 0,
              answer: {
                correctAnswer: "A complete STAR narrative with a measurable result.",
                modelAnswer:
                  "Situation: API design dispute. Task: ship on time. Action: ran a timed spike. Result: chose the faster option, cut latency 30%.",
              },
              rubricPresetKey: "behavioral-rubric",
            },
            {
              key: "q-oral-leadership",
              kind: "question",
              questionType: "oral",
              prompt: 'Record a 90-second answer to "Tell me about a time you showed leadership."',
              points: 3,
              order: 1,
              answer: {
                correctAnswer: "A spoken STAR story demonstrating ownership.",
                evaluationGuidance: "Reward clear ownership and a quantified outcome.",
              },
            },
            {
              key: "q-audio-failure",
              kind: "question",
              questionType: "audio_response",
              prompt: 'Record your answer to "Tell me about a failure and what you learned."',
              points: 3,
              order: 2,
              answer: {
                correctAnswer: "An honest failure story with a concrete lesson.",
                evaluationGuidance: "Reward genuine reflection over blame-shifting.",
              },
            },
            {
              key: "q-fileupload-resume",
              kind: "question",
              questionType: "file_upload",
              prompt: "Upload your one-page resume for review.",
              points: 1,
              order: 3,
              answer: { correctAnswer: "A one-page PDF resume." },
            },
          ],
        },
        {
          key: "sp-beh-mock",
          title: "Mock Interview Quiz",
          type: "quiz",
          order: 2,
          durationSeconds: 1200,
          items: [
            {
              key: "q-mcq-weakness",
              kind: "question",
              questionType: "mcq",
              prompt: 'The best way to answer "What is your greatest weakness?" is to?',
              options: [
                { id: "a", text: "Claim you have none" },
                { id: "b", text: "Name a real weakness + how you’re improving" },
                { id: "c", text: "Name a strength in disguise" },
                { id: "d", text: "Deflect" },
              ],
              points: 1,
              order: 0,
              answer: { correctAnswer: "b" },
            },
            {
              key: "q-msq-redflags",
              kind: "question",
              questionType: "msq",
              prompt: "Which are behavioral-answer red flags?",
              options: [
                { id: "a", text: "Blaming others" },
                { id: "b", text: "Vague, no result" },
                { id: "c", text: "Quantified impact" },
                { id: "d", text: "No self-reflection" },
              ],
              points: 2,
              order: 1,
              answer: { correctAnswer: ["a", "b", "d"] },
            },
            {
              key: "q-short-values",
              kind: "question",
              questionType: "short_answer",
              prompt: "Name one leadership principle and give a one-line example.",
              points: 2,
              order: 2,
              answer: {
                correctAnswer: "Ownership: I fixed a flaky test no one owned.",
                evaluationGuidance: "Accept any named principle with a concrete example.",
              },
            },
            {
              key: "q-long-growth",
              kind: "question",
              questionType: "long_answer",
              prompt: "Describe how you’ve grown most as an engineer in the last year.",
              points: 5,
              order: 3,
              answer: {
                correctAnswer: "A reflective growth narrative.",
                modelAnswer:
                  "I moved from reactive bug-fixing to proactive design reviews, cutting our incident rate noticeably.",
              },
              rubricPresetKey: "behavioral-rubric",
            },
          ],
        },
      ],
    },

    // ══════════════ SPACE 5 — B2C STORE SPACE (published, priced) ══════════════
    {
      key: "space-store-mastery",
      title: "Interview Mastery Bootcamp",
      description: "A premium B2C bundle: DSA + design + behavioral, sold on the store.",
      type: "store",
      status: "published",
      subject: "Career",
      price: 4999,
      ownerTeacherKey: "t-content",
      storyPoints: [
        {
          key: "sp-store-welcome",
          title: "Welcome & Roadmap",
          type: "standard",
          order: 0,
          items: [
            {
              key: "m-read-roadmap",
              kind: "material",
              materialType: "reading",
              title: "Your 8-Week Roadmap",
              body: "A week-by-week plan covering DSA, design, and behavioral prep.",
              order: 0,
            },
            {
              key: "m-video-intro",
              kind: "material",
              materialType: "video",
              title: "Welcome from Your Coach",
              url: "https://cdn.levelup.dev/videos/welcome.mp4",
              durationSeconds: 300,
              order: 1,
            },
            {
              key: "m-link-discord",
              kind: "material",
              materialType: "link",
              title: "Join the Cohort Community",
              url: "https://discord.gg/levelup-cohort",
              order: 2,
            },
            {
              key: "m-pdf-syllabus",
              kind: "material",
              materialType: "pdf",
              title: "Full Syllabus (PDF)",
              url: "tenants/content-levelup/materials/syllabus.pdf",
              order: 3,
            },
            {
              key: "q-mcq-readiness",
              kind: "question",
              questionType: "mcq",
              prompt: "How many hours/week does this bootcamp recommend?",
              options: [
                { id: "a", text: "2-3" },
                { id: "b", text: "8-10" },
                { id: "c", text: "40+" },
                { id: "d", text: "0" },
              ],
              points: 1,
              order: 4,
              answer: { correctAnswer: "b" },
            },
          ],
        },
        {
          key: "sp-store-diagnostic",
          title: "Diagnostic Assessment",
          type: "timed_test",
          order: 1,
          durationSeconds: 3600,
          items: [
            {
              key: "q-code-twosum",
              kind: "question",
              questionType: "code",
              prompt: "Solve Two-Sum in O(n) and return the indices.",
              points: 10,
              order: 0,
              answer: {
                correctAnswer: "Hash map of value→index; one pass.",
                evaluationGuidance: "Must be a single O(n) pass with a hash map.",
              },
              rubricPresetKey: "coding-rubric",
            },
            {
              key: "q-long-designcache",
              kind: "question",
              questionType: "long_answer",
              prompt: "Design a distributed cache. Cover eviction, sharding, and consistency.",
              points: 15,
              order: 1,
              answer: {
                correctAnswer: "Consistent hashing, LRU eviction, replication for availability.",
                modelAnswer:
                  "Use consistent hashing across nodes, LRU eviction per node, and replication with read-through for availability; accept eventual consistency.",
              },
              rubricPresetKey: "design-rubric",
            },
            {
              key: "q-essay-behavioral",
              kind: "question",
              questionType: "essay",
              prompt: "Write a STAR story showcasing your biggest professional impact.",
              points: 5,
              order: 2,
              answer: {
                correctAnswer: "A polished STAR essay with quantified impact.",
                modelAnswer:
                  "I led a migration (S/T), phased rollouts behind flags (A), and cut infra cost 22% (R).",
              },
              rubricPresetKey: "behavioral-rubric",
            },
            {
              key: "q-numeric-selfscore",
              kind: "question",
              questionType: "numeric",
              prompt: "On a scale of 1-10, rate your current interview confidence.",
              points: 0,
              order: 3,
              answer: { correctAnswer: 5, acceptableAnswers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
            },
          ],
        },
        {
          key: "sp-store-practice",
          title: "Daily Practice Drills",
          type: "practice",
          order: 2,
          items: [
            {
              key: "q-fill-complexity",
              kind: "question",
              questionType: "fill_blank",
              prompt: "A balanced BST search runs in O(______) time.",
              points: 1,
              order: 0,
              answer: { correctAnswer: "log n", acceptableAnswers: ["log n", "logn", "log(n)"] },
            },
            {
              key: "q-tf-microservices",
              kind: "question",
              questionType: "true_false",
              prompt: "Microservices always reduce operational complexity.",
              points: 1,
              order: 1,
              answer: { correctAnswer: false },
            },
            {
              key: "q-match-bigo",
              kind: "question",
              questionType: "match",
              prompt: "Match the operation to its complexity.",
              options: [
                { id: "hash", text: "Hash lookup" },
                { id: "bst", text: "Balanced BST search" },
                { id: "arr", text: "Array scan" },
                { id: "sort", text: "Comparison sort" },
              ],
              points: 4,
              order: 2,
              answer: {
                correctAnswer: { hash: "O(1)", bst: "O(log n)", arr: "O(n)", sort: "O(n log n)" },
              },
            },
            {
              key: "q-oral-pitch",
              kind: "question",
              questionType: "oral",
              prompt: 'Record your 60-second "tell me about yourself" pitch.',
              points: 3,
              order: 3,
              answer: {
                correctAnswer: "A concise, structured self-introduction.",
                evaluationGuidance: "Reward a clear narrative arc under 60 seconds.",
              },
            },
            {
              key: "q-audio-mock",
              kind: "question",
              questionType: "audio_response",
              prompt: "Record your walkthrough of the Two-Sum solution.",
              points: 3,
              order: 4,
              answer: { correctAnswer: "A clear verbal walkthrough of the hash-map approach." },
            },
          ],
        },
      ],
    },

    // ══════════════ SPACE 6 — ARCHIVED legacy space (status coverage) ══════════════
    {
      key: "space-legacy-cpp",
      title: "Legacy C++ Crash Course",
      description: "Retired course — kept archived to exercise the archived lifecycle state.",
      type: "course",
      status: "archived",
      subject: "Computer Science",
      ownerTeacherKey: "t-content",
      storyPoints: [
        {
          key: "sp-legacy-basics",
          title: "Pointers & Memory",
          type: "standard",
          order: 0,
          items: [
            {
              key: "m-read-pointers",
              kind: "material",
              materialType: "reading",
              title: "Pointers 101",
              body: "A pointer stores a memory address.",
              order: 0,
            },
            {
              key: "q-mcq-nullptr",
              kind: "question",
              questionType: "mcq",
              prompt: "Dereferencing a null pointer causes?",
              options: [
                { id: "a", text: "A compile error" },
                { id: "b", text: "Undefined behavior" },
                { id: "c", text: "A warning only" },
                { id: "d", text: "Nothing" },
              ],
              points: 1,
              order: 1,
              answer: { correctAnswer: "b" },
            },
          ],
        },
      ],
    },
  ],

  // ── Space reviews (B2C store space) ──
  spaceReviews: [
    {
      key: "rev-nandini",
      spaceKey: "space-store-mastery",
      reviewerKey: "s-nandini",
      rating: 5,
      comment: "The diagnostic test alone was worth it. Landed two onsites!",
    },
    {
      key: "rev-arjun",
      spaceKey: "space-store-mastery",
      reviewerKey: "s-arjun",
      rating: 4,
      comment: "Great content; wish there were more mock interviews.",
    },
    {
      key: "rev-fatima-dsa",
      spaceKey: "space-dsa",
      reviewerKey: "s-fatima",
      rating: 5,
      comment: "Best DSA refresher I have used.",
    },
  ],

  // ── Chat sessions (AI tutor) — messages always a subcollection (D6) ──
  chatSessions: [
    {
      key: "chat-nandini-bfs",
      spaceKey: "space-dsa",
      storyPointKey: "sp-dsa-graphs",
      itemKey: "q-code-bfs",
      studentKey: "s-nandini",
      agentKey: "interview-tutor",
      title: "Help with BFS",
      language: "en",
      isActive: true,
      systemPrompt:
        "Coach the learner toward a queue + visited-set BFS without giving the full code.",
      messages: [
        {
          key: "m1",
          role: "user",
          text: "I am stuck implementing BFS. Where do I start?",
          timestamp: "2026-02-01T10:00:00.000Z",
        },
        {
          key: "m2",
          role: "assistant",
          text: "Good question — what data structure guarantees you process nodes in the order you discover them?",
          timestamp: "2026-02-01T10:00:05.000Z",
          tokensUsed: 42,
        },
        { key: "m3", role: "user", text: "A queue!", timestamp: "2026-02-01T10:00:30.000Z" },
        {
          key: "m4",
          role: "assistant",
          text: "Exactly. Now, how will you avoid visiting the same node twice?",
          timestamp: "2026-02-01T10:00:35.000Z",
          tokensUsed: 38,
        },
      ],
    },
    {
      key: "chat-arjun-star",
      spaceKey: "space-behavioral",
      storyPointKey: "sp-beh-stories",
      itemKey: "q-essay-conflict",
      studentKey: "s-arjun",
      agentKey: "interview-tutor",
      title: "STAR feedback",
      language: "en",
      isActive: false,
      messages: [
        {
          key: "m1",
          role: "user",
          text: "Is my conflict story strong enough?",
          timestamp: "2026-02-02T14:00:00.000Z",
        },
        {
          key: "m2",
          role: "assistant",
          text: "It has a clear Situation and Action — but what was the measurable Result?",
          timestamp: "2026-02-02T14:00:06.000Z",
          tokensUsed: 51,
        },
      ],
    },
  ],

  // ── Learner progress across the published spaces ──
  progress: [
    {
      studentKey: "s-nandini",
      spaceKey: "space-dsa",
      overallPercentage: 68,
      pointsEarned: 28,
      totalPoints: 41,
      storyPoints: [
        {
          storyPointKey: "sp-dsa-foundations",
          completedItems: 6,
          totalItems: 6,
          pointsEarned: 5,
          totalPoints: 5,
          status: "completed",
        },
        {
          storyPointKey: "sp-dsa-trees",
          completedItems: 4,
          totalItems: 4,
          pointsEarned: 9,
          totalPoints: 10,
          status: "completed",
        },
        {
          storyPointKey: "sp-dsa-graphs",
          completedItems: 2,
          totalItems: 4,
          pointsEarned: 14,
          totalPoints: 23,
          status: "in_progress",
        },
        {
          storyPointKey: "sp-dsa-practice",
          completedItems: 0,
          totalItems: 4,
          pointsEarned: 0,
          totalPoints: 14,
          status: "not_started",
        },
      ],
    },
    {
      studentKey: "s-arjun",
      spaceKey: "space-behavioral",
      overallPercentage: 40,
      pointsEarned: 8,
      totalPoints: 20,
      storyPoints: [
        {
          storyPointKey: "sp-beh-star",
          completedItems: 5,
          totalItems: 5,
          pointsEarned: 7,
          totalPoints: 7,
          status: "completed",
        },
        {
          storyPointKey: "sp-beh-stories",
          completedItems: 1,
          totalItems: 4,
          pointsEarned: 1,
          totalPoints: 12,
          status: "in_progress",
        },
        {
          storyPointKey: "sp-beh-mock",
          completedItems: 0,
          totalItems: 4,
          pointsEarned: 0,
          totalPoints: 10,
          status: "not_started",
        },
      ],
    },
  ],

  // ── Test sessions (graded + in-progress for screen coverage) ──
  testSessions: [
    {
      key: "ts-nandini-trees",
      spaceKey: "space-dsa",
      storyPointKey: "sp-dsa-trees",
      studentKey: "s-nandini",
      sessionType: "quiz",
      status: "graded",
      attemptNumber: 1,
      isLatest: true,
      startedAt: "2026-02-01T09:30:00.000Z",
      submittedAt: "2026-02-01T09:42:00.000Z",
      answers: [
        {
          itemKey: "q-msq-traversal",
          answer: ["a", "b", "d"],
          evaluation: { score: 2, maxScore: 2, correct: true, feedback: "All three correct." },
        },
        {
          itemKey: "q-fill-bst",
          answer: "sorted",
          evaluation: { score: 1, maxScore: 1, correct: true },
        },
        {
          itemKey: "q-short-balance",
          answer: "To keep operations logarithmic and avoid O(n).",
          evaluation: { score: 2, maxScore: 2, correct: true, feedback: "Clear." },
        },
        {
          itemKey: "q-long-recursion",
          answer: "Each call adds a stack frame; the base case stops and frames pop.",
          markedForReview: true,
          evaluation: {
            score: 4,
            maxScore: 5,
            correct: false,
            feedback: "Good — add a concrete example next time.",
          },
        },
      ],
    },
    {
      key: "ts-fatima-graphs",
      spaceKey: "space-dsa",
      storyPointKey: "sp-dsa-graphs",
      studentKey: "s-fatima",
      sessionType: "timed_test",
      status: "in_progress",
      attemptNumber: 1,
      isLatest: true,
      serverDeadline: "2026-06-20T12:30:00.000Z",
      startedAt: "2026-06-20T12:00:00.000Z",
      answers: [
        {
          itemKey: "q-code-bfs",
          answer: "function bfs(adj,s){ /* in progress */ }",
          markedForReview: true,
        },
      ],
    },
  ],

  // ── Gamification ──
  achievements: [
    {
      key: "ach-first-space",
      name: "First Steps",
      description: "Completed your first story point",
      tier: "bronze",
      category: "milestone",
      criteria: { type: "storypoints_completed", target: 1 },
    },
    {
      key: "ach-dsa-master",
      name: "Algorithm Ace",
      description: "Scored 90%+ on a DSA timed test",
      tier: "gold",
      category: "mastery",
      criteria: { type: "high_score", target: 90 },
    },
    {
      key: "ach-streak-7",
      name: "7-Day Streak",
      description: "Studied 7 days in a row",
      tier: "silver",
      category: "streak",
      criteria: { type: "streak_days", target: 7 },
    },
  ],

  studentGamification: [
    {
      studentKey: "s-nandini",
      level: { level: 5, xp: 3200, tier: "gold" },
      unlockedAchievementKeys: ["ach-first-space", "ach-dsa-master"],
      streakDays: 9,
      longestStreak: 14,
      studyGoals: [
        {
          key: "goal-dsa",
          title: "Finish DSA by March",
          targetType: "storypoints_completed",
          targetCount: 4,
          startDate: "2026-02-01",
          endDate: "2026-03-31",
          currentCount: 2,
        },
      ],
      studySessions: [
        { key: "ss-1", date: "2026-02-01", minutes: 60, itemsCompleted: 8 },
        { key: "ss-2", date: "2026-02-02", minutes: 45, itemsCompleted: 5 },
      ],
    },
    {
      studentKey: "s-arjun",
      level: { level: 2, xp: 720, tier: "bronze" },
      unlockedAchievementKeys: ["ach-first-space"],
      streakDays: 3,
      longestStreak: 5,
    },
  ],

  // ── Announcements / notifications / insights / cost ──
  announcements: [
    {
      key: "anc-store-launch",
      title: "Interview Mastery Bootcamp is live!",
      body: "Our premium bootcamp is now on the store. Early-bird pricing this week.",
      scope: "tenant",
      status: "published",
      authorKey: "admin-studio",
      readByKeys: ["s-nandini"],
    },
  ],

  notifications: [
    {
      key: "ntf-nandini-ach",
      recipientKey: "s-nandini",
      type: "achievement_unlocked",
      title: "Achievement unlocked: Algorithm Ace",
      body: "You scored 90%+ on a DSA timed test!",
      payload: { achievementKey: "ach-dsa-master" },
      isRead: false,
    },
    {
      key: "ntf-arjun-review",
      recipientKey: "s-arjun",
      type: "chat_reply",
      title: "Your coach replied",
      body: "New feedback on your STAR story.",
      payload: { chatKey: "chat-arjun-star" },
      isRead: true,
    },
  ],

  insights: [
    {
      key: "ins-arjun-stalled",
      studentKey: "s-arjun",
      type: "stalled_progress",
      severity: "warning",
      message: 'Arjun has paused on "Craft Your Stories" for 5 days.',
    },
  ],

  costSummaries: [
    {
      key: "cost-d1",
      granularity: "daily",
      period: "2026-02-01",
      totalUsd: 0.0089,
      totalTokens: 7400,
      callCount: 6,
      byPurpose: { tutoring: 0.0031, answer_grading: 0.0058 },
    },
    {
      key: "cost-m1",
      granularity: "monthly",
      period: "2026-02",
      totalUsd: 0.214,
      totalTokens: 182000,
      callCount: 140,
      byPurpose: { tutoring: 0.072, answer_grading: 0.118, content_generation: 0.024 },
    },
  ],
};
