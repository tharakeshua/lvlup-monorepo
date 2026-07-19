/**
 * Teacher item-editor boundary.
 *
 * The existing form controls use the legacy, flat shared-types payload because
 * that is their local UI state model. The wire contract is deliberately not
 * widened to accept that shape: all reads are adapted from the canonical
 * @levelup/domain model and every write is rebuilt as the strict two-level
 * SaveItem payload.
 */
import type { ReqOf } from "@levelup/api-contract";
import type {
  AnswerKey,
  ItemAttachment as CanonicalAttachment,
  ItemPayload as CanonicalPayload,
  UnifiedItem as CanonicalItem,
} from "@levelup/domain";
import type {
  ItemAttachment as EditorAttachment,
  MaterialPayload as EditorMaterialPayload,
  QuestionPayload as EditorQuestionPayload,
  UnifiedItem as EditorItem,
} from "@levelup/shared-types";

export type ItemEditorModel = EditorItem;
export type ItemEditView = CanonicalItem & { answerKey?: AnswerKey };
export type SaveItemData = ReqOf<"v1.levelup.saveItem">["data"];

type Bag = Record<string, unknown>;

const bag = (value: unknown): Bag =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Bag) : {};

function editorAttachment(attachment: CanonicalAttachment): EditorAttachment {
  const extended = attachment as CanonicalAttachment & { id?: string; mimeType?: string };
  return {
    id: extended.id ?? `attachment_${encodeURIComponent(attachment.url)}`,
    fileName: attachment.name ?? "Attachment",
    url: attachment.url,
    type: attachment.type,
    size: attachment.sizeBytes ?? 0,
    mimeType: extended.mimeType ?? "",
  };
}

function canonicalAttachment(attachment: EditorAttachment): CanonicalAttachment {
  return {
    type: attachment.type,
    url: attachment.url,
    name: attachment.fileName,
    sizeBytes: attachment.size,
    // The domain/API may add these optional storage identity fields. Keeping
    // them here is intentional; the strict schema is the final runtime gate.
    id: attachment.id,
    mimeType: attachment.mimeType,
  } as CanonicalAttachment;
}

