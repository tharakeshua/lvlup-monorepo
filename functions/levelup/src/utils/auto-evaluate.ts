import type { QuestionType, TestSubmission, UnifiedItem, UnifiedEvaluationResult } from "../types";
import type {
  AnswerKey,
  QuestionPayload,
  MCQData,
  MCAQData,
  MCQOption,
  TrueFalseData,
  NumericalData,
  FillBlanksData,
  FillBlank,
  FillBlanksDDData,
  FillBlanksDDBlank,
  MatchingData,
  MatchingPair,
  JumbledData,
  GroupOptionsData,
  GroupOptionsGroup,
} from "../types";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Auto-evaluate a submission for deterministic question types.
 * Returns null if the question type requires AI evaluation.
 */
export function autoEvaluateSubmission(
  item: UnifiedItem,
  submission: TestSubmission,
  answerKey?: AnswerKey | undefined
): UnifiedEvaluationResult | null {
  const qType = submission.questionType;
  const payload = item.payload as QuestionPayload;
  const qData = answerKey ?? payload?.questionData;
  if (!qData) return null;

  const maxScore = item.meta?.totalPoints ?? payload?.basePoints ?? 1;

  switch (qType) {
    case "mcq":
      return evaluateMCQ(submission.answer, qData as MCQData, maxScore);
    case "mcaq":
      return evaluateMCAQ(submission.answer, qData as MCAQData, maxScore);
    case "true-false":
      return evaluateTrueFalse(submission.answer, qData as TrueFalseData, maxScore);
    case "numerical":
      return evaluateNumerical(submission.answer, qData as NumericalData, maxScore);
    case "fill-blanks":
      return evaluateFillBlanks(submission.answer, qData as FillBlanksData, maxScore);
    case "fill-blanks-dd":
      return evaluateFillBlanksDD(submission.answer, qData as FillBlanksDDData, maxScore);
    case "matching":
      return evaluateMatching(submission.answer, qData as MatchingData, maxScore);
    case "jumbled":
      return evaluateJumbled(submission.answer, qData as JumbledData, maxScore);
    case "group-options":
      return evaluateGroupOptions(submission.answer, qData as GroupOptionsData, maxScore);
    default:
      return null; // Requires AI evaluation
  }
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
    gradedAt: Timestamp.now(),
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

  // Deduct for wrong selections
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

function evaluateMatching(
  answer: unknown,
  qData: MatchingData,
  maxScore: number
): UnifiedEvaluationResult {
  const answerMap = answer as Record<string, string> | undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = qData as any;

  // Legacy leftItems/rightItems/correctPairs format (from seed data)
  if (Array.isArray(legacy.leftItems) && Array.isArray(legacy.correctPairs)) {
    const correctPairs: { leftId: string; rightId: string }[] = legacy.correctPairs;
    if (correctPairs.length === 0) return buildResult(0, maxScore, false);

    let correctCount = 0;
    for (const cp of correctPairs) {
      if (answerMap?.[cp.leftId] === cp.rightId) correctCount++;
    }
    const score = (correctCount / correctPairs.length) * maxScore;
    return buildResult(
      Math.round(score * 100) / 100,
      maxScore,
      correctCount === correctPairs.length
    );
  }

  // Standard pairs format: answer maps leftPairId → rightPairId (same pair = correct)
  const pairs: MatchingPair[] = qData.pairs || [];
  if (pairs.length === 0) return buildResult(0, maxScore, false);

  let correctCount = 0;
  for (const pair of pairs) {
    if (answerMap?.[pair.id] === pair.id) correctCount++;
  }

  const score = (correctCount / pairs.length) * maxScore;
  return buildResult(Math.round(score * 100) / 100, maxScore, correctCount === pairs.length);
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

  // Deduct for items placed in wrong groups
  const score = Math.max(0, (correctItems - wrongItems) / totalItems) * maxScore;
  const isCorrect = correctItems === totalItems && wrongItems === 0;
  return buildResult(Math.round(score * 100) / 100, maxScore, isCorrect);
}
