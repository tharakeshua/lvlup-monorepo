/**
 * Learn-lane VIEW types.
 *
 * The `@levelup/query` read hooks return `unknown` at the repo seam (the SDK
 * shapes views to `unknown` and lets apps narrow). These are the tolerant,
 * read-only shapes the Learn screens narrow to — supersets of the canonical
 * `@levelup/domain` entities with every field optional, because a learner read
 * is answer-stripped and progress may still be hydrating. NEVER assume a field
 * is present; default it.
 */
import type {
  Space,
  StoryPoint,
  UnifiedItem,
  SpaceProgress,
  StoryPointProgress,
  StoryPointProgressDoc,
  ItemProgressEntry,
  ProgressStatus,
  QuestionProgressStatus,
} from "@levelup/domain";

/** A space row as it arrives from `useSpaces`/`useSpace` (tolerant). */
export type SpaceView = Partial<Space> & {
  id: string;
  title?: string;
  // some list projections name it differently — tolerate both.
  name?: string;
  spaceId?: string;
};

/** A story point as it arrives from `useStoryPoints` / the detail view. */
export type StoryPointView = Partial<StoryPoint> & { id: string };

/** A learner (answer-stripped) item from `useItems`. */
export type ItemView = Partial<UnifiedItem> & { id: string };

/** Per-space progress summary from `useSpaceProgress` (or detailView.myProgress). */
export type SpaceProgressView = Partial<SpaceProgress> & {
  storyPoints?: Record<string, Partial<StoryPointProgress>>;
};

/** Per-story-point progress doc from `useStoryPointProgress`. */
export type StoryPointProgressView = Partial<StoryPointProgressDoc> & {
  items?: Record<string, Partial<ItemProgressEntry>>;
};

/** The composed `useSpaceDetailView` payload. */
export type SpaceDetailView = {
  space?: SpaceView;
  storyPoints?: StoryPointView[];
  itemsByStoryPoint?: Record<string, ItemView[]>;
  myProgress?: SpaceProgressView;
};

export type { ProgressStatus, QuestionProgressStatus };
