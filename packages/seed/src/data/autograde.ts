/**
 * Autograde mock dataset — a dedicated tenant subtree ("Northgate Public School") that exercises
 * EVERY autograde entity type + every grading screen, end to end:
 *
 *   Exam (+ExamQuestionPaper/GradingConfig/Stats), ExamQuestion (+SubQuestion + embedded
 *   UnifiedRubric snapshot), Submission (+AnswerSheetData/ScoutingResult/Summary), QuestionSubmission
 *   (+QuestionMapping/ManualOverride + UnifiedEvaluationResult carrying score/confidence/cost),
 *   EvaluationSettings (per tenant), GradingDeadLetterEntry.
 *
 * It is authored as a `TenantConfig` (the SeedConfig fragment the engine consumes). Deterministic
 * LOGICAL keys → the engine resolves stable branded ids, so re-seeding is idempotent. All FK
 * references resolve by logical key within this tenant:
 *   memberships→users, exam.classKeys→classes, exam.linkedSpaceKey→spaces, exam.questions→exam,
 *   submission.examKey→exams, submission.studentKey→students, questionSubmission.questionKey→
 *   exam.questions, gradingDeadLetter.submissionKey→submissions.
 *
 * Shapes mirror the @levelup/domain autograde Zod-first entities (SDK-LAYERS-PLAN §2.5 + autograde.md):
 *   ISO-8601 timestamps (engine-stamped), `authUid`/`uploadedBy`/`overriddenBy`/`resolvedBy` are the
 *   auth uid (resolved from `*Key`), branded ids, closed `uploadSource: web|scanner|rn` union,
 *   embedded resolved `rubric` snapshot on questions, answer-sheet **Storage paths** (not bytes),
 *   `pipelineStatus` state machine, ⚷ scores/cost stored server-side & released-gated.
 *
 * Exam status coverage (mixed, per the four `ALLOWED_TRANSITIONS.exam` reachable states the UI shows):
 *   - exam-eng-draft       → draft               (authoring; no submissions)
 *   - exam-sci-active      → published           (open; some uploaded/scouting submissions, pre-grade)
 *   - exam-math-grading    → grading             (pipeline mid-flight; graded/partial/failed/manual mix)
 *   - exam-hist-released   → released (domain results_released)  (finalized; student/parent-visible)
 *
 * ~30 submissions total across these exams. Graded submissions carry per-question
 * UnifiedEvaluationResult (score/confidence/cost); pre-release ones omit released scores/summary.
 */

import type { TenantConfig } from "../config/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Storage-path helpers (answer sheets / question papers are tenant Storage paths, not bytes)
// ─────────────────────────────────────────────────────────────────────────────

const TENANT = "northgate";
const paperPath = (examKey: string, n: number) =>
  `tenants/${TENANT}/exams/${examKey}/question-paper/page-${n}.png`;
const sheetPath = (subKey: string, n: number) =>
  `tenants/${TENANT}/submissions/${subKey}/answer-sheets/page-${n}.jpg`;

// ─────────────────────────────────────────────────────────────────────────────
// Roster — 3 classes, 2 teachers, 12 students, 2 parents, 1 scanner, 1 admin
// ─────────────────────────────────────────────────────────────────────────────

const STUDENTS = [
  { key: "s-aanya", first: "Aanya", last: "Reddy", roll: "NG2025-01", cls: "c9-math" },
  { key: "s-vihaan", first: "Vihaan", last: "Joshi", roll: "NG2025-02", cls: "c9-math" },
  { key: "s-ananya", first: "Ananya", last: "Pillai", roll: "NG2025-03", cls: "c9-math" },
  { key: "s-arjun", first: "Arjun", last: "Mehta", roll: "NG2025-04", cls: "c9-math" },
  { key: "s-ishaan", first: "Ishaan", last: "Verma", roll: "NG2025-05", cls: "c9-sci" },
  { key: "s-saanvi", first: "Saanvi", last: "Rao", roll: "NG2025-06", cls: "c9-sci" },
  { key: "s-kabir", first: "Kabir", last: "Khan", roll: "NG2025-07", cls: "c9-sci" },
  { key: "s-myra", first: "Myra", last: "Das", roll: "NG2025-08", cls: "c9-sci" },
  { key: "s-reyansh", first: "Reyansh", last: "Nair", roll: "NG2025-09", cls: "c10-hist" },
  { key: "s-aaradhya", first: "Aaradhya", last: "Bose", roll: "NG2025-10", cls: "c10-hist" },
  { key: "s-dhruv", first: "Dhruv", last: "Kapoor", roll: "NG2025-11", cls: "c10-hist" },
  { key: "s-anvi", first: "Anvi", last: "Sharma", roll: "NG2025-12", cls: "c10-hist" },
] as const;

const fullName = (s: { first: string; last: string }) => `${s.first} ${s.last}`;
const studentsIn = (cls: string) => STUDENTS.filter((s) => s.cls === cls);

// ─────────────────────────────────────────────────────────────────────────────
// Shared UnifiedRubric snapshots (embedded by value on questions — extraction-resolved)
// ─────────────────────────────────────────────────────────────────────────────

const rubric5pt = (modelAnswer?: string) => ({
  dimensions: [
    {
      key: "correctness",
      label: "Correctness",
      weight: 0.6,
      promptGuidance: "Is the final result correct and complete?",
    },
    {
      key: "method",
      label: "Method / Working",
      weight: 0.4,
      promptGuidance: "Award partial credit for correct approach.",
    },
  ],
  totalPoints: 5,
  passingScore: 3,
  ...(modelAnswer ? { modelAnswer } : {}),
});

