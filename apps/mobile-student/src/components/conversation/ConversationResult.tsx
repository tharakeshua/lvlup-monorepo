import { useEffect, useRef } from "react";
import { AccessibilityInfo, findNodeHandle, Text, View } from "react-native";

import { colors } from "../../theme";
import type { ConversationMode, ConversationResultView } from "../../features/conversation/types";
import { Icon } from "../Icon";

export interface ConversationResultProps {
  mode: ConversationMode;
  result?: ConversationResultView;
}

export function ConversationResult({ mode, result }: ConversationResultProps) {
  const headingRef = useRef<View>(null);
  const evaluation = result?.evaluation;
  const isInterview = mode === "agent_assessment";

  useEffect(() => {
    const handle = findNodeHandle(headingRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    AccessibilityInfo.announceForAccessibility(
      isInterview ? "Interview result is ready." : "Conversation complete."
    );
  }, [isInterview]);

  const hasScore = typeof evaluation?.score === "number";
  const score = hasScore
    ? `${evaluation?.score}${typeof evaluation?.maxScore === "number" ? ` / ${evaluation.maxScore} pts` : " pts"}`
    : undefined;
  const pct =
    typeof evaluation?.percentage === "number"
      ? Math.max(0, Math.min(100, Math.round(evaluation.percentage)))
      : hasScore && typeof evaluation?.maxScore === "number" && evaluation.maxScore > 0
        ? Math.max(
            0,
            Math.min(100, Math.round(((evaluation.score ?? 0) / evaluation.maxScore) * 100))
          )
        : undefined;

  const summaryObject =
    evaluation?.summary && typeof evaluation.summary === "object" ? evaluation.summary : undefined;
  const summaryString = typeof evaluation?.summary === "string" ? evaluation.summary : undefined;
  const takeaway = summaryObject?.keyTakeaway ?? summaryString;
  const overallComment = summaryObject?.overallComment;

  const strengths = (evaluation?.strengths ?? []).filter(Boolean).slice(0, 2);
  const growth = (evaluation?.weaknesses ?? []).filter(Boolean).slice(0, 2);
  const fallbackFeedback = evaluation?.feedback ?? overallComment;
  const hasFeedbackList = strengths.length > 0 || growth.length > 0;

  return (
    <View className="gap-3">
      {/* Verdict header */}
      <View
        ref={headingRef}
        accessible
        accessibilityRole="header"
        className="flex-row items-center gap-3"
      >
        <View className="rounded-pill h-12 w-12 items-center justify-center bg-green-200/50">
          <Icon name="check" size={22} color={colors.success} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-display text-text-primary text-xl leading-7">
            {isInterview ? "Interview complete" : "Conversation complete"}
          </Text>
          {score ? (
            <Text className="text-text-secondary font-mono text-sm">{score}</Text>
          ) : (
            <Text className="font-ui text-text-secondary text-sm">
              {isInterview
                ? "Your learner-safe result has been saved."
                : "You can return to your learning whenever you are ready."}
            </Text>
          )}
        </View>
      </View>

      {/* Percentage bar */}
      {typeof pct === "number" ? (
        <View
          accessible
          accessibilityLabel={`Score ${pct} percent`}
          className="bg-surface-sunken rounded-pill h-2 overflow-hidden"
        >
          <View className="bg-brand rounded-pill h-full" style={{ width: `${pct}%` }} />
        </View>
      ) : null}

      {/* Key takeaway */}
      {takeaway ? (
        <View className="border-spark bg-marigold-50 gap-0.5 rounded-md rounded-l-none border-l-[3px] px-4 py-3">
          <Text className="text-spark tracking-caps text-2xs font-mono uppercase">
            Key takeaway
          </Text>
          <Text className="font-display text-text-primary text-base font-medium leading-6">
            {takeaway}
          </Text>
        </View>
      ) : null}

      {/* Feedback */}
      {hasFeedbackList ? (
        <View className="border-border-subtle bg-surface gap-2 rounded-lg border px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Icon name="sprout" size={15} color={colors.brand} />
            <Text className="font-ui text-text-primary text-sm font-semibold">Feedback</Text>
          </View>
          {strengths.map((item, index) => (
            <View key={`s-${index}`} className="flex-row gap-2">
              <View className="mt-0.5">
                <Icon name="check" size={14} color={colors.success} />
              </View>
              <Text className="font-ui text-text-secondary flex-1 text-sm leading-5">{item}</Text>
            </View>
          ))}
          {growth.map((item, index) => (
            <View key={`g-${index}`} className="flex-row gap-2">
              <View className="mt-0.5">
                <Icon name="move-up-right" size={14} color={colors.warning} />
              </View>
              <Text className="font-ui text-text-secondary flex-1 text-sm leading-5">{item}</Text>
            </View>
          ))}
        </View>
      ) : fallbackFeedback ? (
        <View className="border-border-subtle bg-surface gap-2 rounded-lg border px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Icon name="sprout" size={15} color={colors.brand} />
            <Text className="font-ui text-text-primary text-sm font-semibold">Feedback</Text>
          </View>
          <Text className="font-ui text-text-secondary text-sm leading-5">{fallbackFeedback}</Text>
        </View>
      ) : null}

      {/* Progress applied */}
      {result?.progressApplied ? (
        <View className="border-border-subtle bg-surface-sunken flex-row items-center gap-2 rounded-md border px-3 py-2.5">
          <Icon name="trending-up" size={15} color={colors.brand} />
          <Text className="font-ui text-text-secondary flex-1 text-xs leading-5">
            Progress updated — this counts toward your unit score.
          </Text>
        </View>
      ) : null}

      {/* Sealed */}
      <View className="border-border-strong bg-surface-sunken flex-row items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3">
        <Icon name="lock" size={14} color={colors.textMuted} />
        <Text className="font-ui text-text-muted flex-shrink text-xs">
          {isInterview
            ? "Conversation sealed — your transcript is your graded answer."
            : "This conversation is complete."}
        </Text>
      </View>
    </View>
  );
}
