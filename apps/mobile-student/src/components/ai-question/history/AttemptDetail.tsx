/**
 * AttemptDetail — a single past attempt opened from the history trail: the
 * answer the learner gave, then that attempt's full feedback (reuses the Lyceum
 * FeedbackPanel so a revisited result reads identically to a fresh one).
 *
 * Read-only. Owns no state; the parent supplies the AttemptRow.
 */
import { View, Text } from "react-native";

import { Icon } from "../../Icon";
import { cx } from "../../cx";
import { colors } from "../../../theme";
import { FeedbackPanel } from "../../lyceum";
import { answerToText, evaluationToFeedback, type AttemptRow } from "./model";

export interface AttemptDetailProps {
  attempt: AttemptRow;
  className?: string;
}

/** ISO → "12 Mar 2026 · 09:41" for the detail header. */
function formatFull(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

export function AttemptDetail({ attempt, className }: AttemptDetailProps) {
  const answerText = answerToText(attempt.answer);
  const feedback = evaluationToFeedback(attempt.evaluation);
  const when = formatFull(attempt.timestamp);

  return (
    <View className={cx("gap-4", className)}>
      <View className="flex-row items-center gap-2">
        <Text className="font-display text-text-primary flex-1 text-base font-semibold">
          Attempt {attempt.attemptNumber}
        </Text>
        {attempt.isBest ? (
          <View className="bg-marigold-50 rounded-pill flex-row items-center gap-1 px-2 py-0.5">
            <Icon name="award" size={11} color={colors.spark} />
            <Text className="font-ui text-2xs font-semibold" style={{ color: colors.spark }}>
              Best
            </Text>
          </View>
        ) : null}
      </View>
      {when ? <Text className="text-text-muted text-2xs -mt-3 font-mono">{when}</Text> : null}

      {/* The answer the learner submitted for this attempt. */}
      <View className="gap-1.5">
        <View className="flex-row items-center gap-1.5">
          <Icon name="pencil-line" size={13} color={colors.textMuted} />
          <Text className="font-ui text-text-secondary text-xs font-semibold">Your answer</Text>
        </View>
        {answerText ? (
          <View className="border-border-subtle bg-surface-sunken rounded-md border px-3 py-2.5">
            <Text className="font-ui text-text-primary text-sm leading-6">{answerText}</Text>
          </View>
        ) : (
          <Text className="font-ui text-text-muted text-xs">
            This attempt's answer wasn't recorded.
          </Text>
        )}
      </View>

      {/* That attempt's feedback, rendered with the shared verdict panel. */}
      <FeedbackPanel verdict={attempt.verdict} {...feedback} />
    </View>
  );
}
