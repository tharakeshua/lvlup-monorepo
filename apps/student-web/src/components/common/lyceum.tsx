/**
 * Lyceum visual primitives for the student learning journey.
 *
 * Small, presentational-only pieces shared by the spaces → story points →
 * items screens. Everything composes the Lyceum preset tokens (semantic
 * Tailwind utilities from @levelup/lyceum-preset) — no data fetching here.
 */
import {
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock,
  ClipboardList,
  Dumbbell,
  Zap,
} from "lucide-react";

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

export function coverGradient(seed: string): string {
  const [from, to] = COVER_GRADIENTS[hashSeed(seed) % COVER_GRADIENTS.length];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

export function SpaceCover({
  seed,
  title,
  thumbnailUrl,
  className = "",
}: {
  seed: string;
  title: string;
  thumbnailUrl?: string;
  className?: string;
}) {
  if (thumbnailUrl) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  const glyph = (title.trim()[0] ?? "?").toUpperCase();
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden ${className}`}
      style={{ background: coverGradient(seed) }}
    >
      {/* soft light from the top-right corner */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 85% -20%, rgba(255,253,250,0.28) 0%, rgba(255,253,250,0.0) 55%)",
        }}
      />
      {/* oversized scholarly glyph */}
      <span
        className="font-display absolute -bottom-6 right-3 select-none leading-none text-white/[0.14]"
        style={{ fontSize: "7rem" }}
      >
        {glyph}
      </span>
      {/* hairline rule near the base — bookplate idiom */}
      <div className="absolute bottom-3 left-4 right-4 border-t border-white/20" />
    </div>
  );
}

/* ── Progress ring (mastery) ───────────────────────────────────────────── */
export function ProgressRing({
  value,
  size = 44,
  strokeWidth = 4,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const tone =
    pct >= 100
      ? "text-mastery-mastered"
      : pct > 0
        ? "text-mastery-in-progress"
        : "text-mastery-not-started";
  return (
    <span
      role="img"
      aria-label={pct > 0 ? `${pct}% mastered` : "Ready when you are"}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="text-subtle stroke-current"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          className={`stroke-current ${tone} duration-slow ease-standard transition-[stroke-dashoffset]`}
        />
      </svg>
      <span className="text-fg-secondary text-2xs absolute font-mono font-medium tabular-nums">
        {pct}
      </span>
    </span>
  );
}

/* ── Story point / space type chips ───────────────────────────────────── */
export const TYPE_META: Record<string, { label: string; Icon: typeof BookOpen }> = {
  standard: { label: "Learning", Icon: BookOpen },
  timed_test: { label: "Timed test", Icon: Clock },
  test: { label: "Test", Icon: ClipboardList },
  quiz: { label: "Quiz", Icon: Zap },
  practice: { label: "Practice", Icon: Dumbbell },
};

export function TypeChip({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, Icon: BookOpen };
  const { label, Icon } = meta;
  return (
    <span className="border-subtle bg-surface text-fg-secondary rounded-pill text-2xs inline-flex shrink-0 items-center gap-1 border px-2 py-0.5 font-medium">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

const DIFFICULTY_DOT: Record<string, string> = {
  easy: "bg-success",
  medium: "bg-warning",
  hard: "bg-error",
  expert: "bg-brand",
};

export function DifficultyChip({ difficulty }: { difficulty?: string | null }) {
  if (!difficulty) return null;
  const dot = DIFFICULTY_DOT[difficulty] ?? "bg-strong";
  return (
    <span className="border-subtle bg-surface text-fg-secondary rounded-pill text-2xs inline-flex shrink-0 items-center gap-1.5 border px-2 py-0.5 font-medium capitalize">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {difficulty}
    </span>
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
      <span className="text-mastery-mastered inline-flex items-center gap-1 text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Mastered
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="text-mastery-in-progress inline-flex items-center gap-1 text-xs font-medium">
        <CircleDot className="h-3.5 w-3.5" aria-hidden /> In progress
        {percentage != null && percentage > 0 && (
          <span className="font-mono tabular-nums">· {Math.round(percentage)}%</span>
        )}
      </span>
    );
  }
  return (
    <span className="text-fg-muted inline-flex items-center gap-1 text-xs font-medium">
      <Circle className="h-3.5 w-3.5" aria-hidden /> Not started
    </span>
  );
}

/* ── Uppercase eyebrow / kicker ───────────────────────────────────────── */
export function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-brand text-2xs tracking-caps font-semibold uppercase">{children}</p>;
}

/* ── Numbered item-navigator node styling (shared by learn + practice) ── */
export type NavNodeState = "correct" | "partial" | "incorrect" | "idle";

const NAV_NODE_STATE: Record<NavNodeState, string> = {
  correct: "bg-mastery-mastered text-fg-on-accent border-transparent",
  partial: "bg-warning text-fg-on-accent border-transparent",
  incorrect: "bg-error-subtle text-error border-error/30",
  idle: "bg-surface-sunken text-fg-muted border-transparent hover:bg-brand-subtle hover:text-brand",
};

export function navNodeClass(state: NavNodeState, isCurrent: boolean): string {
  return [
    "flex h-9 w-9 items-center justify-center rounded-md border font-mono text-xs font-medium tabular-nums",
    "transition-colors duration-fast ease-standard",
    NAV_NODE_STATE[state],
    isCurrent ? "ring-2 ring-brand ring-offset-1 ring-offset-surface" : "",
  ].join(" ");
}
