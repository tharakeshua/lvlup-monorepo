/**
 * Client-side auto-evaluation for deterministic question types.
 * Mirrors the server-side auto-evaluate logic so MCQ, true-false, etc.
 * don't need a cloud function call.
 */

import type {
  UnifiedItem,
  QuestionPayload,
  QuestionType,
  MCQData,
  MCAQData,
  MCQOption,
  TrueFalseData,
  NumericalData,
  FillBlanksData,
  FillBlank,
  FillBlanksDDData,
  FillBlanksDDBlank,
  JumbledData,
  GroupOptionsData,
  GroupOptionsGroup,
  UnifiedEvaluationResult,
} from "@levelup/shared-types";
import { AUTO_EVALUATABLE_TYPES } from "@levelup/shared-types";

export function isAutoEvaluatableType(questionType: string): boolean {
  return (AUTO_EVALUATABLE_TYPES as readonly string[]).includes(questionType);
}

function nowTimestamp() {
  const now = new Date();
  return {
    seconds: Math.floor(now.getTime() / 1000),
    nanoseconds: (now.getTime() % 1000) * 1_000_000,
    toDate: () => now,
  };
}

function buildResult(score: number, maxScore: number, correct: boolean): UnifiedEvaluationResult {
  return {
    score,
    maxScore,
    correctness: maxScore > 0 ? score / maxScore : 0,
    percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
    strengths: correct ? ["Correct answer"] : [],
    weaknesses: correct ? [] : ["Incorrect answer"],
    missingConcepts: [],
    confidence: 1,
    mistakeClassification: correct ? "None" : undefined,
    gradedAt: nowTimestamp(),
  };
}

function evaluateMCQ(answer: unknown, qData: MCQData, maxScore: number): UnifiedEvaluationResult {
  const correctOption = qData.options?.find((o: MCQOption) => o.isCorrect);
  const isCorrect = correctOption && answer === correctOption.id;
  return buildResult(isCorrect ? maxScore : 0, maxScore, !!isCorrect);
}

function evaluateMCAQ(answer: unknown, qData: MCAQData, maxScore: number): UnifiedEvaluationResult {
  const correctIds = new Set(
    (qData.options || []).filter((o: MCQOption) => o.isCorrect).map((o: MCQOption) => o.id)
  );
  const selectedIds = new Set(Array.isArray(answer) ? answer : []);

  if (correctIds.size === 0) return buildResult(0, maxScore, false);

  let correctSelections = 0;
  for (const id of selectedIds) {
    if (correctIds.has(id)) correctSelections++;
  }

  const wrongSelections = selectedIds.size - correctSelections;
  const score = Math.max(0, (correctSelections - wrongSelections) / correctIds.size) * maxScore;
  const isCorrect = correctSelections === correctIds.size && wrongSelections === 0;

  return buildResult(Math.round(score * 100) / 100, maxScore, isCorrect);
}

function evaluateTrueFalse(
  answer: unknown,
  qData: TrueFalseData,
  maxScore: number
): UnifiedEvaluationResult {
  const isCorrect = answer === qData.correctAnswer;
  return buildResult(isCorrect ? maxScore : 0, maxScore, isCorrect);
}

function evaluateNumerical(
  answer: unknown,
  qData: NumericalData,
  maxScore: number
): UnifiedEvaluationResult {
  const studentAnswer = parseFloat(answer as string);
  if (isNaN(studentAnswer)) return buildResult(0, maxScore, false);

  const correctAnswer = qData.correctAnswer;
  const tolerance = qData.tolerance ?? 0;
  const isCorrect = Math.abs(studentAnswer - correctAnswer) <= tolerance;

  return buildResult(isCorrect ? maxScore : 0, maxScore, isCorrect);
}

function evaluateFillBlanks(
  answer: unknown,
  qData: FillBlanksData,
  maxScore: number
): UnifiedEvaluationResult {
  const blanks: FillBlank[] = qData.blanks || [];
  if (blanks.length === 0) return buildResult(0, maxScore, false);

  const answerMap = answer as Record<string, string> | undefined;
  let correctCount = 0;
  for (const blank of blanks) {
    const studentAnswer = answerMap?.[blank.id] ?? "";
    const caseSensitive = blank.caseSensitive ?? false;
    const normalize = (s: string) => (caseSensitive ? s.trim() : s.trim().toLowerCase());

    const acceptable = [blank.correctAnswer, ...(blank.acceptableAnswers || [])].map(normalize);
    if (acceptable.includes(normalize(String(studentAnswer)))) {
      correctCount++;
    }
  }

  const score = (correctCount / blanks.length) * maxScore;
  return buildResult(Math.round(score * 100) / 100, maxScore, correctCount === blanks.length);
}

