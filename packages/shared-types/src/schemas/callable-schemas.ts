/**
 * Zod schemas for validating callable request data at Cloud Function entry points.
 *
 * Usage in a callable:
 * ```typescript
 * import { SaveClassRequestSchema } from '@levelup/shared-types';
 * const data = parseRequest(request, SaveClassRequestSchema);
 * ```
 *
 * @module schemas/callable-schemas
 */

import { z } from "zod";

// ── Validation constants ──────────────────────────────────────────────────

/** Max length for short text fields (names, titles). */
const MAX_SHORT_TEXT = 200;
/** Max length for medium text fields (descriptions, prompts). */
const MAX_MEDIUM_TEXT = 2000;
/** Max length for long text fields (content, guidance). */
const MAX_LONG_TEXT = 10000;
/** Max array items for list fields (classIds, tags, etc.). */
const MAX_ARRAY_ITEMS = 100;
/** Max array items for bulk operations. */
const MAX_BULK_ITEMS = 500;
/** Firestore document ID pattern (no slashes, non-empty, max 1500 chars). */
const firestoreId = z
  .string()
  .min(1, "ID cannot be empty")
  .max(1500)
  .regex(/^[^/]+$/, "ID cannot contain slashes");

// ── Reusable schema fragments ─────────────────────────────────────────────

/** Rubric criterion level (score + label + description). */
const RubricCriterionLevelSchema = z.object({
  score: z.number(),
  label: z.string(),
  description: z.string(),
});

/** Rubric criterion (id + name + maxPoints + optional levels). */
const RubricCriterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  maxPoints: z.number(),
  weight: z.number().optional(),
  levels: z.array(RubricCriterionLevelSchema).optional(),
});

/** Evaluation dimension for RELMS / AI grading. */
const EvaluationDimensionSchema = z.object({
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
});

/** UnifiedRubric schema — canonical grading criteria structure. */
const UnifiedRubricSchema = z.object({
  scoringMode: z.enum(["criteria_based", "dimension_based", "holistic", "hybrid"]),
  criteria: z.array(RubricCriterionSchema).optional(),
  dimensions: z.array(EvaluationDimensionSchema).optional(),
  holisticGuidance: z.string().optional(),
  holisticMaxScore: z.number().optional(),
  passingPercentage: z.number().optional(),
  showModelAnswer: z.boolean().optional(),
  modelAnswer: z.string().optional(),
  evaluatorGuidance: z.string().optional(),
});

/** Item metadata schema for meta/analytics fields on SaveItemRequest. */
const ItemMetadataSchema = z
  .object({
    subject: z.string().optional(),
    topics: z.array(z.string()).optional(),
    bloomsLevel: z.string().optional(),
    estimatedTime: z.number().optional(),
    source: z.string().optional(),
  })
  .passthrough();

// ── Identity module ────────────────────────────────────────────────────────

export const SaveTenantRequestSchema = z.object({
  id: firestoreId.optional(),
  data: z.object({
    name: z.string().max(MAX_SHORT_TEXT).optional(),
    shortName: z.string().max(MAX_SHORT_TEXT).optional(),
    description: z.string().max(MAX_MEDIUM_TEXT).optional(),
    contactEmail: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    contactPhone: z.string().max(20).nullable().optional(),
    contactPerson: z.string().max(MAX_SHORT_TEXT).nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    bannerUrl: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        zipCode: z.string().optional(),
      })
      .optional(),
    status: z.enum(["active", "suspended", "trial", "expired", "deactivated"]).optional(),
    subscription: z
      .object({
        plan: z.enum(["free", "trial", "basic", "premium", "enterprise"]).optional(),
        maxStudents: z.number().optional(),
        maxTeachers: z.number().optional(),
        maxSpaces: z.number().optional(),
        maxExamsPerMonth: z.number().optional(),
        billingCycle: z.enum(["monthly", "annual"]).optional(),
        billingEmail: z.string().optional(),
        cancelAtPeriodEnd: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    features: z
      .object({
        autoGradeEnabled: z.boolean().optional(),
        levelUpEnabled: z.boolean().optional(),
        scannerAppEnabled: z.boolean().optional(),
        aiChatEnabled: z.boolean().optional(),
        aiGradingEnabled: z.boolean().optional(),
        analyticsEnabled: z.boolean().optional(),
        parentPortalEnabled: z.boolean().optional(),
        bulkImportEnabled: z.boolean().optional(),
        apiAccessEnabled: z.boolean().optional(),
      })
      .optional(),
    settings: z
      .object({
        geminiKeyRef: z.string().optional(),
        geminiKeySet: z.boolean().optional(),
        defaultEvaluationSettingsId: z.string().optional(),
        defaultAiModel: z.string().optional(),
        timezone: z.string().optional(),
        locale: z.string().optional(),
        gradingPolicy: z.string().optional(),
      })
      .optional(),
    branding: z
      .object({
        logoUrl: z.string().optional(),
        bannerUrl: z.string().optional(),
        primaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        favicon: z.string().optional(),
      })
      .optional(),
    onboarding: z
      .object({
        completed: z.boolean().optional(),
        completedSteps: z.array(z.string()).optional(),
      })
      .optional(),
    geminiApiKey: z.string().optional(),
  }),
});

