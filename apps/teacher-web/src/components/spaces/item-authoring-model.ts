import type {
  AudioData,
  ChatAgentQuestionData,
  CodeData,
  FillBlanksData,
  FillBlanksDDData,
  GroupOptionsData,
  ImageEvaluationData,
  ItemAttachment,
  JumbledData,
  MatchingData,
  MaterialPayload,
  MaterialType,
  MCAQData,
  MCQData,
  NumericalData,
  ParagraphData,
  QuestionPayload,
  QuestionType,
  QuestionTypeData,
  TextData,
  TrueFalseData,
} from "@levelup/shared-types";

/**
 * Local authoring overlay until shared legacy UI types are retired. The editor
 * always writes the canonical public/private split; old `objectives`/`maxTurns`
 * fields are intentionally not used as a persistence adapter.
 */
export type ChatAgentAuthoringData = ChatAgentQuestionData & {
  scenario?: string;
  publicLearningObjectives?: Array<{ id: string; label: string }>;
  interviewerAgentId?: string;
  completionPolicy?: {
    minLearnerTurns: number;
    maxLearnerTurns: number;
    allowEarlyFinish: boolean;
    hardLimitAction: "auto_finalize";
  };
  modelAnswer?: string;
  privateEvaluationObjectives?: Array<{
    id: string;
    rubricDimensionId: string;
    description: string;
    evidenceRequirement?: string;
  }>;
};

export const QUESTION_TYPES: ReadonlyArray<{ value: QuestionType; label: string }> = [
  { value: "mcq", label: "Multiple Choice (Single)" },
  { value: "mcaq", label: "Multiple Choice (Multiple)" },
  { value: "true-false", label: "True / False" },
  { value: "numerical", label: "Numerical" },
  { value: "text", label: "Short Text" },
  { value: "paragraph", label: "Paragraph" },
  { value: "code", label: "Code" },
  { value: "fill-blanks", label: "Fill in the Blanks" },
  { value: "fill-blanks-dd", label: "Fill Blanks (Dropdown)" },
  { value: "matching", label: "Matching" },
  { value: "jumbled", label: "Jumbled / Ordering" },
  { value: "audio", label: "Audio Response" },
  { value: "image_evaluation", label: "Image Evaluation" },
  { value: "group-options", label: "Group Options" },
  { value: "chat_agent_question", label: "Chat Agent" },
];

export const MATERIAL_TYPES: ReadonlyArray<{ value: MaterialType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "video", label: "Video" },
  { value: "pdf", label: "PDF" },
  { value: "link", label: "Link" },
  { value: "interactive", label: "Interactive" },
  { value: "story", label: "Story" },
  { value: "rich", label: "Rich Content" },
];

export function isValidItemUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function answerKeyLooksStripped(payload: QuestionPayload): boolean {
  const data = payload.questionData as Partial<QuestionTypeData> | undefined;
  if (!data) return false;

  switch (payload.questionType) {
    case "mcq":
    case "mcaq": {
      const options = (data as MCQData).options ?? [];
      return options.length > 0 && options.every((option) => !option.isCorrect);
    }
    case "true-false":
      return (data as TrueFalseData).correctAnswer === undefined;
    case "numerical":
      return (data as NumericalData).correctAnswer === undefined;
    case "text":
      return !(data as TextData).correctAnswer && !(data as TextData).acceptableAnswers?.length;
    case "fill-blanks": {
      const blanks = (data as FillBlanksData).blanks ?? [];
      return blanks.length > 0 && blanks.every((blank) => !blank.correctAnswer);
    }
    case "fill-blanks-dd": {
      const blanks = (data as FillBlanksDDData).blanks ?? [];
      return blanks.length > 0 && blanks.every((blank) => !blank.correctOptionId);
    }
    case "jumbled": {
      const jumbled = data as JumbledData;
      return Boolean(jumbled.items?.length) && !jumbled.correctOrder?.length;
    }
    case "group-options": {
      const groups = (data as GroupOptionsData).groups ?? [];
      return groups.length > 0 && groups.every((group) => group.correctItems.length === 0);
    }
    default:
      return false;
  }
}

