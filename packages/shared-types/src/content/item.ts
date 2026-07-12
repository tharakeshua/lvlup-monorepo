/**
 * UnifiedItem — the canonical content atom for the platform.
 * Covers 7 top-level types, 15 question subtypes, 7 material subtypes.
 * @module content/item
 */

import type { FirestoreTimestamp } from "../identity/user";
import type { UnifiedRubric } from "./rubric";
import type { ItemMetadata, ItemAnalytics } from "./item-metadata";
import type { BloomsLevel } from "../constants/grades";

// ─────────────────────────────────────────────────────
// 7 Top-Level Item Types
// ─────────────────────────────────────────────────────

export type ItemType =
  | "question"
  | "material"
  | "interactive"
  | "assessment"
  | "discussion"
  | "project"
  | "checkpoint";

// ─────────────────────────────────────────────────────
// 15 Question Subtypes
// ─────────────────────────────────────────────────────

export type QuestionType =
  | "mcq"
  | "mcaq"
  | "true-false"
  | "numerical"
  | "text"
  | "paragraph"
  | "code"
  | "fill-blanks"
  | "fill-blanks-dd"
  | "matching"
  | "jumbled"
  | "audio"
  | "image_evaluation"
  | "group-options"
  | "chat_agent_question";

/** Auto-evaluatable question types (no AI needed) */
export const AUTO_EVALUATABLE_TYPES: QuestionType[] = [
  "mcq",
  "mcaq",
  "true-false",
  "numerical",
  "fill-blanks",
  "fill-blanks-dd",
  "matching",
  "jumbled",
  "group-options",
];

/** AI-evaluatable question types */
export const AI_EVALUATABLE_TYPES: QuestionType[] = [
  "text",
  "paragraph",
  "code",
  "audio",
  "image_evaluation",
  "chat_agent_question",
];

// ── Question type-specific data ──────────────────────

export interface MCQOption {
  id: string;
  text: string;
  isCorrect: boolean;
  explanation?: string;
  imageUrl?: string;
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
  referenceImageUrls?: string[];
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

// ── Question payload ─────────────────────────────────

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

// ─────────────────────────────────────────────────────
// 7 Material Subtypes
// ─────────────────────────────────────────────────────

export type MaterialType = "text" | "video" | "pdf" | "link" | "interactive" | "story" | "rich";

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

// ─────────────────────────────────────────────────────
// Other Payload Types
// ─────────────────────────────────────────────────────

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
  dueDate?: FirestoreTimestamp;
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

// ─────────────────────────────────────────────────────
// UnifiedItem
// ─────────────────────────────────────────────────────

/**
 * Media attachment on a learning item (images, PDFs, audio).
 */
export interface ItemAttachment {
  id: string;
  fileName: string;
  url: string;
  type: "image" | "pdf" | "audio";
  size: number;
  mimeType: string;
}

/**
 * The canonical content atom for the platform.
 * Used by LevelUp for digital learning content and optionally
 * linked from AutoGrade ExamQuestion via linkedItemId.
 */
export interface UnifiedItem {
  id: string;
  spaceId: string;
  storyPointId: string;
  sectionId?: string;
  tenantId: string;

  // Type system
  type: ItemType;
  payload: ItemPayload;

  // Display
  title?: string;
  content?: string;

  // Classification
  difficulty?: "easy" | "medium" | "hard";
  topics?: string[];
  labels?: string[];

  // Ordering
  orderIndex: number;

  // Metadata
  meta?: ItemMetadata;

  // Analytics dimensions
  analytics?: ItemAnalytics;

  // Rubric (item-level, overrides storyPoint default)
  rubric?: UnifiedRubric;

  // Cross-domain linkage
  linkedQuestionId?: string;

  // Media attachments
  attachments?: ItemAttachment[];

  // Versioning
  version?: number;

  // Audit
  createdBy?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}
