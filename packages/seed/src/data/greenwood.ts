/**
 * Greenwood Academy — the primary, FULL mock tenant. Exercises every entity type:
 * sessions, classes, all 7 roles, agents, rubric presets, question bank, spaces with
 * story points / items (question + material) / answer keys, exams with questions,
 * submissions with question-submissions, test sessions, progress, gamification,
 * announcements, notifications, insights, and cost summaries.
 */

import type { TenantConfig } from "../config/types.js";

export const greenwoodTenant: TenantConfig = {
  key: "greenwood",
  name: "Greenwood Academy",
  code: "GRN001",
  status: "active",
  plan: "premium",
  contact: { email: "admin@greenwood.edu", phone: "+91-80-1111-2222" },
  features: { exams: true, spaces: true, gamification: true, ai: true },
  branding: { primaryColor: "#2E7D32" },
  geminiKeyRef: "tenant-greenwood-gemini",

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

  // Classes (denorm filled from teacher/student keys at write time)
  classes: [
    {
      key: "g8-math",
      name: "Grade 8 - Mathematics",
      grade: "8",
      section: "A",
      academicSessionKey: "2025-26",
      teacherKeys: ["t-asha"],
      studentKeys: ["s-aarav", "s-diya", "s-rohan"],
      schedule: {
        days: ["Mon", "Wed", "Fri"],
        startTime: "09:00",
        endTime: "10:00",
        room: "R-101",
      },
    },
    {
      key: "g8-sci",
      name: "Grade 8 - Science",
      grade: "8",
      section: "A",
      academicSessionKey: "2025-26",
      teacherKeys: ["t-vikram"],
      studentKeys: ["s-aarav", "s-diya", "s-meera"],
    },
    {
      key: "g10-phy",
      name: "Grade 10 - Physics",
      grade: "10",
      section: "B",
      academicSessionKey: "2025-26",
      teacherKeys: ["t-vikram"],
      studentKeys: ["s-karan", "s-priya"],
    },
  ],

  admins: [
    {
      key: "admin-main",
      email: "principal@greenwood.edu",
      password: "Admin@12345",
      firstName: "Latha",
      lastName: "Krishnan",
      staffPermissions: {
        canManageUsers: true,
        canManageClasses: true,
        canViewAnalytics: true,
      },
    },
  ],

  teachers: [
    {
      key: "t-asha",
      email: "asha.rao@greenwood.edu",
      password: "Teacher@123",
      firstName: "Asha",
      lastName: "Rao",
      subjects: ["Mathematics"],
      department: "Mathematics",
      designation: "Senior Teacher",
      classKeys: ["g8-math"],
      permissions: {
        canCreateExams: true,
        canManageContent: true,
        canGradeExams: true,
        canManageSpaces: true,
        canViewAnalytics: true,
      },
    },
    {
      key: "t-vikram",
      email: "vikram.nair@greenwood.edu",
      password: "Teacher@123",
      firstName: "Vikram",
      lastName: "Nair",
      subjects: ["Science", "Physics"],
      department: "Science",
      classKeys: ["g8-sci", "g10-phy"],
      permissions: { canCreateExams: true, canGradeExams: true, canManageSpaces: true },
    },
  ],

  students: [
    {
      key: "s-aarav",
      email: "aarav.patel@greenwood.edu",
      password: "Student@123",
      firstName: "Aarav",
      lastName: "Patel",
      rollNumber: "2025001",
      grade: "8",
      classKeys: ["g8-math", "g8-sci"],
    },
    {
      key: "s-diya",
      email: "diya.gupta@greenwood.edu",
      password: "Student@123",
      firstName: "Diya",
      lastName: "Gupta",
      rollNumber: "2025002",
      grade: "8",
      classKeys: ["g8-math", "g8-sci"],
    },
    {
      key: "s-rohan",
      email: "rohan.sharma@greenwood.edu",
      password: "Student@123",
      firstName: "Rohan",
      lastName: "Sharma",
      rollNumber: "2025003",
      grade: "8",
      classKeys: ["g8-math"],
    },
    {
      key: "s-meera",
      email: "meera.iyer@greenwood.edu",
      password: "Student@123",
      firstName: "Meera",
      lastName: "Iyer",
      rollNumber: "2025004",
      grade: "8",
      classKeys: ["g8-sci"],
    },
    {
      key: "s-karan",
      email: "karan.singh@greenwood.edu",
      password: "Student@123",
      firstName: "Karan",
      lastName: "Singh",
      rollNumber: "2025005",
      grade: "10",
      classKeys: ["g10-phy"],
    },
    {
      key: "s-priya",
      email: "priya.menon@greenwood.edu",
      password: "Student@123",
      firstName: "Priya",
      lastName: "Menon",
      rollNumber: "2025006",
      grade: "10",
      classKeys: ["g10-phy"],
    },
  ],

  parents: [
    {
      key: "p-patel",
      email: "rajesh.patel@gmail.com",
      password: "Parent@123",
      firstName: "Rajesh",
      lastName: "Patel",
      studentKeys: ["s-aarav"],
    },
    {
      key: "p-singh",
      email: "manpreet.singh@gmail.com",
      password: "Parent@123",
      firstName: "Manpreet",
      lastName: "Singh",
      studentKeys: ["s-karan"],
    },
  ],

  staff: [
    {
      key: "staff-office",
      email: "office@greenwood.edu",
      password: "Staff@123",
      firstName: "Geeta",
      lastName: "Bhat",
      department: "Administration",
      staffPermissions: { canManageUsers: true, canManageClasses: true },
    },
  ],

  scanners: [
    {
      key: "scanner-1",
      email: "scanner1@greenwood.edu",
      password: "Scanner@123",
      label: "Front Office Scanner",
    },
  ],

  agents: [
    {
      key: "math-evaluator",
      name: "Math Answer Evaluator",
      spaceKey: "space-algebra",
      type: "evaluator",
      purpose: "answer_grading",
      systemPrompt: "You grade math answers strictly against the rubric. Show partial credit.",
      rules: ["Award partial credit for correct method", "Penalize unit errors lightly"],
      model: "gemini-2.0-flash",
      isActive: true,
    },
  ],

  rubricPresets: [
    {
      key: "short-answer-5pt",
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

  questionBank: [
    {
      key: "qb-algebra-1",
      questionType: "numeric",
      prompt: "Solve for x: 2x + 5 = 17",
      points: 2,
      answer: { correctAnswer: 6, acceptableAnswers: [6, "6"] },
      tags: ["algebra", "grade-8"],
    },
    {
      key: "qb-newton-1",
      questionType: "mcq",
      prompt: "Newton's first law is also known as the law of?",
      options: [
        { id: "a", text: "Acceleration" },
        { id: "b", text: "Inertia" },
        { id: "c", text: "Gravitation" },
        { id: "d", text: "Momentum" },
      ],
      points: 1,
      answer: { correctAnswer: "b" },
      tags: ["physics", "grade-10"],
    },
  ],

  spaces: [
    {
      key: "space-algebra",
      title: "Algebra Foundations",
      description: "Core algebra concepts for Grade 8",
      type: "course",
      status: "published",
      subject: "Mathematics",
      classKeys: ["g8-math"],
      ownerTeacherKey: "t-asha",
      storyPoints: [
        {
          key: "sp-intro",
          title: "Introduction to Variables",
          type: "standard",
          order: 0,
          items: [
            {
              key: "i-read-vars",
              kind: "material",
              materialType: "reading",
              title: "What is a Variable?",
              body: "A variable is a symbol that represents a number.",
              order: 0,
            },
            {
              key: "i-mcq-vars",
              kind: "question",
              questionType: "mcq",
              prompt: "Which of these is a variable?",
              options: [
                { id: "a", text: "5" },
                { id: "b", text: "x" },
                { id: "c", text: "+" },
                { id: "d", text: "=" },
              ],
              points: 1,
              order: 1,
              answer: { correctAnswer: "b" },
            },
          ],
        },
        {
          key: "sp-equations",
          title: "Linear Equations",
          type: "timed_test",
          order: 1,
          durationSeconds: 1800,
          items: [
            {
              key: "i-num-eq1",
              kind: "question",
              questionType: "numeric",
              prompt: "Solve for x: 3x - 9 = 0",
              points: 2,
              order: 0,
              answer: { correctAnswer: 3, acceptableAnswers: [3, "3"] },
              rubricPresetKey: "short-answer-5pt",
            },
            {
              key: "i-short-eq2",
              kind: "question",
              questionType: "short_answer",
              prompt: 'Explain what it means to "solve" a linear equation.',
              points: 3,
              order: 1,
              answer: {
                correctAnswer: "Finding the value of the variable that makes the equation true.",
                evaluationGuidance:
                  'Accept any phrasing capturing "value that satisfies the equation".',
                modelAnswer:
                  "To solve a linear equation is to find the value of the unknown that makes both sides equal.",
              },
              rubric: {
                dimensions: [
                  { key: "accuracy", label: "Accuracy", weight: 0.6 },
                  { key: "clarity", label: "Clarity", weight: 0.4 },
                ],
                totalPoints: 3,
                passingScore: 2,
              },
            },
          ],
        },
      ],
    },
  ],

  evaluationSettings: [
    {
      key: "eval-default",
      name: "Default Auto-grade Settings",
      confidenceConfig: { lowThreshold: 0.4, highThreshold: 0.8 },
      autoReleaseThreshold: 0.85,
      rubricPresetKey: "short-answer-5pt",
    },
  ],

  exams: [
    {
      key: "exam-math-mid",
      title: "Grade 8 Mathematics Midterm",
      subject: "Mathematics",
      topics: ["Algebra", "Geometry"],
      classKeys: ["g8-math"],
      examDate: "2025-12-15",
      durationMinutes: 90,
      totalMarks: 20,
      passingMarks: 8,
      academicSessionKey: "2025-26",
      status: "released",
      ownerTeacherKey: "t-asha",
      evaluationSettingsKey: "eval-default",
      linkedSpaceKey: "space-algebra",
      linkedStoryPointKey: "sp-equations",
      questionPaperImages: ["tenants/greenwood/exams/exam-math-mid/paper-1.png"],
      questions: [
        {
          key: "q1",
          text: "Solve the system: x + y = 10, x - y = 4.",
          maxMarks: 10,
          order: 0,
          questionType: "long_answer",
          rubric: {
            dimensions: [
              {
                key: "method",
                label: "Method",
                weight: 0.5,
                promptGuidance: "Correct elimination/substitution.",
              },
              { key: "answer", label: "Final Answer", weight: 0.5 },
            ],
            totalPoints: 10,
            passingScore: 5,
            modelAnswer: "x = 7, y = 3",
          },
        },
        {
          key: "q2",
          text: "Find the area of a triangle with base 6 and height 8.",
          maxMarks: 10,
          order: 1,
          questionType: "numeric",
          subQuestions: [
            { label: "a", text: "State the formula.", maxMarks: 3 },
            { label: "b", text: "Compute the area.", maxMarks: 7 },
          ],
        },
      ],
    },
  ],

  submissions: [
    {
      key: "sub-aarav-mid",
      examKey: "exam-math-mid",
      studentKey: "s-aarav",
      classKey: "g8-math",
      uploadSource: "scanner",
      uploadedByKey: "scanner-1",
      status: "released",
      studentName: "Aarav Patel",
      rollNumber: "2025001",
      answerSheetImages: ["tenants/greenwood/submissions/sub-aarav-mid/sheet-1.png"],
      summary: { totalScore: 16, maxScore: 20, percentage: 80, grade: "A" },
      questionSubmissions: [
        {
          questionKey: "q1",
          gradingStatus: "graded",
          evaluation: {
            score: 8,
            maxScore: 10,
            confidence: 0.82,
            feedback: "Correct method, minor arithmetic slip.",
            cost: { tokensIn: 1200, tokensOut: 340, usd: 0.0021 },
          },
        },
        {
          questionKey: "q2",
          gradingStatus: "graded",
          evaluation: {
            score: 8,
            maxScore: 10,
            confidence: 0.91,
            feedback: "Formula and computation correct.",
            cost: { tokensIn: 980, tokensOut: 210, usd: 0.0015 },
          },
        },
      ],
    },
    {
      key: "sub-diya-mid",
      examKey: "exam-math-mid",
      studentKey: "s-diya",
      classKey: "g8-math",
      uploadSource: "web",
      uploadedByKey: "t-asha",
      status: "graded",
      studentName: "Diya Gupta",
      rollNumber: "2025002",
      questionSubmissions: [
        {
          questionKey: "q1",
          gradingStatus: "graded",
          evaluation: {
            score: 10,
            maxScore: 10,
            confidence: 0.95,
            feedback: "Perfect.",
            cost: { tokensIn: 1100, tokensOut: 300, usd: 0.0019 },
          },
        },
        {
          questionKey: "q2",
          gradingStatus: "manual",
          manualOverride: {
            score: 9,
            by: "t-asha",
            reason: "Allowed alternate formula.",
          },
        },
      ],
    },
  ],

  testSessions: [
    {
      key: "ts-aarav-eq",
      spaceKey: "space-algebra",
      storyPointKey: "sp-equations",
      studentKey: "s-aarav",
      sessionType: "timed_test",
      status: "graded",
      attemptNumber: 1,
      isLatest: true,
      answers: [
        {
          itemKey: "i-num-eq1",
          answer: 3,
          evaluation: { score: 2, maxScore: 2, correct: true, feedback: "Correct." },
        },
        {
          itemKey: "i-short-eq2",
          answer: "Finding the x that makes both sides equal.",
          markedForReview: true,
          evaluation: {
            score: 2,
            maxScore: 3,
            correct: false,
            feedback: 'Good, but mention "true".',
          },
        },
      ],
    },
  ],

  progress: [
    {
      studentKey: "s-aarav",
      spaceKey: "space-algebra",
      overallPercentage: 75,
      pointsEarned: 5,
      totalPoints: 6,
      storyPoints: [
        {
          storyPointKey: "sp-intro",
          completedItems: 2,
          totalItems: 2,
          pointsEarned: 1,
          totalPoints: 1,
          status: "completed",
        },
        {
          storyPointKey: "sp-equations",
          completedItems: 1,
          totalItems: 2,
          pointsEarned: 4,
          totalPoints: 5,
          status: "in_progress",
        },
      ],
    },
    {
      studentKey: "s-diya",
      spaceKey: "space-algebra",
      overallPercentage: 50,
      pointsEarned: 3,
      totalPoints: 6,
      storyPoints: [
        {
          storyPointKey: "sp-intro",
          completedItems: 2,
          totalItems: 2,
          pointsEarned: 1,
          totalPoints: 1,
          status: "completed",
        },
        {
          storyPointKey: "sp-equations",
          completedItems: 0,
          totalItems: 2,
          pointsEarned: 0,
          totalPoints: 5,
          status: "not_started",
        },
      ],
    },
  ],

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
      studentKey: "s-aarav",
      level: { level: 3, xp: 1250, tier: "silver" },
      unlockedAchievementKeys: ["ach-first-test"],
      streakDays: 5,
      longestStreak: 9,
      studyGoals: [
        {
          key: "goal-algebra",
          title: "Master Algebra",
          targetType: "items_completed",
          targetCount: 20,
          startDate: "2025-11-01",
          endDate: "2025-12-31",
          currentCount: 12,
        },
      ],
      studySessions: [
        { key: "ss-1", date: "2025-11-20", minutes: 45, itemsCompleted: 5 },
        { key: "ss-2", date: "2025-11-21", minutes: 30, itemsCompleted: 3 },
      ],
    },
    {
      studentKey: "s-diya",
      level: { level: 2, xp: 640, tier: "bronze" },
      streakDays: 2,
      longestStreak: 4,
    },
  ],

  announcements: [
    {
      key: "anc-midterm",
      title: "Midterm Exam Schedule Released",
      body: "Grade 8 Mathematics Midterm is on Dec 15. Please review the syllabus.",
      scope: "class",
      targetClassKeys: ["g8-math"],
      status: "published",
      authorKey: "admin-main",
      readByKeys: ["s-aarav"],
    },
  ],

  notifications: [
    {
      key: "ntf-aarav-result",
      recipientKey: "s-aarav",
      type: "exam_results_released",
      title: "Your Midterm results are out",
      body: "You scored 16/20. Great job!",
      payload: { examKey: "exam-math-mid" },
      isRead: false,
    },
    {
      key: "ntf-parent-patel",
      recipientKey: "p-patel",
      type: "child_result",
      title: "Aarav's Midterm results",
      body: "Aarav scored 80% on the Mathematics Midterm.",
      isRead: false,
    },
  ],

  insights: [
    {
      key: "ins-diya-atrisk",
      studentKey: "s-diya",
      type: "at_risk",
      severity: "warning",
      message: "Diya has not started the Linear Equations test. Consider a follow-up.",
    },
  ],

  costSummaries: [
    {
      key: "cost-d1",
      granularity: "daily",
      period: "2025-12-15",
      totalUsd: 0.0055,
      totalTokens: 4830,
      callCount: 4,
      byPurpose: { answer_grading: 0.0055 },
    },
    {
      key: "cost-m1",
      granularity: "monthly",
      period: "2025-12",
      totalUsd: 0.142,
      totalTokens: 120400,
      callCount: 96,
      byPurpose: { answer_grading: 0.11, question_extraction: 0.032 },
    },
  ],
};
