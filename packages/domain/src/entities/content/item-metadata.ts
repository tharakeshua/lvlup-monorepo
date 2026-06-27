/**
 * ItemMetadata + ItemAnalytics — embedded value objects on UnifiedItem.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";
import { zAgentId } from "../../primitives/branded-id.zod.js";
import { zBloomsLevel } from "../../enums/grading.js";

export const PyqInfoSchema = zObject({
  year: z.number().int(),
  examName: z.string(),
  marks: z.number().optional(),
});
export type PyqInfo = z.infer<typeof PyqInfoSchema>;

export const ItemMetadataSchema = zObject({
  totalPoints: z.number().optional(),
  maxMarks: z.number().optional(),
  estimatedTime: z.number().optional(),
  learningObjectives: z.array(z.string()).optional(),
  skillsAssessed: z.array(z.string()).optional(),
  bloomsLevel: zBloomsLevel.optional(),
  prerequisites: z.array(z.string()).optional(),
  isRetriable: z.boolean().optional(),
  evaluatorAgentId: zAgentId.optional(),
  pyqInfo: z.array(PyqInfoSchema).optional(),
  featured: z.boolean().optional(),
  viewCount: z.number().int().optional(),
  successRate: z.number().optional(),
  migrationSource: z.string().optional(),
});
export type ItemMetadata = z.infer<typeof ItemMetadataSchema>;

export const ItemAnalyticsSchema = zObject({
  difficulty: z.number().optional(),
  topics: z.array(z.string()).optional(),
  cognitiveLoad: z.number().optional(),
  conceptImportance: z.number().optional(),
  attemptCount: z.number().int().optional(),
  averageScore: z.number().optional(),
});
export type ItemAnalytics = z.infer<typeof ItemAnalyticsSchema>;
