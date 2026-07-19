/**
 * `QUESTION_TYPE_REGISTRY` — THE single source of truth for question types
 * (DP-2 Part A / SDK-RR-T2 §A). One entry per type carries its `prompt`, `answer`,
 * and `learnerAnswer` schemas plus its `evaluation` mode, `label`, and a minimal
 * `sample()`. Everything else — the `QuestionType` enum, `zQuestionType`, the three
 * discriminated unions, the AUTO/AI grading arrays, and the test fixture — is
 * DERIVED from this one list (see below + `enums/content.ts`). Adding a 16th type
 * is a single entry; omitting any field is a compile error via `satisfies`.
 *
 * DP-3 DEFERRAL: the `prompt` schemas STILL carry answer-bearing fields (isCorrect,
 * correctAnswer, modelAnswer, correctOrder, …) exactly as before — DP-3 will later
 * swap them for answer-free prompts. The registry only RE-HOMES them so that swap
 * becomes a one-place edit; it does not change their shape today.
 */
import { z } from "zod";
import { zObject } from "../../../authoring/strict.js";
import {
  AgentAssessmentAnswerKeyDataSchema,
  AgentAssessmentLearnerAnswerSchema,
  AgentAssessmentQuestionPromptSchema,
} from "../../levelup/conversation-assessment.js";

export type GradingMode = "auto" | "ai";