export const DeactivateTenantRequestSchema = z.object({
  tenantId: firestoreId,
  reason: z.string().max(MAX_MEDIUM_TEXT).optional(),
});

export const ReactivateTenantRequestSchema = z.object({
  tenantId: firestoreId,
});

export const ExportTenantDataRequestSchema = z.object({
  tenantId: firestoreId,
  format: z.enum(["json", "csv"]),
  collections: z.array(z.enum(["students", "teachers", "classes", "exams", "submissions"])),
});

export const SaveStaffRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    uid: z.string().optional(),
    department: z.string().optional(),
    staffPermissions: z
      .object({
        canManageUsers: z.boolean().optional(),
        canManageClasses: z.boolean().optional(),
        canManageBilling: z.boolean().optional(),
        canViewAnalytics: z.boolean().optional(),
        canManageSettings: z.boolean().optional(),
        canExportData: z.boolean().optional(),
      })
      .optional(),
    status: z.enum(["active", "archived"]).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().optional(),
  }),
});

export const SaveClassRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    name: z.string().max(MAX_SHORT_TEXT).optional(),
    grade: z.string().max(20).optional(),
    section: z.string().max(20).optional(),
    academicSessionId: firestoreId.optional(),
    teacherIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    status: z.enum(["active", "archived", "deleted"]).optional(),
  }),
});

export const SaveStudentRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    uid: z.string().optional(),
    rollNumber: z.string().max(50).optional(),
    section: z.string().max(20).optional(),
    classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    parentIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    grade: z.string().max(20).optional(),
    admissionNumber: z.string().max(50).optional(),
    dateOfBirth: z.string().max(20).optional(),
    status: z.enum(["active", "archived"]).optional(),
    firstName: z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: z.string().max(MAX_SHORT_TEXT).optional(),
    email: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: z.string().max(20).optional(),
    password: z.string().min(6).max(128).optional(),
  }),
});

export const SaveTeacherRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    uid: z.string().optional(),
    subjects: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    designation: z.string().max(MAX_SHORT_TEXT).optional(),
    classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    permissions: z
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
      .optional(),
    status: z.enum(["active", "archived"]).optional(),
    firstName: z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: z.string().max(MAX_SHORT_TEXT).optional(),
    email: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: z.string().max(20).optional(),
    password: z.string().min(6).max(128).optional(),
  }),
});

export const SaveParentRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    uid: z.string().optional(),
    childStudentIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    status: z.enum(["active", "archived"]).optional(),
    firstName: z.string().max(MAX_SHORT_TEXT).optional(),
    lastName: z.string().max(MAX_SHORT_TEXT).optional(),
    email: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
    phone: z.string().max(20).optional(),
    password: z.string().min(6).max(128).optional(),
  }),
});

export const SaveAcademicSessionRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    name: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isCurrent: z.boolean().optional(),
    status: z.enum(["active", "archived"]).optional(),
  }),
});

export const ManageNotificationsRequestSchema = z.object({
  tenantId: firestoreId,
  action: z.enum(["list", "markRead"]),
  limit: z.number().optional(),
  cursor: z.string().optional(),
  notificationId: z.string().optional(),
  markAllRead: z.boolean().optional(),
});

