/**
 * LEGACY DOC SHAPES for the unprefixed collections this package serves
 * (`tenants/{t}/spaces/**`, `digitalTestSessions/`, `spaceProgress/`,
 * `chatSessions/`, `questionBank/`, `rubricPresets/`, `notifications/`,
 * `userMemberships/`). Ported from @levelup/shared-types as part of U3.2
 * (DATA-MODEL-FIX-PLAN §3/§6, MIGRATION-PATTERN.md rule 2) so that package
 * can be deleted (U3.5).
 *
 * These are deliberately NOT the @levelup/domain entity schemas: docs at rest
 * carry the legacy field vocabularies — flat `payload.questionType` payloads
 * (domain nests a `type` discriminant), `maxPoints` rubric criteria (domain:
 * `maxScore`), `{issue,howToFix}` feedback items (domain: `{message,suggestion}`),
 * `summary` objects (domain: string), the dropped `'test'` storyPoint type —
 * and, pre-B8, Firestore Timestamp objects. Casting them to domain types would
 * be a lie. Enums/roles/primitives that ARE identical to domain come from
 * domain — never redefined here (verified value-identical 2026-07-04).
 *
 * B8 timestamps: every timestamp field is `LegacyTimestamp` (= domain
 * `TimestampInput`): old docs hold Firestore Timestamp objects, audit fields
 * written after U3.2 hold canonical ISO strings. NEVER consume one directly —
 * collapse with `toTimestamp()` / `toMillis(toTimestamp())` from @levelup/domain
 * at the point of use.
 *
 * U3.2 addendum (levelup-specific): DigitalTestSession TIMING fields
 * (`startedAt`, `endedAt`, `serverDeadline`, `submittedAt`) and evaluation
 * `gradedAt` remain Firestore-Timestamp at rest — they are entity timing used
 * in `.toMillis()` math and read by deployed legacy clients; flipping them is
 * deferred to U3.5. Only AUDIT fields (`createdAt`/`updatedAt`/`changedAt`/…)
 * flip to `isoNow()`.
 */
import { z } from "zod";
import type {
  TimestampInput,
  TenantRole,
  ItemType,
  QuestionType,
  MaterialType,
  BloomsLevel,
  SpaceType,
  SpaceStatus,
  SpaceAccessType,
  StoryPointType,
  LegacyStoryPointType,
  AgentType,
  ChatMessageRole,
  TestSessionStatus,
  TestSessionType,
  QuestionStatus,
  ProgressStatus,
  QuestionProgressStatus,
  RubricScoringMode,
  RubricPresetCategory,
  MistakeClassification,
} from "@levelup/domain";

/** Firestore-Timestamp-or-ISO-string. Collapse with domain `toTimestamp()`. */
export type LegacyTimestamp = TimestampInput;

// Re-exported so handlers have ONE local import surface for legacy doc shapes.
export type {
  TenantRole,
  ItemType,
  QuestionType,
  MaterialType,
  BloomsLevel,
  SpaceType,
  SpaceStatus,
  SpaceAccessType,
  AgentType,
  ChatMessageRole,
  TestSessionStatus,
  TestSessionType,
  QuestionStatus,
  ProgressStatus,
  QuestionProgressStatus,
  RubricScoringMode,
  RubricPresetCategory,
};

/**
 * At-rest storyPoint `type` — legacy docs still carry the dropped `'test'`
 * synonym (domain: `zLegacyStoryPointTypeRead` maps it to `'timed_test'`).
 * Handlers branch on BOTH values (behavior-preserving); the at-rest value is
 * NOT normalized by the doc-parse schemas below.
 */
export type LegacyStoryPointTypeField = StoryPointType | LegacyStoryPointType;

/**
 * Lenient B8 timestamp validator for doc parses: accepts a Firestore Timestamp
 * (or serialized/{seconds,nanoseconds} shape), an ISO string, epoch millis, or
 * a Date — WITHOUT transforming, so Timestamp instances keep their prototype
 * (`.toMillis()` still works on passthrough fields downstream).
 */
export const zLegacyTimestampRead = z.custom<LegacyTimestamp>((v) => {
  if (typeof v === "string") return !Number.isNaN(Date.parse(v));
  if (typeof v === "number") return !Number.isNaN(v);
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return (
      (typeof o.seconds === "number" && typeof o.nanoseconds === "number") ||
      (typeof o._seconds === "number" && typeof o._nanoseconds === "number") ||
      typeof o.toMillis === "function"
    );
  }
  return false;
}, "expected Firestore Timestamp or ISO-8601 string");

