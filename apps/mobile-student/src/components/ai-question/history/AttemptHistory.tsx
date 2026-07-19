/**
 * AttemptHistory — Surface H. The growth trail for one AI question: each past
 * attempt as a tappable row (verdict dot · label · date · score), the best score
 * marked, an improving-trend celebration banner, and a "Try again" CTA.
 *
 * DATA: consumes a per-item progress entry (`progress.items[itemId]`) and builds
 * the model via `buildAttemptHistory`. When the backend only retains a single
 * best evaluation (today's reality — see model.ts), it degrades to one row.
 * Visual-only; owns no answer/submission state.
 */
import { View, Text, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Icon } from "../../Icon";
import { Button } from "../../primitives";
import { cx } from "../../cx";
import { colors } from "../../../theme";
import { REDUCE_MOTION } from "../tokens";
import { buildAttemptHistory, type AttemptRow, type ItemProgressEntryLike } from "./model";
import type { FeedbackVerdict } from "../../lyceum";

export interface AttemptHistoryProps {
  /** Raw per-item progress entry (`useStoryPointProgress` → items[itemId]). */
  entry: ItemProgressEntryLike | null | undefined;
  /** The question prompt/title, shown collapsed at the top for context. */
  promptText?: string;
  /** Tapping a row opens that attempt's full feedback (Surface G). */
  onOpenAttempt?: (attempt: AttemptRow) => void;
  /** Retry the question (pre-fills last answer, per owner-locked UX). */
  onTryAgain?: () => void;
  /** Hide the collapsed prompt row (e.g. when already shown by the host). */
  hidePrompt?: boolean;
  className?: string;
}

const VERDICT_ROW: Record<
  FeedbackVerdict,
  { label: string; icon: string; color: string; dotClass: string }
> = {
  correct: {
    label: "Got it",
    icon: "check-circle",
    color: colors.success,
    dotClass: "bg-green-200/40",
  },
  partial: {
    label: "You're close",
    icon: "trending-up",
    color: colors.warning,
    dotClass: "bg-marigold-50",
  },
  incorrect: {
    label: "Not quite yet",
    icon: "sprout",
    color: colors.brand,
    dotClass: "bg-brand-subtle",
  },
};

/** ISO → "Today · 9:41" / "Yesterday · 16:02" / "12 Mar · 09:41". */
function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  const day = d.toLocaleDateString([], { day: "numeric", month: "short" });
  return `${day} · ${time}`;
}

function AttemptItem({
  row,
  onPress,
  index,
}: {
  row: AttemptRow;
  onPress?: () => void;
  index: number;
}) {
  const meta = VERDICT_ROW[row.verdict];
  const when = formatWhen(row.timestamp);
  return (
    <Animated.View entering={FadeInDown.delay(index * 45).reduceMotion(REDUCE_MOTION)}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={
          `Attempt ${row.attemptNumber}, ${meta.label}` +
          (row.score != null ? `, ${row.score} of ${row.maxScore ?? "—"}` : "") +
          (row.isBest ? ", best attempt" : "")
        }
        className={cx(
          "flex-row items-center gap-3 rounded-md border px-4 py-3",
          row.isBest
            ? "border-brand bg-brand-subtle"
            : "border-border-subtle bg-surface active:bg-surface-sunken"
        )}
      >
        <View className={cx("h-9 w-9 items-center justify-center rounded-full", meta.dotClass)}>
          <Icon name={meta.icon} size={16} color={meta.color} />
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="font-ui text-text-primary text-sm font-medium" numberOfLines={1}>
              Attempt {row.attemptNumber} · {meta.label}
            </Text>
            {row.isBest ? (
              <View className="bg-marigold-50 rounded-pill flex-row items-center gap-1 px-2 py-0.5">
                <Icon name="award" size={11} color={colors.spark} />
                <Text className="font-ui text-2xs font-semibold" style={{ color: colors.spark }}>
                  Best
                </Text>
              </View>
            ) : null}
          </View>
          {when ? <Text className="text-text-muted text-2xs mt-0.5 font-mono">{when}</Text> : null}
        </View>
        {row.score != null ? (
          <Text className="text-text-secondary font-mono text-sm">
            {row.score}/{row.maxScore ?? "—"}
          </Text>
        ) : null}
        {onPress ? <Icon name="chevron-right" size={16} color={colors.textMuted} /> : null}
      </Pressable>
    </Animated.View>
  );
}

export function AttemptHistory({
  entry,
  promptText,
  onOpenAttempt,
  onTryAgain,
  hidePrompt,
  className,
}: AttemptHistoryProps) {
  const model = buildAttemptHistory(entry);

  return (
    <View className={cx("gap-3", className)}>
      {!hidePrompt && promptText ? (
        <View className="border-border-subtle flex-row items-center gap-2 border-b pb-3">
          <Icon name="help-circle" size={15} color={colors.brand} />
          <Text className="font-display text-text-secondary flex-1 text-sm" numberOfLines={1}>
            {promptText}
          </Text>
        </View>
      ) : null}

      {model.rows.length === 0 ? (
        <View className="items-center gap-2 py-8">
          <Icon name="sprout" size={22} color={colors.textMuted} />
          <Text className="font-ui text-text-muted px-6 text-center text-sm">
            No attempts yet — give it a try when you're ready.
          </Text>
        </View>
      ) : (
        <>
          {model.trend ? (
            <Animated.View
              entering={FadeInDown.reduceMotion(REDUCE_MOTION)}
              className="bg-marigold-50 flex-row items-center gap-2 rounded-md px-3 py-2.5"
            >
              <Icon name="trending-up" size={15} color={colors.spark} />
              <Text className="font-ui flex-1 text-xs" style={{ color: paletteSparkHover }}>
                {model.trend.attempts} attempts, +{model.trend.pointsGained} points — that's the
                growth trail.
              </Text>
            </Animated.View>
          ) : null}

          <View className="gap-2">
            {model.rows.map((row, i) => (
              <AttemptItem
                key={`${row.attemptNumber}-${i}`}
                row={row}
                index={i}
                onPress={onOpenAttempt ? () => onOpenAttempt(row) : undefined}
              />
            ))}
          </View>

          {onTryAgain ? (
            <Button variant="primary" block leadingIcon="rotate-ccw" onPress={onTryAgain}>
              Try again
            </Button>
          ) : null}
        </>
      )}
    </View>
  );
}

// spark-hover accent for the celebration banner text (marigold-600).
const paletteSparkHover = "#C97A14";