const rubric10pt = (modelAnswer?: string) => ({
  dimensions: [
    {
      key: "accuracy",
      label: "Accuracy",
      weight: 0.5,
      promptGuidance: "Factual / numerical correctness.",
    },
    {
      key: "reasoning",
      label: "Reasoning",
      weight: 0.3,
      promptGuidance: "Logical, well-justified steps.",
    },
    { key: "clarity", label: "Clarity", weight: 0.2 },
  ],
  totalPoints: 10,
  passingScore: 6,
  ...(modelAnswer ? { modelAnswer } : {}),
});

// ─────────────────────────────────────────────────────────────────────────────
// Submission builders — keep the ~30 submissions internally consistent & terse
// ─────────────────────────────────────────────────────────────────────────────

type QS = NonNullable<TenantConfig["submissions"]>[number]["questionSubmissions"];
type Sub = NonNullable<TenantConfig["submissions"]>[number];

/** A graded+released submission: every QS graded, summary released, ⚷ cost present. */
function releasedSub(opts: {
  key: string;
  examKey: string;
  studentKey: string;
  classKey: string;
  qs: QS;
  maxScore: number;
  grade?: string;
  uploadSource?: "web" | "scanner" | "rn";
  uploadedByKey?: string;
}): Sub {
  const s = STUDENTS.find((x) => x.key === opts.studentKey)!;
  const total = (opts.qs ?? []).reduce(
    (sum, q) => sum + (q.manualOverride?.score ?? q.evaluation?.score ?? 0),
    0
  );
  return {
    key: opts.key,
    examKey: opts.examKey,
    studentKey: opts.studentKey,
    classKey: opts.classKey,
    uploadSource: opts.uploadSource ?? "scanner",
    uploadedByKey: opts.uploadedByKey ?? "scanner-1",
    status: "released",
    pipelineStatus: "reviewed",
    resultsReleased: true,
    resultsReleasedByKey: "t-ramesh",
    resultsReleasedAt: "2025-12-18T10:00:00.000Z",
    studentName: fullName(s),
    rollNumber: s.roll,
    answerSheetImages: [sheetPath(opts.key, 1), sheetPath(opts.key, 2)],
    scoutingResult: {
      routingMap: Object.fromEntries((opts.qs ?? []).map((q, i) => [q.questionKey, [i, i + 1]])),
      confidence: Object.fromEntries((opts.qs ?? []).map((q) => [q.questionKey, 0.93])),
      completedAt: "2025-12-17T08:05:00.000Z",
    },
    gradingProgress: { graded: (opts.qs ?? []).length, total: (opts.qs ?? []).length },
    questionSubmissions: opts.qs,
    summary: {
      totalScore: total,
      maxScore: opts.maxScore,
      percentage: Math.round((total / opts.maxScore) * 1000) / 10,
      grade: opts.grade,
      questionsGraded: (opts.qs ?? []).length,
      totalQuestions: (opts.qs ?? []).length,
    },
  };
}

/** A submission mid-grading: graded ⚷ scores exist server-side but results NOT released (no summary visible). */
function gradingSub(opts: {
  key: string;
  examKey: string;
  studentKey: string;
  classKey: string;
  qs: QS;
  pipelineStatus:
    | "grading"
    | "grading_partial"
    | "grading_failed"
    | "manual_review_needed"
    | "grading_complete";
  retryCount?: number;
}): Sub {
  const s = STUDENTS.find((x) => x.key === opts.studentKey)!;
  const graded = (opts.qs ?? []).filter(
    (q) =>
      q.gradingStatus === "graded" ||
      q.gradingStatus === "overridden" ||
      q.gradingStatus === "manual"
  ).length;
  return {
    key: opts.key,
    examKey: opts.examKey,
    studentKey: opts.studentKey,
    classKey: opts.classKey,
    uploadSource: "scanner",
    uploadedByKey: "scanner-1",
    status: "grading",
    pipelineStatus: opts.pipelineStatus,
    retryCount: opts.retryCount ?? 0,
    resultsReleased: false,
    studentName: fullName(s),
    rollNumber: s.roll,
    answerSheetImages: [sheetPath(opts.key, 1), sheetPath(opts.key, 2)],
    scoutingResult: {
      routingMap: Object.fromEntries((opts.qs ?? []).map((q, i) => [q.questionKey, [i, i + 1]])),
      confidence: Object.fromEntries((opts.qs ?? []).map((q) => [q.questionKey, 0.88])),
      completedAt: "2025-12-20T07:40:00.000Z",
    },
    gradingProgress: { graded, total: (opts.qs ?? []).length, batchIndex: 1 },
    questionSubmissions: opts.qs,
    // No released summary while grading: scores are ⚷ until releaseResults.
  };
}

