/**
 * Callable request/response types for the consolidated API.
 *
 * Pattern: Each entity gets a single `save*` endpoint using upsert semantics.
 * - No `id` in request → create new entity
 * - `id` present → update existing entity (including status transitions)
 *
 * @module callable-types
 */

import type { SpaceType, SpaceStatus, SpaceAccessType } from "./levelup/space";
import type { StoryPointType, AssessmentConfig, StoryPointSection } from "./levelup/story-point";
import type { ItemType, ItemPayload } from "./content/item";
import type { ItemMetadata, ItemAnalytics } from "./content/item-metadata";
import type { UnifiedRubric } from "./content/rubric";
import type { ExamStatus } from "./constants/grades";
import type { ExamGradingConfig } from "./autograde/exam";
import type { TenantRole, TeacherPermissions } from "./identity/membership";
import type {
  TenantSubscription,
  TenantFeatures,
  TenantSettings,
  TenantAddress,
  TenantBranding,
  TenantStatus,
} from "./identity/tenant";
import type { StaffPermissions } from "./identity/membership";
import type { StudentProgressSummary, ClassProgressSummary } from "./progress/summary";
import type { FirestoreTimestamp } from "./identity/user";

// ─────────────────────────────────────────────────────
// Generic save pattern
// ─────────────────────────────────────────────────────

export interface SaveResponse {
  id: string;
  created: boolean;
}

// ─────────────────────────────────────────────────────
// Identity module
// ─────────────────────────────────────────────────────

/** saveTenant — replaces: createTenant, setTenantApiKey */
export interface SaveTenantRequest {
  id?: string;
  data: {
    name?: string;
    shortName?: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactPerson?: string;
    logoUrl?: string;
    bannerUrl?: string;
    website?: string;
    address?: TenantAddress;
    status?: TenantStatus;
    subscription?: Partial<TenantSubscription>;
    features?: Partial<TenantFeatures>;
    settings?: Partial<TenantSettings>;
    branding?: Partial<TenantBranding>;
    onboarding?: { completed?: boolean; completedSteps?: string[] };
    /** Set the tenant Gemini API key (replaces setTenantApiKey) */
    geminiApiKey?: string;
  };
}

/** saveClass — replaces: createClass, updateClass, deleteClass */
export interface SaveClassRequest {
  id?: string;
  tenantId: string;
  data: {
    name?: string;
    grade?: string;
    section?: string;
    academicSessionId?: string;
    teacherIds?: string[];
    status?: "active" | "archived" | "deleted";
  };
}

