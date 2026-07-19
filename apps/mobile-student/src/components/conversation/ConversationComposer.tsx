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
        className="bg-surface-sunken flex-row gap-2 rounded-md px-3 py-3"
      >
        <Icon name="lock-keyhole" size={17} color={colors.textSecondary} />
        <Text className="font-ui text-text-secondary flex-1 text-sm leading-5">
          {sealedMessage}
        </Text>
      </View>
    );
  }

  return (
    <View className="border-border-subtle bg-surface gap-2 rounded-lg border p-2">
      <View className="flex-row items-end gap-2">
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
          style={{ minHeight: 48, maxHeight: 136 }}
          className="font-ui text-text-primary flex-1 px-2 py-2 text-base leading-6"
          returnKeyType="default"
        />
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend, busy: Boolean(isSending) }}
          className={cx(
            "h-12 w-12 items-center justify-center rounded-md",
            canSend ? "bg-brand active:bg-brand-hover" : "bg-border-subtle"
          )}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.textOnAccent} />
          ) : (
            <Icon
              name="send-horizontal"
              size={19}
              color={canSend ? colors.textOnAccent : colors.textMuted}
            />
          )}
        </Pressable>
      </View>
      <View className="flex-row items-center gap-1.5 px-1 pb-0.5">
        <Icon name="shield-check" size={13} color={colors.textMuted} />
        <Text className="font-ui text-text-muted text-2xs flex-1">
          Your message is sent only when you choose Send.
        </Text>
      </View>
    </View>
  );
}