function mergeAnswerKey(questionData: Bag, answerKey?: AnswerKey): Bag {
  if (!answerKey) return questionData;
  const qt = String(questionData.questionType ?? answerKey.questionType);
  const answer = answerKey.correctAnswer;

  switch (qt) {
    case "mcq":
    case "mcaq": {
      const structuredIds = bag(answer).correctOptionIds;
      const rawIds = Array.isArray(structuredIds) ? structuredIds : answer;
      const ids = Array.isArray(rawIds)
        ? rawIds.map(String)
        : rawIds == null
          ? []
          : [String(rawIds)];
      return {
        ...questionData,
        options: Array.isArray(questionData.options)
          ? questionData.options.map((option) => {
              const current = bag(option);
              return { ...current, isCorrect: ids.includes(String(current.id)) };
            })
          : [],
      };
    }
    case "true-false":
      return {
        ...questionData,
        correctAnswer: bag(answer).correctAnswer ?? answer,
      };
    case "numerical": {
      const value = bag(answer).value ?? answer;
      return { ...questionData, correctAnswer: value };
    }
    case "text":
      return {
        ...questionData,
        correctAnswer: answerKey.modelAnswer ?? answer,
        acceptableAnswers: answerKey.acceptableAnswers?.map(String),
      };
    case "paragraph":
    case "code":
    case "audio":
    case "image_evaluation":
      return {
        ...questionData,
        modelAnswer: answerKey.modelAnswer ?? answer,
        evaluationGuidance: answerKey.evaluationGuidance,
      };
    case "chat_agent_question":
      return {
        ...questionData,
        // These fields are authoring-only local editor state and arrive solely
        // through the answer-key projection. `toSaveItemData` splits them back
        // into `data.answerKey`; it never emits them on public questionData.
        modelAnswer: answerKey.modelAnswer,
        evaluationGuidance: answerKey.evaluationGuidance,
        privateEvaluationObjectives: answerKey.privateEvaluationObjectives,
      };
    case "fill-blanks": {
      const answerBlanks = Array.isArray(bag(answer).blanks) ? bag(answer).blanks : answer;
      return {
        ...questionData,
        blanks: Array.isArray(answerBlanks)
          ? answerBlanks.map((entry, index) => ({
              ...bag(Array.isArray(questionData.blanks) ? questionData.blanks[index] : undefined),
              ...bag(entry),
            }))
          : questionData.blanks,
      };
    }
    case "fill-blanks-dd": {
      const answerBlanks = Array.isArray(bag(answer).blanks) ? bag(answer).blanks : answer;
      return {
        ...questionData,
        blanks: Array.isArray(answerBlanks)
          ? answerBlanks.map((entry, index) => ({
              ...bag(Array.isArray(questionData.blanks) ? questionData.blanks[index] : undefined),
              ...bag(entry),
            }))
          : questionData.blanks,
      };
    }
    case "matching": {
      const pairs = Array.isArray(bag(answer).pairs) ? bag(answer).pairs : answer;
      return {
        ...questionData,
        pairs: Array.isArray(pairs) ? pairs : questionData.pairs,
      };
    }
    case "jumbled": {
      const correctOrder = Array.isArray(bag(answer).correctOrder)
        ? bag(answer).correctOrder
        : answer;
      return {
        ...questionData,
        correctOrder: Array.isArray(correctOrder) ? correctOrder : questionData.correctOrder,
      };
    }
    case "group-options": {
      const answerAssignments = Array.isArray(bag(answer).assignments)
        ? bag(answer).assignments
        : answer;
      const assignments = Array.isArray(answerAssignments)
        ? new Map(
            answerAssignments.map((entry) => {
              const current = bag(entry);
              return [String(current.itemId ?? ""), String(current.group ?? "")];
            })
          )
        : new Map<string, string>();
      return {
        ...questionData,
        items: Array.isArray(questionData.items)
          ? questionData.items.map((entry) => {
              const current = bag(entry);
              const group = assignments.get(String(current.id ?? ""));
              return group ? { ...current, group } : current;
            })
          : questionData.items,
      };
    }
    default:
      return { ...questionData, correctAnswer: answer };
  }
}

