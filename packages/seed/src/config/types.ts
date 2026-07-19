/**
 * SeedConfig — the full, typed, config-driven seed model.
 *
 * This is the authoring surface: a SeedConfig is plain data (no admin handles, no ids). The
 * engine resolves stable branded ids from the `key` fields via `seedId(kind, key)`, so the
 * config never spells out Firestore ids — it spells out logical keys, and the engine makes them
 * deterministic. Every collection is keyed by a human `key` that the engine slugs+hashes.
 *
 * Shapes mirror the @levelup/domain Zod-first entities (SDK-LAYERS-PLAN §2 + §8 drift):
 *   ISO-8601 timestamps (engine-stamped), authUid (not uid), parentLinkedStudentIds,
 *   effectiveRubric snapshot + rubricId, discriminated item payload union, subcollections
 *   (not record-maps), branded ids. The seed writes through the engine (admin path).
 *
 * Cross-references between entities use the LOGICAL KEY of the target (e.g. a class lists
 * `studentKeys`, a space lists `classKeys`), and the engine resolves keys → ids in dependency
 * order. This keeps configs readable and refactor-safe.
 */

import type { Clock } from "../engine/clock.js";
import type { StaffPermissionKey, TeacherPermissionKey, TenantRole } from "../engine/claims.js";

// ─────────────────────────────────────────────────────────────────────────────
// Top-level config
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedConfig {
  /** Optional schema/version tag for migration-aware seeds. */
  version?: string;
  /** Platform-root super-admin users (no tenant). */
  superAdmins?: SuperAdminConfig[];
  /** Tenant subtrees — the bulk of the model. */
  tenants: TenantConfig[];
  /** Optional platform-wide global evaluation presets (super-admin owned). */
  globalEvaluationPresets?: GlobalPresetConfig[];
}

export interface SuperAdminConfig {
  key: string;
  email: string;
  password: string;
  displayName: string;
  photoURL?: string;
}

export interface GlobalPresetConfig {
  key: string;
  name: string;
  description?: string;
  rubric?: UnifiedRubricInput;
  status?: "active" | "archived";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant
// ─────────────────────────────────────────────────────────────────────────────

export type TenantStatus = "active" | "trial" | "suspended" | "deactivated" | "pending";

export interface TenantConfig {
  key: string;
  name: string;
  /** Public join code; the engine writes the `/tenantCodes/{code}` index doc. */
  code: string;
  slug?: string;
  status?: TenantStatus;
  plan?: "free" | "starter" | "premium" | "enterprise";
  contact?: { email: string; phone?: string };
  settings?: {
    defaultLanguage?: string;
    timezone?: string;
    [k: string]: unknown;
  };
  features?: Record<string, boolean>;
  branding?: { logoUrl?: string; primaryColor?: string };
  /** Reference to the AI key (never the key itself — SEC-09). */
  geminiKeyRef?: string;

  academicSessions?: AcademicSessionConfig[];
  classes?: ClassConfig[];
  teachers?: TeacherConfig[];
  students?: StudentConfig[];
  parents?: ParentConfig[];
  staff?: StaffConfig[];
  scanners?: ScannerConfig[];
  admins?: TenantAdminConfig[];

  agents?: AgentConfig[];
  rubricPresets?: RubricPresetConfig[];
  questionBank?: QuestionBankItemConfig[];
  spaces?: SpaceConfig[];
  /** B2C learner reviews on (usually store) spaces → `spaces/{s}/reviews/{uid}`. */
  spaceReviews?: SpaceReviewConfig[];
  /** AI-tutor chat sessions (messages always a subcollection — D6). */
  chatSessions?: ChatSessionConfig[];
  exams?: ExamConfig[];
  evaluationSettings?: EvaluationSettingsConfig[];
  /** Autograde grading dead-letter queue entries (terminal pipeline failures). */
  gradingDeadLetter?: GradingDeadLetterConfig[];

  /** Student activity: test sessions, submissions, progress, gamification. */
  testSessions?: TestSessionConfig[];
  submissions?: SubmissionConfig[];
  progress?: SpaceProgressConfig[];
  achievements?: AchievementConfig[];
  studentGamification?: StudentGamificationConfig[];

