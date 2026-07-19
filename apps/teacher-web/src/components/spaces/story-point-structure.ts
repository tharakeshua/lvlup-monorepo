import type { StoryPoint, StoryPointSection } from "@levelup/domain";
import { asSectionId } from "@levelup/domain";

export interface StoryPointDuplicatePlan {
  data: Pick<
    StoryPoint,
    | "title"
    | "description"
    | "orderIndex"
    | "type"
    | "sections"
    | "assessmentConfig"
    | "defaultRubric"
    | "defaultRubricId"
    | "difficulty"
    | "estimatedTimeMinutes"
  >;
  sectionIdMap: ReadonlyMap<string, StoryPointSection["id"]>;
}

export function reorderStoryPoints(
  storyPoints: readonly StoryPoint[],
  fromIndex: number,
  toIndex: number
): StoryPoint[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= storyPoints.length ||
    toIndex >= storyPoints.length
  ) {
    return storyPoints.map((storyPoint, orderIndex) => ({ ...storyPoint, orderIndex }));
  }
  const next = [...storyPoints];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return storyPoints.map((storyPoint, orderIndex) => ({ ...storyPoint, orderIndex }));
  next.splice(toIndex, 0, moved);
  return next.map((storyPoint, orderIndex) => ({ ...storyPoint, orderIndex }));
}

export function createStoryPointDuplicatePlan(
  source: StoryPoint,
  orderIndex: number,
  createSectionId: (sourceSection: StoryPointSection, index: number) => string = (
    sourceSection,
    index
  ) => `${sourceSection.id}_copy_${index + 1}`
): StoryPointDuplicatePlan {
  const sectionIdMap = new Map<string, StoryPointSection["id"]>();
  const sections = [...(source.sections ?? [])]
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((section, index) => {
      const id = asSectionId(createSectionId(section, index));
      sectionIdMap.set(section.id, id);
      return { ...section, id, orderIndex: index };
    });
  const assessmentConfig = source.assessmentConfig
    ? {
        ...source.assessmentConfig,
        schedule: source.assessmentConfig.schedule
          ? { ...source.assessmentConfig.schedule }
          : undefined,
        retryConfig: source.assessmentConfig.retryConfig
          ? { ...source.assessmentConfig.retryConfig }
          : undefined,
        adaptiveConfig: source.assessmentConfig.adaptiveConfig
          ? { ...source.assessmentConfig.adaptiveConfig }
          : undefined,
      }
    : undefined;

  return {
    data: {
      title: `${source.title || "Untitled story point"} copy`,
      description: source.description,
      orderIndex,
      type: source.type,
      sections,
      assessmentConfig,
      defaultRubric: source.defaultRubric,
      defaultRubricId: source.defaultRubricId,
      difficulty: source.difficulty,
      estimatedTimeMinutes: source.estimatedTimeMinutes,
    },
    sectionIdMap,
  };
}

export function remapSectionIdForDuplicate(
  sectionId: string | undefined,
  sectionIdMap: ReadonlyMap<string, StoryPointSection["id"]>
): StoryPointSection["id"] | undefined {
  return sectionId ? sectionIdMap.get(sectionId) : undefined;
}
