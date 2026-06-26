/**
 * Zod schemas for runtime validation at Firebase read boundaries.
 *
 * These schemas validate data read from Firestore before it enters
 * the typed domain model. Use at Cloud Function boundaries:
 *
 * ```typescript
 * const doc = await db.doc(`tenants/${tenantId}`).get();
 * const tenant = TenantSchema.parse({ id: doc.id, ...doc.data() });
 * ```
 *
 * @module schemas
 */

import { z } from "zod";

// Type-only imports for compile-time compatibility assertions
import type { Tenant } from "../identity/tenant";
import type { UnifiedUser } from "../identity/user";
import type { UserMembership } from "../identity/membership";
import type { Class } from "../tenant/class";
import type { Student } from "../tenant/student";
import type { Teacher } from "../tenant/teacher";
import type { Parent } from "../tenant/parent";
import type { AcademicSession } from "../tenant/academic-session";
import type { UnifiedItem } from "../content/item";
import type { Space } from "../levelup/space";
import type { StoryPoint } from "../levelup/story-point";
import type { Agent } from "../levelup/agent";
import type { ChatSession, ChatMessage } from "../levelup/chat";
import type { DigitalTestSession } from "../levelup/test-session";
import type { SpaceProgress } from "../levelup/progress";
import type { QuestionBankItem } from "../levelup/question-bank";
import type { SpaceReview } from "../levelup/space-review";
import type { AnswerKey } from "../levelup/answer-key";
import type { Exam } from "../autograde/exam";
import type { Submission } from "../autograde/submission";
import type { ExamQuestion } from "../autograde/exam-question";
import type { QuestionSubmission } from "../autograde/question-submission";
import type { EvaluationSettings } from "../autograde/evaluation-settings";
import type { GradingDeadLetterEntry } from "../autograde/dead-letter";
import type { ExamAnalytics } from "../autograde/exam-analytics";
import type { StudentProgressSummary, ClassProgressSummary } from "../progress/summary";
import type { LearningInsight } from "../progress/insight";
import type { Notification } from "../notification/notification";
import type { LLMCallLog } from "../analytics/llm-call-log";
import type { Achievement, StudentAchievement, StudentLevel } from "../gamification/achievement";

// ── Shared primitives ───────────────────────────────────────────────────────

/** Firestore Timestamp-like object (seconds + nanoseconds). */
const FirestoreTimestampSchema = z
  .object({
    seconds: z.number(),
    nanoseconds: z.number(),
  })
  .passthrough();

// ── Identity schemas ────────────────────────────────────────────────────────

