/**
 * The two-level item payload union (REVIEW top-risk #3). Top-level discriminant is
 * the item `type` (7 ITEM_TYPES); the `question` member embeds the nested
 * `questionType` discriminated union, `material` embeds the `materialType` union.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import {
  zMaterialType,
  zInteractiveType,
  zItemAssessmentType,
  zDiscussionThreadType,
} from "../../enums/content.js";
import { QuestionTypeDataSchema } from "./question-payload.js";

// --- question --------------------------------------------------------------
const QuestionPayloadSchema = zObject({
  type: z.literal("question"),
  basePoints: z.number().optional(),
  explanation: z.string().optional(),
  questionData: QuestionTypeDataSchema,
});

// --- material (nested materialType discriminant) ---------------------------
const TextMaterialSchema = zObject({ materialType: z.literal("text"), body: z.string() });
const VideoMaterialSchema = zObject({
  materialType: z.literal("video"),
  url: z.string(),
  durationSeconds: z.number().int().optional(),
});
const PdfMaterialSchema = zObject({ materialType: z.literal("pdf"), url: z.string() });
const LinkMaterialSchema = zObject({
  materialType: z.literal("link"),
  url: z.string(),
  label: z.string().optional(),
});
const InteractiveMaterialSchema = zObject({
  materialType: z.literal("interactive"),
  embedUrl: z.string(),
});
const StoryMaterialSchema = zObject({
  materialType: z.literal("story"),
  slides: z.array(z.object({ title: z.string().optional(), body: z.string() }).strict()),
});
const RichMaterialSchema = zObject({
  materialType: z.literal("rich"),
  blocks: z.array(z.unknown()),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  coverImage: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: zObject({
    name: z.string(),
    avatar: z.string().optional(),
    bio: z.string().optional(),
  }).optional(),
  readingTime: z.number().nonnegative().optional(),
});

const MaterialDataSchema = z.discriminatedUnion("materialType", [
  TextMaterialSchema,
  VideoMaterialSchema,
  PdfMaterialSchema,
  LinkMaterialSchema,
  InteractiveMaterialSchema,
  StoryMaterialSchema,
  RichMaterialSchema,
]);

const MaterialPayloadSchema = zObject({
  type: z.literal("material"),
  materialData: MaterialDataSchema,
});

// --- interactive -----------------------------------------------------------
const InteractivePayloadSchema = zObject({
  type: z.literal("interactive"),
  interactiveType: zInteractiveType,
  config: z.record(z.string(), z.unknown()).optional(),
  embedUrl: z.string().optional(),
});

// --- assessment ------------------------------------------------------------
const AssessmentPayloadSchema = zObject({
  type: z.literal("assessment"),
  assessmentType: zItemAssessmentType,
  durationMinutes: z.number().int().optional(),
  passingPercentage: z.number().optional(),
});

// --- discussion ------------------------------------------------------------
const DiscussionPayloadSchema = zObject({
  type: z.literal("discussion"),
  threadType: zDiscussionThreadType,
  prompt: z.string(),
});

// --- project ---------------------------------------------------------------
const ProjectPayloadSchema = zObject({
  type: z.literal("project"),
  brief: z.string(),
  deliverables: z.array(z.string()).optional(),
  rubricDriven: z.boolean().optional(),
});

// --- checkpoint ------------------------------------------------------------
const CheckpointPayloadSchema = zObject({
  type: z.literal("checkpoint"),
  message: z.string().optional(),
  requiresAcknowledgement: z.boolean().optional(),
});

export const ItemPayloadSchema = z.discriminatedUnion("type", [
  QuestionPayloadSchema,
  MaterialPayloadSchema,
  InteractivePayloadSchema,
  AssessmentPayloadSchema,
  DiscussionPayloadSchema,
  ProjectPayloadSchema,
  CheckpointPayloadSchema,
]);
export type ItemPayload = z.infer<typeof ItemPayloadSchema>;

// Re-export the material union for consumers that need just material shapes.
export { zMaterialType };