/** A pre-grade submission on a published exam: uploaded or scouting; NO scores, NO summary. */
function preGradeSub(opts: {
  key: string;
  examKey: string;
  studentKey: string;
  classKey: string;
  pipelineStatus: "uploaded" | "scouting" | "scouting_complete" | "scouting_failed";
  questionKeys?: string[];
  uploadSource?: "web" | "scanner" | "rn";
}): Sub {
  const s = STUDENTS.find((x) => x.key === opts.studentKey)!;
  const scouted = opts.pipelineStatus === "scouting_complete";
  return {
    key: opts.key,
    examKey: opts.examKey,
    studentKey: opts.studentKey,
    classKey: opts.classKey,
    uploadSource: opts.uploadSource ?? "scanner",
    uploadedByKey: opts.uploadSource === "web" ? "t-deepa" : "scanner-1",
    status: opts.pipelineStatus === "uploaded" ? "pending" : "scouting",
    pipelineStatus: opts.pipelineStatus,
    resultsReleased: false,
    studentName: fullName(s),
    rollNumber: s.roll,
    answerSheetImages: [sheetPath(opts.key, 1), sheetPath(opts.key, 2)],
    ...(scouted && opts.questionKeys
      ? {
          scoutingResult: {
            routingMap: Object.fromEntries(opts.questionKeys.map((q, i) => [q, [i, i + 1]])),
            confidence: Object.fromEntries(opts.questionKeys.map((q) => [q, 0.9])),
            completedAt: "2025-12-21T09:10:00.000Z",
          },
          questionSubmissions: opts.questionKeys.map((q) => ({
            questionKey: q,
            gradingStatus: "pending" as const,
            mapping: { pageIndices: [0, 1], imageUrls: [sheetPath(opts.key, 1)] },
          })),
        }
      : {}),
    // No evaluation, no summary: pre-release.
  };
}