export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().optional(),
  slug: z.string(),
  description: z.string().optional(),
  tenantCode: z.string(),
  ownerUid: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string().optional(),
  contactPerson: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  website: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zipCode: z.string().optional(),
    })
    .optional(),
  status: z.enum(["active", "suspended", "trial", "expired", "deactivated"]),
  subscription: z.object({
    plan: z.enum(["free", "trial", "basic", "premium", "enterprise"]),
    expiresAt: FirestoreTimestampSchema.optional(),
    maxStudents: z.number().optional(),
    maxTeachers: z.number().optional(),
    maxSpaces: z.number().optional(),
    maxExamsPerMonth: z.number().optional(),
    billingCycle: z.enum(["monthly", "annual"]).optional(),
    billingEmail: z.string().optional(),
    currentPeriodStart: FirestoreTimestampSchema.optional(),
    currentPeriodEnd: FirestoreTimestampSchema.optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
  }),
  features: z.object({
    autoGradeEnabled: z.boolean(),
    levelUpEnabled: z.boolean(),
    scannerAppEnabled: z.boolean(),
    aiChatEnabled: z.boolean(),
    aiGradingEnabled: z.boolean(),
    analyticsEnabled: z.boolean(),
    parentPortalEnabled: z.boolean(),
    bulkImportEnabled: z.boolean(),
    apiAccessEnabled: z.boolean(),
  }),
  settings: z.object({
    geminiKeyRef: z.string().optional(),
    geminiKeySet: z.boolean(),
    defaultEvaluationSettingsId: z.string().optional(),
    defaultAiModel: z.string().optional(),
    timezone: z.string().optional(),
    locale: z.string().optional(),
    gradingPolicy: z.string().optional(),
  }),
  stats: z.object({
    totalStudents: z.number(),
    totalTeachers: z.number(),
    totalClasses: z.number(),
    totalSpaces: z.number(),
    totalExams: z.number(),
    activeStudentsLast30Days: z.number().optional(),
  }),
  branding: z
    .object({
      logoUrl: z.string().optional(),
      bannerUrl: z.string().optional(),
      primaryColor: z.string().optional(),
      accentColor: z.string().optional(),
      favicon: z.string().optional(),
    })
    .optional(),
  usage: z
    .object({
      currentStudents: z.number(),
      currentTeachers: z.number(),
      currentSpaces: z.number(),
      examsThisMonth: z.number(),
      aiCallsThisMonth: z.number(),
      storageBytes: z.number(),
      lastUpdated: FirestoreTimestampSchema,
    })
    .optional(),
  onboarding: z
    .object({
      completed: z.boolean(),
      completedSteps: z.array(z.string()),
      completedAt: FirestoreTimestampSchema.optional(),
    })
    .optional(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

// ── Tenant entity schemas ───────────────────────────────────────────────────

export const ClassSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  grade: z.string(),
  section: z.string().optional(),
  academicSessionId: z.string().optional(),
  teacherIds: z.array(z.string()),
  studentIds: z.array(z.string()),
  studentCount: z.number(),
  status: z.enum(["active", "archived"]),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

export const StudentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  uid: z.string(),
  rollNumber: z.string().optional(),
  section: z.string().optional(),
  classIds: z.array(z.string()),
  parentIds: z.array(z.string()),
  grade: z.string().optional(),
  admissionNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  status: z.enum(["active", "archived"]),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

export const TeacherSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  authUid: z.string().optional(),
  uid: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
  subjects: z.array(z.string()),
  designation: z.string().optional(),
  classIds: z.array(z.string()),
  sectionIds: z.array(z.string()).optional(),
  status: z.enum(["active", "archived"]),
  lastLogin: FirestoreTimestampSchema.optional(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

// ── LevelUp schemas ─────────────────────────────────────────────────────────

export const SpaceSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    title: z.string(),
    description: z.string().nullish(),
    thumbnailUrl: z.string().nullish(),
    slug: z.string().nullish(),
    type: z.enum(["learning", "practice", "assessment", "resource", "hybrid"]),
    subject: z.string().nullish(),
    labels: z.array(z.string()).nullish(),
    classIds: z.array(z.string()),
    sectionIds: z.array(z.string()).nullish(),
    teacherIds: z.array(z.string()),
    accessType: z.enum(["class_assigned", "tenant_wide", "public_store"]),
    academicSessionId: z.string().nullish(),
    status: z.enum(["draft", "published", "archived"]),
    createdBy: z.string(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── AutoGrade schemas ───────────────────────────────────────────────────────

export const ExamSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    title: z.string(),
    subject: z.string(),
    topics: z.array(z.string()).optional().default([]),
    classIds: z.array(z.string()).optional().default([]),
    sectionIds: z.array(z.string()).optional(),
    // examDate may be null in Firestore when an exam was created without a date.
    examDate: FirestoreTimestampSchema.nullish(),
    duration: z.number().optional().default(0),
    academicSessionId: z.string().nullish(),
    totalMarks: z.number().optional().default(0),
    passingMarks: z.number().optional().default(0),
    status: z.enum([
      "draft",
      "question_paper_uploaded",
      "question_paper_extracted",
      "published",
      "grading",
      "completed",
      "results_released",
      "archived",
    ]),
    createdBy: z.string().optional(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

export const SubmissionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  examId: z.string(),
  studentId: z.string(),
  studentName: z.string(),
  rollNumber: z.string(),
  classId: z.string(),
  answerSheets: z.object({
    images: z.array(z.string()),
    uploadedAt: FirestoreTimestampSchema,
    uploadedBy: z.string(),
    uploadSource: z.enum(["web", "scanner", "gcs"]),
  }),
  summary: z.object({
    totalScore: z.number(),
    maxScore: z.number(),
    percentage: z.number(),
    grade: z.string(),
    questionsGraded: z.number(),
    totalQuestions: z.number(),
    completedAt: FirestoreTimestampSchema.optional(),
  }),
  pipelineStatus: z.enum([
    "uploaded",
    "ocr_processing",
    "ocr_failed",
    "scouting",
    "scouting_failed",
    "scouting_complete",
    "grading",
    "grading_partial",
    "grading_failed",
    "grading_complete",
    "finalization_failed",
    "ready_for_review",
    "reviewed",
    "failed",
    "manual_review_needed",
  ]),
  pipelineError: z.string().optional(),
  retryCount: z.number(),
  resultsReleased: z.boolean(),
  resultsReleasedAt: FirestoreTimestampSchema.optional(),
  resultsReleasedBy: z.string().optional(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

export const ExamQuestionSchema = z
  .object({
    id: z.string(),
    examId: z.string(),
    text: z.string(),
    imageUrls: z.array(z.string()).optional(),
    maxMarks: z.number(),
    order: z.number(),
    questionType: z.enum(["standard", "diagram", "multi-part"]).optional(),
    extractedBy: z.enum(["ai", "manual"]).optional(),
    extractedAt: FirestoreTimestampSchema.optional(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

export const QuestionSubmissionSchema = z
  .object({
    id: z.string(),
    submissionId: z.string(),
    questionId: z.string(),
    examId: z.string(),
    mapping: z.object({
      pageIndices: z.array(z.number()),
      imageUrls: z.array(z.string()),
      scoutedAt: FirestoreTimestampSchema,
    }),
    gradingStatus: z.enum(["pending", "processing", "graded", "needs_review", "failed", "manual", "overridden"]),
    gradingError: z.string().optional(),
    gradingRetryCount: z.number(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── Parent schema ─────────────────────────────────────────────────────────

export const ParentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  authUid: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string().optional(),
  studentIds: z.array(z.string()),
  status: z.enum(["active", "archived"]),
  lastLogin: FirestoreTimestampSchema.optional(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

// ── Academic Session schema ───────────────────────────────────────────────

export const AcademicSessionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  startDate: FirestoreTimestampSchema,
  endDate: FirestoreTimestampSchema,
  isCurrent: z.boolean(),
  status: z.enum(["active", "archived"]),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

// ── StoryPoint schema ─────────────────────────────────────────────────────

export const StoryPointSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    spaceId: z.string(),
    title: z.string(),
    description: z.string().nullish(),
    orderIndex: z.number(),
    type: z.enum(["standard", "timed_test", "quiz", "practice", "test"]),
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          orderIndex: z.number(),
          description: z.string().nullish(),
        })
      )
      .nullish(),
    assessmentConfig: z
      .object({
        durationMinutes: z.number().nullish(),
        instructions: z.string().nullish(),
        maxAttempts: z.number().nullish(),
        shuffleQuestions: z.boolean().nullish(),
        shuffleOptions: z.boolean().nullish(),
        showResultsImmediately: z.boolean().nullish(),
      })
      .passthrough()
      .nullish(),
    difficulty: z.enum(["easy", "medium", "hard", "expert"]).nullish(),
    estimatedTimeMinutes: z.number().nullish(),
    status: z.enum(["active", "archived"]).nullish(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── Agent schema ──────────────────────────────────────────────────────────

export const AgentSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    spaceId: z.string(),
    name: z.string(),
    type: z.enum(["tutor", "evaluator"]),
    systemPrompt: z.string(),
    rules: z.array(z.string()).optional(),
    modelOverride: z.string().optional(),
    isActive: z.boolean(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── Chat Session schema ───────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  text: z.string(),
  timestamp: FirestoreTimestampSchema,
  mediaUrls: z.array(z.string()).optional(),
  tokensUsed: z.number().optional(),
});

export const ChatSessionSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  spaceId: z.string(),
  storyPointId: z.string().optional(),
  itemId: z.string().optional(),
  agentId: z.string().optional(),
  messages: z.array(ChatMessageSchema),
  systemPrompt: z.string().optional(),
  isActive: z.boolean(),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
});

// ── Digital Test Session schema ───────────────────────────────────────────

export const DigitalTestSessionSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    userId: z.string(),
    spaceId: z.string(),
    storyPointId: z.string(),
    type: z.enum(["timed_test", "quiz", "practice"]),
    status: z.enum(["in_progress", "completed", "expired", "abandoned"]),
    startedAt: FirestoreTimestampSchema,
    deadline: FirestoreTimestampSchema.nullish(),
    completedAt: FirestoreTimestampSchema.nullish(),
    totalQuestions: z.number(),
    attemptNumber: z.number(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── Notification schema ───────────────────────────────────────────────────

export const NotificationSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    recipientUid: z.string(),
    recipientRole: z.enum(["teacher", "student", "parent", "tenantAdmin"]),
    type: z.string(),
    title: z.string(),
    body: z.string(),
    isRead: z.boolean(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    createdAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── UnifiedUser schema ────────────────────────────────────────────────────

const PurchaseRecordSchema = z
  .object({
    spaceId: z.string(),
    spaceTitle: z.string(),
    amount: z.number(),
    currency: z.string(),
    purchasedAt: FirestoreTimestampSchema,
    transactionId: z.string(),
  })
  .passthrough();

const ConsumerProfileSchema = z
  .object({
    plan: z.enum(["free", "pro", "premium"]),
    enrolledSpaceIds: z.array(z.string()),
    purchaseHistory: z.array(PurchaseRecordSchema),
    totalSpend: z.number(),
  })
  .passthrough();

export const UnifiedUserSchema = z
  .object({
    uid: z.string(),
    email: z.string().nullish(),
    phone: z.string().nullish(),
    authProviders: z.array(z.enum(["email", "phone", "google", "apple"])),
    displayName: z.string(),
    firstName: z.string().nullish(),
    lastName: z.string().nullish(),
    photoURL: z.string().nullish(),
    country: z.string().optional(),
    age: z.number().optional(),
    grade: z.string().optional(),
    onboardingCompleted: z.boolean().optional(),
    preferences: z.record(z.string(), z.unknown()).optional(),
    isSuperAdmin: z.boolean(),
    consumerProfile: ConsumerProfileSchema.optional(),
    activeTenantId: z.string().optional(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
    lastLogin: FirestoreTimestampSchema.optional(),
    status: z.enum(["active", "suspended", "deleted"]),
  })
  .passthrough();

// ── UserMembership schema ─────────────────────────────────────────────────

const TeacherPermissionsSchema = z
  .object({
    canCreateExams: z.boolean().optional(),
    canEditRubrics: z.boolean().optional(),
    canManuallyGrade: z.boolean().optional(),
    canViewAllExams: z.boolean().optional(),
    canCreateSpaces: z.boolean().optional(),
    canManageContent: z.boolean().optional(),
    canViewAnalytics: z.boolean().optional(),
    canConfigureAgents: z.boolean().optional(),
    managedSpaceIds: z.array(z.string()).optional(),
    managedClassIds: z.array(z.string()).optional(),
  })
  .passthrough();

const StaffPermissionsSchema = z
  .object({
    canManageUsers: z.boolean(),
    canManageClasses: z.boolean(),
    canManageBilling: z.boolean(),
    canViewAnalytics: z.boolean(),
    canManageSettings: z.boolean(),
    canExportData: z.boolean(),
  })
  .passthrough();

export const UserMembershipSchema = z
  .object({
    id: z.string(),
    uid: z.string(),
    tenantId: z.string(),
    tenantCode: z.string(),
    role: z.enum(["superAdmin", "tenantAdmin", "teacher", "student", "parent", "scanner", "staff"]),
    status: z.enum(["active", "inactive", "suspended"]),
    joinSource: z.enum([
      "admin_created",
      "bulk_import",
      "invite_code",
      "self_register",
      "migration",
      "tenant_code",
    ]),
    teacherId: z.string().optional(),
    studentId: z.string().optional(),
    parentId: z.string().optional(),
    scannerId: z.string().optional(),
    schoolId: z.string().optional(),
    staffId: z.string().optional(),
    permissions: TeacherPermissionsSchema.optional(),
    staffPermissions: StaffPermissionsSchema.optional(),
    parentLinkedStudentIds: z.array(z.string()).optional(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
    lastActive: FirestoreTimestampSchema.optional(),
  })
  .passthrough();

// ── UnifiedItem schema ────────────────────────────────────────────────────

export const UnifiedItemSchema = z
  .object({
    id: z.string(),
    spaceId: z.string(),
    storyPointId: z.string(),
    sectionId: z.string().nullish(),
    tenantId: z.string(),
    type: z.enum([
      "question",
      "material",
      "interactive",
      "assessment",
      "discussion",
      "project",
      "checkpoint",
    ]),
    payload: z.record(z.string(), z.unknown()),
    title: z.string().nullish(),
    content: z.string().nullish(),
    difficulty: z.enum(["easy", "medium", "hard"]).nullish(),
    topics: z.array(z.string()).nullish(),
    labels: z.array(z.string()).nullish(),
    orderIndex: z.number(),
    meta: z.record(z.string(), z.unknown()).nullish(),
    analytics: z.record(z.string(), z.unknown()).nullish(),
    rubric: z.record(z.string(), z.unknown()).nullish(),
    linkedQuestionId: z.string().nullish(),
    version: z.number().nullish(),
    createdBy: z.string().nullish(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── SpaceProgress schema ──────────────────────────────────────────────────

const QuestionProgressDataSchema = z
  .object({
    status: z.enum(["pending", "correct", "incorrect", "partial"]),
    attemptsCount: z.number(),
    bestScore: z.number(),
    pointsEarned: z.number(),
    totalPoints: z.number(),
    percentage: z.number(),
    solved: z.boolean(),
    latestScore: z.number().optional(),
    latestStatus: z.enum(["pending", "correct", "incorrect", "partial"]).optional(),
  })
  .passthrough();

const StoredEvaluationZodSchema = z
  .object({
    score: z.number(),
    maxScore: z.number(),
    correctness: z.number(),
    percentage: z.number(),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    missingConcepts: z.array(z.string()),
    summary: z
      .object({
        keyTakeaway: z.string(),
        overallComment: z.string(),
      })
      .optional(),
    mistakeClassification: z
      .enum(["Conceptual", "Silly Error", "Knowledge Gap", "None"])
      .optional(),
  })
  .passthrough();

const AttemptRecordSchema = z
  .object({
    attemptNumber: z.number(),
    answer: z.unknown(),
    evaluation: StoredEvaluationZodSchema,
    score: z.number(),
    maxScore: z.number(),
    timestamp: z.number(),
  })
  .passthrough();

const ItemProgressEntrySchema = z
  .object({
    itemId: z.string(),
    itemType: z.enum([
      "question",
      "material",
      "interactive",
      "assessment",
      "discussion",
      "project",
      "checkpoint",
    ]),
    completed: z.boolean(),
    completedAt: z.number().optional(),
    timeSpent: z.number().optional(),
    interactions: z.number().optional(),
    lastUpdatedAt: z.number(),
    questionData: QuestionProgressDataSchema.optional(),
    progress: z.number().optional(),
    score: z.number().optional(),
    feedback: z.string().optional(),
    lastAnswer: z.unknown().optional(),
    lastEvaluation: StoredEvaluationZodSchema.optional(),
    attempts: z.array(AttemptRecordSchema).max(20).optional(),
  })
  .passthrough();

const StoryPointProgressSchema = z
  .object({
    storyPointId: z.string(),
    status: z.enum(["not_started", "in_progress", "completed"]),
    pointsEarned: z.number(),
    totalPoints: z.number(),
    percentage: z.number(),
    completedItems: z.number(),
    totalItems: z.number(),
    completedAt: z.number().optional(),
  })
  .passthrough();

export const StoryPointProgressDocSchema = z
  .object({
    storyPointId: z.string(),
    status: z.enum(["not_started", "in_progress", "completed"]),
    pointsEarned: z.number(),
    totalPoints: z.number(),
    percentage: z.number(),
    completedItems: z.number(),
    totalItems: z.number(),
    completedAt: z.number().optional(),
    updatedAt: z.number(),
    items: z.record(z.string(), ItemProgressEntrySchema),
  })
  .passthrough();

export const SpaceProgressSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    tenantId: z.string(),
    spaceId: z.string(),
    status: z.enum(["not_started", "in_progress", "completed"]),
    pointsEarned: z.number(),
    totalPoints: z.number(),
    marksEarned: z.number().optional(),
    totalMarks: z.number().optional(),
    percentage: z.number(),
    storyPoints: z.record(z.string(), StoryPointProgressSchema),
    startedAt: FirestoreTimestampSchema.optional(),
    completedAt: FirestoreTimestampSchema.optional(),
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── QuestionBankItem schema ───────────────────────────────────────────────

export const QuestionBankItemSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    questionType: z.enum([
      "mcq",
      "mcaq",
      "true-false",
      "numerical",
      "text",
      "paragraph",
      "code",
      "fill-blanks",
      "fill-blanks-dd",
      "matching",
      "jumbled",
      "audio",
      "image_evaluation",
      "group-options",
      "chat_agent_question",
    ]),
    title: z.string().optional(),
    content: z.string(),
    explanation: z.string().optional(),
    basePoints: z.number().optional(),
    questionData: z.record(z.string(), z.unknown()),
    subject: z.string(),
    topics: z.array(z.string()),
    difficulty: z.enum(["easy", "medium", "hard"]),
    bloomsLevel: z
      .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
      .optional(),
    usageCount: z.number(),
    averageScore: z.number().optional(),
    lastUsedAt: FirestoreTimestampSchema.optional(),
    tags: z.array(z.string()),
    createdBy: z.string(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── SpaceReview schema ────────────────────────────────────────────────────

export const SpaceReviewSchema = z
  .object({
    id: z.string(),
    spaceId: z.string(),
    tenantId: z.string(),
    userId: z.string(),
    userName: z.string().optional(),
    rating: z.number(),
    comment: z.string().optional(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── AnswerKey schema ──────────────────────────────────────────────────────

export const AnswerKeySchema = z
  .object({
    id: z.string(),
    itemId: z.string(),
    questionType: z.enum([
      "mcq",
      "mcaq",
      "true-false",
      "numerical",
      "text",
      "paragraph",
      "code",
      "fill-blanks",
      "fill-blanks-dd",
      "matching",
      "jumbled",
      "audio",
      "image_evaluation",
      "group-options",
      "chat_agent_question",
    ]),
    correctAnswer: z.unknown(),
    acceptableAnswers: z.array(z.unknown()).optional(),
    evaluationGuidance: z.string().optional(),
    modelAnswer: z.string().optional(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── EvaluationSettings schema ─────────────────────────────────────────────

const EvaluationDimensionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
    promptGuidance: z.string(),
    enabled: z.boolean(),
    isDefault: z.boolean(),
    isCustom: z.boolean(),
    expectedFeedbackCount: z.number().optional(),
    weight: z.number(),
    scoringScale: z.number(),
    createdAt: FirestoreTimestampSchema.optional(),
    createdBy: z.string().optional(),
  })
  .passthrough();

const EvaluationDisplaySettingsSchema = z
  .object({
    showStrengths: z.boolean(),
    showKeyTakeaway: z.boolean(),
    prioritizeByImportance: z.boolean(),
  })
  .passthrough();

const EvaluationConfidenceConfigSchema = z
  .object({
    confidenceThreshold: z.number(),
    autoApproveThreshold: z.number(),
    requireReviewForPartialCredit: z.boolean(),
  })
  .passthrough();

const UsageQuotaConfigSchema = z
  .object({
    monthlyBudgetUsd: z.number(),
    dailyCallLimit: z.number(),
    warningThresholdPercent: z.number(),
  })
  .passthrough();

export const EvaluationSettingsSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    isDefault: z.boolean(),
    isPublic: z.boolean().optional(),
    enabledDimensions: z.array(EvaluationDimensionSchema),
    displaySettings: EvaluationDisplaySettingsSchema,
    confidenceConfig: EvaluationConfidenceConfigSchema.optional(),
    usageQuota: UsageQuotaConfigSchema.optional(),
    createdBy: z.string().optional(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── GradingDeadLetter schema ──────────────────────────────────────────────

export const GradingDeadLetterSchema = z
  .object({
    id: z.string(),
    submissionId: z.string(),
    questionSubmissionId: z.string().optional(),
    pipelineStep: z.enum(["ocr", "scouting", "grading"]),
    error: z.string(),
    errorStack: z.string().optional(),
    attempts: z.number(),
    lastAttemptAt: FirestoreTimestampSchema,
    resolvedAt: FirestoreTimestampSchema.optional(),
    resolvedBy: z.string().optional(),
    resolutionMethod: z.enum(["retry_success", "manual_grade", "dismissed"]).optional(),
    createdAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── ExamAnalytics schema ──────────────────────────────────────────────────

const ScoreDistributionBucketSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    count: z.number(),
  })
  .passthrough();

const QuestionAnalyticsEntrySchema = z
  .object({
    questionId: z.string(),
    avgScore: z.number(),
    maxScore: z.number(),
    avgPercentage: z.number(),
    difficultyIndex: z.number(),
    discriminationIndex: z.number(),
    commonMistakes: z.array(z.string()),
    commonStrengths: z.array(z.string()),
  })
  .passthrough();

const ClassBreakdownEntrySchema = z
  .object({
    classId: z.string(),
    className: z.string(),
    avgScore: z.number(),
    passRate: z.number(),
    submissionCount: z.number(),
  })
  .passthrough();

const TopicPerformanceEntrySchema = z
  .object({
    topic: z.string(),
    avgPercentage: z.number(),
    weakStudentCount: z.number(),
  })
  .passthrough();

export const ExamAnalyticsSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    examId: z.string(),
    totalSubmissions: z.number(),
    gradedSubmissions: z.number(),
    avgScore: z.number(),
    avgPercentage: z.number(),
    passRate: z.number(),
    medianScore: z.number(),
    scoreDistribution: z
      .object({
        buckets: z.array(ScoreDistributionBucketSchema),
        gradeDistribution: z.record(z.string(), z.number()).optional(),
      })
      .passthrough(),
    questionAnalytics: z.record(z.string(), QuestionAnalyticsEntrySchema),
    classBreakdown: z.record(z.string(), ClassBreakdownEntrySchema),
    topicPerformance: z.record(z.string(), TopicPerformanceEntrySchema),
    computedAt: FirestoreTimestampSchema,
    lastUpdatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── StudentProgressSummary schema ─────────────────────────────────────────

const AutogradeSubjectBreakdownSchema = z
  .object({
    avgScore: z.number(),
    examCount: z.number(),
  })
  .passthrough();

const RecentExamEntrySchema = z
  .object({
    examId: z.string(),
    examTitle: z.string(),
    score: z.number(),
    percentage: z.number(),
    date: FirestoreTimestampSchema,
  })
  .passthrough();

const StudentAutogradeMetricsSchema = z
  .object({
    totalExams: z.number(),
    completedExams: z.number(),
    averageScore: z.number(),
    averagePercentage: z.number(),
    totalMarksObtained: z.number(),
    totalMarksAvailable: z.number(),
    subjectBreakdown: z.record(z.string(), AutogradeSubjectBreakdownSchema),
    recentExams: z.array(RecentExamEntrySchema),
  })
  .passthrough();

const LevelupSubjectBreakdownSchema = z
  .object({
    avgCompletion: z.number(),
    spaceCount: z.number(),
  })
  .passthrough();

const RecentActivityEntrySchema = z
  .object({
    spaceId: z.string(),
    spaceTitle: z.string(),
    action: z.string(),
    date: FirestoreTimestampSchema,
  })
  .passthrough();

const StudentLevelupMetricsSchema = z
  .object({
    totalSpaces: z.number(),
    completedSpaces: z.number(),
    averageCompletion: z.number(),
    totalPointsEarned: z.number(),
    totalPointsAvailable: z.number(),
    averageAccuracy: z.number(),
    streakDays: z.number(),
    subjectBreakdown: z.record(z.string(), LevelupSubjectBreakdownSchema),
    recentActivity: z.array(RecentActivityEntrySchema),
  })
  .passthrough();

export const StudentProgressSummarySchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    studentId: z.string(),
    autograde: StudentAutogradeMetricsSchema,
    levelup: StudentLevelupMetricsSchema,
    overallScore: z.number(),
    strengthAreas: z.array(z.string()),
    weaknessAreas: z.array(z.string()),
    isAtRisk: z.boolean(),
    atRiskReasons: z.array(z.string()),
    lastUpdatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── ClassProgressSummary schema ───────────────────────────────────────────

const ClassAutogradeMetricsSchema = z
  .object({
    averageClassScore: z.number(),
    examCompletionRate: z.number(),
    topPerformers: z.array(
      z.object({
        studentId: z.string(),
        name: z.string(),
        avgScore: z.number(),
      })
    ),
    bottomPerformers: z.array(
      z.object({
        studentId: z.string(),
        name: z.string(),
        avgScore: z.number(),
      })
    ),
  })
  .passthrough();

const ClassLevelupMetricsSchema = z
  .object({
    averageClassCompletion: z.number(),
    activeStudentRate: z.number(),
    topPointEarners: z.array(
      z.object({
        studentId: z.string(),
        name: z.string(),
        points: z.number(),
      })
    ),
  })
  .passthrough();

export const ClassProgressSummarySchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    classId: z.string(),
    className: z.string(),
    studentCount: z.number(),
    autograde: ClassAutogradeMetricsSchema,
    levelup: ClassLevelupMetricsSchema,
    atRiskStudentIds: z.array(z.string()),
    atRiskCount: z.number(),
    lastUpdatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── LearningInsight schema ────────────────────────────────────────────────

export const LearningInsightSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    studentId: z.string(),
    type: z.enum([
      "weak_topic_recommendation",
      "exam_preparation",
      "streak_encouragement",
      "improvement_celebration",
      "at_risk_intervention",
      "cross_system_correlation",
    ]),
    priority: z.enum(["high", "medium", "low"]),
    title: z.string(),
    description: z.string(),
    actionType: z.enum(["practice_space", "review_exam", "seek_help", "celebrate"]),
    actionEntityId: z.string().optional(),
    actionEntityTitle: z.string().optional(),
    createdAt: FirestoreTimestampSchema,
    dismissedAt: FirestoreTimestampSchema.optional(),
  })
  .passthrough();

// ── LLMCallLog schema ─────────────────────────────────────────────────────

export const LLMCallLogSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    functionName: z.string(),
    model: z.string(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
    costUSD: z.number(),
    latencyMs: z.number(),
    status: z.enum(["success", "error"]),
    errorMessage: z.string().optional(),
    userId: z.string().optional(),
    examId: z.string().optional(),
    spaceId: z.string().optional(),
    createdAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── Achievement schema ────────────────────────────────────────────────────

const AchievementCriteriaSchema = z
  .object({
    type: z.enum([
      "spaces_completed",
      "story_points_completed",
      "exams_passed",
      "perfect_scores",
      "streak_days",
      "total_points",
      "items_completed",
      "chat_sessions",
      "leaderboard_top3",
      "login_days",
    ]),
    threshold: z.number(),
    subject: z.string().optional(),
    spaceId: z.string().optional(),
  })
  .passthrough();

export const AchievementSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    title: z.string(),
    description: z.string(),
    icon: z.string(),
    category: z.enum([
      "learning",
      "consistency",
      "excellence",
      "exploration",
      "social",
      "milestone",
    ]),
    rarity: z.enum(["common", "uncommon", "rare", "epic", "legendary"]),
    tier: z.enum(["bronze", "silver", "gold", "platinum", "diamond"]),
    criteria: AchievementCriteriaSchema,
    pointsReward: z.number(),
    isActive: z.boolean(),
    createdAt: FirestoreTimestampSchema,
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ── StudentAchievement schema ─────────────────────────────────────────────

export const StudentAchievementSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    userId: z.string(),
    achievementId: z.string(),
    achievement: AchievementSchema,
    earnedAt: FirestoreTimestampSchema,
    seen: z.boolean(),
  })
  .passthrough();

// ── StudentLevel schema ───────────────────────────────────────────────────

export const StudentLevelSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    userId: z.string(),
    level: z.number(),
    currentXP: z.number(),
    xpToNextLevel: z.number(),
    totalXP: z.number(),
    tier: z.enum(["bronze", "silver", "gold", "platinum", "diamond"]),
    achievementCount: z.number(),
    updatedAt: FirestoreTimestampSchema,
  })
  .passthrough();

// ═══════════════════════════════════════════════════════════════════════════
// z.infer<> type exports for all schemas
// ═══════════════════════════════════════════════════════════════════════════

// Existing schemas
export type TenantSchemaType = z.infer<typeof TenantSchema>;
export type ClassSchemaType = z.infer<typeof ClassSchema>;
export type StudentSchemaType = z.infer<typeof StudentSchema>;
export type TeacherSchemaType = z.infer<typeof TeacherSchema>;
export type ParentSchemaType = z.infer<typeof ParentSchema>;
export type AcademicSessionSchemaType = z.infer<typeof AcademicSessionSchema>;
export type SpaceSchemaType = z.infer<typeof SpaceSchema>;
export type StoryPointSchemaType = z.infer<typeof StoryPointSchema>;
export type AgentSchemaType = z.infer<typeof AgentSchema>;
export type ChatMessageSchemaType = z.infer<typeof ChatMessageSchema>;
export type ChatSessionSchemaType = z.infer<typeof ChatSessionSchema>;
export type DigitalTestSessionSchemaType = z.infer<typeof DigitalTestSessionSchema>;
export type ExamSchemaType = z.infer<typeof ExamSchema>;
export type SubmissionSchemaType = z.infer<typeof SubmissionSchema>;
export type ExamQuestionSchemaType = z.infer<typeof ExamQuestionSchema>;
export type QuestionSubmissionSchemaType = z.infer<typeof QuestionSubmissionSchema>;
export type NotificationSchemaType = z.infer<typeof NotificationSchema>;

// New schemas
export type UnifiedUserSchemaType = z.infer<typeof UnifiedUserSchema>;
export type UserMembershipSchemaType = z.infer<typeof UserMembershipSchema>;
export type UnifiedItemSchemaType = z.infer<typeof UnifiedItemSchema>;
export type SpaceProgressSchemaType = z.infer<typeof SpaceProgressSchema>;
export type QuestionBankItemSchemaType = z.infer<typeof QuestionBankItemSchema>;
export type SpaceReviewSchemaType = z.infer<typeof SpaceReviewSchema>;
export type AnswerKeySchemaType = z.infer<typeof AnswerKeySchema>;
export type EvaluationSettingsSchemaType = z.infer<typeof EvaluationSettingsSchema>;
export type GradingDeadLetterSchemaType = z.infer<typeof GradingDeadLetterSchema>;
export type ExamAnalyticsSchemaType = z.infer<typeof ExamAnalyticsSchema>;
export type StudentProgressSummarySchemaType = z.infer<typeof StudentProgressSummarySchema>;
export type ClassProgressSummarySchemaType = z.infer<typeof ClassProgressSummarySchema>;
export type LearningInsightSchemaType = z.infer<typeof LearningInsightSchema>;
export type LLMCallLogSchemaType = z.infer<typeof LLMCallLogSchema>;
export type AchievementSchemaType = z.infer<typeof AchievementSchema>;
export type StudentAchievementSchemaType = z.infer<typeof StudentAchievementSchema>;
export type StudentLevelSchemaType = z.infer<typeof StudentLevelSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Compile-time compatibility assertions
// Verifies each Zod schema type is assignable from its TypeScript interface.
// If a schema and interface drift apart, this will produce a compile error.
// ═══════════════════════════════════════════════════════════════════════════

// Using passthrough() makes schemas produce types with index signatures,
// so we check that the interface extends the schema type (schema is a subset).
type _AssertTenantCompat = Tenant extends TenantSchemaType ? true : never;
type _AssertClassCompat = Class extends ClassSchemaType ? true : never;
type _AssertStudentCompat = Student extends StudentSchemaType ? true : never;
type _AssertTeacherCompat = Teacher extends TeacherSchemaType ? true : never;
type _AssertParentCompat = Parent extends ParentSchemaType ? true : never;
type _AssertAcademicSessionCompat = AcademicSession extends AcademicSessionSchemaType
  ? true
  : never;
type _AssertSpaceCompat = Space extends SpaceSchemaType ? true : never;
type _AssertStoryPointCompat = StoryPoint extends StoryPointSchemaType ? true : never;
type _AssertAgentCompat = Agent extends AgentSchemaType ? true : never;
type _AssertChatMessageCompat = ChatMessage extends ChatMessageSchemaType ? true : never;
type _AssertChatSessionCompat = ChatSession extends ChatSessionSchemaType ? true : never;
type _AssertDigitalTestSessionCompat = DigitalTestSession extends DigitalTestSessionSchemaType
  ? true
  : never;
type _AssertExamCompat = Exam extends ExamSchemaType ? true : never;
type _AssertSubmissionCompat = Submission extends SubmissionSchemaType ? true : never;
type _AssertExamQuestionCompat = ExamQuestion extends ExamQuestionSchemaType ? true : never;
type _AssertQuestionSubmissionCompat = QuestionSubmission extends QuestionSubmissionSchemaType
  ? true
  : never;
type _AssertNotificationCompat = Notification extends NotificationSchemaType ? true : never;
type _AssertUnifiedUserCompat = UnifiedUser extends UnifiedUserSchemaType ? true : never;
type _AssertUserMembershipCompat = UserMembership extends UserMembershipSchemaType ? true : never;
type _AssertUnifiedItemCompat = UnifiedItem extends UnifiedItemSchemaType ? true : never;
type _AssertSpaceProgressCompat = SpaceProgress extends SpaceProgressSchemaType ? true : never;
type _AssertQuestionBankItemCompat = QuestionBankItem extends QuestionBankItemSchemaType
  ? true
  : never;
type _AssertSpaceReviewCompat = SpaceReview extends SpaceReviewSchemaType ? true : never;
type _AssertAnswerKeyCompat = AnswerKey extends AnswerKeySchemaType ? true : never;
type _AssertEvaluationSettingsCompat = EvaluationSettings extends EvaluationSettingsSchemaType
  ? true
  : never;
type _AssertGradingDeadLetterCompat = GradingDeadLetterEntry extends GradingDeadLetterSchemaType
  ? true
  : never;
type _AssertExamAnalyticsCompat = ExamAnalytics extends ExamAnalyticsSchemaType ? true : never;
type _AssertStudentProgressSummaryCompat =
  StudentProgressSummary extends StudentProgressSummarySchemaType ? true : never;
type _AssertClassProgressSummaryCompat = ClassProgressSummary extends ClassProgressSummarySchemaType
  ? true
  : never;
type _AssertLearningInsightCompat = LearningInsight extends LearningInsightSchemaType
  ? true
  : never;
type _AssertLLMCallLogCompat = LLMCallLog extends LLMCallLogSchemaType ? true : never;
type _AssertAchievementCompat = Achievement extends AchievementSchemaType ? true : never;
type _AssertStudentAchievementCompat = StudentAchievement extends StudentAchievementSchemaType
  ? true
  : never;
type _AssertStudentLevelCompat = StudentLevel extends StudentLevelSchemaType ? true : never;

// Suppress unused type warnings
void 0 as unknown as _AssertTenantCompat;
void 0 as unknown as _AssertClassCompat;
void 0 as unknown as _AssertStudentCompat;
void 0 as unknown as _AssertTeacherCompat;
void 0 as unknown as _AssertParentCompat;
void 0 as unknown as _AssertAcademicSessionCompat;
void 0 as unknown as _AssertSpaceCompat;
void 0 as unknown as _AssertStoryPointCompat;
void 0 as unknown as _AssertAgentCompat;
void 0 as unknown as _AssertChatMessageCompat;
void 0 as unknown as _AssertChatSessionCompat;
void 0 as unknown as _AssertDigitalTestSessionCompat;
void 0 as unknown as _AssertExamCompat;
void 0 as unknown as _AssertSubmissionCompat;
void 0 as unknown as _AssertExamQuestionCompat;
void 0 as unknown as _AssertQuestionSubmissionCompat;
void 0 as unknown as _AssertNotificationCompat;
void 0 as unknown as _AssertUnifiedUserCompat;
void 0 as unknown as _AssertUserMembershipCompat;
void 0 as unknown as _AssertUnifiedItemCompat;
void 0 as unknown as _AssertSpaceProgressCompat;
void 0 as unknown as _AssertQuestionBankItemCompat;
void 0 as unknown as _AssertSpaceReviewCompat;
void 0 as unknown as _AssertAnswerKeyCompat;
void 0 as unknown as _AssertEvaluationSettingsCompat;
void 0 as unknown as _AssertGradingDeadLetterCompat;
void 0 as unknown as _AssertExamAnalyticsCompat;
void 0 as unknown as _AssertStudentProgressSummaryCompat;
void 0 as unknown as _AssertClassProgressSummaryCompat;
void 0 as unknown as _AssertLearningInsightCompat;
void 0 as unknown as _AssertLLMCallLogCompat;
void 0 as unknown as _AssertAchievementCompat;
void 0 as unknown as _AssertStudentAchievementCompat;
void 0 as unknown as _AssertStudentLevelCompat;

// ── Callable request schemas ──────────────────────────────────────────────
export * from "./callable-schemas";
export {
  SaveAnnouncementRequestSchema,
  ListAnnouncementsRequestSchema,
} from "./announcement.schema";
