/**
 * Tests-lane pure helpers (no React, no I/O). Status taxonomy, grade mapping and
 * clock/percentage formatting — shared by every screen in `src/screens/tests`.
 *
 * The server is authoritative for status and score: these helpers only RENDER
 * what the projection already decided (e.g. status is never recomputed from the
 * device clock). Source of truth for the status set is the design viewjs in
 * `docs/rebuild-spec/design/build/app/mobile-family/_build/`.
 */
import type { BadgeVariant } from "./bits";

/** mm:ss from a (possibly fractional) seconds count, clamped at 0. */
export function clock(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

/** Whole-percent of got/max, guarding divide-by-zero. */
export function pct(got: number, max: number): number {
  if (!max || max <= 0) return 0;
  return Math.round((got / max) * 100);
}

/** Letter grade from a percentage (matches the web GradePill bands). */
export function gradeFromPct(p: number | null | undefined): string {
  if (p == null) return "B";
  if (p >= 90) return "A";
  if (p >= 80) return "B";
  if (p >= 70) return "C";
  if (p >= 60) return "D";
  return "F";
}

/** GradePill tone from a percentage against a pass mark. */
export function gradeTone(
  p: number | null | undefined,
  passMark = 70
): "success" | "warning" | "error" | "neutral" {
  if (p == null) return "neutral";
  if (p >= passMark) return "success";
  if (p >= passMark - 15) return "warning";
  return "error";
}

/**
 * The list/landing-facing test status (richer than the raw session status). The
 * server projection may send any of these; we degrade an unknown value to
 * `closed`. `in_progress`/`completed`/`expired`/`abandoned` are the four raw
 * `DigitalTestSession` statuses; the rest are availability states the projection
 * layers on top.
 */
export type TestStatus =
  | "available"
  | "in_progress"
  | "scheduled"
  | "cooldown"
  | "completed"
  | "closed"
  | "expired"
  | "abandoned"
  | "locked";

export interface StatusMeta {
  label: string;
  icon: string;
  badge: BadgeVariant | null;
  actionable: boolean;
  intent: string;
  group: "Available" | "Upcoming" | "Completed" | "Locked";
}

export const STATUS_META: Record<TestStatus, StatusMeta> = {
  available: {
    label: "Available",
    icon: "circle-play",
    badge: "brand",
    actionable: true,
    intent: "Start",
    group: "Available",
  },
  in_progress: {
    label: "In progress",
    icon: "play",
    badge: "spark",
    actionable: true,
    intent: "Resume",
    group: "Available",
  },
  scheduled: {
    label: "Upcoming",
    icon: "calendar-clock",
    badge: "info",
    actionable: false,
    intent: "Opens",
    group: "Upcoming",
  },
  cooldown: {
    label: "Cooldown",
    icon: "refresh-cw",
    badge: "warning",
    actionable: false,
    intent: "Retry soon",
    group: "Available",
  },
  completed: {
    label: "Completed",
    icon: "check-circle",
    badge: "success",
    actionable: true,
    intent: "Review",
    group: "Completed",
  },
  closed: {
    label: "Closed",
    icon: "lock",
    badge: "neutral",
    actionable: false,
    intent: "Closed",
    group: "Completed",
  },
  expired: {
    label: "Closed",
    icon: "lock",
    badge: "neutral",
    actionable: false,
    intent: "Closed",
    group: "Completed",
  },
  abandoned: {
    label: "Closed",
    icon: "lock",
    badge: "neutral",
    actionable: false,
    intent: "Closed",
    group: "Completed",
  },
  locked: {
    label: "Locked",
    icon: "lock",
    badge: "neutral",
    actionable: true,
    intent: "Review",
    group: "Locked",
  },
};

export function statusMeta(status: string | undefined): StatusMeta {
  return STATUS_META[(status ?? "closed") as TestStatus] ?? STATUS_META.closed;
}

export const LIST_FILTERS = ["All", "Available", "Upcoming", "Completed", "Locked"] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];

/** Time-sensitive ordering for the default (window) sort. */
export const STATUS_ORDER: TestStatus[] = [
  "in_progress",
  "available",
  "cooldown",
  "scheduled",
  "completed",
  "closed",
  "expired",
  "abandoned",
  "locked",
];
