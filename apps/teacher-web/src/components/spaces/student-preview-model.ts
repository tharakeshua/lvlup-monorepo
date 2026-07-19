import type { UnifiedItem } from "@levelup/shared-types";

export const QUESTION_PREVIEW_TYPES = [
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

export const MATERIAL_PREVIEW_TYPES = [
  "text",
  "video",
  "pdf",
  "link",
  "interactive",
  "story",
  "rich",
] as const;

const QUESTION_SET = new Set<string>(QUESTION_PREVIEW_TYPES);
const MATERIAL_SET = new Set<string>(MATERIAL_PREVIEW_TYPES);

export function itemPreviewType(item: UnifiedItem): string {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const data = (payload["questionData"] ?? {}) as Record<string, unknown>;
  return String(
    item.type === "question"
      ? (payload["questionType"] ?? data["questionType"] ?? "")
      : (payload["materialType"] ?? "")
  );
}

export function isSupportedPreviewItem(item: UnifiedItem): boolean {
  const type = itemPreviewType(item);
  return item.type === "question"
    ? QUESTION_SET.has(type)
    : item.type === "material" && MATERIAL_SET.has(type);
}

export function validatePreviewItem(item: UnifiedItem): string[] {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const data = (payload["questionData"] ?? {}) as Record<string, unknown>;
  const type = itemPreviewType(item);
  const issues: string[] = [];

  if (!isSupportedPreviewItem(item)) {
    issues.push(`Unsupported ${item.type} type: ${type || "not configured"}.`);
    return issues;
  }
  if (item.type === "question") {
    if (!String(item.content ?? payload["content"] ?? "").trim()) {
      issues.push("Question prompt is empty.");
    }
    if (
      (type === "mcq" || type === "mcaq") &&
      (!Array.isArray(data["options"]) || data["options"].length < 2)
    ) {
      issues.push("Add at least two answer options.");
    }
    if (
      (type === "matching" || type === "jumbled") &&
      !Array.isArray(data[type === "matching" ? "pairs" : "items"])
    ) {
      issues.push(`Add ${type === "matching" ? "matching pairs" : "items to order"}.`);
    }
    if (
      (type === "fill-blanks" || type === "fill-blanks-dd") &&
      !String(data["textWithBlanks"] ?? "").trim()
    ) {
      issues.push("Add text containing at least one blank.");
    }
  } else if (
    ["video", "pdf", "link", "interactive"].includes(type) &&
    !String(payload["url"] ?? "").trim()
  ) {
    issues.push(`Add a URL for this ${type} material.`);
  }
  return issues;
}

export function hasPreviewAnswer(answer: unknown): boolean {
  if (answer == null) return false;
  if (typeof answer === "string") return answer.trim().length > 0;
  if (Array.isArray(answer)) return answer.length > 0;
  if (typeof answer === "object") return Object.keys(answer as object).length > 0;
  return true;
}

export interface PreviewSessionSummary {
  answered: number;
  unanswered: number;
  markedForReview: number;
}

export function buildPreviewSessionSummary(
  items: UnifiedItem[],
  answers: Record<string, unknown>,
  markedForReview: ReadonlySet<string>
): PreviewSessionSummary {
  const questions = items.filter((item) => item.type === "question");
  const answered = questions.filter((item) => hasPreviewAnswer(answers[item.id])).length;
  return {
    answered,
    unanswered: questions.length - answered,
    markedForReview: questions.filter((item) => markedForReview.has(item.id)).length,
  };
}
