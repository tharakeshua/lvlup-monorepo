/**
 * testsession-progress — a FULL, self-contained SeedConfig fragment for the
 * `testsession-progress` domain (module `levelup`, codebase `functions/levelup`).
 *
 * It exercises every screen + entity the digital-test runtime and learning-progress
 * aggregation touch (SDK-LAYERS-PLAN §2.3 + sdk-plan/domains/testsession-progress.md):
 *
 *   • ~10 `DigitalTestSession` docs in MIXED states across multiple students:
 *       - in_progress (carry a server-authoritative `serverDeadline`, partial answers,
 *         markedForReview / visitedQuestions implied by per-item answers)
 *       - submitted / graded (full answers + per-item `StoredEvaluation` projections,
 *         autoSubmitted flag where the deadline lapsed)
 *       - expired (deadline in the past, no submittedAt, no scores)
 *       - multi-attempt history (isLatest=false older attempt + isLatest=true retry)
 *   • Per-item answers → the `submissions/{itemId}` subcollection (D6 — NOT a record-map);
 *     `markedForReview` rides on each `TestAnswerConfig` (the engine fans it into the
 *     session's bounded inline `markedForReview`/`visitedQuestions` booleans).
 *   • `SpaceProgress` (+ bounded `storyPoints[]` summary, D6) and the per-storyPoint
 *     `StoryPointProgress` rollups per (student, space) — server-derived, ISO-stamped,
 *     monotone best-score, kept INTERNALLY CONSISTENT with the sessions above.
 *   • Student/Class progress *summaries* surfaced via the analytics-authored read surface
 *     this domain consumes for dashboards — modelled here as `LearningInsight`s (at-risk +
 *     improvement) + gamification rollups (level/xp/streak/study sessions/goals) so every
 *     learner / parent / teacher screen has data.
 *
 * This is a SeedConfig FRAGMENT (one tenant subtree). FK references resolve WITHIN the
 * fragment by stable logical `key` convention — memberships→users, items→storyPoints→spaces,
 * progress→spaces+students, sessions→spaces+storyPoints+students. The engine turns every
 * `key` into a deterministic branded id via `seedId(kind, key)`, so re-seeding is idempotent
 * (no dupes) and ids are reproducible across runs.
 *
 * Timestamps are ISO-8601 (D4). All times are anchored to a single fixed epoch so the data is
 * deterministic and the mixed in_progress/expired states are reproducible regardless of when
 * the seed actually runs.
 */

import type { SeedConfig, TenantConfig } from "../config/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic time anchors (fixed epoch — keeps mixed session states reproducible)
// ─────────────────────────────────────────────────────────────────────────────

const ANCHOR = Date.parse("2026-02-10T09:00:00.000Z");
const iso = (offsetMs: number): string => new Date(ANCHOR + offsetMs).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// ─────────────────────────────────────────────────────────────────────────────
// Tenant subtree
// ─────────────────────────────────────────────────────────────────────────────

