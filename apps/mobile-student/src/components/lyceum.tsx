/**
 * Lyceum learning-journey primitives — the mobile port of
 * apps/student-web/src/components/common/lyceum.tsx (the design SSOT).
 *
 * Presentational only: deterministic duotone covers, the mastery ring, type /
 * difficulty chips, the mastery badge, the square numbered item-navigator node,
 * the spark points chip, and the warm growth-framed FeedbackPanel. Everything
 * composes the NativeWind Lyceum theme (tailwind.config.js) + src/theme colors.
 */
import { useId, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

import { colors } from "../theme";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { ProgressRing } from "./data";

/* ── Deterministic cover art ─────────────────────────────────────────────
   Spaces rarely have thumbnails; give each one a stable, warm duotone
   cover derived from its title/subject so the library feels designed,
   not empty. Gradient stops come from the Lyceum primitive palette. */
const COVER_GRADIENTS: Array<[string, string]> = [
  ["#322C63", "#564BA6"], // indigo depth
  ["#2D6E8E", "#3F92B8"], // sky
  ["#2F7D5B", "#3EA876"], // green
  ["#C97A14", "#E8972B"], // marigold
  ["#423A82", "#7A6FC9"], // violet indigo
  ["#3D382F", "#756E61"], // warm ink
];

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function coverStops(seed: string): [string, string] {
  return COVER_GRADIENTS[hashSeed(seed) % COVER_GRADIENTS.length];
}

export function SpaceCover({
  seed,
  title,
  thumbnailUrl,
  height = 144,
  className,
}: {
  seed: string;
  title: string;
  thumbnailUrl?: string;
  height?: number;
  className?: string;
}) {
  // SVG def ids are document-global on web; multiple covers (and covers on
  // stacked-but-hidden screens) collide unless each instance is unique.
  // Keep this hook above the thumbnail branch so hook order remains stable if
  // an asynchronously loaded thumbnail changes the rendering path.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (thumbnailUrl) {
    return (
      <View style={{ height }} className={cx("overflow-hidden", className)}>
        <Image
          source={{ uri: thumbnailUrl }}
          resizeMode="cover"
          style={{ width: "100%", height }}
        />
      </View>
    );
  }
  const [from, to] = coverStops(seed);
  const glyph = (title.trim()[0] ?? "?").toUpperCase();
  const duoId = `duo-${uid}`;
  const glowId = `glow-${uid}`;
  return (
    <View style={{ height }} className={cx("relative overflow-hidden", className)}>
      <Svg width="100%" height="100%" style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={duoId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
          {/* soft light from the top-right corner — the bookplate glow */}
          <RadialGradient id={glowId} cx="0.85" cy="-0.2" rx="1.2" ry="1.4">
            <Stop offset="0" stopColor="#FFFDFA" stopOpacity="0.28" />
            <Stop offset="0.55" stopColor="#FFFDFA" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${duoId})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glowId})`} />
      </Svg>
      {/* oversized scholarly glyph */}
      <Text
        className="font-display absolute -bottom-7 right-3"
        style={{
          fontSize: height * 0.78,
          lineHeight: height * 0.82,
          color: "rgba(255,253,250,0.14)",
        }}
      >
        {glyph}
      </Text>
      {/* hairline rule near the base — bookplate idiom */}
      <View
        className="absolute bottom-3 left-4 right-4"
        style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" }}
      />
    </View>
  );
}

/* ── Progress ring (mastery) ───────────────────────────────────────────── */
export function masteryColor(pct: number): string {
  if (pct >= 100) return colors.masteryMastered;
  if (pct > 0) return colors.masteryInProgress;
  return colors.masteryNotStarted;
}

export function MasteryRing({ value, size = 44 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <ProgressRing
      value={pct}
      size={size}
      strokeWidth={4}
      color={masteryColor(pct)}
      label={<Text className="text-text-secondary text-2xs font-mono font-medium">{pct}</Text>}
    />
  );
}

/* ── Story point / space type chips ───────────────────────────────────── */
export const TYPE_META: Record<string, { label: string; icon: string }> = {
  standard: { label: "Learning", icon: "book-open" },
  timed_test: { label: "Timed test", icon: "clock" },
  test: { label: "Test", icon: "clipboard-list" },
  quiz: { label: "Quiz", icon: "zap" },
  practice: { label: "Practice", icon: "dumbbell" },
};

export function TypeChip({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, icon: "book-open" };
  return (
    <View className="border-border-subtle bg-surface rounded-pill flex-row items-center gap-1 self-start border px-2 py-0.5">
      <Icon name={meta.icon} size={12} color={colors.textSecondary} />
      <Text className="font-ui text-text-secondary text-2xs font-medium">{meta.label}</Text>
    </View>
  );
}

const DIFFICULTY_DOT: Record<string, string> = {
  easy: "bg-success",
  beginner: "bg-success",
  medium: "bg-warning",
  intermediate: "bg-warning",
  hard: "bg-error",
  advanced: "bg-error",
  expert: "bg-brand",
};

export function DifficultyChip({ difficulty }: { difficulty?: string | null }) {
  if (!difficulty) return null;
  const key = difficulty.toLowerCase();
  const dot = DIFFICULTY_DOT[key] ?? "bg-border-strong";
  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  return (
    <View className="border-border-subtle bg-surface rounded-pill flex-row items-center gap-1.5 self-start border px-2 py-0.5">
      <View className={cx("h-1.5 w-1.5 rounded-full", dot)} />
      <Text className="font-ui text-text-secondary text-2xs font-medium">{label}</Text>
    </View>
  );
}

/* ── Mastery state (icon + label + color — never color alone) ─────────── */
export function MasteryBadge({
  status,
  percentage,
}: {
  status?: "not_started" | "in_progress" | "completed" | string;
  percentage?: number;
}) {
  if (status === "completed") {
    return (
      <View className="flex-row items-center gap-1">
        <Icon name="check-circle" size={14} color={colors.masteryMastered} />
        <Text className="font-ui text-mastery-mastered text-xs font-medium">Mastered</Text>
      </View>
    );
  }
  if (status === "in_progress") {
    return (
      <View className="flex-row items-center gap-1">
        <Icon name="circle-dot" size={14} color={colors.masteryInProgress} />
        <Text className="font-ui text-mastery-in-progress text-xs font-medium">
          In progress
          {percentage != null && percentage > 0 ? ` · ${Math.round(percentage)}%` : ""}
        </Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-center gap-1">
      <Icon name="circle" size={14} color={colors.textMuted} />
      <Text className="font-ui text-text-muted text-xs font-medium">Not started</Text>
    </View>
  );
}

/* ── Uppercase eyebrow / kicker ───────────────────────────────────────── */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <Text className="font-ui text-brand tracking-caps text-2xs font-semibold uppercase">
      {children}
    </Text>
  );
}

/* ── Spark points chip (earned / total) ───────────────────────────────── */
export function PointsChip({ earned, total }: { earned: number; total: number }) {
  if (total <= 0) return null;
  return (
    <View className="bg-marigold-50 border-marigold-200 flex-row items-center gap-2 self-start rounded-lg border px-3 py-2">
      <Icon name="trophy" size={15} color={colors.spark} />
      <Text className="text-text-primary font-mono text-sm font-semibold">
        {earned}
        <Text className="text-text-muted font-normal"> / {total} pts</Text>
      </Text>
    </View>
  );
}

/* ── Numbered item-navigator node (shared by learn + practice) ─────────── */
export type NavNodeState = "correct" | "partial" | "incorrect" | "idle";

const NAV_NODE_STATE: Record<NavNodeState, { box: string; text: string }> = {
  correct: { box: "bg-mastery-mastered border-transparent", text: "text-text-on-accent" },
  partial: { box: "bg-warning border-transparent", text: "text-text-on-accent" },
  incorrect: { box: "bg-red-200 border-error/40", text: "text-error" },
  idle: { box: "bg-surface-sunken border-transparent", text: "text-text-muted" },
};

export function NavNode({
  index,
  state,
  isCurrent,
  onPress,
}: {
  index: number;
  state: NavNodeState;
  isCurrent: boolean;
  onPress?: () => void;
}) {
  const m = NAV_NODE_STATE[state];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isCurrent }}
      className={cx(
        "h-11 w-11 items-center justify-center rounded-md border",
        m.box,
        isCurrent && "border-brand border-2"
      )}
    >
      <Text className={cx("font-mono text-sm font-medium", m.text)}>{index + 1}</Text>
    </Pressable>
  );
}

/** Horizontally scrollable numbered navigator row — the one-question-at-a-time spine. */
export function ItemNavigatorRow({
  states,
  current,
  onSelect,
  className,
}: {
  states: NavNodeState[];
  current: number;
  onSelect: (i: number) => void;
  className?: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row items-center gap-2 px-1 py-1"
      className={cx("flex-grow-0", className)}
    >
      {states.map((s, i) => (
        <NavNode
          key={i}
          index={i}
          state={s}
          isCurrent={i === current}
          onPress={() => onSelect(i)}
        />
      ))}
    </ScrollView>
  );
}

/* ── Warm growth-framed feedback panel ────────────────────────────────── */
export type FeedbackVerdict = "correct" | "partial" | "incorrect";

export interface FeedbackPanelProps {
  verdict: FeedbackVerdict;
  score?: number | null;
  maxScore?: number | null;
  percentage?: number | null;
  /** The grader's overall comment / feedback line. */
  comment?: string | null;
  /** The authored explanation for the question, if any. */
  explanation?: string | null;
  strengths?: string[];
  weaknesses?: string[];
  missingConcepts?: string[];
}

const VERDICT_META: Record<
  FeedbackVerdict,
  { title: string; icon: string; frame: string; bar: string; color: string; text: string }
> = {
  correct: {
    title: "Got it!",
    icon: "check-circle",
    frame: "border-success/30 bg-green-200/30",
    bar: "bg-success",
    color: "#2F7D5B",
    text: "text-success",
  },
  partial: {
    title: "You're close — let's look at this part again",
    icon: "circle-dot",
    frame: "border-warning/30 bg-marigold-50",
    bar: "bg-warning",
    color: "#B7791F",
    text: "text-warning",
  },
  incorrect: {
    title: "Not quite yet — let's work through it",
    icon: "alert-circle",
    frame: "border-error/30 bg-red-200/30",
    bar: "bg-error",
    color: "#B23A36",
    text: "text-error",
  },
};

function FeedbackSection({
  icon,
  color,
  textClass,
  title,
  items,
}: {
  icon: string;
  color: string;
  textClass: string;
  title: string;
  items: string[];
}) {
  if (!items.length) return null;
  return (
    <View className="mt-3 gap-1">
      <View className="flex-row items-center gap-1.5">
        <Icon name={icon} size={13} color={color} />
        <Text className={cx("font-ui text-xs font-semibold", textClass)}>{title}</Text>
      </View>
      {items.map((s, i) => (
        <View key={i} className="flex-row gap-2 pl-1">
          <Text className="text-text-muted text-xs">•</Text>
          <Text className="font-ui text-text-secondary flex-1 text-xs leading-5">{s}</Text>
        </View>
      ))}
    </View>
  );
}

export function FeedbackPanel({
  verdict,
  score,
  maxScore,
  percentage,
  comment,
  explanation,
  strengths = [],
  weaknesses = [],
  missingConcepts = [],
}: FeedbackPanelProps) {
  const m = VERDICT_META[verdict];
  return (
    <View accessibilityLiveRegion="polite" className={cx("rounded-lg border p-4", m.frame)}>
      <View className="flex-row items-center gap-2">
        <Icon name={m.icon} size={19} color={m.color} />
        <Text className={cx("font-display flex-1 text-base leading-6", m.text)}>{m.title}</Text>
        {score != null && maxScore != null ? (
          <Text className="text-text-primary font-mono text-sm font-medium">
            {score}/{maxScore} pts
          </Text>
        ) : null}
      </View>

      {percentage != null ? (
        <View className="mt-3">
          <View className="bg-surface rounded-pill h-1.5 w-full overflow-hidden">
            <View
              className={cx("rounded-pill h-full", m.bar)}
              style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
            />
          </View>
          <Text className="text-text-muted mt-1 font-mono text-xs">{Math.round(percentage)}%</Text>
        </View>
      ) : null}

      {explanation ? (
        <Text className="font-ui text-text-secondary mt-2 text-sm leading-6">{explanation}</Text>
      ) : null}
      {comment ? (
        <Text className="font-ui text-text-primary mt-2 text-sm leading-6">{comment}</Text>
      ) : null}

      <FeedbackSection
        icon="sparkles"
        color="#2F7D5B"
        textClass="text-success"
        title="What you did well"
        items={strengths}
      />
      <FeedbackSection
        icon="sprout"
        color="#B7791F"
        textClass="text-warning"
        title="Where to grow"
        items={weaknesses}
      />
      <FeedbackSection
        icon="book-open"
        color="#565046"
        textClass="text-text-secondary"
        title="Worth revisiting"
        items={missingConcepts}
      />
    </View>
  );
}

/* ── Space-scoped bottom nav (a space is its own little world) ─────────── */
export interface SpaceNavItem {
  key: string;
  icon: string;
  label: string;
}

/**
 * The bottom nav shown while INSIDE a space (the main tab bar hides). A back
 * affordance on the left returns to the spaces library; the remaining slots
 * switch the space's own sections (Overview / Content / Progress / …).
 */
export function SpaceTabbar({
  items,
  activeKey,
  onSelect,
  onBack,
}: {
  items: SpaceNavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      className="border-border-subtle bg-surface flex-row items-stretch border-t px-2 pt-2"
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to spaces"
        className="items-center justify-start gap-1 px-3 py-1"
      >
        <View className="bg-surface-sunken h-[26px] w-[26px] items-center justify-center rounded-full">
          <Icon name="arrow-left" size={16} color={colors.textSecondary} />
        </View>
        <Text className="font-ui text-2xs text-text-muted">Back</Text>
      </Pressable>
      <View className="bg-border-subtle mx-1 w-px" />
      {items.map((it) => {
        const active = it.key === activeKey;
        return (
          <Pressable
            key={it.key}
            onPress={() => onSelect(it.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="flex-1 items-center gap-1 py-1"
          >
            <Icon
              name={it.icon}
              size={22}
              color={active ? colors.brand : colors.textMuted}
              strokeWidth={active ? 2.4 : 2}
            />
            <Text
              className={cx(
                "font-ui text-2xs",
                active ? "text-brand font-semibold" : "text-text-muted"
              )}
            >
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Question-view bottom nav (item stepping lives here, not in the card) ── */
export interface QuestionNavStep {
  onPress: () => void;
  disabled?: boolean;
  /** Stepping crosses into the prev/next lesson (double chevron affordance). */
  crossing?: boolean;
}

/**
 * The fixed bottom bar for the one-question-at-a-time screens: back to the
 * space on the left, prev / position / next in the middle, optional trailing
 * quick actions (practice, lesson) on the right. Keeps the question card itself
 * free of navigation clutter.
 */
export function QuestionNavBar({
  onBack,
  prev,
  next,
  position,
  total,
  actions,
}: {
  onBack: () => void;
  prev: QuestionNavStep;
  next: QuestionNavStep;
  position: number;
  total: number;
  actions?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const stepClass = (disabled?: boolean) =>
    cx(
      "h-11 w-11 items-center justify-center rounded-md border",
      disabled
        ? "border-border-subtle bg-surface opacity-40"
        : "border-border-strong bg-surface active:bg-surface-sunken"
    );
  return (
    <View
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      className="border-border-subtle bg-surface flex-row items-center gap-2 border-t px-4 pt-2.5"
    >
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to space"
        className="bg-surface-sunken active:bg-paper-200 h-11 w-11 items-center justify-center rounded-md"
      >
        <Icon name="arrow-left" size={19} color={colors.textSecondary} />
      </Pressable>

      <View className="flex-1 flex-row items-center justify-center gap-2">
        <Pressable
          onPress={prev.onPress}
          disabled={prev.disabled}
          accessibilityRole="button"
          accessibilityLabel={prev.crossing ? "Previous lesson" : "Previous question"}
          className={stepClass(prev.disabled)}
        >
          <Icon
            name={prev.crossing ? "chevrons-left" : "chevron-left"}
            size={19}
            color={prev.disabled ? colors.textMuted : colors.textPrimary}
          />
        </Pressable>
        <View style={{ minWidth: 64 }} className="items-center">
          <Text className="text-text-secondary font-mono text-sm">
            {position} / {total}
          </Text>
        </View>
        <Pressable
          onPress={next.onPress}
          disabled={next.disabled}
          accessibilityRole="button"
          accessibilityLabel={next.crossing ? "Next lesson" : "Next question"}
          className={stepClass(next.disabled)}
        >
          <Icon
            name={next.crossing ? "chevrons-right" : "chevron-right"}
            size={19}
            color={next.disabled ? colors.textMuted : colors.textPrimary}
          />
        </Pressable>
      </View>

      {actions ?? <View style={{ width: 44 }} />}
    </View>
  );
}

/**
 * Pull a FeedbackPanel payload out of a raw recordItemAttempt result. The server
 * returns { completed, progress: { evaluation } } where `evaluation` is the
 * StoredEvaluation carrying the rich AI-grader fields (score, strengths,
 * weaknesses, missingConcepts, and an object `summary` of { keyTakeaway,
 * overallComment }). Everything is read defensively — a missing field just hides
 * its section.
 */
export function toFeedbackProps(raw: unknown): Omit<FeedbackPanelProps, "verdict"> {
  const d = (raw ?? {}) as { progress?: Record<string, unknown> };
  const p = (d.progress ?? {}) as {
    evaluation?: Record<string, unknown> | null;
    feedback?: unknown;
  };
  const ev = (p.evaluation ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const summary = (ev.summary ?? {}) as { overallComment?: unknown; keyTakeaway?: unknown };
  return {
    score: num(ev.score),
    maxScore: num(ev.maxScore),
    percentage: num(ev.percentage),
    comment:
      str(summary.overallComment) ??
      str(summary.keyTakeaway) ??
      str(ev.feedback) ??
      str(p.feedback),
    strengths: arr(ev.strengths),
    weaknesses: arr(ev.weaknesses),
    missingConcepts: arr(ev.missingConcepts),
  };
}