export interface ItemValidationInput {
  title: string;
  content?: string;
  isQuestion: boolean;
  payload: unknown;
  attachments: ItemAttachment[];
}

export function validateItem(input: ItemValidationInput): string[] {
  const errors: string[] = [];
  if (!input.title.trim()) errors.push("Title is required");

  if (!input.isQuestion) {
    const payload = input.payload as MaterialPayload;
    switch (payload.materialType) {
      case "video":
      case "pdf":
      case "link":
        if (!isValidItemUrl(payload.url ?? "")) errors.push("A valid http(s) URL is required");
        break;
      case "interactive":
        if (!isValidItemUrl(payload.url ?? "")) {
          errors.push("Interactive material needs a valid embed URL");
        }
        break;
      case "story":
      case "rich":
        if (!(payload.content ?? "").trim() && !payload.richContent?.blocks?.length) {
          errors.push("Add narrative content or at least one block");
        }
        break;
      case "text":
        if (!(payload.content ?? "").trim()) errors.push("Text content is required");
        break;
    }
    return errors;
  }

  const payload = input.payload as QuestionPayload;
  const data = payload.questionData as Partial<QuestionTypeData> | undefined;
  if (input.content !== undefined && !input.content.trim())
    errors.push("Question content is required");
  if (
    payload.basePoints != null &&
    (!Number.isFinite(payload.basePoints) || payload.basePoints < 0)
  ) {
    errors.push("Base points cannot be negative");
  }
  if (!payload.questionType) errors.push("Question type is required");
  if (!data) {
    errors.push("Question configuration is missing");
    return errors;
  }

  switch (payload.questionType) {
    case "mcq":
    case "mcaq": {
      const options = (data as MCQData).options ?? [];
      const correctCount = options.filter((option) => option.isCorrect).length;
      if (options.length < 2) errors.push("Add at least 2 options");
      if (options.some((option) => !option.text.trim())) errors.push("All options need text");
      if (payload.questionType === "mcq" && correctCount !== 1) {
        errors.push("Mark exactly one option correct");
      }
      if (payload.questionType === "mcaq") {
        if (correctCount < 1) errors.push("Mark at least one option correct");
        const multiple = data as MCAQData;
        const min = multiple.minSelections;
        const max = multiple.maxSelections;
        if (min != null && min < 1) errors.push("Min selections must be at least 1");
        if (max != null && max > options.length) {
          errors.push("Max selections cannot exceed the option count");
        }
        if (min != null && max != null && min > max) {
          errors.push("Min selections cannot exceed max selections");
        }
      }
      break;
    }
    case "true-false":
      if ((data as TrueFalseData).correctAnswer === undefined) errors.push("Pick True or False");
      break;
    case "numerical": {
      const numerical = data as NumericalData;
      if (
        numerical.correctAnswer === undefined ||
        !Number.isFinite(Number(numerical.correctAnswer))
      ) {
        errors.push("Numerical answer is required");
      }
      if ((numerical.tolerance ?? 0) < 0) errors.push("Tolerance cannot be negative");
      if ((numerical.decimalPlaces ?? 0) < 0) errors.push("Decimal places cannot be negative");
      break;
    }
    case "text": {
      const text = data as TextData;
      if (!text.correctAnswer?.trim() && !text.acceptableAnswers?.some((answer) => answer.trim())) {
        errors.push("Provide a correct answer or acceptable answers");
      }
      if ((text.maxLength ?? 1) < 1) errors.push("Max length must be at least 1");
      break;
    }
    case "paragraph": {
      const paragraph = data as ParagraphData;
      if ((paragraph.minLength ?? 0) < 0) errors.push("Minimum length cannot be negative");
      if ((paragraph.maxLength ?? 1) < 1) errors.push("Maximum length must be at least 1");
      if (
        paragraph.minLength != null &&
        paragraph.maxLength != null &&
        paragraph.minLength > paragraph.maxLength
      ) {
        errors.push("Minimum length cannot exceed maximum length");
      }
      break;
    }
    case "code": {
      const code = data as CodeData;
      if (!code.language?.trim()) errors.push("Choose a programming language");
      if (!code.testCases?.length) errors.push("Add at least one test case");
      if (code.testCases?.some((testCase) => !testCase.expectedOutput.trim())) {
        errors.push("All test cases need an expected output");
      }
      break;
    }
    case "fill-blanks": {
      const fill = data as FillBlanksData;
      if (!fill.textWithBlanks?.trim()) errors.push("Enter text with blanks");
      if (!fill.blanks?.length) errors.push("Add at least one blank");
      if (fill.blanks?.some((blank) => !blank.correctAnswer.trim())) {
        errors.push("All blanks need a correct answer");
      }
      break;
    }
    case "fill-blanks-dd": {
      const fill = data as FillBlanksDDData;
      if (!fill.textWithBlanks?.trim()) errors.push("Enter text with blanks");
      if (!fill.blanks?.length) errors.push("Add at least one blank");
      fill.blanks?.forEach((blank, index) => {
        if (!blank.options.length) errors.push(`Blank #${index + 1} needs options`);
        if (blank.options.some((option) => !option.text.trim())) {
          errors.push(`Blank #${index + 1}: all options need text`);
        }
        if (
          !blank.correctOptionId ||
          !blank.options.some((option) => option.id === blank.correctOptionId)
        ) {
          errors.push(`Blank #${index + 1}: pick a valid correct option`);
        }
      });
      break;
    }
    case "matching": {
      const matching = data as MatchingData;
      if ((matching.pairs?.length ?? 0) < 2) errors.push("Add at least 2 matching pairs");
      if (matching.pairs?.some((pair) => !pair.left.trim() || !pair.right.trim())) {
        errors.push("All pairs need left and right text");
      }
      break;
    }
    case "jumbled": {
      const jumbled = data as JumbledData;
      if ((jumbled.items?.length ?? 0) < 2) errors.push("Add at least 2 items to reorder");
      if (jumbled.items?.some((item) => !item.text.trim())) errors.push("All items need text");
      const ids = new Set(jumbled.items?.map((item) => item.id));
      if (
        jumbled.correctOrder?.length !== jumbled.items?.length ||
        jumbled.correctOrder?.some((id) => !ids.has(id))
      ) {
        errors.push("The correct order must include every item exactly once");
      }
      break;
    }
    case "audio":
      if (((data as AudioData).maxDurationSeconds ?? 0) <= 0) {
        errors.push("Max duration must be > 0 seconds");
      }
      break;
    case "image_evaluation": {
      const image = data as ImageEvaluationData;
      if (!image.instructions?.trim()) errors.push("Image-evaluation instructions are required");
      if ((image.maxImages ?? 0) < 1) errors.push("Max images must be at least 1");
      break;
    }
    case "group-options": {
      const grouped = data as GroupOptionsData;
      if ((grouped.groups?.length ?? 0) < 2) errors.push("Add at least 2 groups");
      if ((grouped.items?.length ?? 0) < 2) errors.push("Add at least 2 items");
      if (grouped.items?.some((item) => !item.text.trim())) errors.push("All items need text");
      if (grouped.groups?.some((group) => !group.name.trim()))
        errors.push("All groups need a name");
      const assignments = grouped.groups?.flatMap((group) => group.correctItems) ?? [];
      if (new Set(assignments).size !== grouped.items?.length) {
        errors.push("Assign every item to exactly one group");
      }
      break;
    }
    case "chat_agent_question": {
      const chat = data as ChatAgentAuthoringData;
      if (!chat.scenario?.trim()) errors.push("A scenario is required");
      if (!chat.interviewerAgentId?.trim()) errors.push("Choose an interviewer agent");
      const publicObjectives = chat.publicLearningObjectives ?? [];
      if (!publicObjectives.length) errors.push("Add at least one public learning objective");
      if (publicObjectives.some((objective) => !objective.id.trim() || !objective.label.trim())) {
        errors.push("Every public learning objective needs an ID and label");
      }
      if (
        new Set(publicObjectives.map((objective) => objective.id)).size !== publicObjectives.length
      ) {
        errors.push("Public learning objective IDs must be unique");
      }
      const policy = chat.completionPolicy;
      if (!policy) {
        errors.push("Set an interview completion policy");
      } else if (
        !Number.isInteger(policy.minLearnerTurns) ||
        !Number.isInteger(policy.maxLearnerTurns) ||
        policy.minLearnerTurns < 1 ||
        policy.maxLearnerTurns > 12 ||
        policy.minLearnerTurns > policy.maxLearnerTurns
      ) {
        errors.push("Use 1–12 turns with a minimum no greater than the maximum");
      }
      const privateObjectives = chat.privateEvaluationObjectives ?? [];
      if (!privateObjectives.length) errors.push("Add at least one private evaluation objective");
      if (
        privateObjectives.some(
          (objective) =>
            !objective.id.trim() ||
            !objective.rubricDimensionId.trim() ||
            !objective.description.trim()
        )
      ) {
        errors.push("Every private objective needs an ID, rubric dimension, and description");
      }
      if (
        new Set(privateObjectives.map((objective) => objective.id)).size !==
        privateObjectives.length
      ) {
        errors.push("Private evaluation objective IDs must be unique");
      }
      break;
    }
  }

  return [...new Set(errors)];
}