// QS factory: a graded question-submission carrying a UnifiedEvaluationResult (⚷ score/confidence/cost).
function gradedQS(
  questionKey: string,
  score: number,
  maxScore: number,
  confidence: number,
  feedback: string
): NonNullable<QS>[number] {
  return {
    questionKey,
    gradingStatus: "graded",
    mapping: { pageIndices: [0, 1] },
    evaluation: {
      score,
      maxScore,
      confidence,
      feedback,
      strengths: ["Clear final answer"],
      improvements: score < maxScore ? ["Show intermediate steps"] : [],
      cost: {
        tokensIn: 1100 + score * 20,
        tokensOut: 260 + score * 10,
        usd: Math.round((0.0015 + score * 0.0001) * 10000) / 10000,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The tenant
// ─────────────────────────────────────────────────────────────────────────────

export const autogradeTenant: TenantConfig = {
  key: TENANT,
  name: "Northgate Public School",
  code: "NGP003",
  status: "active",
  plan: "premium",
  contact: { email: "admin@northgate.edu", phone: "+91-44-3333-4444" },
  features: { exams: true, spaces: true, gamification: false, ai: true },
  branding: { primaryColor: "#1565C0" },
  geminiKeyRef: "tenant-northgate-gemini",

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
      key: "c9-math",
      name: "Grade 9 - Mathematics",
      grade: "9",
      section: "A",
      academicSessionKey: "2025-26",
      teacherKeys: ["t-ramesh"],
      studentKeys: studentsIn("c9-math").map((s) => s.key),
      schedule: {
        days: ["Mon", "Tue", "Thu"],
        startTime: "08:30",
        endTime: "09:30",
        room: "B-204",
      },
    },
    {
      key: "c9-sci",
      name: "Grade 9 - Science",
      grade: "9",
      section: "A",
      academicSessionKey: "2025-26",
      teacherKeys: ["t-deepa"],
      studentKeys: studentsIn("c9-sci").map((s) => s.key),
    },
    {
      key: "c10-hist",
      name: "Grade 10 - History",
      grade: "10",
      section: "B",
      academicSessionKey: "2025-26",
      teacherKeys: ["t-deepa"],
      studentKeys: studentsIn("c10-hist").map((s) => s.key),
    },
  ],

  admins: [
    {
      key: "admin-main",
      email: "principal@northgate.edu",
      password: "Admin@12345",
      firstName: "Sunita",
      lastName: "Iyer",
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
      key: "t-ramesh",
      email: "ramesh.gupta@northgate.edu",
      password: "Teacher@123",
      firstName: "Ramesh",
      lastName: "Gupta",
      subjects: ["Mathematics"],
      department: "Mathematics",
      designation: "Head of Department",
      classKeys: ["c9-math"],
      permissions: {
        canCreateExams: true,
        canEditRubrics: true,
        canManuallyGrade: true,
        canCreateSpaces: true,
        canManageContent: true,
        canViewAnalytics: true,
      },
    },
    {
      key: "t-deepa",
      email: "deepa.menon@northgate.edu",
      password: "Teacher@123",
      firstName: "Deepa",
      lastName: "Menon",
      subjects: ["Science", "History"],
      department: "Science",
      classKeys: ["c9-sci", "c10-hist"],
      permissions: {
        canCreateExams: true,
        canEditRubrics: true,
        canManuallyGrade: true,
        canViewAnalytics: true,
      },
    },
  ],

  students: STUDENTS.map((s) => ({
    key: s.key,
    email: `${s.key.replace(/^s-/, "")}@northgate.edu`,
    password: "Student@123",
    firstName: s.first,
    lastName: s.last,
    rollNumber: s.roll,
    grade: s.cls === "c10-hist" ? "10" : "9",
    classKeys: [s.cls],
  })),

  parents: [
    {
      key: "p-reddy",
      email: "mohan.reddy@gmail.com",
      password: "Parent@123",
      firstName: "Mohan",
      lastName: "Reddy",
      studentKeys: ["s-aanya"],
    },
    {
      key: "p-nair",
      email: "lakshmi.nair@gmail.com",
      password: "Parent@123",
      firstName: "Lakshmi",
      lastName: "Nair",
      studentKeys: ["s-reyansh"],
    },
  ],

  scanners: [
    {
      key: "scanner-1",
      email: "scanner.hall@northgate.edu",
      password: "Scanner@123",
      label: "Exam Hall Scanner 1",
    },
  ],

  // A linked space so exam→space/storyPoint FK linkage resolves (linkedSpaceKey/linkedStoryPointKey).
  spaces: [
    {
      key: "space-quad",
      title: "Quadratic Equations",
      description: "Grade 9 quadratics — backs the linked math midterm exam.",
      type: "course",
      status: "published",
      subject: "Mathematics",
      classKeys: ["c9-math"],
      ownerTeacherKey: "t-ramesh",
      storyPoints: [
        {
          key: "sp-quad-test",
          title: "Quadratics Assessment",
          type: "timed_test",
          order: 0,
          durationSeconds: 2700,
          items: [
            {
              key: "i-quad-factor",
              kind: "question",
              questionType: "numeric",
              prompt: "Solve x² - 5x + 6 = 0 (smaller root).",
              points: 5,
              order: 0,
              answer: {
                correctAnswer: 2,
                acceptableAnswers: [2, "2"],
                modelAnswer: "x = 2 or x = 3; smaller root is 2.",
              },
            },
          ],
        },
      ],
    },
  ],

  // EvaluationSettings per tenant: a default + a stricter public preset (thresholds are ⚷).
  evaluationSettings: [
    {
      key: "eval-default",
      name: "Northgate Default Auto-grade",
      confidenceConfig: { lowThreshold: 0.7, highThreshold: 0.9 },
      autoReleaseThreshold: 0.9,
      rubricPresetKey: "rp-strict",
    },
    {
      key: "eval-strict",
      name: "Strict (Board-aligned)",
      confidenceConfig: { lowThreshold: 0.75, highThreshold: 0.92 },
      autoReleaseThreshold: 0.92,
    },
  ],

  rubricPresets: [
    {
      key: "rp-strict",
      name: "Board Long-answer (10 pts)",
      description: "Board-aligned 10-point long-answer rubric",
      rubric: rubric10pt(),
    },
  ],

  // ─── Exams: 4, mixed statuses, each 4-6 questions, some with subQuestions ────────────────────
  exams: [
    // (1) DRAFT — authoring stage, no submissions yet. 5 questions, one with subQuestions.
    {
      key: "exam-eng-draft",
      title: "Grade 9 English — Unit Test (Draft)",
      subject: "English",
      topics: ["Comprehension", "Grammar", "Writing"],
      classKeys: ["c9-math"],
      examDate: "2026-01-20",
      durationMinutes: 60,
      totalMarks: 30,
      passingMarks: 12,
      academicSessionKey: "2025-26",
      status: "draft",
      ownerTeacherKey: "t-deepa",
      evaluationSettingsKey: "eval-default",
      questions: [
        {
          key: "q1",
          text: "Define a metaphor and give one example.",
          maxMarks: 4,
          order: 0,
          questionType: "short_answer",
          rubric: rubric5pt(),
        },
        {
          key: "q2",
          text: 'Correct the grammar: "She do not likes apples."',
          maxMarks: 4,
          order: 1,
          questionType: "short_answer",
          rubric: rubric5pt("She does not like apples."),
        },
        {
          key: "q3",
          text: "Read the passage and answer.",
          maxMarks: 8,
          order: 2,
          questionType: "long_answer",
          rubric: rubric10pt(),
          subQuestions: [
            { label: "a", text: "What is the main idea?", maxMarks: 4, rubric: rubric5pt() },
            { label: "b", text: "Identify the tone.", maxMarks: 4 },
          ],
        },
        {
          key: "q4",
          text: 'Write a 100-word paragraph on "My Hometown".',
          maxMarks: 10,
          order: 3,
          questionType: "essay",
          rubric: rubric10pt(),
        },
        {
          key: "q5",
          text: 'Choose the correct synonym for "rapid".',
          maxMarks: 4,
          order: 4,
          questionType: "mcq",
          rubric: rubric5pt(),
        },
      ],
      // no questionPaperImages yet (still draft)
    },

    // (2) PUBLISHED (active) — open for upload; pre-grade submissions. 4 questions.
    {
      key: "exam-sci-active",
      title: "Grade 9 Science — Forces & Motion",
      subject: "Science",
      topics: ["Forces", "Motion", "Energy"],
      classKeys: ["c9-sci"],
      examDate: "2025-12-21",
      durationMinutes: 75,
      totalMarks: 25,
      passingMarks: 10,
      academicSessionKey: "2025-26",
      status: "published",
      ownerTeacherKey: "t-deepa",
      evaluationSettingsKey: "eval-default",
      questionPaperImages: [paperPath("exam-sci-active", 1), paperPath("exam-sci-active", 2)],
      questions: [
        {
          key: "q1",
          text: "State Newton's second law and its formula.",
          maxMarks: 5,
          order: 0,
          questionType: "short_answer",
          rubric: rubric5pt("F = ma"),
        },
        {
          key: "q2",
          text: "A 2 kg object accelerates at 3 m/s². Find the net force.",
          maxMarks: 5,
          order: 1,
          questionType: "numeric",
          rubric: rubric5pt("F = 2 × 3 = 6 N"),
        },
        {
          key: "q3",
          text: "Explain the difference between speed and velocity.",
          maxMarks: 5,
          order: 2,
          questionType: "short_answer",
          rubric: rubric5pt(),
        },
        {
          key: "q4",
          text: "Describe an experiment demonstrating conservation of energy.",
          maxMarks: 10,
          order: 3,
          questionType: "long_answer",
          rubric: rubric10pt(),
          subQuestions: [
            { label: "a", text: "List the apparatus.", maxMarks: 4 },
            {
              label: "b",
              text: "State the expected observation.",
              maxMarks: 6,
              rubric: rubric5pt(),
            },
          ],
        },
      ],
    },

    // (3) GRADING — pipeline mid-flight; graded/partial/failed/manual mix. 4 questions. Linked to space.
    {
      key: "exam-math-grading",
      title: "Grade 9 Mathematics — Quadratics Midterm",
      subject: "Mathematics",
      topics: ["Quadratic Equations", "Factoring"],
      classKeys: ["c9-math"],
      examDate: "2025-12-19",
      durationMinutes: 90,
      totalMarks: 25,
      passingMarks: 10,
      academicSessionKey: "2025-26",
      status: "grading",
      ownerTeacherKey: "t-ramesh",
      evaluationSettingsKey: "eval-strict",
      linkedSpaceKey: "space-quad",
      linkedStoryPointKey: "sp-quad-test",
      questionPaperImages: [paperPath("exam-math-grading", 1), paperPath("exam-math-grading", 2)],
      questions: [
        {
          key: "q1",
          text: "Solve x² - 5x + 6 = 0.",
          maxMarks: 5,
          order: 0,
          questionType: "numeric",
          linkedItemKey: "i-quad-factor",
          rubric: rubric5pt("x = 2 or x = 3"),
        },
        {
          key: "q2",
          text: "Find the discriminant of 2x² + 3x - 5 = 0 and state the nature of roots.",
          maxMarks: 5,
          order: 1,
          questionType: "short_answer",
          rubric: rubric5pt("Δ = 49 > 0 → two real distinct roots"),
        },
        {
          key: "q3",
          text: "Derive the quadratic formula by completing the square.",
          maxMarks: 10,
          order: 2,
          questionType: "long_answer",
          rubric: rubric10pt(),
          subQuestions: [
            { label: "a", text: "Complete the square.", maxMarks: 5, rubric: rubric5pt() },
            { label: "b", text: "Solve for x.", maxMarks: 5 },
          ],
        },
        {
          key: "q4",
          text: "A rectangle has area 24 and perimeter 20. Find its sides.",
          maxMarks: 5,
          order: 3,
          questionType: "numeric",
          rubric: rubric5pt("Sides 4 and 6"),
        },
      ],
    },

    // (4) RESULTS_RELEASED — finalized + released; student/parent-visible. 5 questions, one w/ subQuestions.
    {
      key: "exam-hist-released",
      title: "Grade 10 History — World Wars",
      subject: "History",
      topics: ["World War I", "World War II", "Cold War"],
      classKeys: ["c10-hist"],
      examDate: "2025-12-16",
      durationMinutes: 90,
      totalMarks: 30,
      passingMarks: 12,
      academicSessionKey: "2025-26",
      // Seed coarse status; the engine maps this to the domain `results_released` exam status.
      status: "released",
      ownerTeacherKey: "t-deepa",
      evaluationSettingsKey: "eval-default",
      questionPaperImages: [paperPath("exam-hist-released", 1), paperPath("exam-hist-released", 2)],
      questions: [
        {
          key: "q1",
          text: "Name two causes of World War I.",
          maxMarks: 4,
          order: 0,
          questionType: "short_answer",
          rubric: rubric5pt(),
        },
        {
          key: "q2",
          text: "Explain the significance of the Treaty of Versailles.",
          maxMarks: 6,
          order: 1,
          questionType: "long_answer",
          rubric: rubric10pt(),
        },
        {
          key: "q3",
          text: "Compare the alliances of WWI and WWII.",
          maxMarks: 8,
          order: 2,
          questionType: "long_answer",
          rubric: rubric10pt(),
          subQuestions: [
            { label: "a", text: "WWI alliances.", maxMarks: 4, rubric: rubric5pt() },
            { label: "b", text: "WWII alliances.", maxMarks: 4, rubric: rubric5pt() },
          ],
        },
        {
          key: "q4",
          text: "What was the Cold War? Define in your own words.",
          maxMarks: 6,
          order: 3,
          questionType: "short_answer",
          rubric: rubric5pt(),
        },
        {
          key: "q5",
          text: "When did WWII end?",
          maxMarks: 6,
          order: 4,
          questionType: "fill_blank",
          rubric: rubric5pt("1945"),
        },
      ],
    },
  ],

  // ─── Submissions: ~30 across the three non-draft exams ──────────────────────────────────────
  submissions: [
    // (A) exam-sci-active (PUBLISHED) — 4 pre-grade submissions: uploaded / scouting / scouting_complete.
    preGradeSub({
      key: "sub-sci-ishaan",
      examKey: "exam-sci-active",
      studentKey: "s-ishaan",
      classKey: "c9-sci",
      pipelineStatus: "uploaded",
    }),
    preGradeSub({
      key: "sub-sci-saanvi",
      examKey: "exam-sci-active",
      studentKey: "s-saanvi",
      classKey: "c9-sci",
      pipelineStatus: "scouting",
    }),
    preGradeSub({
      key: "sub-sci-kabir",
      examKey: "exam-sci-active",
      studentKey: "s-kabir",
      classKey: "c9-sci",
      pipelineStatus: "scouting_complete",
      questionKeys: ["q1", "q2", "q3", "q4"],
    }),
    preGradeSub({
      key: "sub-sci-myra",
      examKey: "exam-sci-active",
      studentKey: "s-myra",
      classKey: "c9-sci",
      pipelineStatus: "scouting_failed",
      uploadSource: "web",
    }),

    // (B) exam-math-grading (GRADING) — 4 submissions: full graded(not released), partial, failed-question, manual override.
    gradingSub({
      key: "sub-math-aanya",
      examKey: "exam-math-grading",
      studentKey: "s-aanya",
      classKey: "c9-math",
      pipelineStatus: "grading_complete",
      qs: [
        gradedQS("q1", 5, 5, 0.96, "Both roots correct."),
        gradedQS(
          "q2",
          4,
          5,
          0.83,
          "Discriminant correct; nature of roots slightly underspecified."
        ),
        gradedQS("q3", 8, 10, 0.79, "Derivation mostly correct; missing one algebraic step."),
        gradedQS("q4", 5, 5, 0.94, "Correct sides."),
      ],
    }),
    gradingSub({
      key: "sub-math-vihaan",
      examKey: "exam-math-grading",
      studentKey: "s-vihaan",
      classKey: "c9-math",
      pipelineStatus: "grading_partial",
      retryCount: 1,
      qs: [
        gradedQS("q1", 3, 5, 0.81, "One root correct, sign error on the other."),
        gradedQS("q2", 5, 5, 0.9, "Discriminant and nature correct."),
        { questionKey: "q3", gradingStatus: "pending", mapping: { pageIndices: [2, 3] } },
        { questionKey: "q4", gradingStatus: "processing", mapping: { pageIndices: [3] } },
      ],
    }),
    gradingSub({
      key: "sub-math-ananya",
      examKey: "exam-math-grading",
      studentKey: "s-ananya",
      classKey: "c9-math",
      pipelineStatus: "grading_failed",
      retryCount: 2,
      qs: [
        gradedQS("q1", 5, 5, 0.95, "Correct."),
        {
          questionKey: "q2",
          gradingStatus: "failed",
          mapping: { pageIndices: [1] },
          gradingError: "AI grading timed out after 540s.",
          gradingRetryCount: 2,
        },
        gradedQS("q3", 6, 10, 0.74, "Partial derivation."),
        {
          questionKey: "q4",
          gradingStatus: "failed",
          mapping: { pageIndices: [3] },
          gradingError: "Readability too low; answer-sheet page blurred.",
          gradingRetryCount: 2,
        },
      ],
    }),
    gradingSub({
      key: "sub-math-arjun",
      examKey: "exam-math-grading",
      studentKey: "s-arjun",
      classKey: "c9-math",
      pipelineStatus: "manual_review_needed",
      qs: [
        gradedQS("q1", 5, 5, 0.97, "Correct."),
        // needs_review: low-confidence AI score must NOT count toward totals until confirmed.
        {
          questionKey: "q2",
          gradingStatus: "needs_review",
          mapping: { pageIndices: [1] },
          evaluation: {
            score: 3,
            maxScore: 5,
            confidence: 0.58,
            feedback: "Ambiguous handwriting; flagged for review.",
            cost: { tokensIn: 1300, tokensOut: 280, usd: 0.0022 },
          },
        },
        // manual override after teacher review.
        {
          questionKey: "q3",
          gradingStatus: "overridden",
          mapping: { pageIndices: [2, 3] },
          evaluation: {
            score: 7,
            maxScore: 10,
            confidence: 0.7,
            feedback: "AI suggested 7.",
            cost: { tokensIn: 2100, tokensOut: 420, usd: 0.0041 },
          },
          manualOverride: {
            score: 9,
            by: "t-ramesh",
            reason: "Accepted alternate valid derivation.",
            originalScore: 7,
          },
        },
        {
          questionKey: "q4",
          gradingStatus: "manual",
          mapping: { pageIndices: [3] },
          manualOverride: { score: 4, by: "t-ramesh", reason: "Hand-graded: minor unit slip." },
        },
      ],
    }),

    // (C) exam-hist-released (RESULTS_RELEASED) — all 12-ish history students; released + ⚷ cost present.
    releasedSub({
      key: "sub-hist-reyansh",
      examKey: "exam-hist-released",
      studentKey: "s-reyansh",
      classKey: "c10-hist",
      maxScore: 30,
      grade: "A",
      qs: [
        gradedQS("q1", 4, 4, 0.95, "Both causes correct."),
        gradedQS("q2", 5, 6, 0.86, "Strong, minor omission."),
        gradedQS("q3", 7, 8, 0.82, "Good comparison."),
        gradedQS("q4", 5, 6, 0.88, "Clear definition."),
        gradedQS("q5", 6, 6, 0.99, "Correct: 1945."),
      ],
    }),
    releasedSub({
      key: "sub-hist-aaradhya",
      examKey: "exam-hist-released",
      studentKey: "s-aaradhya",
      classKey: "c10-hist",
      maxScore: 30,
      grade: "A",
      qs: [
        gradedQS("q1", 4, 4, 0.94, "Correct."),
        gradedQS("q2", 6, 6, 0.91, "Excellent."),
        gradedQS("q3", 6, 8, 0.8, "Solid, WWII alliances brief."),
        gradedQS("q4", 6, 6, 0.9, "Well defined."),
        gradedQS("q5", 6, 6, 0.99, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-dhruv",
      examKey: "exam-hist-released",
      studentKey: "s-dhruv",
      classKey: "c10-hist",
      maxScore: 30,
      grade: "B",
      qs: [
        gradedQS("q1", 3, 4, 0.85, "One cause vague."),
        gradedQS("q2", 4, 6, 0.78, "Partial significance."),
        gradedQS("q3", 5, 8, 0.76, "Comparison incomplete."),
        gradedQS("q4", 5, 6, 0.84, "Good."),
        gradedQS("q5", 6, 6, 0.98, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-anvi",
      examKey: "exam-hist-released",
      studentKey: "s-anvi",
      classKey: "c10-hist",
      maxScore: 30,
      grade: "B",
      qs: [
        gradedQS("q1", 4, 4, 0.92, "Correct."),
        gradedQS("q2", 5, 6, 0.83, "Good."),
        gradedQS("q3", 4, 8, 0.72, "WWI only."),
        gradedQS("q4", 4, 6, 0.8, "Brief."),
        gradedQS("q5", 6, 6, 0.99, "Correct."),
      ],
    }),

    // (D) exam-hist-released — the remaining roster also sat history (cross-class), released. Brings total to ~30.
    releasedSub({
      key: "sub-hist-aanya",
      examKey: "exam-hist-released",
      studentKey: "s-aanya",
      classKey: "c9-math",
      maxScore: 30,
      grade: "A",
      uploadSource: "web",
      uploadedByKey: "t-deepa",
      qs: [
        gradedQS("q1", 4, 4, 0.93, "Correct."),
        gradedQS("q2", 6, 6, 0.9, "Excellent."),
        gradedQS("q3", 7, 8, 0.85, "Thorough."),
        gradedQS("q4", 5, 6, 0.87, "Good."),
        gradedQS("q5", 6, 6, 0.99, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-vihaan",
      examKey: "exam-hist-released",
      studentKey: "s-vihaan",
      classKey: "c9-math",
      maxScore: 30,
      grade: "C",
      qs: [
        gradedQS("q1", 2, 4, 0.79, "One cause."),
        gradedQS("q2", 3, 6, 0.74, "Weak."),
        gradedQS("q3", 4, 8, 0.71, "Incomplete."),
        gradedQS("q4", 4, 6, 0.8, "OK."),
        gradedQS("q5", 6, 6, 0.97, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-ananya",
      examKey: "exam-hist-released",
      studentKey: "s-ananya",
      classKey: "c9-math",
      maxScore: 30,
      grade: "B",
      qs: [
        gradedQS("q1", 4, 4, 0.91, "Correct."),
        gradedQS("q2", 4, 6, 0.81, "Adequate."),
        gradedQS("q3", 6, 8, 0.83, "Good."),
        gradedQS("q4", 5, 6, 0.86, "Clear."),
        gradedQS("q5", 6, 6, 0.98, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-arjun",
      examKey: "exam-hist-released",
      studentKey: "s-arjun",
      classKey: "c9-math",
      maxScore: 30,
      grade: "A",
      qs: [
        gradedQS("q1", 4, 4, 0.95, "Correct."),
        gradedQS("q2", 6, 6, 0.92, "Excellent."),
        gradedQS("q3", 8, 8, 0.88, "Complete."),
        gradedQS("q4", 5, 6, 0.85, "Good."),
        gradedQS("q5", 6, 6, 0.99, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-ishaan",
      examKey: "exam-hist-released",
      studentKey: "s-ishaan",
      classKey: "c9-sci",
      maxScore: 30,
      grade: "B",
      qs: [
        gradedQS("q1", 3, 4, 0.86, "OK."),
        gradedQS("q2", 5, 6, 0.84, "Good."),
        gradedQS("q3", 6, 8, 0.8, "Solid."),
        gradedQS("q4", 4, 6, 0.82, "Adequate."),
        gradedQS("q5", 6, 6, 0.98, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-saanvi",
      examKey: "exam-hist-released",
      studentKey: "s-saanvi",
      classKey: "c9-sci",
      maxScore: 30,
      grade: "A",
      qs: [
        gradedQS("q1", 4, 4, 0.94, "Correct."),
        gradedQS("q2", 6, 6, 0.9, "Excellent."),
        gradedQS("q3", 7, 8, 0.86, "Thorough."),
        gradedQS("q4", 6, 6, 0.91, "Clear."),
        gradedQS("q5", 6, 6, 0.99, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-kabir",
      examKey: "exam-hist-released",
      studentKey: "s-kabir",
      classKey: "c9-sci",
      maxScore: 30,
      grade: "C",
      qs: [
        gradedQS("q1", 2, 4, 0.77, "One cause."),
        gradedQS("q2", 4, 6, 0.76, "Partial."),
        gradedQS("q3", 4, 8, 0.72, "Incomplete."),
        gradedQS("q4", 3, 6, 0.78, "Brief."),
        gradedQS("q5", 6, 6, 0.97, "Correct."),
      ],
    }),
    releasedSub({
      key: "sub-hist-myra",
      examKey: "exam-hist-released",
      studentKey: "s-myra",
      classKey: "c9-sci",
      maxScore: 30,
      grade: "B",
      qs: [
        gradedQS("q1", 4, 4, 0.9, "Correct."),
        gradedQS("q2", 5, 6, 0.83, "Good."),
        gradedQS("q3", 5, 8, 0.78, "Adequate."),
        gradedQS("q4", 5, 6, 0.85, "Clear."),
        gradedQS("q5", 6, 6, 0.98, "Correct."),
      ],
    }),

    // (E) exam-math-grading — two more graded-but-unreleased to round the grading dashboard counts.
    gradingSub({
      key: "sub-math-ishaan",
      examKey: "exam-math-grading",
      studentKey: "s-ishaan",
      classKey: "c9-math",
      pipelineStatus: "grading_complete",
      qs: [
        gradedQS("q1", 4, 5, 0.88, "One root correct."),
        gradedQS("q2", 5, 5, 0.91, "Correct."),
        gradedQS("q3", 9, 10, 0.84, "Near-complete derivation."),
        gradedQS("q4", 5, 5, 0.93, "Correct sides."),
      ],
    }),
    gradingSub({
      key: "sub-math-myra",
      examKey: "exam-math-grading",
      studentKey: "s-myra",
      classKey: "c9-math",
      pipelineStatus: "grading",
      qs: [
        gradedQS("q1", 5, 5, 0.94, "Correct."),
        { questionKey: "q2", gradingStatus: "processing", mapping: { pageIndices: [1] } },
        { questionKey: "q3", gradingStatus: "pending", mapping: { pageIndices: [2, 3] } },
        { questionKey: "q4", gradingStatus: "pending", mapping: { pageIndices: [3] } },
      ],
    }),
    gradingSub({
      key: "sub-math-kabir",
      examKey: "exam-math-grading",
      studentKey: "s-kabir",
      classKey: "c9-math",
      pipelineStatus: "grading_complete",
      qs: [
        gradedQS("q1", 3, 5, 0.82, "One root, sign slip."),
        gradedQS("q2", 4, 5, 0.86, "Mostly correct."),
        gradedQS("q3", 7, 10, 0.77, "Partial derivation."),
        gradedQS("q4", 4, 5, 0.85, "Minor arithmetic error."),
      ],
    }),
    gradingSub({
      key: "sub-math-saanvi",
      examKey: "exam-math-grading",
      studentKey: "s-saanvi",
      classKey: "c9-math",
      pipelineStatus: "grading_complete",
      qs: [
        gradedQS("q1", 5, 5, 0.95, "Correct."),
        gradedQS("q2", 5, 5, 0.92, "Correct."),
        gradedQS("q3", 8, 10, 0.83, "Strong derivation."),
        gradedQS("q4", 5, 5, 0.9, "Correct."),
      ],
    }),

    // (F) exam-sci-active (PUBLISHED) — more pre-grade uploads (no scores, no summary).
    preGradeSub({
      key: "sub-sci-aanya",
      examKey: "exam-sci-active",
      studentKey: "s-aanya",
      classKey: "c9-sci",
      pipelineStatus: "scouting_complete",
      questionKeys: ["q1", "q2", "q3", "q4"],
    }),
    preGradeSub({
      key: "sub-sci-vihaan",
      examKey: "exam-sci-active",
      studentKey: "s-vihaan",
      classKey: "c9-sci",
      pipelineStatus: "uploaded",
      uploadSource: "rn",
    }),
    preGradeSub({
      key: "sub-sci-reyansh",
      examKey: "exam-sci-active",
      studentKey: "s-reyansh",
      classKey: "c9-sci",
      pipelineStatus: "scouting",
    }),
    preGradeSub({
      key: "sub-sci-anvi",
      examKey: "exam-sci-active",
      studentKey: "s-anvi",
      classKey: "c9-sci",
      pipelineStatus: "scouting_complete",
      questionKeys: ["q1", "q2", "q3", "q4"],
    }),
  ],

  // ─── Grading dead-letter queue: 2 terminal pipeline failures (one open, one resolved) ────────
  gradingDeadLetter: [
    {
      key: "dlq-ananya-q2",
      submissionKey: "sub-math-ananya",
      questionKey: "q2",
      pipelineStep: "grading",
      error: "AI grading timed out after 540s (RELMS stage).",
      errorStack:
        "TimeoutError: deadline-exceeded\n  at gradeItemTask (process-answer-grading.ts:142)",
      attempts: 3,
      lastAttemptAt: "2025-12-20T11:32:00.000Z",
      // open — awaiting teacher resolution
    },
    {
      key: "dlq-myra-scouting",
      submissionKey: "sub-sci-myra",
      pipelineStep: "scouting",
      error: "Panopticon scouting failed: page 2 unreadable (blur score 0.91).",
      attempts: 2,
      lastAttemptAt: "2025-12-21T09:15:00.000Z",
      resolvedAt: "2025-12-21T14:00:00.000Z",
      resolvedByKey: "t-deepa",
      resolutionMethod: "manual_grade",
    },
  ],

  // Notifications so the result-release + grading screens have feed entries.
  notifications: [
    {
      key: "ntf-reyansh-result",
      recipientKey: "s-reyansh",
      type: "exam_results_released",
      title: "History results released",
      body: "You scored 27/30 on the World Wars exam.",
      payload: { examKey: "exam-hist-released" },
      isRead: false,
    },
    {
      key: "ntf-nair-child",
      recipientKey: "p-nair",
      type: "child_result",
      title: "Reyansh's History results",
      body: "Reyansh scored 90% on the World Wars exam.",
      payload: { examKey: "exam-hist-released", studentKey: "s-reyansh" },
      isRead: false,
    },
    {
      key: "ntf-ramesh-grading",
      recipientKey: "t-ramesh",
      type: "grading_needs_review",
      title: "2 submissions need manual review",
      body: "Quadratics Midterm: Arjun and Ananya flagged.",
      payload: { examKey: "exam-math-grading" },
      isRead: false,
    },
  ],

  // Cost summaries so the analytics/cost screens reflect this tenant's AI grading spend.
  costSummaries: [
    {
      key: "cost-d-1216",
      granularity: "daily",
      period: "2025-12-16",
      totalUsd: 0.214,
      totalTokens: 142000,
      callCount: 60,
      byPurpose: { answer_grading: 0.198, question_extraction: 0.016 },
    },
    {
      key: "cost-d-1220",
      granularity: "daily",
      period: "2025-12-20",
      totalUsd: 0.088,
      totalTokens: 58000,
      callCount: 26,
      byPurpose: { answer_grading: 0.082, question_extraction: 0.006 },
    },
    {
      key: "cost-m-1225",
      granularity: "monthly",
      period: "2025-12",
      totalUsd: 0.642,
      totalTokens: 430000,
      callCount: 240,
      byPurpose: { answer_grading: 0.58, question_extraction: 0.062 },
    },
  ],
};
