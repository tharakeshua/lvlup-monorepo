/**
 * The 15 question-type payloads — a REAL z.discriminatedUnion on `questionType`
 * (REVIEW top-risk #3 / be-levelup §4.3). Answer-bearing fields (`isCorrect`,
 * `correctAnswer`, `modelAnswer`, `correctOrder`, …) are stripped server-side into
 * the AnswerKey; the client never receives them through getItem/listItems.
 */
import { z } from "zod";
import { zObject } from "../../authoring/strict.js";

export const McqOptionSchema = zObject({
  id: z.string(),
  text: z.string(),
  imageUrl: z.string().optional(),
  // ⚷ stripped into AnswerKey server-side for non-authoring reads.
  isCorrect: z.boolean().optional(),
});
export type McqOption = z.infer<typeof McqOptionSchema>;

const McqDataSchema = zObject({
  questionType: z.literal("mcq"),
  options: z.array(McqOptionSchema),
  shuffleOptions: z.boolean().optional(),
});

const McaqDataSchema = zObject({
  questionType: z.literal("mcaq"),
  options: z.array(McqOptionSchema),
  shuffleOptions: z.boolean().optional(),
  minSelections: z.number().int().optional(),
  maxSelections: z.number().int().optional(),
});

const TrueFalseDataSchema = zObject({
  questionType: z.literal("true-false"),
  correctAnswer: z.boolean().optional(),
});

const NumericalDataSchema = zObject({
  questionType: z.literal("numerical"),
  correctAnswer: z.number().optional(),
  tolerance: z.number().optional(),
  unit: z.string().optional(),
});

const TextDataSchema = zObject({
  questionType: z.literal("text"),
  maxLength: z.number().int().optional(),
  modelAnswer: z.string().optional(),
});

const ParagraphDataSchema = zObject({
  questionType: z.literal("paragraph"),
  minWords: z.number().int().optional(),
  maxWords: z.number().int().optional(),
  modelAnswer: z.string().optional(),
});

const CodeDataSchema = zObject({
  questionType: z.literal("code"),
  language: z.string().optional(),
  starterCode: z.string().optional(),
  modelAnswer: z.string().optional(),
  testCases: z.array(z.object({ input: z.string(), output: z.string() }).strict()).optional(),
});

const BlankSlotSchema = zObject({
  id: z.string(),
  correctAnswer: z.string().optional(),
  acceptableAnswers: z.array(z.string()).optional(),
});

const FillBlanksDataSchema = zObject({
  questionType: z.literal("fill-blanks"),
  template: z.string(),
  blanks: z.array(BlankSlotSchema),
});

const FillBlanksDdSchema = zObject({
  questionType: z.literal("fill-blanks-dd"),
  template: z.string(),
  blanks: z.array(BlankSlotSchema),
  optionPool: z.array(z.string()),
});

const MatchPairSchema = zObject({
  left: z.string(),
  right: z.string(),
});

const MatchingDataSchema = zObject({
  questionType: z.literal("matching"),
  pairs: z.array(MatchPairSchema),
  shufflePairs: z.boolean().optional(),
});

const JumbledDataSchema = zObject({
  questionType: z.literal("jumbled"),
  tokens: z.array(z.string()),
  correctOrder: z.array(z.number().int()).optional(),
});

const AudioDataSchema = zObject({
  questionType: z.literal("audio"),
  promptAudioUrl: z.string().optional(),
  maxDurationSeconds: z.number().int().optional(),
  modelAnswer: z.string().optional(),
});

const ImageEvaluationDataSchema = zObject({
  questionType: z.literal("image_evaluation"),
  referenceImageUrls: z.array(z.string()).optional(),
  modelAnswer: z.string().optional(),
});

const GroupOptionItemSchema = zObject({
  id: z.string(),
  text: z.string(),
  group: z.string().optional(),
});

const GroupOptionsDataSchema = zObject({
  questionType: z.literal("group-options"),
  groups: z.array(z.string()),
  items: z.array(GroupOptionItemSchema),
});

const ChatAgentQuestionDataSchema = zObject({
  questionType: z.literal("chat_agent_question"),
  agentInstructions: z.string().optional(),
  maxTurns: z.number().int().optional(),
  modelAnswer: z.string().optional(),
});

export const QuestionTypeDataSchema = z.discriminatedUnion("questionType", [
  McqDataSchema,
  McaqDataSchema,
  TrueFalseDataSchema,
  NumericalDataSchema,
  TextDataSchema,
  ParagraphDataSchema,
  CodeDataSchema,
  FillBlanksDataSchema,
  FillBlanksDdSchema,
  MatchingDataSchema,
  JumbledDataSchema,
  AudioDataSchema,
  ImageEvaluationDataSchema,
  GroupOptionsDataSchema,
  ChatAgentQuestionDataSchema,
]);
export type QuestionTypeData = z.infer<typeof QuestionTypeDataSchema>;