export function defaultQuestionData(questionType: QuestionType): QuestionTypeData {
  switch (questionType) {
    case "mcq":
      return {
        options: [
          { id: "option_1", text: "", isCorrect: true },
          { id: "option_2", text: "", isCorrect: false },
        ],
        shuffleOptions: false,
      } satisfies MCQData;
    case "mcaq":
      return {
        options: [
          { id: "option_1", text: "", isCorrect: true },
          { id: "option_2", text: "", isCorrect: false },
        ],
        minSelections: 1,
        maxSelections: 2,
        shuffleOptions: false,
      } satisfies MCAQData;
    case "true-false":
      return { correctAnswer: true } satisfies TrueFalseData;
    case "numerical":
      return { correctAnswer: 0, tolerance: 0 } satisfies NumericalData;
    case "text":
      return { correctAnswer: "", maxLength: 500 } satisfies TextData;
    case "paragraph":
      return { maxLength: 5000, minLength: 50 } satisfies ParagraphData;
    case "code":
      return {
        language: "python",
        testCases: [{ id: "case_1", input: "", expectedOutput: "" }],
      } satisfies CodeData;
    case "fill-blanks":
      return {
        textWithBlanks: "The answer is ___1___.",
        blanks: [{ id: "blank_1", correctAnswer: "" }],
      } satisfies FillBlanksData;
    case "fill-blanks-dd":
      return {
        textWithBlanks: "Choose ___1___.",
        blanks: [
          {
            id: "blank_1",
            correctOptionId: "option_1",
            options: [
              { id: "option_1", text: "" },
              { id: "option_2", text: "" },
            ],
          },
        ],
      } satisfies FillBlanksDDData;
    case "matching":
      return {
        pairs: [
          { id: "pair_1", left: "", right: "" },
          { id: "pair_2", left: "", right: "" },
        ],
      } satisfies MatchingData;
    case "jumbled":
      return {
        items: [
          { id: "item_1", text: "" },
          { id: "item_2", text: "" },
        ],
        correctOrder: ["item_1", "item_2"],
      } satisfies JumbledData;
    case "audio":
      return { maxDurationSeconds: 120 } satisfies AudioData;
    case "image_evaluation":
      return { instructions: "", maxImages: 1 } satisfies ImageEvaluationData;
    case "group-options":
      return {
        groups: [
          { id: "group_1", name: "Group 1", correctItems: [] },
          { id: "group_2", name: "Group 2", correctItems: [] },
        ],
        items: [],
      } satisfies GroupOptionsData;
    case "chat_agent_question":
      return {
        // `objectives` is retained only for the local legacy UI union; it is not
        // serialized by item-editor-contract.ts.
        objectives: [],
        scenario: "",
        publicLearningObjectives: [{ id: "objective_1", label: "" }],
        conversationStarters: [],
        interviewerAgentId: "",
        completionPolicy: {
          minLearnerTurns: 3,
          maxLearnerTurns: 8,
          allowEarlyFinish: true,
          hardLimitAction: "auto_finalize",
        },
        modelAnswer: "",
        evaluationGuidance: "",
        privateEvaluationObjectives: [
          { id: "private_objective_1", rubricDimensionId: "", description: "" },
        ],
      } as ChatAgentAuthoringData as ChatAgentQuestionData;
  }
}
