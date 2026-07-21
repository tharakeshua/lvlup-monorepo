/**
 * Small feedback pills: confidence badge, mistake-type chip, severity tag, and
 * the low-confidence review banner. Each carries a text label (icon alone never
 * conveys meaning — a11y §6).
 */
import { Text, View } from "react-native";

import { Icon } from "../../Icon";
import { cx } from "../../cx";
import { tone } from "./tone";
import type { ConfidenceLevel } from "./adapter";
import type { FeedbackSeverity } from "./types";

/* ── Confidence badge (quiet) ───────────────────────────────────────────── */
const CONF_META: Record<ConfidenceLevel, { label: string; dot: string }> = {
  high: { label: "High confidence", dot: tone.confHigh },
  med: { label: "Confident", dot: tone.confMed },
  low: { label: "Review suggested", dot: tone.confLow },
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const m = CONF_META[level];
  return (
    <View
      accessibilityLabel={`Grader confidence: ${m.label}`}
      className="border-border-subtle rounded-pill flex-row items-center gap-1.5 self-start border px-2.5 py-1"
    >
      <View style={{ backgroundColor: m.dot }} className="h-1.5 w-1.5 rounded-full" />
      <Text className="font-ui text-text-secondary text-2xs font-medium">{m.label}</Text>
    </View>
  );
}

/* ── Mistake-type chip (only when not "None") ───────────────────────────── */
const MISTAKE_ICON: Record<string, string> = {
  Conceptual: "git-branch",
  "Silly Error": "eraser",
  "Knowledge Gap": "book-open",
};

export function MistakeChip({ label }: { label: string }) {
  return (
    <View
      accessibilityLabel={`Mistake type: ${label}`}
      style={{ backgroundColor: tone.infoSubtle }}
      className="rounded-pill flex-row items-center gap-1.5 self-start px-2.5 py-1"
    >
      <Icon name={MISTAKE_ICON[label] ?? "shuffle"} size={12} color={tone.info} />
      <Text style={{ color: tone.info }} className="font-ui text-2xs font-medium">
        {label}
      </Text>
    </View>
  );
}

/* ── Severity tag (critical / major / minor) ────────────────────────────── */
const SEV_META: Record<FeedbackSeverity, { fg: string; bg: string }> = {
  critical: { fg: tone.error, bg: tone.errorSubtle },
  major: { fg: tone.warning, bg: tone.warningSubtle },
  minor: { fg: tone.info, bg: tone.infoSubtle },
};

export function SeverityTag({ severity }: { severity: FeedbackSeverity }) {
  const m = SEV_META[severity];
  return (
    <View style={{ backgroundColor: m.bg }} className="rounded-pill self-start px-2 py-0.5">
      <Text style={{ color: m.fg }} className="font-ui text-2xs font-semibold capitalize">
        {severity}
      </Text>
    </View>
  );
}

/* ── Review banner (low confidence → teacher can re-grade) ──────────────── */
export function ReviewBanner({
  text = "The AI wasn't fully sure here — your teacher can review this grade.",
}: {
  text?: string;
}) {
  return (
    <View
      accessibilityRole="alert"
      className={cx(
        "border-border-subtle bg-surface-sunken flex-row items-center gap-2 rounded-md border px-3 py-2.5"
      )}
    >
      <Icon name="shield-question" size={15} color={tone.brand} />
      <Text className="font-ui text-text-secondary flex-1 text-xs leading-5">{text}</Text>
    </View>
  );
}
