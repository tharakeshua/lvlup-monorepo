import { zEnum } from "./enum.js";

// 7 top-level item types.
export const ITEM_TYPES = [
  "question",
  "material",
  "interactive",
  "assessment",
  "discussion",
  "project",
  "checkpoint",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const zItemType = zEnum(ITEM_TYPES);

// Alias retained for the domain-core naming (ITEM_KINDS).
export const ITEM_KINDS = ITEM_TYPES;
export type ItemKind = ItemType;

// 15 question subtypes.
export const QUESTION_TYPES = [
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
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];
export const zQuestionType = zEnum(QUESTION_TYPES);

export const AUTO_EVALUATABLE_TYPES = [
  "mcq",
  "mcaq",
  "true-false",
  "numerical",
  "fill-blanks",
  "fill-blanks-dd",
  "matching",
  "jumbled",
  "group-options",
] as const satisfies readonly QuestionType[];

export const AI_EVALUATABLE_TYPES = [
  "text",
  "paragraph",
  "code",
  "audio",
  "image_evaluation",
  "chat_agent_question",
] as const satisfies readonly QuestionType[];

// 7 material subtypes.
export const MATERIAL_TYPES = [
  "text",
  "video",
  "pdf",
  "link",
  "interactive",
  "story",
  "rich",
] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];
export const zMaterialType = zEnum(MATERIAL_TYPES);

export const INTERACTIVE_TYPES = ["simulation", "demo", "tool", "game"] as const;
export type InteractiveType = (typeof INTERACTIVE_TYPES)[number];
export const zInteractiveType = zEnum(INTERACTIVE_TYPES);

export const ITEM_ASSESSMENT_TYPES = ["quiz", "exam", "project", "peer_review"] as const;
export type ItemAssessmentType = (typeof ITEM_ASSESSMENT_TYPES)[number];
export const zItemAssessmentType = zEnum(ITEM_ASSESSMENT_TYPES);

// 4 story point types — synonym `test` dropped (be-levelup §4.2).
export const STORY_POINT_TYPES = ["standard", "timed_test", "quiz", "practice"] as const;
export type StoryPointType = (typeof STORY_POINT_TYPES)[number];
export const zStoryPointType = zEnum(STORY_POINT_TYPES);

export const RICH_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "image",
  "video",
  "audio",
  "code",
  "quote",
  "list",
  "divider",
] as const;
export type RichBlockType = (typeof RICH_BLOCK_TYPES)[number];
export const zRichBlockType = zEnum(RICH_BLOCK_TYPES);

export const DISCUSSION_THREAD_TYPES = ["open", "guided"] as const;
export type DiscussionThreadType = (typeof DISCUSSION_THREAD_TYPES)[number];
export const zDiscussionThreadType = zEnum(DISCUSSION_THREAD_TYPES);

export const ITEM_ATTACHMENT_TYPES = ["image", "pdf", "audio"] as const;
export type ItemAttachmentType = (typeof ITEM_ATTACHMENT_TYPES)[number];
export const zItemAttachmentType = zEnum(ITEM_ATTACHMENT_TYPES);

// Rubric scoring + presets + chat + agents.
export const RUBRIC_SCORING_MODES = [
  "criteria_based",
  "dimension_based",
  "holistic",
  "hybrid",
] as const;
export type RubricScoringMode = (typeof RUBRIC_SCORING_MODES)[number];
export const zRubricScoringMode = zEnum(RUBRIC_SCORING_MODES);

export const DIMENSION_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export type DimensionPriority = (typeof DIMENSION_PRIORITIES)[number];
export const zDimensionPriority = zEnum(DIMENSION_PRIORITIES);

export const FEEDBACK_SEVERITIES = ["critical", "major", "minor"] as const;
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number];
export const zFeedbackSeverity = zEnum(FEEDBACK_SEVERITIES);

export const MISTAKE_CLASSIFICATIONS = [
  "Conceptual",
  "Silly Error",
  "Knowledge Gap",
  "None",
] as const;
export type MistakeClassification = (typeof MISTAKE_CLASSIFICATIONS)[number];
export const zMistakeClassification = zEnum(MISTAKE_CLASSIFICATIONS);

export const RUBRIC_PRESET_CATEGORIES = [
  "general",
  "coding",
  "essay",
  "math",
  "science",
  "language",
  "custom",
] as const;
export type RubricPresetCategory = (typeof RUBRIC_PRESET_CATEGORIES)[number];
export const zRubricPresetCategory = zEnum(RUBRIC_PRESET_CATEGORIES);

export const AGENT_TYPES = ["tutor", "evaluator"] as const;
export type AgentType = (typeof AGENT_TYPES)[number];
export const zAgentType = zEnum(AGENT_TYPES);

export const CHAT_MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];
export const zChatMessageRole = zEnum(CHAT_MESSAGE_ROLES);

export const CONTENT_VERSION_ENTITY_TYPES = ["space", "storyPoint", "item"] as const;
export type ContentVersionEntityType = (typeof CONTENT_VERSION_ENTITY_TYPES)[number];
export const zContentVersionEntityType = zEnum(CONTENT_VERSION_ENTITY_TYPES);

export const CONTENT_CHANGE_TYPES = ["created", "updated", "published", "archived"] as const;
export type ContentChangeType = (typeof CONTENT_CHANGE_TYPES)[number];
export const zContentChangeType = zEnum(CONTENT_CHANGE_TYPES);

export const PURCHASE_STATUSES = ["completed", "failed", "pending"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export const zPurchaseStatus = zEnum(PURCHASE_STATUSES);