  announcements?: AnnouncementConfig[];
  notifications?: NotificationConfig[];
  insights?: InsightConfig[];
  costSummaries?: CostSummaryConfig[];
}

export interface AcademicSessionConfig {
  key: string;
  name: string;
  startDate: string; // ISO date
  endDate: string;
  isCurrent?: boolean;
  status?: "active" | "upcoming" | "completed" | "archived";
}

// ─────────────────────────────────────────────────────────────────────────────
// People (every tenant entity carries authUid, NOT uid — D3)
// ─────────────────────────────────────────────────────────────────────────────

/** Shared login surface for a person who needs an Auth account. */
export interface AccountFields {
  email: string;
  password: string;
  displayName?: string;
  photoURL?: string;
  phone?: string;
}

export interface TenantAdminConfig extends AccountFields {
  key: string;
  firstName: string;
  lastName: string;
  staffPermissions?: Partial<Record<StaffPermissionKey, boolean>>;
}

export interface TeacherConfig extends AccountFields {
  key: string;
  firstName: string;
  lastName: string;
  subjects?: string[];
  department?: string;
  designation?: string;
  /** Logical keys of classes this teacher teaches. */
  classKeys?: string[];
  permissions?: Partial<Record<TeacherPermissionKey, boolean>>;
  status?: "active" | "invited" | "suspended" | "archived";
}

export interface StudentConfig extends AccountFields {
  key: string;
  firstName: string;
  lastName: string;
  rollNumber?: string;
  grade?: string;
  /** Logical keys of classes this student is enrolled in. */
  classKeys?: string[];
  status?: "active" | "invited" | "suspended" | "archived";
  /** Skip Auth-account creation (e.g. a roster-only student). */
  noAccount?: boolean;
}

export interface ParentConfig extends AccountFields {
  key: string;
  firstName: string;
  lastName: string;
  /** Canonical parent→child link by student logical key (D10 parentLinkedStudentIds). */
  studentKeys: string[];
  status?: "active" | "invited" | "suspended" | "archived";
}

export interface StaffConfig extends AccountFields {
  key: string;
  firstName: string;
  lastName: string;
  department?: string;
  staffPermissions?: Partial<Record<StaffPermissionKey, boolean>>;
  status?: "active" | "invited" | "suspended" | "archived";
}

export interface ScannerConfig extends AccountFields {
  key: string;
  label: string;
  status?: "active" | "suspended" | "archived";
}

export interface ClassConfig {
  key: string;
  name: string;
  grade: string;
  section?: string;
  academicSessionKey?: string;
  /** Teacher logical keys (denorm projection — engine resolves to TeacherId[]). */
  teacherKeys?: string[];
  /** Student logical keys (denorm projection — engine resolves to StudentId[] + studentCount). */
  studentKeys?: string[];
  schedule?: {
    days: string[];
    startTime: string;
    endTime: string;
    room?: string;
  };
  status?: "active" | "archived";
}

// ─────────────────────────────────────────────────────────────────────────────
// Content: Space → StoryPoint → Item (+ server-only AnswerKey), Agents, Rubrics, Bank
// ─────────────────────────────────────────────────────────────────────────────

export type SpaceType = "course" | "subject" | "practice" | "store";
export type SpaceStatus = "draft" | "published" | "archived";
export type StoryPointType = "timed_test" | "quiz" | "practice" | "standard";

export interface SpaceConfig {
  key: string;
  title: string;
  description?: string;
  type?: SpaceType;
  status?: SpaceStatus;
  subject?: string;
  /** Class logical keys this space is assigned to. */
  classKeys?: string[];
  /** Owning teacher logical key (createdBy). */
  ownerTeacherKey?: string;
  price?: number;
  storyPoints?: StoryPointConfig[];
}

export interface StoryPointConfig {
  key: string;
  title: string;
  description?: string;
  type?: StoryPointType;
  order?: number;
  /** Total seconds for timed_test/quiz. */
  durationSeconds?: number;
  items?: ItemConfig[];
}

/**
 * Item — the discriminated payload union (SDK-LAYERS-PLAN §2.2 two-level z.discriminatedUnion).
 * The seed authors `payload` directly; the engine strips the answer into the server-only
 * `answerKeys` subcollection and stores `effectiveRubric` + `rubricId` on the item.
 */
export type ItemConfig = QuestionItemConfig | ChatAgentQuestionSeedConfig | MaterialItemConfig;

export type QuestionType =
  | "mcq"
  | "msq"
  | "true_false"
  | "fill_blank"
  | "short_answer"
  | "long_answer"
  | "code"
  | "numeric"
  | "match"
  | "ordering"
  | "essay"
  | "diagram"
  | "audio_response"
  | "file_upload"
  | "oral"
  /** Conversational assessment. Its public/private shape is intentionally distinct. */
  | "chat_agent_question";

/** Standard question types use the generic answer-key shape. */
export type StandardQuestionType = Exclude<QuestionType, "chat_agent_question">;

export type MaterialType = "reading" | "video" | "pdf" | "slides" | "link" | "image" | "audio";

export interface QuestionItemConfig {
  key: string;
  kind: "question";
  questionType: StandardQuestionType;
  order?: number;
  prompt: string;
  /** Choices for mcq/msq/match/ordering. */
  options?: { id: string; text: string }[];
  points?: number;
  /** The answer — STRIPPED into the server-only answerKeys subcollection by the engine. */
  answer: AnswerKeyInput;
  /** Source rubric key (resolved + snapshotted into effectiveRubric + rubricId). */
  rubricPresetKey?: string;
  /** Inline rubric (used when no preset key is given). */
  rubric?: UnifiedRubricInput;
}

/**
 * Config-authoring surface for an assessment interview (§15.2).  Public fields
 * are written to the item; `answer` is written only to its deny-all answer key.
 * Logical keys are resolved by the pipeline before any document is written.
 */
export interface ChatAgentQuestionSeedConfig {
  key: string;
  kind: "question";
  questionType: "chat_agent_question";
  order?: number;
  /** Learner-safe item prompt. */
  prompt: string;
  scenario: string;
  publicLearningObjectives: Array<{ key: string; label: string }>;
  conversationStarters?: string[];
  interviewerAgentKey: string;
  /** Optional evaluator override; resolved to item.meta.evaluatorAgentId. */
  evaluatorAgentKey?: string;
  completionPolicy: {
    minLearnerTurns: number;
    maxLearnerTurns: number;
    allowEarlyFinish: boolean;
  };
  /** Server-only assessment key; never copied into item.questionData. */
  answer: ChatAgentAnswerKeyInput;
  rubricPresetKey?: string;
  rubric?: UnifiedRubricInput;
}

export interface MaterialItemConfig {
  key: string;
  kind: "material";
  materialType: MaterialType;
  order?: number;
  title: string;
  body?: string;
  url?: string;
  durationSeconds?: number;
}

/** AnswerKey payload — server-only (§6.4). `evaluationGuidance`/`modelAnswer` are ⚷. */
export interface AnswerKeyInput {
  correctAnswer: unknown;
  acceptableAnswers?: unknown[];
  evaluationGuidance?: string;
  modelAnswer?: string;
}

/** Private assessment material stored only in `answerKeys/{itemId}`. */
export interface ChatAgentAnswerKeyInput {
  modelAnswer?: string;
  evaluationGuidance?: string;
  privateEvaluationObjectives: Array<{
    key: string;
    rubricDimensionKey: string;
    description: string;
    evidenceRequirement?: string;
  }>;
}

export interface UnifiedRubricInput {
  /** Dimensions with weights; promptGuidance is ⚷ (authoring-only). */
  dimensions?: {
    key: string;
    label: string;
    weight: number;
    promptGuidance?: string;
  }[];
  totalPoints?: number;
  passingScore?: number;
  modelAnswer?: string;
  evaluatorGuidance?: string;
}

export interface AgentConfig {
  key: string;
  name: string;
  /** Owning space logical key — canonical Agent.spaceId is required (agents are space-scoped). */
  spaceKey: string;
  /** Canonical agent type; derived from `purpose` only for legacy configs. */
  type?: "tutor" | "interviewer" | "evaluator";
  purpose?: string;
  publicDescription?: string;
  identity?: string;
  systemPrompt?: string; // ⚷
  /** Static/config-derived learner-safe first message. */
  openingMessage?: string;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  maxConversationTurns?: number;
  rules?: string[];
  /** Evaluator persona guidance; distinct from item-private assessment objectives. */
  evaluationObjectives?: string[];
  strictness?: number;
  feedbackStyle?: string;
  /** Opaque allowlisted policy ID; never a provider/model name. */
  modelPolicyId?: "conversation.fast" | "conversation.quality" | "evaluation.quality";
  temperatureOverride?: number;
  /** Starting semantic version (the service owns later transactional increments). */
  version?: number;
  /** @deprecated Legacy input only. It is never written as a raw model override. */
  model?: string;
  isActive?: boolean;
}

export interface RubricPresetConfig {
  key: string;
  name: string;
  description?: string;
  rubric: UnifiedRubricInput;
  /** Canonical RubricPreset.category (default "general"). */
  category?: "general" | "coding" | "essay" | "math" | "science" | "language" | "custom";
  isDefault?: boolean;
}

export interface QuestionBankItemConfig {
  key: string;
  questionType: StandardQuestionType;
  prompt: string;
  options?: { id: string; text: string }[];
  points?: number;
  answer: AnswerKeyInput;
  tags?: string[];
  /** Canonical taxonomy (defaults: "General" / tags / "medium"). */
  subject?: string;
  topics?: string[];
  difficulty?: "easy" | "medium" | "hard";
}

/**
 * SpaceReview — a learner rating on a space (B2C store / class space).
 * Written to `spaces/{spaceId}/reviews/{reviewerUid}` (one review per user per space).
 * The server-owned `ratingAggregate` on the Space is recomputed by `onSpaceReviewWritten`.
 */
export interface SpaceReviewConfig {
  key: string;
  spaceKey: string;
  /** Reviewer logical key (any person key — usually a student). */
  reviewerKey: string;
  rating: number; // 1–5
  comment?: string;
}

/**
 * ChatSession — an AI-tutor conversation scoped to a space/storyPoint/item.
 * Messages are ALWAYS a subcollection (`chatSessions/{id}/messages/{msgId}`, D6).
 * `systemPrompt`/`tokensUsed` are ⚷ (server-only authoring/cost).
 */
export interface ChatSessionConfig {
  key: string;
  spaceKey: string;
  storyPointKey?: string;
  itemKey?: string;
  /** Learner logical key (the chat owner). */
  studentKey: string;
  agentKey?: string;
  title?: string;
  language?: string;
  isActive?: boolean;
  /** ⚷ authoring-only tutor prompt (server-projected-out for learners). */
  systemPrompt?: string;
  messages: ChatMessageConfig[];
}

export interface ChatMessageConfig {
  key: string;
  role: "user" | "assistant" | "system";
  text: string;
  /** ISO-8601 (D4). */
  timestamp?: string;
  mediaUrls?: string[];
  /** ⚷ server-only cost telemetry. */
  tokensUsed?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exams (autograde)
// ─────────────────────────────────────────────────────────────────────────────

export type ExamStatus = "draft" | "published" | "grading" | "graded" | "released" | "archived";

export interface ExamConfig {
  key: string;
  title: string;
  subject: string;
  topics?: string[];
  classKeys?: string[];
  examDate: string; // ISO
  durationMinutes?: number;
  totalMarks: number;
  passingMarks?: number;
  academicSessionKey?: string;
  status?: ExamStatus;
  /** Tenant storage paths (not URLs) for the question paper images. */
  questionPaperImages?: string[];
  ownerTeacherKey?: string;
  evaluationSettingsKey?: string;
  /** Linkage to a space (linkedSpaceId / linkedStoryPointId). */
  linkedSpaceKey?: string;
  linkedStoryPointKey?: string;
  questions?: ExamQuestionConfig[];
}

export interface ExamQuestionConfig {
  key: string;
  text: string;
  maxMarks: number;
  order?: number;
  questionType?: QuestionType;
  imageUrls?: string[];
  rubric?: UnifiedRubricInput;
  linkedItemKey?: string;
  subQuestions?: {
    label: string;
    text: string;
    maxMarks: number;
    rubric?: UnifiedRubricInput;
  }[];
}

export interface EvaluationSettingsConfig {
  key: string;
  name: string;
  confidenceConfig?: { lowThreshold: number; highThreshold: number }; // ⚷
  /** Not a canonical EvaluationSettings field — kept for authoring context only. */
  autoReleaseThreshold?: number;
  rubricPresetKey?: string;
  isDefault?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Submissions (autograde grading pipeline)
// ─────────────────────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | "pending"
  | "scouting"
  | "mapping"
  | "grading"
  | "graded"
  | "finalized"
  | "released"
  | "failed";

export interface SubmissionConfig {
  key: string;
  examKey: string;
  studentKey: string;
  classKey?: string;
  /** web | scanner | rn (D12 closed union). */
  uploadSource?: "web" | "scanner" | "rn";
  uploadedByKey?: string;
  status?: SubmissionStatus;
  /**
   * Domain pipeline status (autograde `SubmissionPipelineStatus`). When present the engine maps
   * this onto `pipelineStatus`; `status` stays the seed-facing coarse status.
   */
  pipelineStatus?: SubmissionPipelineStatus;
  /** Terminal/partial pipeline error message (⚷). */
  pipelineError?: string;
  retryCount?: number;
  /** Server-maintained batch counters surfaced by the gradingStatus subscription. */
  gradingProgress?: { graded: number; total: number; batchIndex?: number };
  /** Visibility gate (⚷). When true, released summary + scores are student/parent-visible. */
  resultsReleased?: boolean;
  resultsReleasedByKey?: string;
  resultsReleasedAt?: string;
  /** Point-in-time denorm (PC-8). */
  studentName?: string;
  rollNumber?: string;
  answerSheetImages?: string[];
  /** Panopticon scouting routing map (questionKey -> page indices) + per-question confidence. */
  scoutingResult?: {
    routingMap?: Record<string, number[]>;
    confidence?: Record<string, number>;
    completedAt?: string;
  };
  /** Per-question graded results (⚷ scores — server authority). */
  questionSubmissions?: QuestionSubmissionConfig[];
  /** Released summary (only when results are released / grading complete). */
  summary?: {
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade?: string;
    questionsGraded?: number;
    totalQuestions?: number;
  };
}

export type SubmissionPipelineStatus =
  | "uploaded"
  | "scouting"
  | "scouting_failed"
  | "scouting_complete"
  | "grading"
  | "grading_partial"
  | "grading_failed"
  | "grading_complete"
  | "finalization_failed"
  | "ready_for_review"
  | "reviewed"
  | "failed"
  | "manual_review_needed";

export interface QuestionSubmissionConfig {
  /** Target exam-question logical key. */
  questionKey: string;
  gradingStatus?:
    | "pending"
    | "processing"
    | "grading"
    | "graded"
    | "needs_review"
    | "failed"
    | "manual"
    | "overridden";
  /** Scouting QuestionMapping (page indices + answer-sheet storage paths). */
  mapping?: { pageIndices: number[]; imageUrls?: string[] };
  /**
   * Shared UnifiedEvaluationResult (⚷ server-internal). For pre-release submissions this is set
   * server-side but never projected to students; for graded+released it backs StoredEvaluation.
   */
  evaluation?: {
    score: number;
    maxScore: number;
    confidence?: number;
    feedback?: string;
    strengths?: string[];
    improvements?: string[];
    /** ⚷ cost — never reaches a client response; stored server-side only. */
    cost?: { tokensIn: number; tokensOut: number; usd: number };
  };
  gradingError?: string;
  gradingRetryCount?: number;
  manualOverride?: { score: number; by: string; reason?: string; originalScore?: number };
}

export interface GradingDeadLetterConfig {
  key: string;
  submissionKey: string;
  /** Target exam-question logical key when the failure is per-question. */
  questionKey?: string;
  pipelineStep: "scouting" | "grading";
  error: string;
  errorStack?: string;
  attempts: number;
  lastAttemptAt?: string;
  resolvedAt?: string;
  resolvedByKey?: string;
  resolutionMethod?: "retry_success" | "manual_grade" | "dismissed";
}

// ─────────────────────────────────────────────────────────────────────────────
// Test sessions + progress (levelup)
// ─────────────────────────────────────────────────────────────────────────────

export type TestSessionStatus = "in_progress" | "submitted" | "graded" | "expired";

export interface TestSessionConfig {
  key: string;
  spaceKey: string;
  storyPointKey: string;
  studentKey: string;
  sessionType?: "timed_test" | "quiz" | "practice";
  status?: TestSessionStatus;
  /** Server-authoritative deadline (ISO). */
  serverDeadline?: string;
  attemptNumber?: number;
  isLatest?: boolean;
  startedAt?: string;
  submittedAt?: string;
  /** Per-item answers → `submissions/{itemId}` subcollection (D6 always-subcollection). */
  answers?: TestAnswerConfig[];
}

export interface TestAnswerConfig {
  itemKey: string;
  answer: unknown;
  markedForReview?: boolean;
  /** ⚷ server-computed StoredEvaluation (answer+cost-stripped client projection). */
  evaluation?: {
    score: number;
    maxScore: number;
    correct?: boolean;
    feedback?: string;
  };
}

export interface SpaceProgressConfig {
  /** Student logical key (progress is keyed `{userId}_{spaceId}`, D13). */
  studentKey: string;
  spaceKey: string;
  /** Bounded summary: one numeric per story point (D6 — no nested per-item state). */
  storyPoints?: {
    storyPointKey: string;
    completedItems: number;
    totalItems: number;
    pointsEarned: number;
    totalPoints: number;
    status?: "not_started" | "in_progress" | "completed";
  }[];
  overallPercentage?: number;
  pointsEarned?: number;
  totalPoints?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gamification (server-owned; userId-keyed)
// ─────────────────────────────────────────────────────────────────────────────

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export interface AchievementConfig {
  key: string;
  name: string;
  description?: string;
  tier?: AchievementTier;
  category?: string;
  criteria?: { type: string; target: number };
  isActive?: boolean;
}

export interface StudentGamificationConfig {
  studentKey: string;
  level?: { level: number; xp: number; tier?: AchievementTier };
  unlockedAchievementKeys?: string[];
  streakDays?: number;
  longestStreak?: number;
  studyGoals?: {
    key: string;
    title: string;
    targetType: string;
    targetCount: number;
    startDate: string;
    endDate: string;
    currentCount?: number;
    completed?: boolean;
  }[];
  studySessions?: {
    key: string;
    date: string; // IsoDate YYYY-MM-DD
    minutes: number;
    itemsCompleted?: number;
  }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications / announcements / insights / cost (analytics + notification)
// ─────────────────────────────────────────────────────────────────────────────

export interface AnnouncementConfig {
  key: string;
  title: string;
  body: string;
  scope?: "tenant" | "class" | "role";
  targetClassKeys?: string[];
  targetRoles?: TenantRole[];
  status?: "draft" | "published" | "archived";
  authorKey?: string;
  /** Logical keys (uid keys) who have read it → `/reads/{uid}` subcollection (CD8). */
  readByKeys?: string[];
}

export interface NotificationConfig {
  key: string;
  /** Recipient logical key (recipientUid — D3/D12 canonical). */
  recipientKey: string;
  type: string;
  title: string;
  body?: string;
  /** Discriminated payload union (kept as opaque data here). */
  payload?: Record<string, unknown>;
  isRead?: boolean;
}

export interface InsightConfig {
  key: string;
  studentKey: string;
  type: string;
  severity?: "info" | "warning" | "critical";
  message: string;
  dismissed?: boolean;
}

export interface CostSummaryConfig {
  key: string;
  granularity: "daily" | "monthly";
  /** Period id — YYYY-MM-DD (daily) or YYYY-MM (monthly). */
  period: string;
  totalUsd: number;
  totalTokens: number;
  callCount: number;
  byPurpose?: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine run options
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedRunOptions {
  projectId: string;
  serviceAccountPath?: string;
  databaseURL?: string;
  dryRun?: boolean;
  logLevel?: "silent" | "error" | "warn" | "info" | "debug";
  clock?: Clock;
  clockEpochMs?: number;
  /** When true, run() does NOT write — only verify() is executed. */
  verifyOnly?: boolean;
}
