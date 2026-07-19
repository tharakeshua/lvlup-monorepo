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

  useEffect(() => {
    const handle = findNodeHandle(headingRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    AccessibilityInfo.announceForAccessibility(
      mode === "agent_assessment" ? "Interview result is ready." : "Conversation complete."
    );
  }, [mode]);

  const score =
    typeof evaluation?.score === "number"
      ? `${evaluation.score}${typeof evaluation.maxScore === "number" ? ` / ${evaluation.maxScore}` : ""}`
      : undefined;
  const summary =
    typeof evaluation?.summary === "string"
      ? evaluation.summary
      : [evaluation?.summary?.keyTakeaway, evaluation?.summary?.overallComment]
          .filter(Boolean)
          .join(" ");
  const feedback =
    evaluation?.feedback ?? evaluation?.strengths?.[0] ?? evaluation?.weaknesses?.[0];

  return (
    <View className="gap-3 rounded-lg border border-green-500/35 bg-green-200/30 p-4">
      <View
        ref={headingRef}
        accessible
        accessibilityRole="header"
        className="flex-row items-center gap-2"
      >
        <View className="bg-surface rounded-pill h-9 w-9 items-center justify-center">
          <Icon name="circle-check-big" size={20} color={colors.success} />
        </View>
        <View className="flex-1">
          <Text className="font-display text-text-primary text-lg">
            {mode === "agent_assessment" ? "Interview complete" : "Conversation complete"}
          </Text>
          <Text className="font-ui text-text-secondary text-sm">
            {mode === "agent_assessment"
              ? "Your learner-safe result has been saved."
              : "You can return to your learning whenever you are ready."}
          </Text>
        </View>
        {score ? (
          <View className="bg-surface rounded-md px-2 py-1">
            <Text className="text-success font-mono text-sm">{score}</Text>
          </View>
        ) : null}
      </View>
      {summary ? (
        <Text className="font-ui text-text-primary text-sm leading-5">{summary}</Text>
      ) : null}
      {feedback ? (
        <View className="bg-surface rounded-md border border-green-500/25 px-3 py-2.5">
          <Text className="font-ui text-text-secondary text-sm leading-5">{feedback}</Text>
        </View>
      ) : null}
      {result?.progressApplied ? (
        <View className="flex-row items-center gap-1.5">
          <Icon name="check" size={15} color={colors.success} />
          <Text className="font-ui text-success text-xs">
            Your learning progress has been updated.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
