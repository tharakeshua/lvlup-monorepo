import type {
  Space,
  SpaceAccessType,
  SpaceType,
  StoryPoint,
  StoryPointType,
} from "@levelup/domain";

export type SpaceTemplateId = "blank" | "guided-course" | "practice-set" | "assessment";

export interface SpaceTemplate {
  id: SpaceTemplateId;
  name: string;
  eyebrow: string;
  description: string;
  bestFor: string;
  type: SpaceType;
  accessType: SpaceAccessType;
  starterStoryPoints: Array<{
    title: string;
    description: string;
    type: StoryPointType;
  }>;
}

export const SPACE_TEMPLATES: readonly SpaceTemplate[] = [
  {
    id: "blank",
    name: "Blank canvas",
    eyebrow: "Build your own",
    description: "Start with an empty learning space and shape every part yourself.",
    bestFor: "Experienced authors or one-off resources",
    type: "learning",
    accessType: "class_assigned",
    starterStoryPoints: [],
  },
  {
    id: "guided-course",
    name: "Guided course",
    eyebrow: "Teach in a sequence",
    description: "A clear beginning, core lesson, and knowledge check for structured teaching.",
    bestFor: "Units, chapters, and short courses",
    type: "learning",
    accessType: "class_assigned",
    starterStoryPoints: [
      {
        title: "Start here",
        description: "Set expectations and introduce the learning goals.",
        type: "standard",
      },
      {
        title: "Core lesson",
        description: "Add the main explanation, examples, and guided activities.",
        type: "standard",
      },
      {
        title: "Check your understanding",
        description: "Close the loop with a short formative check.",
        type: "quiz",
      },
    ],
  },
  {
    id: "practice-set",
    name: "Practice pathway",
    eyebrow: "Build confident repetition",
    description: "A warm-up, focused practice, and challenge progression for independent work.",
    bestFor: "Homework, revision, and skills practice",
    type: "practice",
    accessType: "class_assigned",
    starterStoryPoints: [
      {
        title: "Warm-up",
        description: "Activate prior knowledge with a few approachable prompts.",
        type: "practice",
      },
      {
        title: "Focused practice",
        description: "Build fluency with the core skill.",
        type: "practice",
      },
      {
        title: "Challenge",
        description: "Stretch understanding with a more demanding application.",
        type: "practice",
      },
    ],
  },
  {
    id: "assessment",
    name: "Assessment",
    eyebrow: "Measure understanding",
    description: "A ready-to-configure assessment structure with instructions and a timed test.",
    bestFor: "Quizzes, checkpoints, and formal tests",
    type: "assessment",
    accessType: "class_assigned",
    starterStoryPoints: [
      {
        title: "Before you begin",
        description: "Share instructions, materials allowed, and success criteria.",
        type: "standard",
      },
      {
        title: "Assessment",
        description: "Add questions, timing, attempts, and scoring rules.",
        type: "timed_test",
      },
    ],
  },
] as const;

export interface PublishReadinessItem {
  id: string;
  label: string;
  description: string;
  ready: boolean;
  tab: "settings" | "content";
}

type ReadinessSpace = Pick<
  Space,
  | "title"
  | "description"
  | "publishedToStore"
  | "storeDescription"
  | "storeThumbnailUrl"
  | "thumbnailUrl"
  | "accessType"
>;

type ReadinessStoryPoint = Pick<StoryPoint, "id" | "title" | "assessmentConfig">;

export function getPublishReadiness(
  space: ReadinessSpace,
  storyPoints: ReadinessStoryPoint[],
  itemCounts: Record<string, number>
): PublishReadinessItem[] {
  const hasStoryPoints = storyPoints.length > 0;
  const countsLoaded =
    hasStoryPoints && storyPoints.every((storyPoint) => storyPoint.id in itemCounts);
  const emptyStoryPoint = storyPoints.find((storyPoint) => (itemCounts[storyPoint.id] ?? 0) === 0);
  const invalidSchedule = storyPoints.find((storyPoint) => {
    const schedule = storyPoint.assessmentConfig?.schedule;
    return Boolean(
      schedule?.opensAt &&
      schedule.closesAt &&
      Date.parse(schedule.opensAt) >= Date.parse(schedule.closesAt)
    );
  });
  const untitledStoryPoint = storyPoints.find((storyPoint) => !storyPoint.title.trim());
  const storeListingComplete =
    !space.publishedToStore ||
    (space.accessType === "public_store" &&
      Boolean(space.storeDescription?.trim()) &&
      Boolean(space.storeThumbnailUrl?.trim() || space.thumbnailUrl?.trim()));

  return [
    {
      id: "title",
      label: "Clear title",
      description: space.title.trim()
        ? "Students can identify this space."
        : "Add a descriptive title in Settings.",
      ready: Boolean(space.title.trim()),
      tab: "settings",
    },
    {
      id: "description",
      label: "Student-facing summary",
      description: space.description?.trim()
        ? "The purpose of this space is explained."
        : "Add a short description of what students will learn or do.",
      ready: Boolean(space.description?.trim()),
      tab: "settings",
    },
    {
      id: "structure",
      label: "Learning structure",
      description: !hasStoryPoints
        ? "Add at least one story point."
        : untitledStoryPoint
          ? "Every story point needs a title."
          : `${storyPoints.length} story point${storyPoints.length === 1 ? "" : "s"} ready.`,
      ready: hasStoryPoints && !untitledStoryPoint,
      tab: "content",
    },
    {
      id: "content",
      label: "Content in every story point",
      description: !countsLoaded
        ? "Checking content readiness…"
        : emptyStoryPoint
          ? `Add content to “${emptyStoryPoint.title || "Untitled story point"}”.`
          : "Every story point contains learning content.",
      ready: countsLoaded && !emptyStoryPoint,
      tab: "content",
    },
    {
      id: "schedule",
      label: "Valid assessment schedules",
      description: invalidSchedule
        ? `The closing time for “${invalidSchedule.title}” must be after its opening time.`
        : "Scheduled assessments have valid opening and closing times.",
      ready: !invalidSchedule,
      tab: "content",
    },
    {
      id: "store",
      label: "Store listing",
      description: !space.publishedToStore
        ? "This space is not being listed in the public store."
        : storeListingComplete
          ? "Public access, description, and cover are configured."
          : "Choose Public Store access, then add store copy and a cover image.",
      ready: storeListingComplete,
      tab: "settings",
    },
  ];
}

export function getReadinessProgress(items: PublishReadinessItem[]): number {
  if (items.length === 0) return 100;
  return Math.round((items.filter((item) => item.ready).length / items.length) * 100);
}
