import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, ScrollView, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../../theme";
import { DURATION, EASE, REDUCE_MOTION } from "../ai-question/tokens";
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

/** One softly breathing dot in the typing indicator, driven by Reanimated. */
function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withDelay(delay, withTiming(1, { duration: DURATION.slow, easing: EASE.standard })),
        withTiming(0.35, { duration: DURATION.slow, easing: EASE.standard })
      ),
      -1,
      false
    );
  }, [delay, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: 6, height: 6, borderRadius: 999, backgroundColor: colors.brand }, style]}
    />
  );
}

/** Three softly breathing dots — the interviewer "is working on this turn" motif. */
function TypingDots() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      className="border-border-subtle bg-surface flex-row items-center gap-1 self-start rounded-xl rounded-bl-sm border px-4 py-3.5"
    >
      <TypingDot delay={0} />
      <TypingDot delay={150} />
      <TypingDot delay={300} />
    </View>
  );
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
  const sending = message.localStatus === "sending";
  const failed = message.localStatus === "failed" || Boolean(retry);

  return (
    <Animated.View
      entering={(learner ? FadeInDown : FadeIn)
        .duration(DURATION.base)
        .easing(EASE.entrance)
        .reduceMotion(REDUCE_MOTION)}
      nativeID={`conversation-message-${message.id}`}
      accessible
      accessibilityLabel={label}
      style={{ width: "100%", alignItems: learner ? "flex-end" : "flex-start", rowGap: 4 }}
    >
      <View
        className={cx(
          "max-w-[82%] gap-2 rounded-xl px-4 py-3",
          learner
            ? "bg-brand rounded-br-sm"
            : "border-border-subtle bg-surface rounded-bl-sm border",
          sending && "opacity-60",
          failed && "border-error border"
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
              "flex-row items-center gap-1 self-start rounded-sm px-2 py-1",
              learner ? "bg-white/15" : "bg-surface-sunken"
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
                className={cx(
                  "flex-row items-center gap-1.5 rounded-sm px-2 py-1.5",
                  learner ? "bg-white/15" : "bg-surface-sunken"
                )}
              >
                <Icon
                  name="book-open"
                  size={13}
                  color={learner ? colors.textOnAccent : colors.info}
                />
                <Text
                  className={cx(
                    "font-ui flex-1 text-xs",
                    learner ? "text-text-on-accent" : "text-text-secondary"
                  )}
                  numberOfLines={2}
                >
                  {citation.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {sending ? <Text className="text-text-muted text-2xs px-1 font-mono">Sending…</Text> : null}

      {retry ? (
        <View
          accessibilityLiveRegion="assertive"
          className="border-error/30 max-w-[88%] gap-2 rounded-md border bg-red-200/30 p-2"
        >
          <Text className="font-ui text-error text-xs leading-4">
            {retry.error?.safeMessage ?? "This reply did not finish."}
          </Text>
          {retry.onRetry ? (
            <Button variant="secondary" size="sm" leadingIcon="rotate-ccw" onPress={retry.onRetry}>
              Retry this reply
            </Button>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
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
              <Icon name="messages-square" size={19} color={colors.brand} />
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
          <View accessibilityLiveRegion="polite" className="items-start gap-1">
            <TypingDots />
            <Text className="text-text-muted text-2xs px-1 font-mono">
              {assistantLabel} is working on this turn…
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
