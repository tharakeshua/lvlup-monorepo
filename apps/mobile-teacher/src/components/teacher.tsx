/**
 * Teacher-specific composites layered on the shared Lyceum RN kit.
 *
 *   RosterRow        — class roster line (avatar, progress, score/grade, status)
 *   SubmissionCard   — grading-queue row (student, status, confidence, score)
 *   ConfidenceBadge  — autograde confidence band (high/medium/low + %)
 *   RubricRow        — one rubric criterion / sub-question (earned / max)
 *   RubricBreakdown  — list of RubricRows with a total footer
 *   ScoreInput       — manual-override numeric points entry (clamped, "/ max")
 *   ScoreStepper     — +/- points stepper
 *   MetricCard       — insights KPI tile (value, delta/trend, optional visual)
 *   AtRiskRow        — intervention-triage line (reasons, severity, trend)
 *   RoleTenantPill   — top-bar tenant/role switcher trigger
 *   FilterChips      — horizontal-scroll filter row
 *
 * Look mirrors docs/rebuild-spec/design/build/prototypes/teacher/*.card.html
 * and Lyceum-Mobile-Staff.html. All reads are defensive (null/undefined safe).
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "../theme";
import { Avatar, Badge, ProgressBar } from "./data";
import { cx } from "./cx";
import { Icon, renderIcon } from "./Icon";
import { Sparkline } from "./charts";
import type {
  AtRiskRowProps,
  BadgeVariant,
  ConfidenceBadgeProps,
  ConfidenceLevel,
  FilterChipsProps,
  MetricCardProps,
  RiskSeverity,
  RoleTenantPillProps,
  RosterRowProps,
  RubricBreakdownProps,
  RubricCriterion,
  RubricRowProps,
  ScoreInputProps,
  ScoreStepperProps,
  StudentStatus,
  SubmissionCardProps,
  SubmissionStatus,
  TrendDir,
} from "./_types";

// --- shared helpers ---------------------------------------------------------
function initialsFrom(name: string, fallback?: string): string {
  if (fallback) return fallback.slice(0, 2).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const GRADE_TONE: Record<string, BadgeVariant> = {
  A: "success",
  B: "success",
  C: "warning",
  D: "warning",
  F: "error",
};

function gradeBadgeVariant(grade?: string | null): BadgeVariant {
  if (!grade) return "neutral";
  return GRADE_TONE[grade.trim().charAt(0).toUpperCase()] ?? "neutral";
}

function Checkbox({ checked, onPress }: { checked?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <View
        className={cx(
          "h-5 w-5 items-center justify-center rounded-sm border",
          checked ? "border-brand bg-brand" : "border-border-strong bg-surface"
        )}
      >
        {checked && <Icon name="check" size={13} color={colors.textOnAccent} strokeWidth={3} />}
      </View>
    </Pressable>
  );
}

const TREND_META: Record<TrendDir, { icon: string | null; color: string }> = {
  up: { icon: "trending-up", color: colors.success },
  down: { icon: "trending-down", color: colors.error },
  flat: { icon: "minus", color: colors.textMuted },
  na: { icon: null, color: colors.textMuted },
};

// --- RosterRow --------------------------------------------------------------
const STATUS_BADGE: Record<StudentStatus, { variant: BadgeVariant; icon: string; label: string }> =
  {
    active: { variant: "success", icon: "check-circle", label: "Active" },
    inactive: { variant: "neutral", icon: "moon", label: "Inactive" },
    pending: { variant: "warning", icon: "clock", label: "Pending" },
    invited: { variant: "info", icon: "mail", label: "Invited" },
  };

export function RosterRow({
  name,
  initials,
  avatarUri,
  roll,
  progress,
  score,
  grade,
  status = "active",
  atRisk,
  lastActive,
  selectable,
  selected,
  onToggleSelect,
  onPress,
  trailing,
  className,
}: RosterRowProps) {
  const st = STATUS_BADGE[status] ?? STATUS_BADGE.active;
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      className={cx(
        "border-border-subtle bg-surface flex-row items-center gap-3 rounded-lg border px-3 py-3",
        onPress && "active:bg-surface-sunken",
        className
      )}
    >
      {selectable && <Checkbox checked={selected} onPress={onToggleSelect} />}
      <Avatar uri={avatarUri} initials={initialsFrom(name, initials)} size="md" />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className="font-ui text-text-primary flex-1 text-base font-semibold"
          >
            {name}
          </Text>
          {atRisk && <Icon name="alert-triangle" size={14} color={colors.error} />}
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          {roll != null && <Text className="text-2xs text-text-muted font-mono">#{roll}</Text>}
          <Badge variant={st.variant} icon={st.icon} className="px-2 py-0.5">
            {st.label}
          </Badge>
          {lastActive != null && (
            <Text className="font-ui text-2xs text-text-muted">{lastActive}</Text>
          )}
        </View>
        {progress != null && (
          <View className="mt-2 flex-row items-center gap-2">
            <ProgressBar value={progress} height={6} className="flex-1" />
            <Text className="text-2xs text-text-muted font-mono">{Math.round(progress)}%</Text>
          </View>
        )}
      </View>
      {trailing ?? (
        <View className="items-end gap-1">
          {grade ? <Badge variant={gradeBadgeVariant(grade)}>{grade}</Badge> : null}
          <Text className="text-text-primary font-mono text-sm font-semibold">
            {score == null ? "—" : score}
          </Text>
        </View>
      )}
    </Wrap>
  );
}

// --- ConfidenceBadge --------------------------------------------------------
const CONF_META: Record<ConfidenceLevel, { variant: BadgeVariant; icon: string; label: string }> = {
  high: { variant: "success", icon: "shield-check", label: "High" },
  medium: { variant: "warning", icon: "shield", label: "Medium" },
  low: { variant: "error", icon: "shield-alert", label: "Low" },
};

function bandFromScore(score?: number): ConfidenceLevel {
  if (score == null) return "medium";
  if (score >= 0.85) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

export function ConfidenceBadge({
  level,
  score,
  hidePercent,
  size = "md",
  className,
}: ConfidenceBadgeProps) {
  const band = level ?? bandFromScore(score);
  const m = CONF_META[band];
  const pct = score != null ? `${Math.round(score * 100)}%` : null;
  return (
    <Badge
      variant={m.variant}
      icon={m.icon}
      className={cx(size === "sm" && "px-2 py-0.5", className)}
    >
      {m.label}
      {!hidePercent && pct ? ` · ${pct}` : ""}
    </Badge>
  );
}

// --- SubmissionCard ---------------------------------------------------------
const SUBMISSION_STATUS: Record<
  SubmissionStatus,
  { variant: BadgeVariant; icon: string; label: string }
> = {
  awaiting: { variant: "neutral", icon: "clock", label: "Awaiting" },
  "auto-graded": { variant: "info", icon: "sparkles", label: "Auto-graded" },
  "needs-review": { variant: "warning", icon: "eye", label: "Needs review" },
  reviewed: { variant: "brand", icon: "check", label: "Reviewed" },
  released: { variant: "success", icon: "send", label: "Released" },
  flagged: { variant: "error", icon: "flag", label: "Flagged" },
  error: { variant: "error", icon: "alert-circle", label: "Error" },
};

export function SubmissionCard({
  studentName,
  initials,
  avatarUri,
  meta,
  status = "awaiting",
  confidence,
  confidenceScore,
  score,
  maxScore,
  onPress,
  trailing,
  className,
}: SubmissionCardProps) {
  const st = SUBMISSION_STATUS[status] ?? SUBMISSION_STATUS.awaiting;
  const showConfidence = confidence != null || confidenceScore != null;
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      className={cx(
        "border-border-subtle bg-surface gap-2.5 rounded-lg border p-3.5",
        onPress && "active:bg-surface-sunken",
        className
      )}
    >
      <View className="flex-row items-center gap-3">
        <Avatar uri={avatarUri} initials={initialsFrom(studentName, initials)} size="md" />
        <View className="flex-1">
          <Text numberOfLines={1} className="font-ui text-text-primary text-base font-semibold">
            {studentName}
          </Text>
          {meta != null && (
            <Text numberOfLines={1} className="font-ui text-text-muted mt-0.5 text-xs">
              {meta}
            </Text>
          )}
        </View>
        {trailing ??
          (score != null ? (
            <View className="items-end">
              <Text className="text-text-primary font-mono text-base font-bold">
                {score}
                {maxScore != null && (
                  <Text className="text-text-muted font-mono text-xs font-normal">{` / ${maxScore}`}</Text>
                )}
              </Text>
            </View>
          ) : null)}
      </View>
      <View className="flex-row items-center gap-2">
        <Badge variant={st.variant} icon={st.icon}>
          {st.label}
        </Badge>
        {showConfidence && <ConfidenceBadge level={confidence} score={confidenceScore} size="sm" />}
      </View>
    </Wrap>
  );
}

// --- RubricRow --------------------------------------------------------------
const RUBRIC_STATE: Record<string, { icon: string; color: string }> = {
  met: { icon: "check-circle", color: colors.success },
  partial: { icon: "circle-dot", color: colors.warning },
  missed: { icon: "x-circle", color: colors.error },
};

export function RubricRow(props: RubricRowProps) {
  const c: RubricCriterion = props.criterion ?? {
    label: props.label,
    earned: props.earned,
    max: props.max,
    note: props.note,
    state: props.state,
  };
  const state =
    c.state ??
    (c.earned != null && c.max != null
      ? c.earned >= c.max
        ? "met"
        : c.earned <= 0
          ? "missed"
          : "partial"
      : undefined);
  const sm = state ? RUBRIC_STATE[state] : null;
  const Wrap = props.onPress ? Pressable : View;
  return (
    <Wrap
      onPress={props.onPress}
      className={cx(
        "flex-row items-start gap-3 rounded-md px-1 py-2.5",
        props.onPress && "active:bg-surface-sunken",
        props.className
      )}
    >
      {sm && <Icon name={sm.icon} size={18} color={sm.color} className="mt-0.5" />}
      <View className="flex-1">
        <Text className="font-ui text-text-primary text-sm font-medium">{c.label}</Text>
        {c.note != null && <Text className="font-ui text-text-muted mt-0.5 text-xs">{c.note}</Text>}
      </View>
      {(c.earned != null || c.max != null) && (
        <Text className="text-text-primary font-mono text-sm font-semibold">
          {c.earned ?? 0}
          {c.max != null && <Text className="text-text-muted">{` / ${c.max}`}</Text>}
        </Text>
      )}
      {props.onPress && (
        <Icon name="pencil" size={14} color={colors.textMuted} className="mt-0.5" />
      )}
    </Wrap>
  );
}

// --- RubricBreakdown --------------------------------------------------------
export function RubricBreakdown({
  criteria = [],
  totalEarned,
  totalMax,
  title,
  className,
}: RubricBreakdownProps) {
  const earned = totalEarned ?? criteria.reduce((s, c) => s + (c.earned ?? 0), 0);
  const max = totalMax ?? criteria.reduce((s, c) => s + (c.max ?? 0), 0);
  return (
    <View className={cx("border-border-subtle bg-surface rounded-lg border p-3", className)}>
      {title != null && (
        <Text className="font-ui text-text-secondary mb-1 text-sm font-semibold">{title}</Text>
      )}
      <View className="divide-border-subtle divide-y">
        {criteria.map((c, i) => (
          <RubricRow key={i} criterion={c} />
        ))}
      </View>
      {criteria.length > 0 && <View className="bg-border-subtle my-1 h-px w-full" />}
      <View className="flex-row items-center justify-between px-1 pt-1">
        <Text className="font-ui text-text-primary text-sm font-semibold">Total</Text>
        <Text className="text-text-primary font-mono text-base font-bold">
          {earned}
          <Text className="text-text-muted font-normal">{` / ${max}`}</Text>
        </Text>
      </View>
    </View>
  );
}

// --- ScoreInput -------------------------------------------------------------
function clampScore(n: number, min: number, max?: number): number {
  let v = n;
  if (v < min) v = min;
  if (max != null && v > max) v = max;
  return v;
}

export function ScoreInput({
  value,
  onChange,
  max,
  min = 0,
  step = 1,
  label,
  disabled,
  autoFocus,
  className,
}: ScoreInputProps) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [focused, setFocused] = useState(false);

  function commit(raw: string) {
    setText(raw);
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange?.(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isNaN(n)) onChange?.(clampScore(n, min, max));
  }

  return (
    <View className={cx("gap-1.5", className)}>
      {label != null && (
        <Text className="font-ui text-text-secondary text-sm font-semibold">{label}</Text>
      )}
      <View
        className={cx(
          "bg-surface flex-row items-center rounded-md border px-3",
          disabled
            ? "border-border-strong opacity-50"
            : focused
              ? "border-brand"
              : "border-border-strong"
        )}
      >
        <TextInput
          value={text}
          editable={!disabled}
          autoFocus={autoFocus}
          keyboardType={step < 1 ? "decimal-pad" : "number-pad"}
          placeholder="—"
          placeholderTextColor={colors.textMuted}
          onChangeText={commit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="text-text-primary min-w-[40px] flex-1 py-3 font-mono text-lg font-bold"
        />
        {max != null && <Text className="text-text-muted font-mono text-base">{`/ ${max}`}</Text>}
      </View>
    </View>
  );
}

// --- ScoreStepper -----------------------------------------------------------
export function ScoreStepper({
  value = 0,
  onChange,
  min = 0,
  max,
  step = 1,
  label,
  disabled,
  className,
}: ScoreStepperProps) {
  const set = (n: number) => !disabled && onChange?.(clampScore(n, min, max));
  const atMin = value <= min;
  const atMax = max != null && value >= max;
  return (
    <View className={cx("gap-1.5", className)}>
      {label != null && (
        <Text className="font-ui text-text-secondary text-sm font-semibold">{label}</Text>
      )}
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => set(value - step)}
          disabled={disabled || atMin}
          className={cx(
            "border-border-strong bg-surface active:bg-surface-sunken h-10 w-10 items-center justify-center rounded-md border",
            (disabled || atMin) && "opacity-40"
          )}
        >
          <Icon name="minus" size={18} color={colors.textPrimary} />
        </Pressable>
        <View className="min-w-[56px] flex-row items-baseline justify-center gap-0.5">
          <Text className="text-text-primary font-mono text-2xl font-bold">{value}</Text>
          {max != null && <Text className="text-text-muted font-mono text-sm">{`/${max}`}</Text>}
        </View>
        <Pressable
          onPress={() => set(value + step)}
          disabled={disabled || atMax}
          className={cx(
            "border-border-strong bg-surface active:bg-surface-sunken h-10 w-10 items-center justify-center rounded-md border",
            (disabled || atMax) && "opacity-40"
          )}
        >
          <Icon name="plus" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

// --- MetricCard -------------------------------------------------------------
const METRIC_TONE: Record<string, { border: string; bg: string; label: string }> = {
  neutral: { border: "border-border-subtle", bg: "bg-surface", label: "text-text-muted" },
  brand: { border: "border-brand/30", bg: "bg-brand-subtle", label: "text-brand" },
  success: { border: "border-green-200", bg: "bg-green-200/30", label: "text-success" },
  warning: { border: "border-marigold-200", bg: "bg-marigold-50", label: "text-warning" },
  error: { border: "border-red-200", bg: "bg-red-200/30", label: "text-error" },
};

export function MetricCard({
  label,
  value,
  caption,
  delta,
  trend = "na",
  icon,
  tone = "neutral",
  visual,
  onPress,
  className,
}: MetricCardProps) {
  const t = METRIC_TONE[tone] ?? METRIC_TONE.neutral;
  const tm = TREND_META[trend] ?? TREND_META.na;
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      className={cx(
        "rounded-lg border p-3.5",
        t.border,
        t.bg,
        onPress && "active:opacity-90",
        className
      )}
    >
      <View className="flex-row items-center justify-between">
        <Text numberOfLines={1} className={cx("font-ui flex-1 text-xs font-medium", t.label)}>
          {label}
        </Text>
        {renderIcon(icon, { size: 16, color: colors.textMuted })}
      </View>
      <View className="mt-1.5 flex-row items-end justify-between">
        <Text className="font-display text-text-primary text-2xl font-bold">{value ?? "—"}</Text>
        {visual != null && <View className="ml-2">{visual}</View>}
      </View>
      {(caption != null || delta != null) && (
        <View className="mt-1 flex-row items-center gap-1.5">
          {delta != null && (
            <View className="flex-row items-center gap-0.5">
              {tm.icon && <Icon name={tm.icon} size={13} color={tm.color} />}
              <Text style={{ color: tm.color }} className="font-ui text-xs font-semibold">
                {delta}
              </Text>
            </View>
          )}
          {caption != null && (
            <Text numberOfLines={1} className="font-ui text-text-muted flex-1 text-xs">
              {caption}
            </Text>
          )}
        </View>
      )}
    </Wrap>
  );
}

// --- AtRiskRow --------------------------------------------------------------
const SEVERITY_META: Record<RiskSeverity, { variant: BadgeVariant; label: string; dot: string }> = {
  high: { variant: "error", label: "High", dot: colors.error },
  medium: { variant: "warning", label: "Medium", dot: colors.warning },
  low: { variant: "info", label: "Low", dot: colors.info },
};

export function AtRiskRow({
  name,
  initials,
  avatarUri,
  className_,
  reasons = [],
  severity = "medium",
  score,
  trend = "na",
  lastActive,
  flagged,
  selectable,
  selected,
  onToggleSelect,
  onPress,
  className,
}: AtRiskRowProps) {
  const sv = SEVERITY_META[severity] ?? SEVERITY_META.medium;
  const tm = TREND_META[trend] ?? TREND_META.na;
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      className={cx(
        "border-border-subtle bg-surface flex-row items-start gap-3 rounded-lg border p-3.5",
        onPress && "active:bg-surface-sunken",
        className
      )}
    >
      {selectable && (
        <View className="pt-1">
          <Checkbox checked={selected} onPress={onToggleSelect} />
        </View>
      )}
      <Avatar uri={avatarUri} initials={initialsFrom(name, initials)} size="md" />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            numberOfLines={1}
            className="font-ui text-text-primary flex-1 text-base font-semibold"
          >
            {name}
          </Text>
          <Badge variant={sv.variant} dot>
            {sv.label}
          </Badge>
        </View>
        <View className="mt-0.5 flex-row items-center gap-2">
          {className_ != null && (
            <Text className="text-2xs text-text-muted font-mono">{className_}</Text>
          )}
          {lastActive != null && (
            <Text className="font-ui text-2xs text-text-muted">{lastActive}</Text>
          )}
          {flagged != null && <Text className="font-ui text-2xs text-text-muted">· {flagged}</Text>}
        </View>
        {reasons.length > 0 && (
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {reasons.map((r, i) => (
              <View
                key={i}
                className="rounded-pill flex-row items-center gap-1 bg-red-200/40 px-2 py-0.5"
              >
                <Icon name="alert-triangle" size={11} color={colors.error} />
                <Text className="font-ui text-2xs text-error">{r}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View className="items-end gap-1">
        <Text className="text-text-primary font-mono text-lg font-bold">
          {score == null ? "—" : score}
        </Text>
        {tm.icon && <Icon name={tm.icon} size={15} color={tm.color} />}
      </View>
    </Wrap>
  );
}

// --- RoleTenantPill ---------------------------------------------------------
export function RoleTenantPill({
  tenant,
  role,
  code,
  switchable = true,
  onPress,
  className,
}: RoleTenantPillProps) {
  const mark = (code ?? (typeof tenant === "string" ? tenant : "L")).slice(0, 1).toUpperCase();
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      onPress={onPress}
      className={cx(
        "rounded-pill border-border-subtle bg-surface flex-row items-center gap-2 self-start border px-2 py-1.5",
        onPress && "active:bg-surface-sunken",
        className
      )}
    >
      <View className="bg-brand h-6 w-6 items-center justify-center rounded-md">
        <Text className="font-display text-text-on-accent text-xs font-bold">{mark}</Text>
      </View>
      <View>
        {tenant != null && (
          <Text numberOfLines={1} className="font-ui text-text-primary text-sm font-semibold">
            {tenant}
          </Text>
        )}
        {role != null && (
          <Text numberOfLines={1} className="font-ui text-2xs text-text-muted">
            {role}
          </Text>
        )}
      </View>
      {switchable && <Icon name="chevrons-up-down" size={15} color={colors.textMuted} />}
    </Wrap>
  );
}

// --- FilterChips ------------------------------------------------------------
export function FilterChips({
  options = [],
  value,
  onChange,
  contentClassName,
  className,
}: FilterChipsProps) {
  const selected = Array.isArray(value) ? value : value != null ? [value] : [];
  const isActive = (key: string) => selected.includes(key);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={className}
      contentContainerClassName={cx("flex-row gap-2 px-0.5", contentClassName)}
    >
      {options.map((opt) => {
        const active = isActive(opt.key);
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange?.(opt.key)}
            className={cx(
              "rounded-pill flex-row items-center gap-1.5 border px-3 py-1.5",
              active ? "border-brand bg-brand-subtle" : "border-border-strong bg-surface"
            )}
          >
            {renderIcon(opt.icon, { size: 14, color: active ? colors.brand : colors.textMuted })}
            <Text
              className={cx(
                "font-ui text-sm",
                active ? "text-brand font-semibold" : "text-text-secondary"
              )}
            >
              {opt.label}
            </Text>
            {opt.count != null && (
              <View
                className={cx(
                  "rounded-pill min-w-[18px] items-center px-1.5 py-0.5",
                  active ? "bg-brand" : "bg-surface-sunken"
                )}
              >
                <Text
                  className={cx(
                    "text-2xs font-mono font-semibold",
                    active ? "text-text-on-accent" : "text-text-muted"
                  )}
                >
                  {opt.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