/** saveStudent — replaces: createStudent, updateStudent, deleteStudent, assignStudentToClass */
export interface SaveStudentRequest {
  id?: string;
  tenantId: string;
  data: {
    uid?: string;
    rollNumber?: string;
    section?: string;
    /** Assign/reassign to classes (replaces assignStudentToClass) */
    classIds?: string[];
    parentIds?: string[];
    grade?: string;
    admissionNumber?: string;
    dateOfBirth?: string;
    status?: "active" | "archived";
    /** Fields for creating via createOrgUser flow */
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
}

/** saveTeacher — replaces: createTeacher, updateTeacher, assignTeacherToClass, updateTeacherPermissions */
export interface SaveTeacherRequest {
  id?: string;
  tenantId: string;
  data: {
    uid?: string;
    subjects?: string[];
    designation?: string;
    /** Assign/reassign to classes (replaces assignTeacherToClass) */
    classIds?: string[];
    /** Update permissions (replaces updateTeacherPermissions) */
    permissions?: TeacherPermissions;
    status?: "active" | "archived";
    /** Fields for creating via createOrgUser flow */
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
}

/** saveParent — replaces: createParent, linkParentToStudent */
export interface SaveParentRequest {
  id?: string;
  tenantId: string;
  data: {
    uid?: string;
    /** Link/unlink students (replaces linkParentToStudent) */
    childStudentIds?: string[];
    status?: "active" | "archived";
    /** Fields for creating via createOrgUser flow */
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
}

/** saveAcademicSession — replaces: createAcademicSession, updateAcademicSession */
export interface SaveAcademicSessionRequest {
  id?: string;
  tenantId: string;
  data: {
    name?: string;
    startDate?: string;
    endDate?: string;
    isCurrent?: boolean;
    status?: "active" | "archived";
  };
}

/** manageNotifications — replaces: getNotifications, markNotificationRead */
export interface ManageNotificationsRequest {
  tenantId: string;
  action: "list" | "markRead";
  /** Required for 'list' */
  limit?: number;
  cursor?: string;
  /** Required for 'markRead' */
  notificationId?: string;
  /** Mark all as read */
  markAllRead?: boolean;
}

export interface ManageNotificationsResponse {
  /** Returned for action: 'list' */
  notifications?: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: FirestoreTimestamp;
    entityType?: string;
    entityId?: string;
    actionUrl?: string;
  }>;
  nextCursor?: string;
  /** Returned for action: 'markRead' */
  success?: boolean;
}

/** saveStaff — create/update non-teaching staff members */
export interface SaveStaffRequest {
  id?: string;
  tenantId: string;
  data: {
    uid?: string;
    department?: string;
    staffPermissions?: StaffPermissions;
    status?: "active" | "archived";
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
  };
}

/** deactivateTenant — SuperAdmin deactivates a tenant */
export interface DeactivateTenantRequest {
  tenantId: string;
  reason?: string;
}

/** reactivateTenant — SuperAdmin reactivates a deactivated tenant */
export interface ReactivateTenantRequest {
  tenantId: string;
}

/** exportTenantData — bulk data export for a tenant */
export interface ExportTenantDataRequest {
  tenantId: string;
  format: "json" | "csv";
  collections: ("students" | "teachers" | "classes" | "exams" | "submissions")[];
}

export interface ExportTenantDataResponse {
  downloadUrl: string;
  expiresAt: string;
  recordCount: number;
}

export interface TeacherImportRow {
  firstName: string;
  lastName: string;
  email: string;
  subjects?: string;
  designation?: string;
}

export interface BulkImportTeachersRequest {
  tenantId: string;
  teachers: TeacherImportRow[];
  dryRun: boolean;
}

export interface BulkImportTeachersResponse {
  totalRows: number;
  created: number;
  skipped: number;
  errors: { rowIndex: number; email: string; error: string }[];
  credentialsUrl?: string;
  credentialsExpiresAt?: string;
}

export interface BulkUpdateStatusRequest {
  tenantId: string;
  entityType: "student" | "teacher" | "class";
  entityIds: string[];
  newStatus: "active" | "archived";
}

export interface BulkUpdateStatusResponse {
  success: boolean;
  updated: number;
}

export interface RolloverSessionRequest {
  tenantId: string;
  sourceSessionId: string;
  newSession: {
    name: string;
    startDate: string;
    endDate: string;
  };
  copyClasses: boolean;
  copyTeacherAssignments: boolean;
  promoteStudents: boolean;
}

export interface RolloverSessionResponse {
  newSessionId: string;
  classesCreated: number;
  teacherAssignments: number;
  studentsPromoted: number;
  studentsUnassigned: number;
}

// ─────────────────────────────────────────────────────
// LevelUp module
// ─────────────────────────────────────────────────────

/**
 * saveSpace — replaces: createSpace, updateSpace, publishSpace, archiveSpace, publishToStore
 *
 * Status transitions validated server-side:
 *   draft → published → archived
 *
 * Store listing is a field update (publishedToStore) — requires status = 'published'.
 */
export interface SaveSpaceRequest {
  id?: string;
  tenantId: string;
  data: {
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    slug?: string;
    type?: SpaceType;
    subject?: string;
    labels?: string[];
    classIds?: string[];
    sectionIds?: string[];
    teacherIds?: string[];
    accessType?: SpaceAccessType;
    academicSessionId?: string;
    defaultEvaluatorAgentId?: string;
    defaultTutorAgentId?: string;
    defaultTimeLimitMinutes?: number;
    allowRetakes?: boolean;
    maxRetakes?: number;
    showCorrectAnswers?: boolean;
    defaultRubric?: UnifiedRubric;
    /** Status transition (validated server-side) */
    status?: SpaceStatus;
    /** Store fields (require status = 'published') */
    price?: number;
    currency?: string;
    publishedToStore?: boolean;
    storeDescription?: string;
    storeThumbnailUrl?: string;
  };
}

/** saveStoryPoint — replaces: createStoryPoint, updateStoryPoint */
export interface SaveStoryPointRequest {
  id?: string;
  tenantId: string;
  spaceId: string;
  data: {
    title?: string;
    description?: string;
    orderIndex?: number;
    type?: StoryPointType;
    sections?: StoryPointSection[];
    assessmentConfig?: AssessmentConfig;
    defaultRubric?: UnifiedRubric;
    difficulty?: "easy" | "medium" | "hard" | "expert";
    estimatedTimeMinutes?: number;
    /** Soft-delete */
    deleted?: boolean;
  };
}

/** saveItem — replaces: createItem, updateItem, deleteItem */
export interface SaveItemRequest {
  id?: string;
  tenantId: string;
  spaceId: string;
  storyPointId: string;
  data: {
    sectionId?: string;
    type?: ItemType;
    payload?: ItemPayload;
    title?: string;
    content?: string;
    difficulty?: "easy" | "medium" | "hard";
    topics?: string[];
    labels?: string[];
    orderIndex?: number;
    meta?: ItemMetadata;
    analytics?: ItemAnalytics;
    rubric?: UnifiedRubric;
    linkedQuestionId?: string;
    /** Media attachments */
    attachments?: Array<{
      id: string;
      fileName: string;
      url: string;
      type: "image" | "pdf" | "audio";
      size: number;
      mimeType: string;
    }>;
    /** Soft-delete */
    deleted?: boolean;
  };
}

// ─────────────────────────────────────────────────────
// AutoGrade module
// ─────────────────────────────────────────────────────

/**
 * saveExam — replaces: createExam, updateExam, publishExam, releaseExamResults, linkExamToSpace
 *
 * Status transitions validated server-side:
 *   draft → question_paper_uploaded → question_paper_extracted → published → grading → completed → results_released → archived
 *
 * spaceId linking is just a field update.
 */
export interface SaveExamRequest {
  id?: string;
  tenantId: string;
  data: {
    title?: string;
    subject?: string;
    topics?: string[];
    classIds?: string[];
    sectionIds?: string[];
    examDate?: string;
    duration?: number;
    academicSessionId?: string;
    totalMarks?: number;
    passingMarks?: number;
    gradingConfig?: Partial<ExamGradingConfig>;
    /** Link to LevelUp space (replaces linkExamToSpace) */
    linkedSpaceId?: string;
    linkedSpaceTitle?: string;
    linkedStoryPointId?: string;
    /** Status transition (validated server-side) */
    status?: ExamStatus;
    evaluationSettingsId?: string;
    /** Storage paths for uploaded question paper images */
    questionPaperImages?: string[];
  };
}

/**
 * gradeQuestion — replaces: manualGradeQuestion, retryFailedQuestions
 *
 * mode: 'manual' → grade a single question with manual override
 * mode: 'retry'  → retry all failed AI gradings on a partial submission
 * mode: 'ai'     → run AI grading synchronously on a single question
 */
export interface GradeQuestionRequest {
  tenantId: string;
  mode: "manual" | "retry" | "ai";
  /** Required for mode: 'manual' and 'ai' */
  submissionId?: string;
  questionId?: string;
  score?: number;
  maxScore?: number;
  feedback?: string;
  /** Required for mode: 'retry' */
  examId?: string;
  /** Optional for retry — if omitted, retries all failed questions */
  questionIds?: string[];
}

export interface GradeQuestionResponse {
  success: boolean;
  /** For mode: 'manual' and 'ai' */
  updatedScore?: number;
  /** For mode: 'ai' — final per-question grading status */
  gradingStatus?: string;
  /** For mode: 'retry' */
  retriedCount?: number;
  failedCount?: number;
}

// ─────────────────────────────────────────────────────
// Analytics module
// ─────────────────────────────────────────────────────

export interface PlatformSummaryResponse {
  newTenantsThisMonth: number;
  newTenantsLastMonth: number;
  newUsersThisWeek: number;
  newUsersLastWeek: number;
  activeUsersLast7d: number;
  recentActivity: Array<{
    id: string;
    action: string;
    actorEmail: string;
    tenantId?: string;
    metadata: Record<string, unknown>;
    createdAt: unknown;
  }>;
}

export interface HealthSummaryResponse {
  snapshots: Array<{
    date: string;
    status: string;
  }>;
  errorCount24h: number;
}

/**
 * getSummary — replaces: getStudentSummary, getClassSummary
 * Extended with platform & health scopes for super-admin.
 */
export interface GetSummaryRequest {
  tenantId?: string;
  scope: "student" | "class" | "platform" | "health";
  /** Required when scope = 'student' */
  studentId?: string;
  /** Required when scope = 'class' */
  classId?: string;
}

export interface GetSummaryResponse {
  scope: "student" | "class" | "platform" | "health";
  studentSummary?: StudentProgressSummary;
  classSummary?: ClassProgressSummary;
  platformSummary?: PlatformSummaryResponse;
  healthSummary?: HealthSummaryResponse;
}

/**
 * generateReport — replaces: generateExamResultPdf, generateProgressReportPdf, generateClassReportPdf
 */
export interface GenerateReportRequest {
  tenantId: string;
  type: "exam-result" | "progress" | "class";
  /** Required for type: 'exam-result' */
  examId?: string;
  /** Required for type: 'exam-result' and 'progress' */
  studentId?: string;
  /** Required for type: 'class' */
  classId?: string;
  /** Optional filters */
  academicSessionId?: string;
}

export interface GenerateReportResponse {
  pdfUrl: string;
}

// ─────────────────────────────────────────────────────
// Announcements
// ─────────────────────────────────────────────────────

export interface SaveAnnouncementRequest {
  id?: string;
  tenantId?: string;
  data: {
    title?: string;
    body?: string;
    scope?: "platform" | "tenant";
    targetRoles?: string[];
    targetClassIds?: string[];
    status?: "draft" | "published" | "archived";
    expiresAt?: string;
  };
  delete?: boolean;
}

export interface SaveAnnouncementResponse {
  id: string;
  created?: boolean;
  deleted?: boolean;
}

export interface ListAnnouncementsRequest {
  tenantId?: string;
  scope?: "platform" | "tenant";
  status?: "draft" | "published" | "archived";
  limit?: number;
  cursor?: string;
}

export interface ListAnnouncementsResponse {
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    authorName: string;
    scope: "platform" | "tenant";
    status: "draft" | "published" | "archived";
    targetRoles?: string[];
    targetClassIds?: string[];
    publishedAt?: unknown;
    archivedAt?: unknown;
    expiresAt?: unknown;
    createdAt: unknown;
    updatedAt: unknown;
  }>;
  nextCursor?: string;
}

// ─────────────────────────────────────────────────────
// Tenant Asset Upload
// ─────────────────────────────────────────────────────

/** uploadTenantAsset — generates a signed upload URL for tenant branding assets */
export interface UploadTenantAssetRequest {
  tenantId: string;
  assetType: "logo" | "banner" | "favicon";
  contentType: string;
}

export interface UploadTenantAssetResponse {
  uploadUrl: string;
  publicUrl: string;
}

// ─────────────────────────────────────────────────────
// Global User Search
// ─────────────────────────────────────────────────────

export interface SearchUsersRequest {
  query: string;
  limit?: number;
}

export interface SearchUsersResponse {
  users: Array<{
    uid: string;
    email: string | null;
    displayName: string | null;
    isSuperAdmin: boolean;
    activeTenantId: string | null;
    lastLoginAt: unknown;
    createdAt: unknown;
    memberships: Array<{
      tenantId: string;
      tenantCode: string;
      role: string;
    }>;
  }>;
}