function evaluateFillBlanksDD(
  answer: unknown,
  qData: FillBlanksDDData,
  maxScore: number
): UnifiedEvaluationResult {
  const blanks: FillBlanksDDBlank[] = qData.blanks || [];
  if (blanks.length === 0) return buildResult(0, maxScore, false);

  const answerMap = answer as Record<string, string> | undefined;
  let correctCount = 0;
  for (const blank of blanks) {
    if (answerMap?.[blank.id] === blank.correctOptionId) {
      correctCount++;
    }
  }

  const score = (correctCount / blanks.length) * maxScore;
  return buildResult(Math.round(score * 100) / 100, maxScore, correctCount === blanks.length);
}


function evaluateJumbled(
  answer: unknown,
  qData: JumbledData,
  maxScore: number
): UnifiedEvaluationResult {
  const correctOrder: string[] = qData.correctOrder || [];
  const studentOrder: string[] = Array.isArray(answer) ? answer : [];

  if (correctOrder.length === 0) return buildResult(0, maxScore, false);

  const isCorrect =
    correctOrder.length === studentOrder.length &&
    correctOrder.every((id, i) => id === studentOrder[i]);

  return buildResult(isCorrect ? maxScore : 0, maxScore, isCorrect);
}

function evaluateGroupOptions(
  answer: unknown,
  qData: GroupOptionsData,
  maxScore: number
): UnifiedEvaluationResult {
  const groups: GroupOptionsGroup[] = qData.groups || [];
  if (groups.length === 0) return buildResult(0, maxScore, false);

  let totalItems = 0;
  let correctItems = 0;
  let wrongItems = 0;

  const answerMap = answer as Record<string, string[]> | undefined;
  for (const group of groups) {
    const correctSet = new Set(group.correctItems || []);
    totalItems += correctSet.size;
    const studentItems: string[] = answerMap?.[group.id] || [];
    for (const item of studentItems) {
      if (correctSet.has(item)) {
        correctItems++;
      } else {
        wrongItems++;
      }
    }
  }

  if (totalItems === 0) return buildResult(0, maxScore, false);

  const score = Math.max(0, (correctItems - wrongItems) / totalItems) * maxScore;
  const isCorrect = correctItems === totalItems && wrongItems === 0;
  return buildResult(Math.round(score * 100) / 100, maxScore, isCorrect);
}

/**
 * Client-side auto-evaluation. Returns a result for deterministic question types,
 * or null if the question requires AI evaluation.
 */
export function autoEvaluateClient(
  item: UnifiedItem,
  answer: unknown
): UnifiedEvaluationResult | null {
  const payload = item.payload as QuestionPayload;
  const questionType = payload?.questionType as QuestionType;

  if (!questionType || !isAutoEvaluatableType(questionType)) {
    return null;
  }

  const qData = payload.questionData;
  if (!qData) return null;

  const maxScore = item.meta?.totalPoints ?? payload?.basePoints ?? 1;

  switch (questionType) {
    case "mcq":
      return evaluateMCQ(answer, qData as MCQData, maxScore);
    case "mcaq":
      return evaluateMCAQ(answer, qData as MCAQData, maxScore);
    case "true-false":
      return evaluateTrueFalse(answer, qData as TrueFalseData, maxScore);
    case "numerical":
      return evaluateNumerical(answer, qData as NumericalData, maxScore);
    case "fill-blanks":
      return evaluateFillBlanks(answer, qData as FillBlanksData, maxScore);
    case "fill-blanks-dd":
      return evaluateFillBlanksDD(answer, qData as FillBlanksDDData, maxScore);
    case "matching":
      // Learner reads strip the right-side pairing (the correct mapping lives
      // only in the server AnswerKey), so the client cannot score matching
      // locally — route to the server evaluator (CD13 server-authoritative).
      return null;
    case "jumbled":
      return evaluateJumbled(answer, qData as JumbledData, maxScore);
    case "group-options":
      return evaluateGroupOptions(answer, qData as GroupOptionsData, maxScore);
    default:
      return null;
  }
}