export const BulkImportStudentsRequestSchema = z.object({
  tenantId: firestoreId,
  students: z
    .array(
      z.object({
        firstName: z.string().min(1).max(MAX_SHORT_TEXT),
        lastName: z.string().min(1).max(MAX_SHORT_TEXT),
        rollNumber: z.string().min(1).max(50),
        email: z.string().email().max(MAX_SHORT_TEXT).optional(),
        phone: z.string().max(20).optional(),
        classId: firestoreId.optional(),
        className: z.string().max(MAX_SHORT_TEXT).optional(),
        section: z.string().max(20).optional(),
        parentFirstName: z.string().max(MAX_SHORT_TEXT).optional(),
        parentLastName: z.string().max(MAX_SHORT_TEXT).optional(),
        parentEmail: z.string().email().max(MAX_SHORT_TEXT).optional(),
        parentPhone: z.string().max(20).optional(),
      })
    )
    .max(MAX_BULK_ITEMS, "Maximum 500 students per import"),
  dryRun: z.boolean(),
});

export const CreateOrgUserRequestSchema = z.object({
  tenantId: firestoreId,
  role: z.enum(["teacher", "student", "parent", "scanner", "staff"]),
  email: z.string().email("Invalid email format").max(MAX_SHORT_TEXT).optional(),
  rollNumber: z.string().max(50).optional(),
  firstName: z.string().min(1, "First name is required").max(MAX_SHORT_TEXT),
  lastName: z.string().min(1, "Last name is required").max(MAX_SHORT_TEXT),
  password: z.string().min(6, "Password must be at least 6 characters").max(128).optional(),
  phone: z.string().max(20).optional(),
  classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
  subjects: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  linkedStudentIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
});

export const SwitchActiveTenantRequestSchema = z.object({
  tenantId: firestoreId,
});

export const JoinTenantRequestSchema = z.object({
  tenantCode: z.string().min(1, "Tenant code is required").max(50),
});

export const SaveGlobalPresetRequestSchema = z.object({
  id: z.string().optional(),
  data: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      isDefault: z.boolean().optional(),
      isPublic: z.boolean().optional(),
      enabledDimensions: z.array(EvaluationDimensionSchema).optional(),
      displaySettings: z
        .object({
          showStrengths: z.boolean(),
          showKeyTakeaway: z.boolean(),
          prioritizeByImportance: z.boolean(),
        })
        .optional(),
    })
    .optional(),
  delete: z.boolean().optional(),
});

// ── LevelUp module ─────────────────────────────────────────────────────────

export const SaveSpaceRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    description: z.string().max(MAX_MEDIUM_TEXT).optional(),
    thumbnailUrl: z.string().optional(),
    slug: z.string().optional(),
    type: z.enum(["learning", "practice", "assessment", "resource", "hybrid"]).optional(),
    subject: z.string().optional(),
    labels: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    sectionIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    teacherIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    accessType: z.enum(["class_assigned", "tenant_wide", "public_store"]).optional(),
    academicSessionId: z.string().optional(),
    defaultEvaluatorAgentId: z.string().optional(),
    defaultTutorAgentId: z.string().optional(),
    defaultTimeLimitMinutes: z.number().optional(),
    allowRetakes: z.boolean().optional(),
    maxRetakes: z.number().optional(),
    showCorrectAnswers: z.boolean().optional(),
    defaultRubric: UnifiedRubricSchema.optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    publishedToStore: z.boolean().optional(),
    storeDescription: z.string().max(MAX_MEDIUM_TEXT).optional(),
    storeThumbnailUrl: z.string().optional(),
  }),
});

export const SaveStoryPointRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  spaceId: firestoreId,
  data: z.object({
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    description: z.string().max(MAX_MEDIUM_TEXT).optional(),
    orderIndex: z.number().optional(),
    type: z.enum(["standard", "timed_test", "quiz", "practice", "test"]).optional(),
    sections: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          orderIndex: z.number(),
          description: z.string().optional(),
        })
      )
      .optional(),
    assessmentConfig: z
      .object({
        durationMinutes: z.number().optional(),
        instructions: z.string().optional(),
        maxAttempts: z.number().optional(),
        shuffleQuestions: z.boolean().optional(),
        shuffleOptions: z.boolean().optional(),
        showResultsImmediately: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    defaultRubric: UnifiedRubricSchema.optional(),
    difficulty: z.enum(["easy", "medium", "hard", "expert"]).optional(),
    estimatedTimeMinutes: z.number().optional(),
    deleted: z.boolean().optional(),
  }),
});

