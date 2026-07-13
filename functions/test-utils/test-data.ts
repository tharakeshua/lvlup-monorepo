/**
 * Factory functions for creating test entities.
 *
 * Each factory returns a minimal valid object that can be overridden.
 */

// ─── Timestamps ──────────────────────────────────────────────────────────────

const mockTimestamp = {
  seconds: 1700000000,
  nanoseconds: 0,
  toDate: () => new Date("2023-11-14T22:13:20Z"),
  toMillis: () => 1700000000000,
};

export function fakeTimestamp(dateStr?: string) {
  if (!dateStr) return mockTimestamp;
  const d = new Date(dateStr);
  return {
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => d,
    toMillis: () => d.getTime(),
  };
}

// ─── Identity ────────────────────────────────────────────────────────────────

export function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-1",
    email: "test@example.com",
    displayName: "Test User",
    authProviders: ["email"],
    isSuperAdmin: false,
    status: "active",
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

export function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1_tenant-1",
    uid: "user-1",
    tenantId: "tenant-1",
    tenantCode: "TST001",
    role: "teacher",
    status: "active",
    joinSource: "admin_created",
    permissions: {
      canCreateExams: true,
      canEditRubrics: true,
      canManuallyGrade: true,
      managedClassIds: ["class-1"],
    },
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

export function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: "tenant-1",
    name: "Test School",
    slug: "test-school",
    tenantCode: "TST001",
    ownerUid: "owner-1",
    contactEmail: "admin@test.com",
    status: "active",
    subscription: { plan: "trial" },
    features: {
      autoGradeEnabled: true,
      levelUpEnabled: true,
      scannerAppEnabled: false,
      aiChatEnabled: false,
      aiGradingEnabled: false,
      analyticsEnabled: true,
      parentPortalEnabled: false,
      bulkImportEnabled: true,
      apiAccessEnabled: false,
    },
    settings: { geminiKeySet: true },
    stats: {
      totalStudents: 10,
      totalTeachers: 2,
      totalClasses: 3,
      totalSpaces: 5,
      totalExams: 4,
    },
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

// ─── AutoGrade ───────────────────────────────────────────────────────────────

export function makeExam(overrides: Record<string, unknown> = {}) {
  return {
    id: "exam-1",
    tenantId: "tenant-1",
    title: "Math Mid-Term",
    subject: "Mathematics",
    topics: ["Algebra", "Geometry"],
    classIds: ["class-1"],
    sectionIds: [],
    examDate: mockTimestamp,
    duration: 120,
    totalMarks: 100,
    passingMarks: 40,
    academicSessionId: null,
    gradingConfig: {
      autoGrade: true,
      allowRubricEdit: true,
      allowManualOverride: true,
      requireOverrideReason: true,
      releaseResultsAutomatically: false,
      evaluationSettingsId: null,
    },
    questionPaper: {
      images: ["tenants/tenant-1/exams/exam-1/qp/page1.jpg"],
      questionCount: 5,
      extractedAt: mockTimestamp,
    },
    status: "published",
    stats: {
      totalSubmissions: 0,
      gradedSubmissions: 0,
      avgScore: 0,
      passRate: 0,
    },
    createdBy: "user-1",
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

export function makeExamQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: "Q1",
    examId: "exam-1",
    text: "Solve for x: 2x + 3 = 7",
    maxMarks: 10,
    order: 0,
    rubric: {
      criteria: [
        {
          id: "c1",
          name: "Correct Setup",
          description: "Sets up equation correctly",
          maxPoints: 4,
        },
        { id: "c2", name: "Solution", description: "Arrives at x = 2", maxPoints: 6 },
      ],
      scoringMode: "criteria_based",
      dimensions: [],
    },
    questionType: "standard",
    subQuestions: [],
    extractedBy: "ai",
    extractedAt: mockTimestamp,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

export function makeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    tenantId: "tenant-1",
    examId: "exam-1",
    studentId: "student-1",
    studentName: "Alice Smith",
    rollNumber: "001",
    classId: "class-1",
    answerSheets: {
      images: [
        "tenants/tenant-1/submissions/sub-1/page1.jpg",
        "tenants/tenant-1/submissions/sub-1/page2.jpg",
      ],
      uploadedAt: mockTimestamp,
      uploadedBy: "user-1",
      uploadSource: "web",
    },
    summary: {
      totalScore: 0,
      maxScore: 100,
      percentage: 0,
      grade: "",
      questionsGraded: 0,
      totalQuestions: 5,
    },
    pipelineStatus: "uploaded",
    retryCount: 0,
    resultsReleased: false,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

export function makeQuestionSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "Q1",
    submissionId: "sub-1",
    questionId: "Q1",
    examId: "exam-1",
    mapping: {
      pageIndices: [0],
      imageUrls: ["tenants/tenant-1/submissions/sub-1/page1.jpg"],
      scoutedAt: mockTimestamp,
    },
    gradingStatus: "pending",
    gradingRetryCount: 0,
    evaluation: null,
    manualOverride: null,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

// ─── LevelUp ─────────────────────────────────────────────────────────────────

export function makeSpace(overrides: Record<string, unknown> = {}) {
  return {
    id: "space-1",
    tenantId: "tenant-1",
    title: "Algebra Basics",
    description: "Learn algebra fundamentals",
    slug: "algebra-basics",
    type: "learn",
    subject: "Mathematics",
    labels: [],
    classIds: ["class-1"],
    sectionIds: [],
    teacherIds: ["user-1"],
    accessType: "class_assigned",
    defaultTimeLimitMinutes: null,
    allowRetakes: true,
    maxRetakes: 0,
    showCorrectAnswers: true,
    defaultRubric: null,
    defaultEvaluatorAgentId: null,
    defaultTutorAgentId: null,
    status: "published",
    publishedAt: mockTimestamp,
    archivedAt: null,
    stats: {
      totalStoryPoints: 3,
      totalItems: 10,
      totalStudents: 5,
      avgCompletionRate: 0,
    },
    createdBy: "user-1",
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

export function makeStoryPoint(overrides: Record<string, unknown> = {}) {
  return {
    id: "sp-1",
    spaceId: "space-1",
    tenantId: "tenant-1",
    title: "Introduction",
    type: "standard",
    order: 0,
    assessmentConfig: {
      durationMinutes: 0,
      maxAttempts: 0,
      shuffleQuestions: false,
    },
    stats: { totalItems: 3, completedStudents: 0 },
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

export function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    spaceId: "space-1",
    storyPointId: "sp-1",
    tenantId: "tenant-1",
    title: "What is 2+2?",
    type: "question",
    order: 0,
    payload: {
      questionType: "mcq",
      questionData: {
        options: [
          { id: "a", text: "3", isCorrect: false },
          { id: "b", text: "4", isCorrect: true },
          { id: "c", text: "5", isCorrect: false },
        ],
      },
      basePoints: 1,
    },
    meta: { totalPoints: 1, maxMarks: 1 },
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
    ...overrides,
  };
}

// ─── Caller Membership (for Cloud Function request mocking) ──────────────────

export function makeCallerMembership(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-1",
    tenantId: "tenant-1",
    role: "teacher",
    permissions: { canCreateExams: true, canEditRubrics: true, canManuallyGrade: true },
    ...overrides,
  };
}

/** Build a mock CallableRequest with auth and data. */
export function makeCallableRequest(
  data: Record<string, unknown>,
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  }
) {
  return {
    data,
    auth: auth ?? {
      uid: "user-1",
      token: {
        tenantId: "tenant-1",
        role: "teacher",
        permissions: { canCreateExams: true },
      },
    },
    rawRequest: {} as any,
  };
}
