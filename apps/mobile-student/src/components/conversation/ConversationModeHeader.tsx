import { Pressable, Text, View } from "react-native";

import { colors } from "../../theme";
import { Icon } from "../Icon";
import { cx } from "../cx";
import type { ConversationMode, ConversationPublicConfig } from "../../features/conversation/types";

export interface ConversationModeHeaderProps {
  mode: ConversationMode;
  title?: string;
  contextLabel?: string;
  publicConfig?: ConversationPublicConfig;
  onSelectStarter?: (starter: string) => void;
  compact?: boolean;
}

const MODE_COPY: Record<ConversationMode, { icon: string; eyebrow: string; description: string }> =
  {
    tutor: {
      icon: "graduation-cap",
      eyebrow: "Guided learning",
      description: "Ask a question and work through the next step together.",
    },
    question_help: {
      icon: "circle-help",
      eyebrow: "Question help",
      description:
        "This guidance helps you reason it out; it does not grade or submit your answer.",
    },
    agent_assessment: {
      icon: "messages-square",
      eyebrow: "Conversation assessment",
      description: "Your interviewer will ask follow-up questions. Finish when you are ready.",
    },
  };

export function ConversationModeHeader({
  mode,
  title,
  contextLabel,
  publicConfig,
  onSelectStarter,
  compact,
}: ConversationModeHeaderProps) {
  const copy = MODE_COPY[mode];
  const objectives = publicConfig?.publicLearningObjectives ?? [];
  const starters = publicConfig?.conversationStarters ?? [];
  const scenario = publicConfig?.scenario;

  return (
    <View className={cx("gap-3", compact && "gap-2")}>
      <View className="flex-row items-start gap-3">
        <View className="bg-brand-subtle mt-0.5 h-10 w-10 items-center justify-center rounded-lg">
          <Icon name={copy.icon} size={19} color={colors.brand} />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-brand tracking-caps text-2xs font-mono uppercase">
            {copy.eyebrow}
          </Text>
          <Text
            accessibilityRole="header"
            className="font-display text-text-primary text-xl leading-7"
          >
            {title ??
              (mode === "tutor"
                ? "Your tutor"
                : mode === "question_help"
                  ? "Need a hint?"
                  : "Interview")}
          </Text>
          {contextLabel ? (
            <Text className="font-ui text-text-secondary text-xs" numberOfLines={2}>
              {contextLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="border-border-subtle bg-surface-sunken flex-row items-center gap-2 rounded-md border px-3 py-2.5">
        <Icon name="shield-check" size={15} color={colors.brand} />
        <Text className="font-ui text-text-secondary flex-1 text-xs leading-5">
          {copy.description}
        </Text>
      </View>

      {scenario ? (
        <View className="border-border-subtle bg-surface gap-1.5 rounded-lg border px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Icon name="map" size={15} color={colors.brand} />
            <Text className="font-ui text-text-primary text-sm font-semibold">Scenario</Text>
          </View>
          <Text className="font-ui text-text-secondary text-sm leading-5">{scenario}</Text>
        </View>
      ) : null}

      {objectives.length > 0 ? (
        <View className="border-border-subtle bg-surface gap-2 rounded-lg border px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Icon name="compass" size={15} color={colors.brand} />
            <Text className="font-ui text-text-primary flex-1 text-sm font-semibold">
              What to cover
            </Text>
            <Text className="text-text-muted text-2xs font-mono">
              {objectives.length} {objectives.length === 1 ? "objective" : "objectives"}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {objectives.map((objective) => (
              <View
                key={objective.id}
                className="bg-surface-sunken rounded-pill flex-row items-center gap-1.5 px-2.5 py-1.5"
              >
                <Icon name="target" size={12} color={colors.brand} />
                <Text className="font-ui text-text-secondary text-2xs font-medium">
                  {objective.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {starters.length > 0 ? (
        <View className="gap-2">
          <Text className="font-ui text-text-secondary text-xs font-semibold">
            Conversation starters
          </Text>
          <View className="gap-2">
            {starters.slice(0, 3).map((starter) => (
              <Pressable
                key={starter}
                onPress={() => onSelectStarter?.(starter)}
                accessibilityRole="button"
                accessibilityLabel={`Use starter: ${starter}`}
                className="border-border-subtle bg-surface active:bg-surface-sunken min-h-11 flex-row items-center gap-2.5 rounded-md border px-4 py-3"
              >
                <Icon name="sparkles" size={15} color={colors.spark} />
                <Text className="font-ui text-text-secondary flex-1 text-sm" numberOfLines={2}>
                  {starter}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
