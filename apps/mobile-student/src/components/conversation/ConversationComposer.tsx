import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { colors } from "../../theme";
import { Icon } from "../Icon";
import { cx } from "../cx";

export interface ConversationComposerProps {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  canSend: boolean;
  disabled?: boolean;
  isSending?: boolean;
  placeholder?: string;
  sealedMessage?: string;
}

export function ConversationComposer({
  value,
  onChangeText,
  onSend,
  canSend,
  disabled,
  isSending,
  placeholder = "Write a message…",
  sealedMessage,
}: ConversationComposerProps) {
  if (sealedMessage) {
    return (
      <View
        accessibilityLiveRegion="polite"
        className="border-border-strong bg-surface-sunken flex-row items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3"
      >
        <Icon name="lock" size={15} color={colors.textMuted} />
        <Text className="font-ui text-text-muted flex-shrink text-xs leading-5">
          {sealedMessage}
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <View className="border-border-strong bg-surface flex-row items-end gap-2 rounded-lg border py-1.5 pl-4 pr-1.5">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          multiline
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Conversation message"
          accessibilityHint="Type your message, then use Send"
          textAlignVertical="top"
          style={{ minHeight: 40, maxHeight: 136 }}
          className="font-ui text-text-primary flex-1 py-2 text-base leading-6"
          returnKeyType="default"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend, busy: Boolean(isSending) }}
          className={cx(
            "h-11 w-11 items-center justify-center rounded-md",
            canSend ? "bg-brand active:bg-brand-hover" : "bg-border-subtle"
          )}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.textOnAccent} />
          ) : (
            <Icon
              name="arrow-up"
              size={20}
              color={canSend ? colors.textOnAccent : colors.textMuted}
            />
          )}
        </Pressable>
      </View>
      <View className="flex-row items-center justify-center gap-1.5">
        <Icon name="shield-check" size={12} color={colors.textMuted} />
        <Text className="text-text-muted text-2xs font-mono">Sent only when you choose Send</Text>
      </View>
    </View>
  );
}