function questionToEditor(
  item: CanonicalItem,
  payload: Extract<CanonicalPayload, { type: "question" }>,
  answerKey?: AnswerKey
): EditorQuestionPayload {
  const canonical = mergeAnswerKey(bag(payload.questionData), answerKey);
  const questionType = canonical.questionType as EditorQuestionPayload["questionType"];
  let questionData: Bag = canonical;

  switch (questionType) {
    case "text":
      questionData = {
        ...canonical,
        correctAnswer: canonical.modelAnswer ?? canonical.correctAnswer,
      };
      break;
    case "paragraph":
      questionData = {
        ...canonical,
        minLength: canonical.minWords,
        maxLength: canonical.maxWords,
      };
      break;
    case "code":
      questionData = {
        ...canonical,
        testCases: Array.isArray(canonical.testCases)
          ? canonical.testCases.map((testCase, index) => {
              const tc = bag(testCase);
              return {
                id: String(tc.id ?? `case_${index + 1}`),
                input: String(tc.input ?? ""),
                expectedOutput: String(tc.output ?? tc.expectedOutput ?? ""),
              };
            })
          : [],
      };
      break;
    case "fill-blanks":
      questionData = { ...canonical, textWithBlanks: String(canonical.template ?? "") };
      break;
    case "fill-blanks-dd": {
      const optionPool = Array.isArray(canonical.optionPool)
        ? canonical.optionPool.map(String)
        : [];
      questionData = {
        ...canonical,
        textWithBlanks: String(canonical.template ?? ""),
        blanks: Array.isArray(canonical.blanks)
          ? canonical.blanks.map((blank, index) => {
              const b = bag(blank);
              const correct = String(b.correctAnswer ?? "");
              return {
                id: String(b.id ?? `blank_${index + 1}`),
                correctOptionId: correct,
                options: optionPool.map((text) => ({ id: text, text })),
              };
            })
          : [],
      };
      break;
    }
    case "matching":
      questionData = {
        ...canonical,
        pairs: Array.isArray(canonical.pairs)
          ? canonical.pairs.map((pair, index) => ({ id: `pair_${index + 1}`, ...bag(pair) }))
          : [],
      };
      break;
    case "jumbled": {
      const tokens = Array.isArray(canonical.tokens) ? canonical.tokens.map(String) : [];
      const order = Array.isArray(canonical.correctOrder)
        ? canonical.correctOrder.map(Number)
        : tokens.map((_, index) => index);
      questionData = {
        ...canonical,
        items: tokens.map((text, index) => ({ id: `item_${index}`, text })),
        correctOrder: order.map((index) => `item_${index}`),
      };
      break;
    }
    case "group-options": {
      const groups = Array.isArray(canonical.groups) ? canonical.groups.map(String) : [];
      const items = Array.isArray(canonical.items) ? canonical.items.map(bag) : [];
      questionData = {
        ...canonical,
        groups: groups.map((name, index) => ({
          id: `group_${index}`,
          name,
          correctItems: items
            .filter((entry) => entry.group === name)
            .map((entry) => String(entry.id)),
        })),
        items: items.map(({ group: _group, ...entry }) => entry),
      };
      break;
    }
    case "image_evaluation":
      questionData = {
        ...canonical,
        instructions: String(canonical.instructions ?? item.content ?? ""),
        maxImages: Number(canonical.maxImages ?? 1),
      };
      break;
    case "chat_agent_question":
      questionData = {
        ...canonical,
        scenario: String(canonical.scenario ?? ""),
        publicLearningObjectives: Array.isArray(canonical.publicLearningObjectives)
          ? canonical.publicLearningObjectives.map((objective) => {
              const current = bag(objective);
              return { id: String(current.id ?? ""), label: String(current.label ?? "") };
            })
          : [],
        conversationStarters: Array.isArray(canonical.conversationStarters)
          ? canonical.conversationStarters.map(String)
          : [],
        interviewerAgentId: String(canonical.interviewerAgentId ?? ""),
        completionPolicy: bag(canonical.completionPolicy),
      };
      break;
  }

  return {
    questionType,
    content: item.content ?? "",
    basePoints: payload.basePoints,
    explanation: payload.explanation,
    questionData: questionData as EditorQuestionPayload["questionData"],
  };
}

function materialToEditor(
  item: CanonicalItem,
  payload: Extract<CanonicalPayload, { type: "material" }>
): EditorMaterialPayload {
  const material = payload.materialData;
  switch (material.materialType) {
    case "text":
      return { materialType: "text", content: material.body };
    case "video":
      return {
        materialType: "video",
        url: material.url,
        duration: material.durationSeconds,
        content: item.content,
      };
    case "pdf":
      return { materialType: "pdf", url: material.url, content: item.content };
    case "link":
      return {
        materialType: "link",
        url: material.url,
        content: item.content,
        richContent: material.label ? { title: material.label, blocks: [] } : undefined,
      };
    case "interactive":
      return { materialType: "interactive", url: material.embedUrl, content: item.content };
    case "story":
      return {
        materialType: "story",
        content: item.content ?? material.slides.map((slide) => slide.body).join("\n\n"),
        richContent: {
          blocks: material.slides.map((slide, index) => ({
            id: `slide_${index + 1}`,
            type: "paragraph",
            content: slide.body,
            metadata: slide.title ? { title: slide.title } : undefined,
          })),
        },
      };
    case "rich":
      return {
        materialType: "rich",
        content: item.content,
        richContent: {
          title: material.title,
          subtitle: material.subtitle,
          coverImage: material.coverImage,
          blocks: material.blocks as EditorMaterialPayload["richContent"] extends {
            blocks: infer T;
          }
            ? T
            : never,
          tags: material.tags,
          author: material.author,
          readingTime: material.readingTime,
        },
      };
  }
}

