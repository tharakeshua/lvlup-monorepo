/**
 * Learn-lane normalizers + display metadata.
 *
 * Pure functions only — no React, no components. They turn the tolerant repo
 * views (see `./types`) into the small, stable shapes the screens render, and
 * own the "never color alone" icon/label metadata so it's identical across the
 * three Learn screens.
 */
import type {
  ItemView,
  ProgressStatus,
  QuestionProgressStatus,
  SpaceProgressView,
  SpaceView,
  StoryPointProgressView,
  StoryPointView,
} from "./types";

/** Unwrap the many list-envelope shapes the repos may return into a plain array. */
export function asArray<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const items = o.items ?? o.spaces ?? o.storyPoints ?? o.data ?? o.results;
    if (Array.isArray(items)) return items as T[];
    // infinite-query pages → flatten {pages: [{items: []}, ...]}
    if (Array.isArray(o.pages)) {
      return (o.pages as unknown[]).flatMap((p) => asArray<T>(p));
    }
  }
  return [];
}

/** Coerce a possibly-undefined percentage to a clamped 0–100 integer. */
export function pct(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ── space type + difficulty metadata (icon + label — never color alone) ──────

export const SPACE_TYPE_META: Record<string, { icon: string; label: string }> = {
  learning: { icon: "book-open", label: "Learning" },
  practice: { icon: "dumbbell", label: "Practice" },
  assessment: { icon: "clipboard-check", label: "Assessment" },
  resource: { icon: "folder", label: "Resource" },
  hybrid: { icon: "layers", label: "Hybrid" },
};

export function spaceTypeMeta(type?: string) {
  // Deployed seed can return out-of-contract types (e.g. "subject") — render
  // as-is rather than hard-validating (coordinator data-shape rule #7).
  if (type && SPACE_TYPE_META[type]) return SPACE_TYPE_META[type];
  if (type) return { icon: "book-open", label: type.charAt(0).toUpperCase() + type.slice(1) };
  return { icon: "book-open", label: "Space" };
}

export const DIFFICULTY_META: Record<string, { icon: string; label: string }> = {
  beginner: { icon: "sprout", label: "Beginner" },
  easy: { icon: "sprout", label: "Easy" },
  intermediate: { icon: "trending-up", label: "Intermediate" },
  medium: { icon: "trending-up", label: "Medium" },
  advanced: { icon: "mountain", label: "Advanced" },
  hard: { icon: "mountain", label: "Hard" },
  expert: { icon: "flame", label: "Expert" },
};

export function difficultyMeta(diff?: string) {
  if (!diff) return null;
  return DIFFICULTY_META[diff.toLowerCase()] ?? { icon: "gauge", label: diff };
}

// ── mastery band (shared across space cards + ring) ─────────────────────────

export type MasteryBand = {
  key: "done" | "progress" | "not-started";
  icon: string;
  word: string;
  aria: string;
  variant: "success" | "spark" | "muted";
};

export function masteryBand(percentage: number): MasteryBand {
  if (percentage >= 100)
    return {
      key: "done",
      icon: "check-circle",
      word: "Completed",
      aria: "100% mastered",
      variant: "success",
    };
  if (percentage > 0)
    return {
      key: "progress",
      icon: "circle-dot",
      word: "In progress",
      aria: `${percentage}% mastered`,
      variant: "spark",
    };
  return {
    key: "not-started",
    icon: "circle",
    word: "Ready when you are",
    aria: "Ready when you are",
    variant: "muted",
  };
}

// ── story-point type → node presentation (label + icon + nav route kind) ─────

export type NodeRouteKind = "content" | "practice" | "test";

export function storyPointTypeMeta(type?: string): {
  label: string;
  icon: string;
  route: NodeRouteKind;
} {
  switch (type) {
    case "timed_test":
      return { label: "Timed test", icon: "timer", route: "test" };
    case "quiz":
      return { label: "Quiz", icon: "list-checks", route: "content" };
    case "practice":
      return { label: "Practice", icon: "dumbbell", route: "practice" };
    case "standard":
    default:
      return { label: "Learning", icon: "book-open", route: "content" };
  }
}

// ── progress-status → node mastery state ─────────────────────────────────────

export type NodeState = "mastered" | "in-progress" | "not-started";

export function nodeStateOf(status?: ProgressStatus, percentage = 0): NodeState {
  if (status === "completed" || percentage >= 100) return "mastered";
  if (status === "in_progress" || percentage > 0) return "in-progress";
  return "not-started";
}

// ── item-level status (drives the AttemptBar numbered nodes) ─────────────────

export type ItemStatus = "mastered" | "partial" | "incorrect" | "current" | "none";

/** Map a per-item progress entry to the AttemptBar status token. */
export function itemStatusOf(entry?: {
  completed?: boolean;
  questionData?: { status?: QuestionProgressStatus; solved?: boolean };
}): ItemStatus {
  if (!entry) return "none";
  const q = entry.questionData;
  if (q?.status === "correct" || q?.solved) return "mastered";
  if (q?.status === "partial") return "partial";
  if (q?.status === "incorrect") return "incorrect";
  if (entry.completed) return "mastered";
  return "none";
}

// ── space-card row builder (spaces-list) ─────────────────────────────────────

export type SpaceCardModel = {
  id: string;
  title: string;
  subject?: string;
  type?: string;
  difficulty?: string;
  thumbnailUrl?: string;
  storyPointCount: number;
  percentage: number;
  rating: number | null;
  totalReviews: number | null;
};

/** Cover image probe — canonical `thumbnailUrl`, tolerating legacy aliases. */
export function thumbnailOf(s: Record<string, unknown> | undefined): string | undefined {
  if (!s) return undefined;
  const candidate = s.thumbnailUrl ?? s.coverImageUrl ?? s.imageUrl ?? s.coverUrl;
  return typeof candidate === "string" && candidate.trim() ? candidate : undefined;
}

/**
 * Read the rating aggregate defensively. The deployed lvlup-ff6fa backend returns
 * `{average, count}` while the TS type says `{averageRating, totalReviews}` —
 * tolerate BOTH (coordinator GATE-0 note: "types lie", code defensively).
 */
function ratingOf(s: SpaceView): { rating: number | null; totalReviews: number | null } {
  const agg = s.ratingAggregate as
    | { averageRating?: number; totalReviews?: number; average?: number; count?: number }
    | undefined;
  if (!agg) return { rating: null, totalReviews: null };
  const avg = typeof agg.averageRating === "number" ? agg.averageRating : agg.average;
  const total = typeof agg.totalReviews === "number" ? agg.totalReviews : agg.count;
  return {
    rating: typeof avg === "number" && Number.isFinite(avg) ? avg : null,
    totalReviews: typeof total === "number" && Number.isFinite(total) ? total : null,
  };
}

/** Build the spaces-list card model from a space view + (optional) progress. */
export function toSpaceCard(s: SpaceView, progress?: SpaceProgressView): SpaceCardModel {
  const { rating, totalReviews } = ratingOf(s);
  return {
    id: s.id ?? s.spaceId ?? "",
    title: s.title ?? s.name ?? "Untitled space",
    subject: s.subject,
    type: s.type,
    difficulty: (s.labels && s.labels[0]) || undefined,
    thumbnailUrl: thumbnailOf(s as Record<string, unknown>),
    storyPointCount: s.stats?.storyPointCount ?? 0,
    percentage: pct(progress?.percentage),
    rating,
    totalReviews,
  };
}

// ── learning-track node builder (space-detail) ───────────────────────────────

export type TrackNodeModel = {
  id: string;
  title: string;
  typeLabel: string;
  typeIcon: string;
  route: NodeRouteKind;
  state: NodeState;
  percentage: number;
  itemCount: number;
  points: number;
  totalPoints: number;
  estimatedMinutes?: number;
  timed: boolean;
};

export function toTrackNode(sp: StoryPointView, progress?: SpaceProgressView): TrackNodeModel {
  const meta = storyPointTypeMeta(sp.type);
  const spProgress = progress?.storyPoints?.[sp.id];
  const percentage = pct(spProgress?.percentage);
  const timed = sp.type === "timed_test";
  return {
    id: sp.id,
    title: sp.title ?? "Untitled",
    typeLabel: meta.label,
    typeIcon: meta.icon,
    route: meta.route,
    state: nodeStateOf(spProgress?.status, percentage),
    percentage,
    itemCount: spProgress?.totalItems ?? sp.stats?.itemCount ?? 0,
    points: spProgress?.pointsEarned ?? 0,
    totalPoints: spProgress?.totalPoints ?? 0,
    estimatedMinutes: sp.assessmentConfig?.durationMinutes ?? sp.estimatedTimeMinutes,
    timed,
  };
}

/** Authored order, tolerating both `order` (deployed seed) and `orderIndex` (canonical). */
export function orderOf(x: { order?: number; orderIndex?: number }): number {
  return x.order ?? x.orderIndex ?? 0;
}

/** Sort story points / items by their authored order. */
export function byOrder<T extends { order?: number; orderIndex?: number }>(a: T, b: T): number {
  return orderOf(a) - orderOf(b);
}

// ── question / material classification (item viewer) ─────────────────────────

/**
 * The item's payload kind, tolerating both `payload.type` (canonical) and
 * `payload.kind` (deployed seed) — coordinator data-shape rule #3. Falls back to
 * the top-level `item.type` when the payload omits a discriminant.
 */
export function payloadKind(item?: ItemView): string | undefined {
  const payload = item?.payload as { type?: string; kind?: string } | undefined;
  return payload?.type ?? payload?.kind ?? item?.type;
}

export function isMaterial(item?: ItemView): boolean {
  return payloadKind(item) === "material";
}

export function isQuestion(item?: ItemView): boolean {
  return payloadKind(item) === "question";
}

/** Pull the question subtype off an answer-stripped item, if any.
 *
 * Handles both schemas:
 *  - v2_ seed:          payload.questionData.questionType
 *  - old hand-authored: payload.questionType (top of payload)
 */
export function questionTypeOf(item?: ItemView): string | undefined {
  if (!isQuestion(item)) return undefined;
  const payload = item?.payload as
    | { questionType?: string; questionData?: { questionType?: string; type?: string } }
    | undefined;
  return (
    payload?.questionData?.questionType ?? payload?.questionData?.type ?? payload?.questionType
  );
}

/** Points an item is worth (question basePoints/points, else 0). */
export function itemPoints(item?: ItemView): number {
  const payload = item?.payload as { basePoints?: number; points?: number } | undefined;
  return payload?.basePoints ?? payload?.points ?? 0;
}

/** A short human label for an item type/subtype (eyebrow + chips). */
export function itemKindLabel(item?: ItemView): string {
  if (isMaterial(item)) return "Material";
  const qt = questionTypeOf(item);
  const QT_LABEL: Record<string, string> = {
    mcq: "Single choice",
    mcaq: "Multiple choice",
    "true-false": "True / false",
    numerical: "Numerical",
    text: "Short answer",
    paragraph: "Long answer",
    code: "Code",
    "fill-blanks": "Fill in the blanks",
    "fill-blanks-dd": "Fill in the blanks",
    matching: "Matching",
    jumbled: "Reorder",
    audio: "Audio",
    image_evaluation: "Image",
    "group-options": "Group options",
    chat_agent_question: "Tutor chat",
  };
  return (qt && QT_LABEL[qt]) ?? "Item";
}