export const testsessionProgressTenant: TenantConfig = {
  key: "tsp",
  name: "LevelUp Test Lab",
  code: "TSP001",
  slug: "levelup-test-lab",
  status: "active",
  plan: "premium",
  contact: { email: "admin@tsp.levelup.dev", phone: "+91-80-9000-0001" },
  settings: { defaultLanguage: "en", timezone: "Asia/Kolkata" },
  features: { spaces: true, gamification: true, ai: true, exams: false },
  branding: { primaryColor: "#5B21B6" },
  geminiKeyRef: "tenant-tsp-gemini",

  academicSessions: [
    {
      key: "ay-2025-26",
      name: "2025-2026",
      startDate: "2025-06-01",
      endDate: "2026-04-30",
      isCurrent: true,
      status: "active",
    },
  ],

  // ── Classes (denorm filled from teacher/student keys at write time) ──────────
  classes: [
    {
      key: "c-dsa",
      name: "Grade 10 - Data Structures",
      grade: "10",
      section: "A",
      academicSessionKey: "ay-2025-26",
      teacherKeys: ["t-rao"],
      studentKeys: ["s-aarav", "s-diya", "s-rohan", "s-meera"],
      schedule: {
        days: ["Mon", "Wed", "Fri"],
        startTime: "09:00",
        endTime: "10:00",
        room: "Lab-1",
      },
    },
    {
      key: "c-algo",
      name: "Grade 10 - Algorithms",
      grade: "10",
      section: "B",
      academicSessionKey: "ay-2025-26",
      teacherKeys: ["t-rao"],
      studentKeys: ["s-aarav", "s-diya", "s-karan"],
    },
  ],

  admins: [
    {
      key: "admin-tsp",
      email: "principal@tsp.levelup.dev",
      password: "Admin@12345",
      firstName: "Latha",
      lastName: "Krishnan",
      staffPermissions: {
        canManageUsers: true,
        canManageClasses: true,
        canManageSettings: true,
        canViewAnalytics: true,
      },
    },
  ],

  teachers: [
    {
      key: "t-rao",
      email: "asha.rao@tsp.levelup.dev",
      password: "Teacher@123",
      firstName: "Asha",
      lastName: "Rao",
      subjects: ["Computer Science"],
      department: "Computer Science",
      designation: "Senior Teacher",
      classKeys: ["c-dsa", "c-algo"],
      permissions: {
        canCreateSpaces: true,
        canManageContent: true,
        canViewAnalytics: true,
        canManuallyGrade: true,
      },
    },
  ],

  students: [
    {
      key: "s-aarav",
      email: "aarav.patel@tsp.levelup.dev",
      password: "Student@123",
      firstName: "Aarav",
      lastName: "Patel",
      rollNumber: "TSP001",
      grade: "10",
      classKeys: ["c-dsa", "c-algo"],
    },
    {
      key: "s-diya",
      email: "diya.gupta@tsp.levelup.dev",
      password: "Student@123",
      firstName: "Diya",
      lastName: "Gupta",
      rollNumber: "TSP002",
      grade: "10",
      classKeys: ["c-dsa", "c-algo"],
    },
    {
      key: "s-rohan",
      email: "rohan.sharma@tsp.levelup.dev",
      password: "Student@123",
      firstName: "Rohan",
      lastName: "Sharma",
      rollNumber: "TSP003",
      grade: "10",
      classKeys: ["c-dsa"],
    },
    {
      key: "s-meera",
      email: "meera.iyer@tsp.levelup.dev",
      password: "Student@123",
      firstName: "Meera",
      lastName: "Iyer",
      rollNumber: "TSP004",
      grade: "10",
      classKeys: ["c-dsa"],
    },
    {
      key: "s-karan",
      email: "karan.singh@tsp.levelup.dev",
      password: "Student@123",
      firstName: "Karan",
      lastName: "Singh",
      rollNumber: "TSP005",
      grade: "10",
      classKeys: ["c-algo"],
    },
  ],

  parents: [
    {
      key: "par-patel",
      email: "rajesh.patel@gmail.com",
      password: "Parent@123",
      firstName: "Rajesh",
      lastName: "Patel",
      studentKeys: ["s-aarav"],
    },
    {
      key: "par-iyer",
      email: "shreya.iyer@gmail.com",
      password: "Parent@123",
      firstName: "Shreya",
      lastName: "Iyer",
      studentKeys: ["s-meera"],
    },
  ],

  // ── Rubric preset reused by short/long answer items ──────────────────────────
  rubricPresets: [
    {
      key: "rp-short-5pt",
      name: "Short Answer (5 pts)",
      description: "Standard 5-point short-answer rubric",
      rubric: {
        dimensions: [
          {
            key: "correctness",
            label: "Correctness",
            weight: 0.7,
            promptGuidance: "Is the final answer correct?",
          },
          { key: "reasoning", label: "Reasoning", weight: 0.3 },
        ],
        totalPoints: 5,
        passingScore: 3,
      },
    },
  ],

  // ── Spaces → StoryPoints → Items (the assessment content the sessions target) ─
  spaces: [
    {
      key: "sp-dsa",
      title: "Data Structures Fundamentals",
      description: "Arrays, stacks, queues, and complexity for Grade 10",
      type: "course",
      status: "published",
      subject: "Computer Science",
      classKeys: ["c-dsa"],
      ownerTeacherKey: "t-rao",
      storyPoints: [
        {
          key: "st-arrays",
          title: "Arrays & Complexity",
          description: "Big-O basics and array operations",
          type: "standard",
          order: 0,
          items: [
            {
              key: "it-read-bigo",
              kind: "material",
              materialType: "reading",
              title: "Understanding Big-O Notation",
              body: "Big-O describes how runtime grows with input size.",
              order: 0,
              durationSeconds: 300,
            },
            {
              key: "it-mcq-bigo",
              kind: "question",
              questionType: "mcq",
              prompt: "What is the time complexity of accessing an array element by index?",
              options: [
                { id: "a", text: "O(1)" },
                { id: "b", text: "O(log n)" },
                { id: "c", text: "O(n)" },
                { id: "d", text: "O(n^2)" },
              ],
              points: 1,
              order: 1,
              answer: { correctAnswer: "a" },
            },
            {
              key: "it-short-bigo",
              kind: "question",
              questionType: "short_answer",
              prompt: "In one sentence, explain why array insertion at the front is O(n).",
              points: 3,
              order: 2,
              answer: {
                correctAnswer:
                  "Because every existing element must be shifted one position to the right.",
                evaluationGuidance:
                  "Accept any phrasing capturing the shifting of subsequent elements.",
                modelAnswer:
                  "Inserting at the front requires shifting all n existing elements right, so the work scales with n.",
              },
              rubricPresetKey: "rp-short-5pt",
            },
          ],
        },
        {
          key: "st-stacks",
          title: "Stacks & Queues (Timed Test)",
          description: "A timed assessment on LIFO/FIFO structures",
          type: "timed_test",
          order: 1,
          durationSeconds: 1800,
          items: [
            {
              key: "it-tf-stack",
              kind: "question",
              questionType: "true_false",
              prompt: "A stack follows Last-In-First-Out (LIFO) ordering.",
              points: 1,
              order: 0,
              answer: { correctAnswer: true },
            },
            {
              key: "it-mcq-queue",
              kind: "question",
              questionType: "mcq",
              prompt: "Which operation removes an element from the front of a queue?",
              options: [
                { id: "a", text: "push" },
                { id: "b", text: "pop" },
                { id: "c", text: "enqueue" },
                { id: "d", text: "dequeue" },
              ],
              points: 1,
              order: 1,
              answer: { correctAnswer: "d" },
            },
            {
              key: "it-num-stack",
              kind: "question",
              questionType: "numeric",
              prompt: "After push(3), push(7), pop(), push(5), what value is on top of the stack?",
              points: 2,
              order: 2,
              answer: { correctAnswer: 5, acceptableAnswers: [5, "5"] },
            },
            {
              key: "it-long-queue",
              kind: "question",
              questionType: "long_answer",
              prompt:
                "Describe a real-world scenario where a queue is the right data structure and why.",
              points: 4,
              order: 3,
              answer: {
                correctAnswer:
                  "Any FIFO scenario such as a printer job queue, where requests are served in arrival order.",
                evaluationGuidance:
                  "Reward a valid FIFO example plus a justification tied to arrival order.",
                modelAnswer:
                  "A printer spooler queues jobs and prints them in the order received — FIFO guarantees fairness.",
              },
              rubricPresetKey: "rp-short-5pt",
            },
          ],
        },
      ],
    },
    {
      key: "sp-algo",
      title: "Sorting Algorithms",
      description: "Comparison sorts and their trade-offs",
      type: "course",
      status: "published",
      subject: "Computer Science",
      classKeys: ["c-algo"],
      ownerTeacherKey: "t-rao",
      storyPoints: [
        {
          key: "st-sorting-quiz",
          title: "Sorting Basics (Quiz)",
          description: "Quick quiz on sort complexities",
          type: "quiz",
          order: 0,
          durationSeconds: 600,
          items: [
            {
              key: "it-mcq-bubble",
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
              order: 0,
              answer: { correctAnswer: "c" },
            },
            {
              key: "it-msq-stable",
              kind: "question",
              questionType: "msq",
              prompt: "Select ALL stable sorting algorithms.",
              options: [
                { id: "a", text: "Merge Sort" },
                { id: "b", text: "Quick Sort" },
                { id: "c", text: "Insertion Sort" },
                { id: "d", text: "Heap Sort" },
              ],
              points: 2,
              order: 1,
              answer: { correctAnswer: ["a", "c"] },
            },
          ],
        },
      ],
    },
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // ~10 DigitalTestSessions — MIXED states across students & spaces.
  // Each `answers[]` entry becomes a `submissions/{itemId}` subdoc (D6).
  // ───────────────────────────────────────────────────────────────────────────
  testSessions: [
    // 1) IN-PROGRESS timed_test with live serverDeadline (Aarav, stacks).
    //    Partial answers + one markedForReview → visited/marked booleans on the doc.
    {
      key: "ts-aarav-stacks-live",
      spaceKey: "sp-dsa",
      storyPointKey: "st-stacks",
      studentKey: "s-aarav",
      sessionType: "timed_test",
      status: "in_progress",
      serverDeadline: iso(20 * MIN), // ~20 min remaining from anchor
      attemptNumber: 1,
      isLatest: true,
      startedAt: iso(-10 * MIN),
      answers: [
        { itemKey: "it-tf-stack", answer: true },
        { itemKey: "it-mcq-queue", answer: "d" },
        { itemKey: "it-num-stack", answer: null, markedForReview: true }, // visited, flagged, not answered
      ],
    },

    // 2) IN-PROGRESS quiz with live serverDeadline (Karan, sorting). Just started.
    {
      key: "ts-karan-sorting-live",
      spaceKey: "sp-algo",
      storyPointKey: "st-sorting-quiz",
      studentKey: "s-karan",
      sessionType: "quiz",
      status: "in_progress",
      serverDeadline: iso(8 * MIN),
      attemptNumber: 1,
      isLatest: true,
      startedAt: iso(-2 * MIN),
      answers: [{ itemKey: "it-mcq-bubble", answer: "c" }],
    },

    // 3) GRADED timed_test, all correct (Diya, stacks) — full StoredEvaluation per item.
    {
      key: "ts-diya-stacks-graded",
      spaceKey: "sp-dsa",
      storyPointKey: "st-stacks",
      studentKey: "s-diya",
      sessionType: "timed_test",
      status: "graded",
      serverDeadline: iso(-1 * DAY + 30 * MIN),
      attemptNumber: 1,
      isLatest: true,
      startedAt: iso(-1 * DAY),
      submittedAt: iso(-1 * DAY + 22 * MIN),
      answers: [
        {
          itemKey: "it-tf-stack",
          answer: true,
          evaluation: {
            score: 1,
            maxScore: 1,
            correct: true,
            feedback: "Correct — stacks are LIFO.",
          },
        },
        {
          itemKey: "it-mcq-queue",
          answer: "d",
          evaluation: {
            score: 1,
            maxScore: 1,
            correct: true,
            feedback: "Correct — dequeue removes from the front.",
          },
        },
        {
          itemKey: "it-num-stack",
          answer: 5,
          evaluation: {
            score: 2,
            maxScore: 2,
            correct: true,
            feedback: "Correct top-of-stack value.",
          },
        },
        {
          itemKey: "it-long-queue",
          answer: "A printer job queue serves jobs in arrival order.",
          markedForReview: true,
          evaluation: {
            score: 4,
            maxScore: 4,
            correct: true,
            feedback: "Strong FIFO example with justification.",
          },
        },
      ],
    },

    // 4) SUBMITTED (AI-pending) timed_test (Rohan, stacks) — long_answer still pending,
    //    deterministic items already scored. submittedAt set, status submitted (not graded).
    {
      key: "ts-rohan-stacks-pending",
      spaceKey: "sp-dsa",
      storyPointKey: "st-stacks",
      studentKey: "s-rohan",
      sessionType: "timed_test",
      status: "submitted",
      serverDeadline: iso(-3 * HOUR + 30 * MIN),
      attemptNumber: 1,
      isLatest: true,
      startedAt: iso(-3 * HOUR),
      submittedAt: iso(-3 * HOUR + 25 * MIN),
      answers: [
        {
          itemKey: "it-tf-stack",
          answer: false,
          evaluation: {
            score: 0,
            maxScore: 1,
            correct: false,
            feedback: "A stack is LIFO, not FIFO.",
          },
        },
        {
          itemKey: "it-mcq-queue",
          answer: "d",
          evaluation: { score: 1, maxScore: 1, correct: true, feedback: "Correct." },
        },
        {
          itemKey: "it-num-stack",
          answer: 5,
          evaluation: { score: 2, maxScore: 2, correct: true, feedback: "Correct." },
        },
        { itemKey: "it-long-queue", answer: "Waiting in line at a ticket counter is FIFO." }, // AI-pending: no evaluation yet
      ],
    },

    // 5) EXPIRED timed_test (Meera, stacks) — deadline lapsed, auto-submitted, partial answers,
    //    no submittedAt grading completion (only what was answered before expiry).
    {
      key: "ts-meera-stacks-expired",
      spaceKey: "sp-dsa",
      storyPointKey: "st-stacks",
      studentKey: "s-meera",
      sessionType: "timed_test",
      status: "expired",
      serverDeadline: iso(-2 * DAY), // deadline well in the past
      attemptNumber: 1,
      isLatest: true,
      startedAt: iso(-2 * DAY - 30 * MIN),
      answers: [
        { itemKey: "it-tf-stack", answer: true },
        { itemKey: "it-mcq-queue", answer: "c", markedForReview: true },
        // it-num-stack & it-long-queue never reached before expiry
      ],
    },

    // 6) GRADED quiz, partial (Aarav, sorting) — msq partially correct.
    {
      key: "ts-aarav-sorting-graded",
      spaceKey: "sp-algo",
      storyPointKey: "st-sorting-quiz",
      studentKey: "s-aarav",
      sessionType: "quiz",
      status: "graded",
      serverDeadline: iso(-4 * DAY + 10 * MIN),
      attemptNumber: 1,
      isLatest: true,
      startedAt: iso(-4 * DAY),
      submittedAt: iso(-4 * DAY + 7 * MIN),
      answers: [
        {
          itemKey: "it-mcq-bubble",
          answer: "c",
          evaluation: {
            score: 1,
            maxScore: 1,
            correct: true,
            feedback: "Correct — O(n^2) worst case.",
          },
        },
        {
          itemKey: "it-msq-stable",
          answer: ["a"],
          evaluation: {
            score: 1,
            maxScore: 2,
            correct: false,
            feedback: "Merge sort is stable, but you missed insertion sort.",
          },
        },
      ],
    },

    // 7) Multi-attempt history (Diya, sorting) — OLDER attempt, isLatest=false, lower score.
    {
      key: "ts-diya-sorting-attempt1",
      spaceKey: "sp-algo",
      storyPointKey: "st-sorting-quiz",
      studentKey: "s-diya",
      sessionType: "quiz",
      status: "graded",
      serverDeadline: iso(-6 * DAY + 10 * MIN),
      attemptNumber: 1,
      isLatest: false,
      startedAt: iso(-6 * DAY),
      submittedAt: iso(-6 * DAY + 6 * MIN),
      answers: [
        {
          itemKey: "it-mcq-bubble",
          answer: "b",
          evaluation: {
            score: 0,
            maxScore: 1,
            correct: false,
            feedback: "Bubble sort worst case is O(n^2).",
          },
        },
        {
          itemKey: "it-msq-stable",
          answer: ["a", "c"],
          evaluation: {
            score: 2,
            maxScore: 2,
            correct: true,
            feedback: "Both stable sorts selected.",
          },
        },
      ],
    },

    // 8) Multi-attempt history (Diya, sorting) — LATEST retry, isLatest=true, best score.
    {
      key: "ts-diya-sorting-attempt2",
      spaceKey: "sp-algo",
      storyPointKey: "st-sorting-quiz",
      studentKey: "s-diya",
      sessionType: "quiz",
      status: "graded",
      serverDeadline: iso(-5 * DAY + 10 * MIN),
      attemptNumber: 2,
      isLatest: true,
      startedAt: iso(-5 * DAY),
      submittedAt: iso(-5 * DAY + 5 * MIN),
      answers: [
        {
          itemKey: "it-mcq-bubble",
          answer: "c",
          evaluation: { score: 1, maxScore: 1, correct: true, feedback: "Correct." },
        },
        {
          itemKey: "it-msq-stable",
          answer: ["a", "c"],
          evaluation: { score: 2, maxScore: 2, correct: true, feedback: "Perfect." },
        },
      ],
    },

    // 9) PRACTICE standard session (Aarav, arrays) — non-timed, recordItemAttempt path.
    {
      key: "ts-aarav-arrays-practice",
      spaceKey: "sp-dsa",
      storyPointKey: "st-arrays",
      studentKey: "s-aarav",
      sessionType: "practice",
      status: "graded",
      attemptNumber: 1,
      isLatest: true,
      startedAt: iso(-7 * DAY),
      submittedAt: iso(-7 * DAY + 12 * MIN),
      answers: [
        {
          itemKey: "it-mcq-bigo",
          answer: "a",
          evaluation: {
            score: 1,
            maxScore: 1,
            correct: true,
            feedback: "Correct — O(1) indexed access.",
          },
        },
        {
          itemKey: "it-short-bigo",
          answer: "Because all later elements shift right by one.",
          evaluation: {
            score: 3,
            maxScore: 3,
            correct: true,
            feedback: "Captures the shift cost precisely.",
          },
        },
      ],
    },

    // 10) EXPIRED quiz (Diya, sorting) — an abandoned/expired attempt with no answers reached.
    {
      key: "ts-diya-sorting-expired",
      spaceKey: "sp-algo",
      storyPointKey: "st-sorting-quiz",
      studentKey: "s-diya",
      sessionType: "quiz",
      status: "expired",
      serverDeadline: iso(-8 * DAY),
      attemptNumber: 3,
      isLatest: false,
      startedAt: iso(-8 * DAY - 10 * MIN),
      answers: [],
    },
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // SpaceProgress (+ bounded storyPoints[] summary) per (student, space).
  // Server-derived, ISO-stamped via engine; kept CONSISTENT with the sessions:
  //   - graded/submitted sessions advance the matching storyPoint summary
  //   - best-score monotonicity reflected (Diya sorting attempt2 wins over attempt1)
  // ───────────────────────────────────────────────────────────────────────────
  progress: [
    // Aarav — DSA: arrays practice complete; stacks in progress (live session, not submitted)
    {
      studentKey: "s-aarav",
      spaceKey: "sp-dsa",
      overallPercentage: 60,
      pointsEarned: 4,
      totalPoints: 12,
      storyPoints: [
        {
          storyPointKey: "st-arrays",
          completedItems: 3,
          totalItems: 3,
          pointsEarned: 4,
          totalPoints: 4,
          status: "completed",
        },
        {
          storyPointKey: "st-stacks",
          completedItems: 0,
          totalItems: 4,
          pointsEarned: 0,
          totalPoints: 8,
          status: "in_progress",
        },
      ],
    },
    // Aarav — Algo: sorting quiz graded (partial)
    {
      studentKey: "s-aarav",
      spaceKey: "sp-algo",
      overallPercentage: 67,
      pointsEarned: 2,
      totalPoints: 3,
      storyPoints: [
        {
          storyPointKey: "st-sorting-quiz",
          completedItems: 2,
          totalItems: 2,
          pointsEarned: 2,
          totalPoints: 3,
          status: "completed",
        },
      ],
    },
    // Diya — DSA: stacks graded full marks
    {
      studentKey: "s-diya",
      spaceKey: "sp-dsa",
      overallPercentage: 67,
      pointsEarned: 8,
      totalPoints: 12,
      storyPoints: [
        {
          storyPointKey: "st-arrays",
          completedItems: 0,
          totalItems: 3,
          pointsEarned: 0,
          totalPoints: 4,
          status: "not_started",
        },
        {
          storyPointKey: "st-stacks",
          completedItems: 4,
          totalItems: 4,
          pointsEarned: 8,
          totalPoints: 8,
          status: "completed",
        },
      ],
    },
    // Diya — Algo: sorting quiz, best of two attempts (attempt2 = 3/3)
    {
      studentKey: "s-diya",
      spaceKey: "sp-algo",
      overallPercentage: 100,
      pointsEarned: 3,
      totalPoints: 3,
      storyPoints: [
        {
          storyPointKey: "st-sorting-quiz",
          completedItems: 2,
          totalItems: 2,
          pointsEarned: 3,
          totalPoints: 3,
          status: "completed",
        },
      ],
    },
    // Rohan — DSA: stacks submitted (AI-pending) → still in_progress until graded
    {
      studentKey: "s-rohan",
      spaceKey: "sp-dsa",
      overallPercentage: 25,
      pointsEarned: 3,
      totalPoints: 12,
      storyPoints: [
        {
          storyPointKey: "st-arrays",
          completedItems: 0,
          totalItems: 3,
          pointsEarned: 0,
          totalPoints: 4,
          status: "not_started",
        },
        {
          storyPointKey: "st-stacks",
          completedItems: 3,
          totalItems: 4,
          pointsEarned: 3,
          totalPoints: 8,
          status: "in_progress",
        },
      ],
    },
    // Meera — DSA: stacks expired → partial / in_progress, low completion (at-risk)
    {
      studentKey: "s-meera",
      spaceKey: "sp-dsa",
      overallPercentage: 8,
      pointsEarned: 1,
      totalPoints: 12,
      storyPoints: [
        {
          storyPointKey: "st-arrays",
          completedItems: 0,
          totalItems: 3,
          pointsEarned: 0,
          totalPoints: 4,
          status: "not_started",
        },
        {
          storyPointKey: "st-stacks",
          completedItems: 1,
          totalItems: 4,
          pointsEarned: 1,
          totalPoints: 8,
          status: "in_progress",
        },
      ],
    },
    // Karan — Algo: sorting quiz in progress (live)
    {
      studentKey: "s-karan",
      spaceKey: "sp-algo",
      overallPercentage: 33,
      pointsEarned: 1,
      totalPoints: 3,
      storyPoints: [
        {
          storyPointKey: "st-sorting-quiz",
          completedItems: 1,
          totalItems: 2,
          pointsEarned: 1,
          totalPoints: 3,
          status: "in_progress",
        },
      ],
    },
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // Gamification rollups — feed Student summary dashboards (level/xp/streak/
  // study sessions/goals). Kept consistent with each student's progress above.
  // ───────────────────────────────────────────────────────────────────────────
  achievements: [
    {
      key: "ach-first-test",
      name: "First Test Complete",
      description: "Completed your first test",
      tier: "bronze",
      category: "milestone",
      criteria: { type: "tests_completed", target: 1 },
    },
    {
      key: "ach-perfect-quiz",
      name: "Perfect Quiz",
      description: "Scored 100% on a quiz",
      tier: "gold",
      category: "performance",
      criteria: { type: "perfect_quiz", target: 1 },
    },
    {
      key: "ach-streak-5",
      name: "5-Day Streak",
      description: "Studied 5 days in a row",
      tier: "silver",
      category: "streak",
      criteria: { type: "streak_days", target: 5 },
    },
  ],

  studentGamification: [
    {
      studentKey: "s-aarav",
      level: { level: 4, xp: 1820, tier: "silver" },
      unlockedAchievementKeys: ["ach-first-test", "ach-streak-5"],
      streakDays: 6,
      longestStreak: 11,
      studyGoals: [
        {
          key: "goal-dsa",
          title: "Finish Data Structures",
          targetType: "items_completed",
          targetCount: 14,
          startDate: "2026-01-15",
          endDate: "2026-02-28",
          currentCount: 8,
        },
      ],
      studySessions: [
        { key: "ssn-a1", date: "2026-02-07", minutes: 40, itemsCompleted: 4 },
        { key: "ssn-a2", date: "2026-02-08", minutes: 35, itemsCompleted: 3 },
        { key: "ssn-a3", date: "2026-02-09", minutes: 50, itemsCompleted: 5 },
      ],
    },
    {
      studentKey: "s-diya",
      level: { level: 5, xp: 2410, tier: "gold" },
      unlockedAchievementKeys: ["ach-first-test", "ach-perfect-quiz", "ach-streak-5"],
      streakDays: 9,
      longestStreak: 14,
      studyGoals: [
        {
          key: "goal-algo",
          title: "Ace Sorting",
          targetType: "tests_passed",
          targetCount: 3,
          startDate: "2026-01-20",
          endDate: "2026-03-01",
          currentCount: 2,
          completed: false,
        },
      ],
      studySessions: [
        { key: "ssn-d1", date: "2026-02-06", minutes: 55, itemsCompleted: 6 },
        { key: "ssn-d2", date: "2026-02-08", minutes: 45, itemsCompleted: 4 },
        { key: "ssn-d3", date: "2026-02-09", minutes: 60, itemsCompleted: 5 },
      ],
    },
    {
      studentKey: "s-rohan",
      level: { level: 2, xp: 540, tier: "bronze" },
      unlockedAchievementKeys: ["ach-first-test"],
      streakDays: 2,
      longestStreak: 4,
    },
    {
      studentKey: "s-meera",
      level: { level: 1, xp: 120, tier: "bronze" },
      streakDays: 0,
      longestStreak: 3,
    },
    {
      studentKey: "s-karan",
      level: { level: 2, xp: 610, tier: "bronze" },
      unlockedAchievementKeys: ["ach-first-test"],
      streakDays: 3,
      longestStreak: 5,
    },
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // LearningInsights — the analytics-authored stream this domain reads for
  // student/parent/teacher dashboards (at-risk + improvement signals).
  // Consistent with progress: Meera at-risk (expired + low completion), Diya improving.
  // ───────────────────────────────────────────────────────────────────────────
  insights: [
    {
      key: "ins-meera-atrisk",
      studentKey: "s-meera",
      type: "at_risk",
      severity: "critical",
      message:
        "Meera let the Stacks & Queues timed test expire with only 8% completion. Recommend a guided retry.",
    },
    {
      key: "ins-rohan-pending",
      studentKey: "s-rohan",
      type: "pending_grade",
      severity: "info",
      message: "Rohan has a submitted test awaiting AI grading on the long-answer question.",
    },
    {
      key: "ins-diya-improving",
      studentKey: "s-diya",
      type: "improvement",
      severity: "info",
      message: "Diya improved from 50% to 100% on the Sorting Basics quiz across two attempts.",
    },
    {
      key: "ins-aarav-streak",
      studentKey: "s-aarav",
      type: "engagement",
      severity: "info",
      message: "Aarav is on a 6-day study streak — encourage finishing the Stacks timed test.",
      dismissed: true,
    },
  ],

  // ───────────────────────────────────────────────────────────────────────────
  // Notifications — surfaced by the dashboards consuming this domain's progress.
  // ───────────────────────────────────────────────────────────────────────────
  notifications: [
    {
      key: "ntf-diya-graded",
      recipientKey: "s-diya",
      type: "test_graded",
      title: "Your Stacks & Queues test was graded",
      body: "You scored 8/8. Excellent work!",
      payload: {
        sessionKey: "ts-diya-stacks-graded",
        spaceKey: "sp-dsa",
        storyPointKey: "st-stacks",
      },
      isRead: false,
    },
    {
      key: "ntf-rohan-pending",
      recipientKey: "s-rohan",
      type: "test_grading_pending",
      title: "Your test is being graded",
      body: "Your long-answer response is in the AI grading queue.",
      payload: { sessionKey: "ts-rohan-stacks-pending" },
      isRead: false,
    },
    {
      key: "ntf-parent-meera-atrisk",
      recipientKey: "par-iyer",
      type: "child_at_risk",
      title: "Meera needs attention",
      body: "A timed test expired with low completion. Consider reviewing together.",
      payload: { studentKey: "s-meera" },
      isRead: false,
    },
  ],
};

/**
 * The exported SeedConfig fragment the engine consumes. It is a complete, standalone
 * config (one tenant subtree) so it can be seeded on its own OR spread into a larger
 * `tenants[]` composition. Deterministic logical keys keep re-seeds idempotent.
 */
export const testsessionProgressSeed: SeedConfig = {
  version: "1.0.0",
  tenants: [testsessionProgressTenant],
};

export default testsessionProgressSeed;