// ─────────────────────────────────────────────────────────────────────────────
// Rubric — embedded on Space / StoryPoint / UnifiedItem / RubricPreset.
// Legacy vocabulary: criterion `maxPoints` (domain renamed to `maxScore`),
// dimension carries icon/enabled/isDefault/isCustom flags domain dropped.
// ─────────────────────────────────────────────────────────────────────────────

export interface RubricCriterionLevel {
  score: number;
  label: string;
  description: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description?: string;
  maxPoints: number;
  weight?: number;
  levels?: RubricCriterionLevel[];
}

export interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  icon?: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  promptGuidance: string;
  enabled: boolean;
  isDefault: boolean;
  isCustom: boolean;
  expectedFeedbackCount?: number;
  weight: number;
  scoringScale: number;
  createdAt?: LegacyTimestamp;
  createdBy?: string;
}

export interface UnifiedRubric {
  scoringMode: RubricScoringMode;
  criteria?: RubricCriterion[];
  dimensions?: EvaluationDimension[];
  holisticGuidance?: string;
  holisticMaxScore?: number;
  passingPercentage?: number;
  showModelAnswer?: boolean;
  modelAnswer?: string;
  evaluatorGuidance?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation result — embedded in session submissions / returned over the wire.
// Legacy vocabulary: FeedbackItem {issue,howToFix}, breakdown {criterion,awarded,max},
// summary object, tokensUsed {input,output} (domain diverges on all four).
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedbackItem {
  issue: string;
  whyItMatters?: string;
  howToFix: string;
  severity: "critical" | "major" | "minor";
  relatedConcept?: string;
}

export interface RubricBreakdownItem {
  criterion: string;
  awarded: number;
  max: number;
  feedback?: string;
}

export interface UnifiedEvaluationResult {
  score: number;
  maxScore: number;
  correctness: number;
  percentage: number;
  structuredFeedback?: Record<string, FeedbackItem[]>;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  rubricBreakdown?: RubricBreakdownItem[];
  summary?: {
    keyTakeaway: string;
    overallComment: string;
  };
  confidence: number;
  mistakeClassification?: MistakeClassification;
  tokensUsed?: { input: number; output: number };
  costUsd?: number;
  evaluationRubricId?: string;
  dimensionsUsed?: string[];
  /** U3.5: stays a Firestore Timestamp at rest (see header addendum). */
  gradedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Item metadata / analytics — embedded value objects on UnifiedItem.
// ─────────────────────────────────────────────────────────────────────────────

export interface PyqInfo {
  exam: string;
  year: number;
  session?: string;
  questionNumber?: string;
}

export interface MigrationSource {
  type: "levelup_item" | "levelup_question" | "autograde_question";
  sourceId: string;
  sourceCollection: string;
}

export interface ItemMetadata {
  totalPoints?: number;
  maxMarks?: number;
  estimatedTime?: number;
  tags?: string[];
  learningObjectives?: string[];
  skillsAssessed?: string[];
  bloomsLevel?: BloomsLevel;
  prerequisites?: string[];
  isRetriable?: boolean;
  evaluatorAgentId?: string;
  pyqInfo?: PyqInfo[];
  featured?: boolean;
  viewCount?: number;
  successRate?: number;
  migrationSource?: MigrationSource;
}

export interface ItemAnalytics {
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[];
  labels?: string[];
  bloomsLevel?: BloomsLevel;
  bloomsSubLevel?: string;
  cognitiveLoad?: "low" | "medium" | "high";
  skillsAssessed?: string[];
  primarySkill?: string;
  secondarySkills?: string[];
  conceptCategory?: string;
  learningObjective?: string;
  applicationDomain?: "theory" | "practical" | "real-world" | "conceptual";
  questionComplexity?: "single-concept" | "multi-concept" | "synthesis" | "integration";
  prerequisiteTopics?: string[];
  relatedTopics?: string[];
  conceptImportance?: "foundational" | "important" | "advanced" | "optional" | "bonus";
  commonMistakes?: string[];
  hintsAvailable?: boolean;
  curriculumStandards?: string[];
  examRelevance?: string[];
  customDimensions?: Record<string, string | string[] | number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Question payloads — the legacy FLAT payload family (payload.questionType +
// payload.questionData). Domain's canonical two-level `type`-discriminated
// payload is a DIFFERENT at-rest shape; do not confuse them.
// ─────────────────────────────────────────────────────────────────────────────

export interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface MCQData {
  options: MCQOption[];
  shuffleOptions?: boolean;
}

export interface MCAQData {
  options: MCQOption[];
  minSelections?: number;
  maxSelections?: number;
  shuffleOptions?: boolean;
}

export interface TrueFalseData {
  correctAnswer: boolean;
  explanation?: string;
}

export interface NumericalData {
  correctAnswer: number;
  tolerance?: number;
  unit?: string;
  decimalPlaces?: number;
}

export interface TextData {
  correctAnswer?: string;
  caseSensitive?: boolean;
  acceptableAnswers?: string[];
  maxLength?: number;
}

export interface ParagraphData {
  maxLength?: number;
  minLength?: number;
  modelAnswer?: string;
  evaluationGuidance?: string;
}

export interface CodeTestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  description?: string;
  points?: number;
}

export interface CodeData {
  language: string;
  starterCode?: string;
  testCases: CodeTestCase[];
  timeoutMs?: number;
  memoryLimitMb?: number;
}

export interface FillBlank {
  id: string;
  correctAnswer: string;
  acceptableAnswers?: string[];
  caseSensitive?: boolean;
}

export interface FillBlanksData {
  textWithBlanks: string;
  blanks: FillBlank[];
}

export interface FillBlanksDDOption {
  id: string;
  text: string;
}

export interface FillBlanksDDBlank {
  id: string;
  correctOptionId: string;
  options: FillBlanksDDOption[];
}

export interface FillBlanksDDData {
  textWithBlanks: string;
  blanks: FillBlanksDDBlank[];
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface MatchingData {
  pairs: MatchingPair[];
  shufflePairs?: boolean;
}

export interface JumbledItem {
  id: string;
  text: string;
}

export interface JumbledData {
  correctOrder: string[];
  items: JumbledItem[];
}

export interface AudioData {
  maxDurationSeconds?: number;
  language?: string;
  evaluationGuidance?: string;
}

export interface ImageEvaluationData {
  instructions: string;
  maxImages?: number;
  evaluationGuidance?: string;
}

export interface GroupOptionsGroup {
  id: string;
  name: string;
  correctItems: string[];
}

export interface GroupOptionsItem {
  id: string;
  text: string;
}

export interface GroupOptionsData {
  groups: GroupOptionsGroup[];
  items: GroupOptionsItem[];
}

export interface ChatAgentQuestionData {
  agentId?: string;
  objectives: string[];
  conversationStarters?: string[];
  maxTurns?: number;
  evaluationGuidance?: string;
}

export type QuestionTypeData =
  | MCQData
  | MCAQData
  | TrueFalseData
  | NumericalData
  | TextData
  | ParagraphData
  | CodeData
  | FillBlanksData
  | FillBlanksDDData
  | MatchingData
  | JumbledData
  | AudioData
  | ImageEvaluationData
  | GroupOptionsData
  | ChatAgentQuestionData;

export interface QuestionPayload {
  questionType: QuestionType;
  title?: string;
  content: string;
  explanation?: string;
  basePoints?: number;
  difficulty?: "easy" | "medium" | "hard";
  bloomsLevel?: BloomsLevel;
  questionData: QuestionTypeData;
}

// ── Material / other payloads ────────────────────────────────────────────────

export interface RichContentBlockItem {
  id: string;
  type:
    | "heading"
    | "paragraph"
    | "image"
    | "video"
    | "audio"
    | "code"
    | "quote"
    | "list"
    | "divider";
  content: string;
  metadata?: Record<string, unknown>;
  styles?: Record<string, unknown>;
}

export interface RichContentBlock {
  title?: string;
  subtitle?: string;
  coverImage?: string;
  blocks: RichContentBlockItem[];
  tags?: string[];
  author?: { name: string; avatar?: string; bio?: string };
  readingTime?: number;
}

export interface MaterialPayload {
  materialType: MaterialType;
  url?: string;
  duration?: number;
  downloadable?: boolean;
  content?: string;
  richContent?: RichContentBlock;
}

export interface InteractivePayload {
  interactiveType: "simulation" | "demo" | "tool" | "game";
  url: string;
  embeddable?: boolean;
  parameters?: Record<string, unknown>;
  instructions?: string;
}

export interface AssessmentRubricItem {
  criterion: string;
  maxPoints: number;
  description: string;
}

export interface AssessmentPayload {
  assessmentType: "quiz" | "exam" | "project" | "peer_review";
  timeLimit?: number;
  attempts?: number;
  passingScore?: number;
  itemReferences?: string[];
  rubric?: AssessmentRubricItem[];
}

export interface DiscussionPayload {
  prompt: string;
  threadType: "open" | "guided";
  moderationEnabled?: boolean;
}

export interface ProjectPayload {
  instructions: string;
  deliverables: string[];
  dueDate?: LegacyTimestamp;
  teamSize?: number;
  rubric?: AssessmentRubricItem[];
}

export interface CheckpointPayload {
  requiredItemIds?: string[];
  requiredPercentage?: number;
  message?: string;
}

export type ItemPayload =
  | QuestionPayload
  | MaterialPayload
  | InteractivePayload
  | AssessmentPayload
  | DiscussionPayload
  | ProjectPayload
  | CheckpointPayload;

// ─────────────────────────────────────────────────────────────────────────────
// UnifiedItem — /tenants/{t}/spaces/{s}/storyPoints/{sp}/items/{i} (nested,
// canonical) or /tenants/{t}/spaces/{s}/items/{i} (legacy flat).
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemAttachment {
  id: string;
  fileName: string;
  url: string;
  type: "image" | "pdf" | "audio";
  size: number;
  mimeType: string;
}

export interface UnifiedItem {
  id: string;
  spaceId: string;
  storyPointId: string;
  sectionId?: string;
  tenantId: string;
  type: ItemType;
  payload: ItemPayload;
  title?: string;
  content?: string;
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[];
  labels?: string[];
  orderIndex: number;
  meta?: ItemMetadata;
  analytics?: ItemAnalytics;
  rubric?: UnifiedRubric;
  linkedQuestionId?: string;
  attachments?: ItemAttachment[];
  version?: number;
  createdBy?: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Space — /tenants/{tenantId}/spaces/{spaceId}
// ─────────────────────────────────────────────────────────────────────────────

export interface SpaceStats {
  totalStoryPoints: number;
  totalItems: number;
  totalStudents: number;
  avgCompletionRate?: number;
}

export interface SpaceRatingAggregate {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

export interface Space {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  slug?: string;
  type: SpaceType;
  subject?: string;
  labels?: string[];
  classIds: string[];
  sectionIds?: string[];
  teacherIds: string[];
  accessType: SpaceAccessType;
  academicSessionId?: string;
  defaultEvaluatorAgentId?: string;
  defaultTutorAgentId?: string;
  defaultTimeLimitMinutes?: number;
  allowRetakes?: boolean;
  maxRetakes?: number;
  showCorrectAnswers?: boolean;
  defaultRubric?: UnifiedRubric;
  price?: number;
  currency?: string;
  publishedToStore?: boolean;
  storeDescription?: string;
  storeThumbnailUrl?: string;
  status: SpaceStatus;
  publishedAt?: LegacyTimestamp;
  archivedAt?: LegacyTimestamp;
  stats?: SpaceStats;
  ratingAggregate?: SpaceRatingAggregate;
  version?: number;
  createdBy: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

/** /tenants/{t}/spaces/{s}/versions/{versionId} */
export interface ContentVersion {
  id: string;
  version: number;
  entityType: "space" | "storyPoint" | "item";
  entityId: string;
  changeType: "created" | "updated" | "published" | "archived";
  changeSummary: string;
  changedBy: string;
  changedAt: LegacyTimestamp;
}

/** /tenants/{t}/spaces/{s}/reviews/{userId} */
export interface SpaceReview {
  id: string;
  spaceId: string;
  tenantId: string;
  userId: string;
  userName?: string;
  rating: number;
  comment?: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// StoryPoint — /tenants/{t}/spaces/{s}/storyPoints/{sp}
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryPointSection {
  id: string;
  title: string;
  orderIndex: number;
  description?: string;
}

export interface AdaptiveConfig {
  enabled: boolean;
  initialDifficulty: "easy" | "medium" | "hard";
  difficultyAdjustment: "gradual" | "aggressive";
  minQuestionsPerDifficulty?: number;
  maxConsecutiveSameDifficulty?: number;
}

export interface AssessmentSchedule {
  startAt?: LegacyTimestamp;
  endAt?: LegacyTimestamp;
  lateSubmissionGraceMinutes?: number;
}

export interface RetryConfig {
  cooldownMinutes?: number;
  lockAfterPassing?: boolean;
}

export interface AssessmentConfig {
  durationMinutes?: number;
  instructions?: string;
  maxAttempts?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResultsImmediately?: boolean;
  passingPercentage?: number;
  adaptiveConfig?: AdaptiveConfig;
  schedule?: AssessmentSchedule;
  retryConfig?: RetryConfig;
}

export interface StoryPointStats {
  totalItems: number;
  totalQuestions: number;
  totalMaterials: number;
  totalPoints: number;
}

export interface StoryPoint {
  id: string;
  spaceId: string;
  tenantId: string;
  title: string;
  description?: string;
  orderIndex: number;
  /** At-rest value may still be the legacy `'test'` synonym. */
  type: LegacyStoryPointTypeField;
  sections: StoryPointSection[];
  assessmentConfig?: AssessmentConfig;
  defaultRubric?: UnifiedRubric;
  difficulty?: "easy" | "medium" | "hard" | "expert";
  estimatedTimeMinutes?: number;
  stats?: StoryPointStats;
  createdBy: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent — /tenants/{t}/spaces/{s}/agents/{agentId}
// ─────────────────────────────────────────────────────────────────────────────

export interface EvaluationObjective {
  id: string;
  name: string;
  points: number;
  description?: string;
}

export interface Agent {
  id: string;
  spaceId: string;
  tenantId: string;
  type: AgentType;
  name: string;
  identity: string;
  systemPrompt?: string;
  supportedLanguages?: string[];
  defaultLanguage?: string;
  maxConversationTurns?: number;
  rules?: string;
  evaluationObjectives?: EvaluationObjective[];
  strictness?: "lenient" | "moderate" | "strict";
  feedbackStyle?: "brief" | "detailed" | "encouraging";
  modelOverride?: string;
  temperatureOverride?: number;
  createdBy: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// AnswerKey — server-only subcollection .../items/{itemId}/answerKeys/{id}
// ─────────────────────────────────────────────────────────────────────────────

export interface AnswerKey {
  id: string;
  itemId: string;
  questionType: QuestionType;
  correctAnswer: unknown;
  acceptableAnswers?: unknown[];
  evaluationGuidance?: string;
  modelAnswer?: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// ChatSession — /tenants/{tenantId}/chatSessions/{sessionId}
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  text: string;
  timestamp: string;
  mediaUrls?: string[];
  tokensUsed?: { input: number; output: number };
}

export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;
  itemId: string;
  questionType?: string;
  agentId?: string;
  agentName?: string;
  sessionTitle: string;
  previewMessage: string;
  messageCount: number;
  language: string;
  isActive: boolean;
  messages: ChatMessage[];
  systemPrompt: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// QuestionBankItem — /tenants/{tenantId}/questionBank/{itemId}
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionBankItem {
  id: string;
  tenantId: string;
  questionType: QuestionType;
  title?: string;
  content: string;
  explanation?: string;
  basePoints?: number;
  questionData: QuestionTypeData;
  subject: string;
  topics: string[];
  difficulty: "easy" | "medium" | "hard";
  bloomsLevel?: BloomsLevel;
  usageCount: number;
  averageScore?: number;
  lastUsedAt?: LegacyTimestamp;
  tags: string[];
  createdBy: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

export interface QuestionBankFilter {
  subject?: string;
  topics?: string[];
  difficulty?: "easy" | "medium" | "hard";
  bloomsLevel?: BloomsLevel;
  questionType?: QuestionType;
  tags?: string[];
  search?: string;
  sortBy?: "usageCount" | "averageScore" | "createdAt";
  sortDir?: "asc" | "desc";
  limit?: number;
  startAfter?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DigitalTestSession — /tenants/{tenantId}/digitalTestSessions/{sessionId}
// ─────────────────────────────────────────────────────────────────────────────

export interface TestSubmission {
  itemId: string;
  questionType: QuestionType;
  answer: unknown;
  submittedAt: number;
  timeSpentSeconds: number;
  evaluation?: UnifiedEvaluationResult;
  correct?: boolean;
  pointsEarned?: number;
  totalPoints?: number;
}

export interface AnalyticsBreakdownEntry {
  correct: number;
  total: number;
  points?: number;
  maxPoints?: number;
}

export interface TestAnalytics {
  topicBreakdown?: Record<string, AnalyticsBreakdownEntry>;
  bloomsBreakdown?: Record<string, AnalyticsBreakdownEntry>;
  difficultyBreakdown?: Record<string, AnalyticsBreakdownEntry>;
  sectionBreakdown?: Record<string, AnalyticsBreakdownEntry>;
  timePerQuestion?: Record<string, number>;
  averageTimePerQuestion?: number;
}

export interface AdaptiveState {
  currentDifficulty: "easy" | "medium" | "hard";
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  answeredByDifficulty: Record<string, number>;
}

export interface DigitalTestSession {
  id: string;
  tenantId: string;
  userId: string;
  spaceId: string;
  storyPointId: string;
  sessionType: TestSessionType;
  attemptNumber: number;
  status: TestSessionStatus;
  isLatest: boolean;
  /** U3.5: timing fields stay Firestore Timestamps at rest (header addendum). */
  startedAt: LegacyTimestamp;
  endedAt?: LegacyTimestamp;
  durationMinutes: number;
  serverDeadline?: LegacyTimestamp;
  totalQuestions: number;
  answeredQuestions: number;
  questionOrder: string[];
  visitedQuestions: Record<string, boolean>;
  submissions: Record<string, TestSubmission>;
  markedForReview: Record<string, boolean>;
  pointsEarned?: number;
  totalPoints?: number;
  marksEarned?: number;
  totalMarks?: number;
  percentage?: number;
  sectionMapping?: Record<string, string>;
  lastVisitedIndex?: number;
  adaptiveState?: AdaptiveState;
  currentDifficultyLevel?: "easy" | "medium" | "hard";
  difficultyProgression?: Array<{
    questionIndex: number;
    difficulty: string;
    correct: boolean;
  }>;
  analytics?: TestAnalytics;
  submittedAt?: LegacyTimestamp;
  autoSubmitted?: boolean;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// SpaceProgress — /tenants/{t}/spaceProgress/{userId}_{spaceId}
//   + storyPointProgress/{storyPointId} subdocs
// ─────────────────────────────────────────────────────────────────────────────

export interface QuestionProgressData {
  status: QuestionProgressStatus;
  attemptsCount: number;
  bestScore: number;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  solved: boolean;
  latestScore?: number;
  latestStatus?: QuestionProgressStatus;
}

export interface StoredEvaluation {
  score: number;
  maxScore: number;
  correctness: number;
  percentage: number;
  strengths: string[];
  weaknesses: string[];
  missingConcepts: string[];
  summary?: {
    keyTakeaway: string;
    overallComment: string;
  };
  mistakeClassification?: MistakeClassification;
}

export interface AttemptRecord {
  attemptNumber: number;
  answer: unknown;
  evaluation: StoredEvaluation;
  score: number;
  maxScore: number;
  timestamp: number;
}

export interface ItemProgressEntry {
  itemId: string;
  itemType: ItemType;
  completed: boolean;
  completedAt?: number;
  timeSpent?: number;
  interactions?: number;
  lastUpdatedAt: number;
  questionData?: QuestionProgressData;
  progress?: number;
  score?: number;
  feedback?: string;
  lastAnswer?: unknown;
  lastEvaluation?: StoredEvaluation;
  attempts?: AttemptRecord[];
}

export interface StoryPointProgress {
  storyPointId: string;
  status: ProgressStatus;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  completedItems: number;
  totalItems: number;
  completedAt?: number;
}

export interface StoryPointProgressDoc {
  storyPointId: string;
  status: ProgressStatus;
  pointsEarned: number;
  totalPoints: number;
  percentage: number;
  completedItems: number;
  totalItems: number;
  completedAt?: number;
  updatedAt: number;
  items: Record<string, ItemProgressEntry>;
}

export interface SpaceProgress {
  id: string;
  userId: string;
  tenantId: string;
  spaceId: string;
  status: ProgressStatus;
  pointsEarned: number;
  totalPoints: number;
  marksEarned?: number;
  totalMarks?: number;
  percentage: number;
  storyPoints: Record<string, StoryPointProgress>;
  startedAt?: LegacyTimestamp;
  completedAt?: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// RubricPreset — /tenants/{tenantId}/rubricPresets/{presetId}
// ─────────────────────────────────────────────────────────────────────────────

export interface RubricPreset {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  rubric: UnifiedRubric;
  category: RubricPresetCategory;
  questionTypes?: QuestionType[];
  isDefault: boolean;
  createdBy: string;
  createdAt: LegacyTimestamp;
  updatedAt: LegacyTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// UserMembership — /userMemberships/{uid}_{tenantId}
// MINIMAL read-surface projection: this package only gates on role/status.
// The FULL legacy doc type lives in functions/identity/src/contracts/legacy-docs.ts
// (U3.1). Promotion to a shared home is a coordinator decision (pattern rule 2) —
// deliberately NOT copied here a third time.
// ─────────────────────────────────────────────────────────────────────────────

export interface UserMembership {
  id?: string;
  uid?: string;
  tenantId?: string;
  role: TenantRole;
  status: "active" | "inactive" | "suspended";
  [key: string]: unknown;
}

// ═════════════════════════════════════════════════════════════════════════════
// Doc-parse zod schemas — ported verbatim from shared-types `schemas/index.ts`
// with the timestamp fields swapped to the lenient B8 `zLegacyTimestampRead`
// (accepts Timestamp objects AND post-U3.2 ISO strings, no transform).
// All `.passthrough()` semantics preserved — un-listed fields (e.g. session
// `serverDeadline`, storyPoint `assessmentConfig.schedule`) pass through
// VERBATIM so Firestore Timestamp instances keep their methods.
// ═════════════════════════════════════════════════════════════════════════════

export const SpaceDocSchema = z
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
    createdAt: zLegacyTimestampRead,
    updatedAt: zLegacyTimestampRead,
  })
  .passthrough();

export const StoryPointDocSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    spaceId: z.string(),
    title: z.string(),
    description: z.string().nullish(),
    orderIndex: z.number(),
    // At-rest value NOT normalized — handlers branch on 'test' explicitly.
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
    createdAt: zLegacyTimestampRead,
    updatedAt: zLegacyTimestampRead,
  })
  .passthrough();

export const AgentDocSchema = z
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
    createdAt: zLegacyTimestampRead,
    updatedAt: zLegacyTimestampRead,
  })
  .passthrough();

export const UnifiedItemDocSchema = z
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
    createdAt: zLegacyTimestampRead,
    updatedAt: zLegacyTimestampRead,
  })
  .passthrough();

export const ChatMessageDocSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  text: z.string(),
  timestamp: zLegacyTimestampRead,
  mediaUrls: z.array(z.string()).optional(),
  tokensUsed: z.number().optional(),
});

export const ChatSessionDocSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  spaceId: z.string(),
  storyPointId: z.string().optional(),
  itemId: z.string().optional(),
  agentId: z.string().optional(),
  messages: z.array(ChatMessageDocSchema),
  systemPrompt: z.string().optional(),
  isActive: z.boolean(),
  createdAt: zLegacyTimestampRead,
  updatedAt: zLegacyTimestampRead,
});

export const DigitalTestSessionDocSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    userId: z.string(),
    spaceId: z.string(),
    storyPointId: z.string(),
    // Legacy 'test'/'exam' at rest are collapsed by domain zLegacyTestSessionTypeRead
    // at read CALL SITES; the wire-era doc schema listed only the canonical three
    // and `sessionType` passes through (this mirrors the shared-types original,
    // which validated a `type` field that session docs don't carry via `.passthrough()`).
    status: z.enum(["in_progress", "completed", "expired", "abandoned"]),
    startedAt: zLegacyTimestampRead,
    totalQuestions: z.number(),
    attemptNumber: z.number(),
    createdAt: zLegacyTimestampRead,
    updatedAt: zLegacyTimestampRead,
  })
  .passthrough();

export const QuestionBankItemDocSchema = z
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
    averageScore: z.number().nullish(),
    lastUsedAt: zLegacyTimestampRead.nullish(),
    tags: z.array(z.string()),
    createdBy: z.string(),
    createdAt: zLegacyTimestampRead,
    updatedAt: zLegacyTimestampRead,
  })
  .passthrough();