export const SaveItemRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
  data: z.object({
    sectionId: firestoreId.optional(),
    type: z
      .enum([
        "question",
        "material",
        "interactive",
        "assessment",
        "discussion",
        "project",
        "checkpoint",
      ])
      .optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    content: z.string().max(MAX_LONG_TEXT).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    topics: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    labels: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    orderIndex: z.number().optional(),
    meta: ItemMetadataSchema.optional(),
    analytics: z.record(z.string(), z.number()).optional(),
    rubric: UnifiedRubricSchema.optional(),
    linkedQuestionId: z.string().optional(),
    attachments: z
      .array(
        z.object({
          id: z.string(),
          fileName: z.string().max(MAX_SHORT_TEXT),
          url: z.string(),
          type: z.enum(["image", "pdf", "audio"]),
          size: z.number(),
          mimeType: z.string(),
        })
      )
      .max(20)
      .optional(),
    deleted: z.boolean().optional(),
  }),
});

export const StartTestSessionRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
});

export const SubmitTestSessionRequestSchema = z.object({
  tenantId: firestoreId,
  sessionId: firestoreId,
  autoSubmitted: z.boolean().optional(),
});

export const EvaluateAnswerRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId.optional(),
  itemId: firestoreId,
  answer: z.unknown(),
  mediaUrls: z.array(z.string().url()).max(20).optional(),
});

export const SendChatMessageRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
  itemId: firestoreId,
  sessionId: firestoreId.optional(),
  message: z.string().min(1, "Message cannot be empty").max(MAX_LONG_TEXT),
  language: z.string().max(10).optional(),
  agentId: firestoreId.optional(),
});

/** Compact evaluation data sent alongside a recorded attempt for persistence.
 *  Uses .nullish() because Firebase callable SDK encodes undefined → null. */
const StoredEvaluationSchema = z
  .object({
    score: z.number(),
    maxScore: z.number(),
    correctness: z.number(),
    percentage: z.number(),
    strengths: z.array(z.string()).max(20),
    weaknesses: z.array(z.string()).max(20),
    missingConcepts: z.array(z.string()).max(20),
    summary: z
      .object({
        keyTakeaway: z.string().max(MAX_MEDIUM_TEXT),
        overallComment: z.string().max(MAX_MEDIUM_TEXT),
      })
      .nullish(),
    mistakeClassification: z.enum(["Conceptual", "Silly Error", "Knowledge Gap", "None"]).nullish(),
  })
  .nullish();

export const RecordItemAttemptRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
  itemId: firestoreId,
  itemType: z.string(),
  score: z.number(),
  maxScore: z.number(),
  correct: z.boolean(),
  timeSpent: z.number().nullish(),
  feedback: z.string().max(MAX_MEDIUM_TEXT).nullish(),
  /** Student's answer for persistence (displayed on revisit). */
  answer: z.unknown().nullish(),
  /** Compact evaluation result for persistence (displayed on revisit). */
  evaluationData: StoredEvaluationSchema,
});

export const ListStoreSpacesRequestSchema = z.object({
  subject: z.string().max(MAX_SHORT_TEXT).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  startAfter: firestoreId.optional(),
  search: z.string().max(MAX_SHORT_TEXT).optional(),
});

export const PurchaseSpaceRequestSchema = z.object({
  spaceId: firestoreId,
  paymentToken: z.string().max(MAX_SHORT_TEXT).optional(),
});

// ── AutoGrade module ───────────────────────────────────────────────────────

export const SaveExamRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    subject: z.string().max(MAX_SHORT_TEXT).optional(),
    topics: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    classIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    sectionIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
    examDate: z.string().optional(),
    duration: z.number().optional(),
    academicSessionId: z.string().optional(),
    totalMarks: z.number().optional(),
    passingMarks: z.number().optional(),
    gradingConfig: z
      .object({
        autoGrade: z.boolean().optional(),
        allowRubricEdit: z.boolean().optional(),
        evaluationSettingsId: z.string().optional(),
        allowManualOverride: z.boolean().optional(),
        requireOverrideReason: z.boolean().optional(),
        releaseResultsAutomatically: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    linkedSpaceId: z.string().nullish(),
    linkedSpaceTitle: z.string().nullish(),
    linkedStoryPointId: z.string().nullish(),
    status: z
      .enum([
        "draft",
        "question_paper_uploaded",
        "question_paper_extracted",
        "published",
        "grading",
        "completed",
        "results_released",
        "archived",
      ])
      .optional(),
    evaluationSettingsId: z.string().optional(),
    // Storage paths under tenants/{tenantId}/... — read server-side via
    // bucket.file(path), not HTTPS URLs. Historical name kept.
    questionPaperImages: z.array(z.string().min(1).max(500)).max(50).nullish(),
  }),
});

