import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, ActivityIndicator, ScrollView, Text, View } from "react-native";

import { colors } from "../../theme";
import { textFromMessage } from "../../features/conversation/reducer";
import type { ConversationError, ConversationMessageView } from "../../features/conversation/types";
import { Button } from "../primitives";
import { Icon } from "../Icon";
import { cx } from "../cx";

export interface ConversationTranscriptProps {
  messages: ConversationMessageView[];
  assistantLabel: string;
  isTurnActive?: boolean;
  failedClientMessageId?: string;
  failure?: ConversationError;
  onRetryFailedTurn?: () => void;
  compact?: boolean;
}

function MessageBubble({
  message,
  assistantLabel,
  retry,
}: {
  message: ConversationMessageView;
  assistantLabel: string;
  retry?: { error?: ConversationError; onRetry?: () => void };
}) {
  const learner = message.role === "learner";
  const text = textFromMessage(message);
  const citations = message.content.filter((block) => block.type === "citation");
  const images = message.content.filter((block) => block.type === "media");
  const label = `${learner ? "Your" : assistantLabel} message${text ? `: ${text}` : ""}`;

  return (
    <View
      nativeID={`conversation-message-${message.id}`}
      accessible
      accessibilityLabel={label}
      className={cx("w-full", learner ? "items-end" : "items-start")}
    >
      <View className={cx("max-w-[88%] flex-row gap-2", learner && "flex-row-reverse")}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          className={cx(
            "rounded-pill mt-1 h-7 w-7 items-center justify-center",
            learner ? "bg-spark" : "bg-brand-subtle"
          )}
        >
          <Icon
            name={learner ? "user-round" : "bot"}
            size={15}
            color={learner ? colors.textPrimary : colors.brand}
          />
        </View>
        <View
          className={cx(
            "gap-2 rounded-xl px-3.5 py-3",
            learner
              ? "bg-brand rounded-tr-sm"
              : "border-border-subtle bg-surface rounded-tl-sm border",
            message.localStatus === "sending" && "opacity-70",
            message.localStatus === "failed" && "border-error"
          )}
        >
          <Text
            className={cx(
              "font-ui text-base leading-6",
              learner ? "text-text-on-accent" : "text-text-primary"
            )}
          >
            {text || "Image attached"}
          </Text>
          {images.length > 0 ? (
            <View
              className={cx(
                "flex-row items-center gap-1",
                learner ? "" : "bg-surface-sunken rounded-sm px-2 py-1"
              )}
            >
              <Icon
                name="image"
                size={14}
                color={learner ? colors.textOnAccent : colors.textSecondary}
              />
              <Text
                className={cx(
                  "font-ui text-xs",
                  learner ? "text-text-on-accent" : "text-text-secondary"
                )}
              >
                Image attached
              </Text>
            </View>
          ) : null}
          {citations.length > 0 ? (
            <View className="gap-1">
              {citations.map((citation) => (
                <View
                  key={citation.sourceId}
                  className="bg-surface-sunken flex-row items-center gap-1.5 rounded-sm px-2 py-1.5"
                >
                  <Icon name="book-open" size={13} color={colors.info} />
                  <Text className="font-ui text-text-secondary flex-1 text-xs" numberOfLines={2}>
                    {citation.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {message.localStatus === "sending" ? (
            <View className="flex-row items-center gap-1.5">
              <ActivityIndicator
                size="small"
                color={learner ? colors.textOnAccent : colors.brand}
              />
              <Text
                className={cx(
                  "font-ui text-xs",
                  learner ? "text-text-on-accent" : "text-text-muted"
                )}
              >
                Sending…
              </Text>
            </View>
          ) : null}
          {retry ? (
            <View
              accessibilityLiveRegion="assertive"
              className="border-error/30 gap-2 rounded-sm border bg-red-200/30 p-2"
            >
              <Text className="font-ui text-error text-xs leading-4">
                {retry.error?.safeMessage ?? "This reply did not finish."}
              </Text>
              {retry.onRetry ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon="rotate-ccw"
                  onPress={retry.onRetry}
                >
                  Retry this reply
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function ConversationTranscript({
  messages,
  assistantLabel,
  isTurnActive,
  failedClientMessageId,
  failure,
  onRetryFailedTurn,
  compact,
}: ConversationTranscriptProps) {
  const scrollRef = useRef<ScrollView>(null);
  const announcedIdsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(false);
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)
      ),
    [messages]
  );

  useEffect(() => {
    const assistants = sortedMessages.filter((message) => message.role === "assistant");
    if (!mountedRef.current) {
      assistants.forEach((message) => announcedIdsRef.current.add(message.id));
      mountedRef.current = true;
      return;
    }
    const latest = assistants.find((message) => !announcedIdsRef.current.has(message.id));
    if (!latest) return;
    assistants.forEach((message) => announcedIdsRef.current.add(message.id));
    AccessibilityInfo.announceForAccessibility(`${assistantLabel} has replied.`);
  }, [assistantLabel, sortedMessages]);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [sortedMessages.length, isTurnActive]);

  return (
    <View
      accessibilityLabel="Conversation transcript"
      className={cx(
        "border-border-subtle bg-canvas rounded-lg border",
        compact ? "max-h-[340px]" : "min-h-[240px] flex-1"
      )}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="gap-3 p-3"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {sortedMessages.length === 0 ? (
          <View className="items-center gap-2 px-5 py-8">
            <View className="bg-brand-subtle rounded-pill h-10 w-10 items-center justify-center">
              <Icon name="message-circle" size={19} color={colors.brand} />
            </View>
            <Text className="font-display text-text-primary text-base">
              Start when you&apos;re ready
            </Text>
            <Text className="font-ui text-text-muted text-center text-sm leading-5">
              Your conversation will appear here.
            </Text>
          </View>
        ) : (
          sortedMessages.map((message) => {
            const failed =
              message.clientMessageId === failedClientMessageId || message.localStatus === "failed";
            return (
              <MessageBubble
                key={message.id}
                message={message}
                assistantLabel={assistantLabel}
                retry={
                  failed
                    ? { error: message.localError ?? failure, onRetry: onRetryFailedTurn }
                    : undefined
                }
              />
            );
          })
        )}
        {isTurnActive ? (
          <View accessibilityLiveRegion="polite" className="flex-row items-center gap-2 px-1 py-1">
            <ActivityIndicator size="small" color={colors.brand} />
            <Text className="font-ui text-text-muted text-sm">
              {assistantLabel} is working on this turn…
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
