import type {
  AssessmentConfig,
  AssessmentSchedule,
  StoryPoint,
  StoryPointSection,
  StoryPointType,
} from "@levelup/domain";
import { asSectionId, asTimestamp } from "@levelup/domain";

type LegacyTimestamp =
  | string
  | number
  | Date
  | { seconds?: number; _seconds?: number; toDate?: () => Date }
  | null
  | undefined;

type LegacyAssessmentConfig = Partial<AssessmentConfig> & {
  shuffleQuestions?: boolean;
  schedule?: Partial<AssessmentSchedule> & {
    startAt?: LegacyTimestamp;
    endAt?: LegacyTimestamp;
  };
  adaptiveConfig?: NonNullable<AssessmentConfig["adaptiveConfig"]> & {
    initialDifficulty?: "easy" | "medium" | "hard";
    minQuestionsPerDifficulty?: number;
    maxConsecutiveSameDifficulty?: number;
  };
};

export interface StoryPointEditorErrors {
  title?: string;
  schedule?: string;
  sections?: Record<string, string>;
}

function timestampToDate(value: LegacyTimestamp): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value.toDate === "function") {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const seconds = value.seconds ?? value._seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000);
  return null;
}

function canonicalTimestamp(value: LegacyTimestamp): AssessmentSchedule["opensAt"] {
  const date = timestampToDate(value);
  return date ? asTimestamp(date.toISOString()) : null;
}

export function toLocalDateTimeValue(value: LegacyTimestamp): string {
  const date = timestampToDate(value);
  if (!date) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function fromLocalDateTimeValue(value: string): AssessmentSchedule["opensAt"] {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : asTimestamp(date.toISOString());
}

export function normalizeSections(
  sections: readonly StoryPointSection[] | null | undefined
): StoryPointSection[] {
  const usedIds = new Set<string>();
  return (sections ?? []).map((section, index) => {
    let id = String(section.id || `section_${index + 1}`);
    while (usedIds.has(id)) id = `${id}_${index + 1}`;
    usedIds.add(id);
    return {
      ...section,
      id: asSectionId(id),
      title: section.title ?? "",
      orderIndex: index,
    };
  });
}

export function reorderSections(
  sections: readonly StoryPointSection[],
  fromIndex: number,
  toIndex: number
): StoryPointSection[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= sections.length ||
    toIndex >= sections.length
  ) {
    return normalizeSections(sections);
  }
  const next = [...sections];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return normalizeSections(sections);
  next.splice(toIndex, 0, moved);
  return normalizeSections(next);
}

export function normalizeAssessmentConfig(
  config: LegacyAssessmentConfig | null | undefined
): AssessmentConfig {
  if (!config) return {};
  const legacySchedule = config.schedule;
  const opensAt = canonicalTimestamp(
    legacySchedule && "opensAt" in legacySchedule ? legacySchedule.opensAt : legacySchedule?.startAt
  );
  const closesAt = canonicalTimestamp(
    legacySchedule && "closesAt" in legacySchedule ? legacySchedule.closesAt : legacySchedule?.endAt
  );
  const hasSchedule =
    legacySchedule != null &&
    (opensAt !== null ||
      closesAt !== null ||
      "opensAt" in legacySchedule ||
      "closesAt" in legacySchedule);
  const legacyAdaptive = config.adaptiveConfig;

  return {
    durationMinutes: config.durationMinutes,
    maxAttempts: config.maxAttempts,
    shuffle: config.shuffle ?? config.shuffleQuestions,
    passingPercentage: config.passingPercentage,
    retryConfig: config.retryConfig,
    schedule: hasSchedule ? { opensAt, closesAt } : undefined,
    adaptiveConfig: legacyAdaptive
      ? {
          enabled: legacyAdaptive.enabled,
          startingDifficulty: legacyAdaptive.startingDifficulty ?? legacyAdaptive.initialDifficulty,
          stepUpThreshold:
            legacyAdaptive.stepUpThreshold ?? legacyAdaptive.minQuestionsPerDifficulty,
          stepDownThreshold:
            legacyAdaptive.stepDownThreshold ?? legacyAdaptive.maxConsecutiveSameDifficulty,
        }
      : undefined,
  };
}

export function normalizeStoryPointForEditing(storyPoint: StoryPoint): StoryPoint {
  return {
    ...storyPoint,
    type: normalizeStoryPointType(storyPoint.type),
    sections: normalizeSections(storyPoint.sections),
    assessmentConfig: normalizeAssessmentConfig(
      storyPoint.assessmentConfig as LegacyAssessmentConfig | undefined
    ),
  };
}

export function normalizeStoryPointType(type: StoryPointType | "test"): StoryPointType {
  return type === "test" ? "timed_test" : type;
}

export function validateStoryPointDraft(storyPoint: StoryPoint): StoryPointEditorErrors {
  const errors: StoryPointEditorErrors = {};
  if (!storyPoint.title.trim()) errors.title = "Give this story point a title.";

  const sectionErrors: Record<string, string> = {};
  const seenTitles = new Set<string>();
  for (const section of storyPoint.sections) {
    const title = section.title.trim();
    if (!title) {
      sectionErrors[section.id] = "Section titles cannot be empty.";
      continue;
    }
    const key = title.toLocaleLowerCase();
    if (seenTitles.has(key)) sectionErrors[section.id] = "Section titles must be unique.";
    seenTitles.add(key);
  }
  if (Object.keys(sectionErrors).length > 0) errors.sections = sectionErrors;

  const { opensAt, closesAt } = storyPoint.assessmentConfig?.schedule ?? {};
  if (opensAt && closesAt && new Date(opensAt).getTime() >= new Date(closesAt).getTime()) {
    errors.schedule = "Closing time must be later than opening time.";
  }
  return errors;
}

export function hasStoryPointErrors(errors: StoryPointEditorErrors): boolean {
  return Boolean(
    errors.title || errors.schedule || (errors.sections && Object.keys(errors.sections).length > 0)
  );
}

export function usesAssessmentSettings(type: StoryPointType): boolean {
  return type === "timed_test" || type === "quiz" || type === "practice";
}