export function toItemEditorModel(item: ItemEditView): ItemEditorModel {
  const payload =
    item.payload.type === "question"
      ? questionToEditor(item, item.payload, item.answerKey)
      : item.payload.type === "material"
        ? materialToEditor(item, item.payload)
        : (item.payload as unknown as EditorItem["payload"]);

  return {
    ...(item as unknown as EditorItem),
    payload,
    attachments: item.attachments?.map(editorAttachment),
  };
}

function questionToCanonical(payload: EditorQuestionPayload): CanonicalPayload {
  const qt = payload.questionType;
  const editor = bag(payload.questionData);
  let questionData: Bag = { ...editor, questionType: qt };

  switch (qt) {
    case "mcq":
    case "mcaq":
      questionData = {
        questionType: qt,
        options: Array.isArray(editor.options)
          ? editor.options.map((option) => {
              const current = bag(option);
              return {
                id: String(current.id ?? ""),
                text: String(current.text ?? ""),
                imageUrl: typeof current.imageUrl === "string" ? current.imageUrl : undefined,
                explanation:
                  typeof current.explanation === "string" ? current.explanation : undefined,
                isCorrect: typeof current.isCorrect === "boolean" ? current.isCorrect : undefined,
              };
            })
          : [],
        shuffleOptions: editor.shuffleOptions,
        ...(qt === "mcaq"
          ? {
              minSelections: editor.minSelections,
              maxSelections: editor.maxSelections,
            }
          : {}),
      };
      break;
    case "true-false":
      questionData = {
        questionType: qt,
        correctAnswer: editor.correctAnswer,
        explanation: editor.explanation,
      };
      break;
    case "numerical":
      questionData = {
        questionType: qt,
        correctAnswer: editor.correctAnswer,
        tolerance: editor.tolerance,
        unit: editor.unit,
        decimalPlaces: editor.decimalPlaces,
      };
      break;
    case "text":
      questionData = {
        questionType: qt,
        maxLength: editor.maxLength,
        modelAnswer: editor.correctAnswer ?? editor.modelAnswer,
        acceptableAnswers: editor.acceptableAnswers,
        caseSensitive: editor.caseSensitive,
      };
      break;
    case "paragraph":
      questionData = {
        questionType: qt,
        minWords: editor.minLength,
        maxWords: editor.maxLength,
        modelAnswer: editor.modelAnswer,
        evaluationGuidance: editor.evaluationGuidance,
      };
      break;
    case "audio":
      questionData = {
        questionType: qt,
        maxDurationSeconds: editor.maxDurationSeconds,
        promptAudioUrl: editor.promptAudioUrl,
        language: editor.language,
        modelAnswer: editor.modelAnswer,
        evaluationGuidance: editor.evaluationGuidance,
      };
      break;
    case "image_evaluation":
      questionData = {
        questionType: qt,
        referenceImageUrls: editor.referenceImageUrls,
        instructions: editor.instructions,
        maxImages: editor.maxImages,
        modelAnswer: editor.modelAnswer,
        evaluationGuidance: editor.evaluationGuidance,
      };
      break;
    case "code":
      questionData = {
        questionType: qt,
        language: editor.language,
        starterCode: editor.starterCode,
        modelAnswer: editor.modelAnswer,
        testCases: Array.isArray(editor.testCases)
          ? editor.testCases.map((testCase) => {
              const tc = bag(testCase);
              return { input: String(tc.input ?? ""), output: String(tc.expectedOutput ?? "") };
            })
          : undefined,
      };
      break;
    case "fill-blanks":
      questionData = {
        questionType: qt,
        template: String(editor.textWithBlanks ?? ""),
        blanks: Array.isArray(editor.blanks)
          ? editor.blanks.map((blank) => {
              const current = bag(blank);
              return {
                id: String(current.id ?? ""),
                correctAnswer:
                  typeof current.correctAnswer === "string" ? current.correctAnswer : undefined,
                acceptableAnswers: Array.isArray(current.acceptableAnswers)
                  ? current.acceptableAnswers.map(String)
                  : undefined,
              };
            })
          : [],
      };
      break;
    case "fill-blanks-dd": {
      const blanks = Array.isArray(editor.blanks) ? editor.blanks.map(bag) : [];
      questionData = {
        questionType: qt,
        template: String(editor.textWithBlanks ?? ""),
        blanks: blanks.map((blank) => {
          const selected = String(blank.correctOptionId ?? "");
          return { id: String(blank.id ?? ""), correctAnswer: selected || undefined };
        }),
        optionPool: [
          ...new Set(
            blanks.flatMap((blank) =>
              Array.isArray(blank.options)
                ? blank.options.map((option) => String(bag(option).text))
                : []
            )
          ),
        ],
      };
      break;
    }
    case "matching":
      questionData = {
        questionType: qt,
        pairs: Array.isArray(editor.pairs)
          ? editor.pairs.map((pair) => {
              const p = bag(pair);
              return { left: String(p.left ?? ""), right: String(p.right ?? "") };
            })
          : [],
        shufflePairs: editor.shufflePairs,
      };
      break;
    case "jumbled": {
      const items = Array.isArray(editor.items) ? editor.items.map(bag) : [];
      const ids = items.map((entry) => String(entry.id));
      questionData = {
        questionType: qt,
        tokens: items.map((entry) => String(entry.text ?? "")),
        correctOrder: Array.isArray(editor.correctOrder)
          ? editor.correctOrder.map((id) => ids.indexOf(String(id))).filter((index) => index >= 0)
          : undefined,
      };
      break;
    }
    case "group-options": {
      const groups = Array.isArray(editor.groups) ? editor.groups.map(bag) : [];
      const assignments = new Map<string, string>();
      for (const group of groups) {
        const name = String(group.name ?? "");
        if (Array.isArray(group.correctItems)) {
          for (const itemId of group.correctItems) assignments.set(String(itemId), name);
        }
      }
      questionData = {
        questionType: qt,
        groups: groups.map((group) => String(group.name ?? "")),
        items: Array.isArray(editor.items)
          ? editor.items.map((item) => {
              const current = bag(item);
              return {
                id: String(current.id ?? ""),
                text: String(current.text ?? ""),
                group: assignments.get(String(current.id ?? "")),
              };
            })
          : [],
      };
      break;
    }
    case "chat_agent_question":
      questionData = {
        questionType: qt,
        scenario: String(editor.scenario ?? ""),
        publicLearningObjectives: Array.isArray(editor.publicLearningObjectives)
          ? editor.publicLearningObjectives.map((objective) => {
              const current = bag(objective);
              return { id: String(current.id ?? ""), label: String(current.label ?? "") };
            })
          : [],
        conversationStarters: Array.isArray(editor.conversationStarters)
          ? editor.conversationStarters.map(String)
          : undefined,
        interviewerAgentId: String(editor.interviewerAgentId ?? ""),
        completionPolicy: {
          minLearnerTurns: Number(bag(editor.completionPolicy).minLearnerTurns ?? 0),
          maxLearnerTurns: Number(bag(editor.completionPolicy).maxLearnerTurns ?? 0),
          allowEarlyFinish: Boolean(bag(editor.completionPolicy).allowEarlyFinish),
          hardLimitAction: "auto_finalize",
        },
      };
      break;
    default:
      questionData = { ...editor, questionType: qt };
  }

  return {
    type: "question",
    basePoints: payload.basePoints,
    explanation: payload.explanation,
    questionData,
  } as CanonicalPayload;
}