export interface QuestionTypeSpec {
  /** Prompt schema (carries `questionType: z.literal(<key>)`). Answer-bearing for now (DP-3). */
  prompt: z.ZodTypeAny;
  /** Typed correct-answer schema (the AnswerKeyData member; LD-02). */
  answer: z.ZodTypeAny;
  /** Typed learner-submitted-answer schema. */
  learnerAnswer: z.ZodTypeAny;
  /** Replaces the AUTO_/AI_ arrays with ONE source. */
  evaluation: GradingMode;
  /** Human label (admin UI, content tooling). */
  label: string;
  /** Minimal valid PROMPT payload — replaces the test's `minimalQuestionData` switch. */
  sample: () => Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

export const McqOptionSchema = zObject({
  id: z.string(),
  text: z.string(),
  imageUrl: z.string().optional(),
  explanation: z.string().optional(),
  // ⚷ stripped into AnswerKey server-side for non-authoring reads.
  isCorrect: z.boolean().optional(),
});
export type McqOption = z.infer<typeof McqOptionSchema>;

const BlankSlotSchema = zObject({
  id: z.string(),
  correctAnswer: z.string().optional(),
  acceptableAnswers: z.array(z.string()).optional(),
});

const MatchPairPromptSchema = zObject({ left: z.string(), right: z.string().optional() });
const MatchPairAnswerSchema = zObject({ left: z.string(), right: z.string() });

const GroupOptionItemSchema = zObject({
  id: z.string(),
  text: z.string(),
  group: z.string().optional(),
});

// ---------------------------------------------------------------------------
// PROMPT schemas — the EXISTING per-type shapes, re-homed here (DP-3 will strip).
// ---------------------------------------------------------------------------

const McqPrompt = zObject({
  questionType: z.literal("mcq"),
  options: z.array(McqOptionSchema),
  shuffleOptions: z.boolean().optional(),
});
const McaqPrompt = zObject({
  questionType: z.literal("mcaq"),
  options: z.array(McqOptionSchema),
  shuffleOptions: z.boolean().optional(),
  minSelections: z.number().int().optional(),
  maxSelections: z.number().int().optional(),
});
const TrueFalsePrompt = zObject({
  questionType: z.literal("true-false"),
  correctAnswer: z.boolean().optional(),
  explanation: z.string().optional(),
});
const NumericalPrompt = zObject({
  questionType: z.literal("numerical"),
  correctAnswer: z.number().optional(),
  tolerance: z.number().optional(),
  unit: z.string().optional(),
  decimalPlaces: z.number().int().nonnegative().optional(),
});
const TextPrompt = zObject({
  questionType: z.literal("text"),
  maxLength: z.number().int().optional(),
  modelAnswer: z.string().optional(),
  acceptableAnswers: z.array(z.string()).optional(),
  caseSensitive: z.boolean().optional(),
});
const ParagraphPrompt = zObject({
  questionType: z.literal("paragraph"),
  minWords: z.number().int().optional(),
  maxWords: z.number().int().optional(),
  modelAnswer: z.string().optional(),
  evaluationGuidance: z.string().optional(),
});
const CodePrompt = zObject({
  questionType: z.literal("code"),
  language: z.string().optional(),
  starterCode: z.string().optional(),
  modelAnswer: z.string().optional(),
  testCases: z.array(z.object({ input: z.string(), output: z.string() }).strict()).optional(),
});
const FillBlanksPrompt = zObject({
  questionType: z.literal("fill-blanks"),
  template: z.string(),
  blanks: z.array(BlankSlotSchema),
});
const FillBlanksDdPrompt = zObject({
  questionType: z.literal("fill-blanks-dd"),
  template: z.string(),
  blanks: z.array(BlankSlotSchema),
  optionPool: z.array(z.string()),
});
const MatchingPrompt = zObject({
  questionType: z.literal("matching"),
  pairs: z.array(MatchPairPromptSchema),
  shufflePairs: z.boolean().optional(),
});
const JumbledPrompt = zObject({
  questionType: z.literal("jumbled"),
  tokens: z.array(z.string()),
  correctOrder: z.array(z.number().int()).optional(),
});
const AudioPrompt = zObject({
  questionType: z.literal("audio"),
  promptAudioUrl: z.string().optional(),
  maxDurationSeconds: z.number().int().optional(),
  language: z.string().optional(),
  modelAnswer: z.string().optional(),
  evaluationGuidance: z.string().optional(),
});
const ImageEvaluationPrompt = zObject({
  questionType: z.literal("image_evaluation"),
  referenceImageUrls: z.array(z.string()).optional(),
  instructions: z.string().optional(),
  maxImages: z.number().int().positive().optional(),
  modelAnswer: z.string().optional(),
  evaluationGuidance: z.string().optional(),
});
const GroupOptionsPrompt = zObject({
  questionType: z.literal("group-options"),
  groups: z.array(z.string()),
  items: z.array(GroupOptionItemSchema),
});
// Lossless public assessment authoring. Private objectives/guidance live in
// AnswerKey, and a learner can only submit a server-owned session reference.
const ChatAgentQuestionPrompt = AgentAssessmentQuestionPromptSchema;

// ---------------------------------------------------------------------------
// ANSWER schemas — the typed correct-answer (AnswerKeyData) per type.
// ---------------------------------------------------------------------------

const McqAnswer = zObject({
  questionType: z.literal("mcq"),
  correctOptionIds: z.array(z.string()),
});
const McaqAnswer = zObject({
  questionType: z.literal("mcaq"),
  correctOptionIds: z.array(z.string()),
});
const TrueFalseAnswer = zObject({
  questionType: z.literal("true-false"),
  correctAnswer: z.boolean(),
});
const NumericalAnswer = zObject({
  questionType: z.literal("numerical"),
  value: z.number(),
  tolerance: z.number().optional(),
  unit: z.string().optional(),
});
const TextAnswer = zObject({
  questionType: z.literal("text"),
  modelAnswer: z.string().optional(),
  acceptableAnswers: z.array(z.string()).optional(),
});
const ParagraphAnswer = zObject({
  questionType: z.literal("paragraph"),
  modelAnswer: z.string().optional(),
});
const CodeAnswer = zObject({
  questionType: z.literal("code"),
  modelAnswer: z.string().optional(),
  testCases: z.array(z.object({ input: z.string(), output: z.string() }).strict()).optional(),
});
const FillBlanksAnswer = zObject({
  questionType: z.literal("fill-blanks"),
  blanks: z.array(BlankSlotSchema),
});
const FillBlanksDdAnswer = zObject({
  questionType: z.literal("fill-blanks-dd"),
  blanks: z.array(BlankSlotSchema),
});
const MatchingAnswer = zObject({
  questionType: z.literal("matching"),
  pairs: z.array(MatchPairAnswerSchema),
});
const JumbledAnswer = zObject({
  questionType: z.literal("jumbled"),
  correctOrder: z.array(z.number().int()),
});
const AudioAnswer = zObject({
  questionType: z.literal("audio"),
  modelAnswer: z.string().optional(),
});
const ImageEvaluationAnswer = zObject({
  questionType: z.literal("image_evaluation"),
  modelAnswer: z.string().optional(),
});
const GroupOptionsAnswer = zObject({
  questionType: z.literal("group-options"),
  assignments: z.array(zObject({ itemId: z.string(), group: z.string() })),
});
const ChatAgentQuestionAnswer = AgentAssessmentAnswerKeyDataSchema;

// ---------------------------------------------------------------------------
// LEARNER-ANSWER schemas — the typed learner submission per type.
// ---------------------------------------------------------------------------

const McqLearner = zObject({
  questionType: z.literal("mcq"),
  selectedOptionIds: z.array(z.string()),
});
const McaqLearner = zObject({
  questionType: z.literal("mcaq"),
  selectedOptionIds: z.array(z.string()),
});
const TrueFalseLearner = zObject({ questionType: z.literal("true-false"), answer: z.boolean() });
const NumericalLearner = zObject({ questionType: z.literal("numerical"), value: z.number() });
const TextLearner = zObject({ questionType: z.literal("text"), text: z.string() });
const ParagraphLearner = zObject({ questionType: z.literal("paragraph"), text: z.string() });
const CodeLearner = zObject({
  questionType: z.literal("code"),
  code: z.string(),
  language: z.string().optional(),
});
const FillBlanksLearner = zObject({
  questionType: z.literal("fill-blanks"),
  answers: z.array(zObject({ id: z.string(), value: z.string() })),
});
const FillBlanksDdLearner = zObject({
  questionType: z.literal("fill-blanks-dd"),
  answers: z.array(zObject({ id: z.string(), value: z.string() })),
});
const MatchingLearner = zObject({
  questionType: z.literal("matching"),
  matches: z.array(MatchPairAnswerSchema),
});
const JumbledLearner = zObject({
  questionType: z.literal("jumbled"),
  order: z.array(z.number().int()),
});
const AudioLearner = zObject({ questionType: z.literal("audio"), audioUrl: z.string() });
const ImageEvaluationLearner = zObject({
  questionType: z.literal("image_evaluation"),
  imageUrls: z.array(z.string()),
});
const GroupOptionsLearner = zObject({
  questionType: z.literal("group-options"),
  assignments: z.array(zObject({ itemId: z.string(), group: z.string() })),
});
const ChatAgentQuestionLearner = AgentAssessmentLearnerAnswerSchema;

// ---------------------------------------------------------------------------
// THE registry — one entry per question type. THIS is the SSOT.
// ---------------------------------------------------------------------------

export const QUESTION_TYPE_REGISTRY = {
  mcq: {
    prompt: McqPrompt,
    answer: McqAnswer,
    learnerAnswer: McqLearner,
    evaluation: "auto",
    label: "Multiple choice",
    sample: () => ({ questionType: "mcq", options: [{ id: "a", text: "A" }] }),
  },
  mcaq: {
    prompt: McaqPrompt,
    answer: McaqAnswer,
    learnerAnswer: McaqLearner,
    evaluation: "auto",
    label: "Multiple correct answers",
    sample: () => ({ questionType: "mcaq", options: [{ id: "a", text: "A" }] }),
  },
  "true-false": {
    prompt: TrueFalsePrompt,
    answer: TrueFalseAnswer,
    learnerAnswer: TrueFalseLearner,
    evaluation: "auto",
    label: "True / false",
    sample: () => ({ questionType: "true-false" }),
  },
  numerical: {
    prompt: NumericalPrompt,
    answer: NumericalAnswer,
    learnerAnswer: NumericalLearner,
    evaluation: "auto",
    label: "Numerical",
    sample: () => ({ questionType: "numerical" }),
  },
  text: {
    prompt: TextPrompt,
    answer: TextAnswer,
    learnerAnswer: TextLearner,
    evaluation: "ai",
    label: "Short answer",
    sample: () => ({ questionType: "text" }),
  },
  paragraph: {
    prompt: ParagraphPrompt,
    answer: ParagraphAnswer,
    learnerAnswer: ParagraphLearner,
    evaluation: "ai",
    label: "Long answer",
    sample: () => ({ questionType: "paragraph" }),
  },
  code: {
    prompt: CodePrompt,
    answer: CodeAnswer,
    learnerAnswer: CodeLearner,
    evaluation: "ai",
    label: "Code",
    sample: () => ({ questionType: "code" }),
  },
  "fill-blanks": {
    prompt: FillBlanksPrompt,
    answer: FillBlanksAnswer,
    learnerAnswer: FillBlanksLearner,
    evaluation: "auto",
    label: "Fill in the blanks",
    sample: () => ({ questionType: "fill-blanks", template: "__", blanks: [{ id: "b1" }] }),
  },
  "fill-blanks-dd": {
    prompt: FillBlanksDdPrompt,
    answer: FillBlanksDdAnswer,
    learnerAnswer: FillBlanksDdLearner,
    evaluation: "auto",
    label: "Fill in the blanks (drag & drop)",
    sample: () => ({
      questionType: "fill-blanks-dd",
      template: "__",
      blanks: [{ id: "b1" }],
      optionPool: ["x"],
    }),
  },
  matching: {
    prompt: MatchingPrompt,
    answer: MatchingAnswer,
    learnerAnswer: MatchingLearner,
    evaluation: "auto",
    label: "Matching",
    sample: () => ({ questionType: "matching", pairs: [{ left: "l", right: "r" }] }),
  },
  jumbled: {
    prompt: JumbledPrompt,
    answer: JumbledAnswer,
    learnerAnswer: JumbledLearner,
    evaluation: "auto",
    label: "Reorder",
    sample: () => ({ questionType: "jumbled", tokens: ["a", "b"] }),
  },
  audio: {
    prompt: AudioPrompt,
    answer: AudioAnswer,
    learnerAnswer: AudioLearner,
    evaluation: "ai",
    label: "Audio response",
    sample: () => ({ questionType: "audio" }),
  },
  image_evaluation: {
    prompt: ImageEvaluationPrompt,
    answer: ImageEvaluationAnswer,
    learnerAnswer: ImageEvaluationLearner,
    evaluation: "ai",
    label: "Image evaluation",
    sample: () => ({ questionType: "image_evaluation" }),
  },
  "group-options": {
    prompt: GroupOptionsPrompt,
    answer: GroupOptionsAnswer,
    learnerAnswer: GroupOptionsLearner,
    evaluation: "auto",
    label: "Group options",
    sample: () => ({
      questionType: "group-options",
      groups: ["g"],
      items: [{ id: "i", text: "I" }],
    }),
  },
  chat_agent_question: {
    prompt: ChatAgentQuestionPrompt,
    answer: ChatAgentQuestionAnswer,
    learnerAnswer: ChatAgentQuestionLearner,
    evaluation: "ai",
    label: "Chat-agent question",
    sample: () => ({
      questionType: "chat_agent_question",
      scenario: "Discuss the trade-offs in this approach.",
      publicLearningObjectives: [{ id: "objective_1", label: "Explain the trade-off" }],
      interviewerAgentId: "agent_interviewer",
      completionPolicy: {
        minLearnerTurns: 1,
        maxLearnerTurns: 4,
        allowEarlyFinish: true,
        hardLimitAction: "auto_finalize",
      },
    }),
  },
} as const satisfies Record<string, QuestionTypeSpec>;

/** The question-type literal union — the registry IS the SSOT. */
export type QuestionType = keyof typeof QUESTION_TYPE_REGISTRY;

// ---------------------------------------------------------------------------
// DERIVATIONS — everything below regenerates from the one list above.
// ---------------------------------------------------------------------------

/** All question-type keys, in registry order. */
export const QUESTION_TYPES = Object.keys(QUESTION_TYPE_REGISTRY) as QuestionType[];

/** Zod enum over the registry keys. */
export const zQuestionType = z.enum(QUESTION_TYPES as [QuestionType, ...QuestionType[]]);

/**
 * The EXISTING question-data discriminated union, now DERIVED from the registry's
 * `prompt` column (was hand-authored). DP-2 is BEHAVIOR-PRESERVING on the answer
 * axis: this is the ONLY question union the public surface exposes — the same
 * `QuestionTypeDataSchema` as before, structurally identical, only its source
 * changes from a hand-listed tuple to `QUESTION_TYPES.map(...)`. The per-entry
 * `answer`/`learnerAnswer` schemas stay INERT metadata (declared for DP-3, wired
 * into NO exported schema/validator here).
 *
 * Zod's `discriminatedUnion` requires a NON-EMPTY TUPLE; `.map()` yields an array,
 * so the one-line tuple cast is the single sanctioned residual (DP-2 §C) — runtime
 * is fully correct (Zod reads the `questionType` literal off each member). The cast
 * targets a tuple of the REGISTRY-DERIVED member type (`PromptOption`), so the
 * inferred output stays the precise per-type union — `QuestionTypeData` is
 * structurally identical to the pre-DP-2 hand-authored union.
 */
type PromptOption = (typeof QUESTION_TYPE_REGISTRY)[QuestionType]["prompt"];
const promptMembers = QUESTION_TYPES.map((t) => QUESTION_TYPE_REGISTRY[t].prompt) as unknown as [
  PromptOption,
  ...PromptOption[],
];

export const QuestionTypeDataSchema = z.discriminatedUnion("questionType", promptMembers);
export type QuestionTypeData = z.infer<typeof QuestionTypeDataSchema>;

/** Grading classification — ONE source replaces the AUTO_/AI_ arrays. */
export const AUTO_EVALUATABLE_TYPES = QUESTION_TYPES.filter(
  (t) => QUESTION_TYPE_REGISTRY[t].evaluation === "auto"
);
export const AI_EVALUATABLE_TYPES = QUESTION_TYPES.filter(
  (t) => QUESTION_TYPE_REGISTRY[t].evaluation === "ai"
);

/** Minimal valid PROMPT payload for a type — replaces the test's per-type switch. */
export const minimalQuestionData = (qt: QuestionType): Record<string, unknown> =>
  QUESTION_TYPE_REGISTRY[qt].sample();