export const GradeQuestionRequestSchema = z.object({
  tenantId: firestoreId,
  mode: z.enum(["manual", "retry", "ai"]),
  submissionId: firestoreId.optional(),
  questionId: firestoreId.optional(),
  score: z.number().optional(),
  maxScore: z.number().optional(),
  feedback: z.string().max(MAX_MEDIUM_TEXT).optional(),
  examId: firestoreId.optional(),
  questionIds: z.array(firestoreId).max(MAX_ARRAY_ITEMS).optional(),
});

export const ExtractQuestionsRequestSchema = z.object({
  tenantId: firestoreId,
  examId: firestoreId,
  /** Set to 'single' to re-extract a single question */
  mode: z.enum(["full", "single"]).optional(),
  /** Required when mode='single' — the question number to re-extract */
  questionNumber: z.string().max(20).optional(),
});

export const UploadAnswerSheetsRequestSchema = z.object({
  tenantId: firestoreId,
  examId: firestoreId,
  studentId: firestoreId,
  classId: firestoreId,
  // Storage paths under tenants/{tenantId}/... — the backend reads them via
  // bucket.file(path), not as HTTPS URLs. The "Urls" name is historical.
  imageUrls: z.array(z.string().min(1).max(500)).min(1, "At least one image is required").max(50),
});

// ── Question Bank ─────────────────────────────────────────────────────────

export const SaveQuestionBankItemRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    questionType: z.string().max(50).optional(),
    title: z.string().max(MAX_SHORT_TEXT).optional(),
    content: z.string().max(MAX_LONG_TEXT).optional(),
    explanation: z.string().max(MAX_MEDIUM_TEXT).optional(),
    basePoints: z.number().optional(),
    questionData: z.record(z.string(), z.unknown()).optional(),
    subject: z.string().max(MAX_SHORT_TEXT).optional(),
    topics: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    bloomsLevel: z
      .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
      .optional(),
    tags: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
    deleted: z.boolean().optional(),
  }),
});

export const ListQuestionBankRequestSchema = z.object({
  tenantId: firestoreId,
  subject: z.string().max(MAX_SHORT_TEXT).optional(),
  topics: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  bloomsLevel: z
    .enum(["remember", "understand", "apply", "analyze", "evaluate", "create"])
    .optional(),
  questionType: z.string().max(50).optional(),
  tags: z.array(z.string().max(MAX_SHORT_TEXT)).max(MAX_ARRAY_ITEMS).optional(),
  search: z.string().max(MAX_SHORT_TEXT).optional(),
  sortBy: z.enum(["usageCount", "averageScore", "createdAt"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  limit: z.number().optional(),
  startAfter: z.string().optional(),
});

export const ImportFromBankRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  storyPointId: firestoreId,
  sectionId: firestoreId.optional(),
  questionBankItemIds: z.array(firestoreId).min(1, "Select at least one item").max(MAX_ARRAY_ITEMS),
});

// ── Reviews ───────────────────────────────────────────────────────────────

export const SaveSpaceReviewRequestSchema = z.object({
  tenantId: firestoreId,
  spaceId: firestoreId,
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  comment: z.string().max(MAX_MEDIUM_TEXT).optional(),
});

// ── Rubric Presets ────────────────────────────────────────────────────────

export const SaveRubricPresetRequestSchema = z.object({
  id: firestoreId.optional(),
  tenantId: firestoreId,
  data: z.object({
    name: z.string().max(MAX_SHORT_TEXT).optional(),
    description: z.string().max(MAX_MEDIUM_TEXT).optional(),
    rubric: UnifiedRubricSchema.optional(),
    category: z
      .enum(["general", "math", "science", "language", "coding", "essay", "custom"])
      .optional(),
    questionTypes: z.array(z.string().max(50)).max(MAX_ARRAY_ITEMS).optional(),
    deleted: z.boolean().optional(),
  }),
});

// ── Analytics module ───────────────────────────────────────────────────────

export const GetSummaryRequestSchema = z.object({
  tenantId: firestoreId.optional(),
  scope: z.enum(["student", "class", "platform", "health"]),
  studentId: firestoreId.optional(),
  classId: firestoreId.optional(),
});

export const GenerateReportRequestSchema = z.object({
  tenantId: firestoreId,
  type: z.enum(["exam-result", "progress", "class"]),
  examId: firestoreId.optional(),
  studentId: firestoreId.optional(),
  classId: firestoreId.optional(),
  academicSessionId: firestoreId.optional(),
});