function materialToCanonical(
  payload: EditorMaterialPayload,
  fallbackContent?: string
): CanonicalPayload {
  const content = payload.content ?? fallbackContent ?? "";
  switch (payload.materialType) {
    case "text":
      return { type: "material", materialData: { materialType: "text", body: content } };
    case "video":
      return {
        type: "material",
        materialData: {
          materialType: "video",
          url: payload.url ?? "",
          durationSeconds: payload.duration,
        },
      };
    case "pdf":
      return { type: "material", materialData: { materialType: "pdf", url: payload.url ?? "" } };
    case "link":
      return {
        type: "material",
        materialData: {
          materialType: "link",
          url: payload.url ?? "",
          label: payload.richContent?.title,
        },
      };
    case "interactive":
      return {
        type: "material",
        materialData: { materialType: "interactive", embedUrl: payload.url ?? "" },
      };
    case "story":
      return {
        type: "material",
        materialData: {
          materialType: "story",
          slides: payload.richContent?.blocks?.length
            ? payload.richContent.blocks.map((block) => ({
                title: typeof block.metadata?.title === "string" ? block.metadata.title : undefined,
                body: block.content,
              }))
            : [{ body: content }],
        },
      };
    case "rich":
      return {
        type: "material",
        materialData: {
          materialType: "rich",
          blocks: payload.richContent?.blocks ?? [],
          title: payload.richContent?.title,
          subtitle: payload.richContent?.subtitle,
          coverImage: payload.richContent?.coverImage,
          tags: payload.richContent?.tags,
          author: payload.richContent?.author,
          readingTime: payload.richContent?.readingTime,
        },
      };
  }
}

