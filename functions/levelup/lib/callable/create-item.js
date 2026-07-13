"use strict";
/**
 * Utility functions for answer key extraction and payload stripping.
 * Used by saveItem to separate answer data into a server-only subcollection
 * for timed test items, so students cannot inspect correct answers client-side.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAnswerKey = extractAnswerKey;
exports.stripAnswerFromPayload = stripAnswerFromPayload;
/** Fields that contain answer information per question type */
const ANSWER_FIELDS_BY_TYPE = {
  mcq: ["options"], // options[].isCorrect
  mcaq: ["options"], // options[].isCorrect
  "true-false": ["correctAnswer"],
  numerical: ["correctAnswer", "tolerance"],
  text: ["correctAnswer", "acceptableAnswers", "caseSensitive"],
  "fill-blanks": ["blanks"], // blanks[].correctAnswer, blanks[].acceptableAnswers
  "fill-blanks-dd": ["blanks"], // blanks[].correctOptionId
  matching: ["pairs"], // pairs contain left-right mappings
  jumbled: ["correctOrder"],
  "group-options": ["groups"], // groups[].correctItems
};
/**
 * Extracts the answer key data from a question payload for server-only storage.
 * Returns null if the question type has no extractable answer key (e.g., AI-evaluated types).
 */
function extractAnswerKey(payload) {
  const questionType = payload.questionType;
  const questionData = payload.questionData;
  if (!questionData || !questionType) return null;
  switch (questionType) {
    case "mcq":
    case "mcaq": {
      const correctIds = (questionData.options ?? []).filter((o) => o.isCorrect).map((o) => o.id);
      return { correctAnswer: correctIds };
    }
    case "true-false":
      return { correctAnswer: questionData.correctAnswer };
    case "numerical":
      return {
        correctAnswer: questionData.correctAnswer,
        acceptableAnswers:
          questionData.tolerance != null ? [{ tolerance: questionData.tolerance }] : undefined,
      };
    case "text":
      return {
        correctAnswer: questionData.correctAnswer,
        acceptableAnswers: questionData.acceptableAnswers,
      };
    case "fill-blanks":
      return {
        correctAnswer: (questionData.blanks ?? []).map((b) => ({
          id: b.id,
          correctAnswer: b.correctAnswer,
          acceptableAnswers: b.acceptableAnswers,
        })),
      };
    case "fill-blanks-dd":
      return {
        correctAnswer: (questionData.blanks ?? []).map((b) => ({
          id: b.id,
          correctOptionId: b.correctOptionId,
        })),
      };
    case "matching":
      return {
        correctAnswer: (questionData.pairs ?? []).map((p) => ({
          id: p.id,
          left: p.left,
          right: p.right,
        })),
      };
    case "jumbled":
      return { correctAnswer: questionData.correctOrder };
    case "group-options":
      return {
        correctAnswer: (questionData.groups ?? []).map((g) => ({
          id: g.id,
          correctItems: g.correctItems,
        })),
      };
    default:
      // AI-evaluated types (paragraph, code, audio, image_evaluation, chat_agent_question)
      // don't have a simple extractable answer key
      return null;
  }
}
/**
 * Strips answer information from the payload so clients cannot see correct answers.
 * Returns a new payload object with answer data removed.
 */
function stripAnswerFromPayload(payload) {
  const questionType = payload.questionType;
  const questionData = payload.questionData;
  if (!questionData || !questionType) return payload;
  const strippedData = { ...questionData };
  const stripped = { ...payload, questionData: strippedData };
  switch (questionType) {
    case "mcq":
    case "mcaq":
      // Remove isCorrect from options
      strippedData.options = (questionData.options ?? []).map((o) => ({
        ...o,
        isCorrect: undefined,
      }));
      break;
    case "true-false":
      delete strippedData.correctAnswer;
      break;
    case "numerical":
      delete strippedData.correctAnswer;
      delete strippedData.tolerance;
      break;
    case "text":
      delete strippedData.correctAnswer;
      delete strippedData.acceptableAnswers;
      break;
    case "fill-blanks":
      strippedData.blanks = (questionData.blanks ?? []).map((b) => ({
        id: b.id,
        // Keep caseSensitive flag but remove answers
      }));
      break;
    case "fill-blanks-dd":
      strippedData.blanks = (questionData.blanks ?? []).map((b) => ({
        id: b.id,
        options: b.options,
        // Remove correctOptionId
      }));
      break;
    case "matching":
      // Shuffle pairs so left-right mapping is not visible
      strippedData.pairs = (questionData.pairs ?? []).map((p) => ({
        id: p.id,
        left: p.left,
        right: p.right,
      }));
      break;
    case "jumbled":
      delete strippedData.correctOrder;
      break;
    case "group-options":
      strippedData.groups = (questionData.groups ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        // Remove correctItems
      }));
      break;
  }
  return stripped;
}
//# sourceMappingURL=create-item.js.map