export function toSaveItemData(
  item: ItemEditorModel,
  overrides: Partial<SaveItemData> = {}
): SaveItemData {
  const payload =
    item.type === "question"
      ? questionToCanonical(item.payload as EditorQuestionPayload)
      : item.type === "material"
        ? materialToCanonical(item.payload as EditorMaterialPayload, item.content)
        : (item.payload as unknown as CanonicalPayload);
  const editorQuestionData =
    item.type === "question"
      ? bag((item.payload as EditorQuestionPayload).questionData)
      : undefined;
  const chatAnswerKey =
    item.type === "question" &&
    (item.payload as EditorQuestionPayload).questionType === "chat_agent_question"
      ? {
          questionType: "chat_agent_question" as const,
          modelAnswer:
            typeof editorQuestionData?.modelAnswer === "string"
              ? editorQuestionData.modelAnswer
              : undefined,
          evaluationGuidance:
            typeof editorQuestionData?.evaluationGuidance === "string"
              ? editorQuestionData.evaluationGuidance
              : undefined,
          privateEvaluationObjectives: Array.isArray(
            editorQuestionData?.privateEvaluationObjectives
          )
            ? editorQuestionData.privateEvaluationObjectives.map((objective) => {
                const current = bag(objective);
                return {
                  id: String(current.id ?? ""),
                  rubricDimensionId: String(current.rubricDimensionId ?? ""),
                  description: String(current.description ?? ""),
                  evidenceRequirement:
                    typeof current.evidenceRequirement === "string"
                      ? current.evidenceRequirement
                      : undefined,
                };
              })
            : [],
        }
      : undefined;

  return {
    type: item.type,
    payload,
    title: item.title,
    content: item.content,
    difficulty: item.difficulty,
    topics: item.topics,
    labels: item.labels,
    orderIndex: item.orderIndex,
    sectionId: item.sectionId,
    meta: item.meta,
    rubric: item.rubric,
    rubricId: (item as EditorItem & { rubricId?: string }).rubricId,
    linkedQuestionId: item.linkedQuestionId,
    attachments: item.attachments?.map(canonicalAttachment),
    ...(chatAnswerKey ? { answerKey: chatAnswerKey } : {}),
    ...overrides,
  } as SaveItemData;
}
