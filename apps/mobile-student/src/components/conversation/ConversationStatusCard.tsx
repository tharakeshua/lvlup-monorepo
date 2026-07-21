import { useEffect, useRef } from "react";
import { AccessibilityInfo, ActivityIndicator, findNodeHandle, Text, View } from "react-native";

import { colors } from "../../theme";
import type { ConversationController, ConversationMode } from "../../features/conversation/types";
import { Button } from "../primitives";
import { Icon } from "../Icon";

export interface ConversationStatusCardProps {
  controller: ConversationController;
  mode: ConversationMode;
  onFinish: () => void;
  disabled?: boolean;
}

type StatusPresentation = {
  icon: string;
  tint: "brand" | "warning" | "error" | "success" | "info";
  title: string;
  body: string;
  busy?: boolean;
};

function presentationFor(
  controller: ConversationController,
  mode: ConversationMode
): StatusPresentation | undefined {
  const rawRecommendation = controller.session?.completionRecommendation;
  const recommendation =
    rawRecommendation?.reasonCode === "hard_limit"
      ? "You have reached the interview turn limit."
      : rawRecommendation?.reasonCode === "objectives_covered"
        ? "The conversation has covered the public objectives."
        : rawRecommendation?.reasonCode === "insufficient_new_evidence"
          ? "A little more detail may help before you finish."
          : undefined;
  const grading = controller.session?.grading;
  switch (controller.state) {
    case "bootstrapping":
      return {
        icon: "loader-circle",
        tint: "brand",
        title: "Opening your conversation",
        body: "Checking for a saved conversation first.",
        busy: true,
      };
    case "sending":
      return {
        icon: "loader-circle",
        tint: "brand",
        title: "Sending your reply",
        body: "Keeping this turn in order while the server accepts it.",
        busy: true,
      };
    case "send_failed":
      return {
        icon: controller.isOffline ? "wifi-off" : "triangle-alert",
        tint: "error",
        title: controller.isOffline ? "You appear to be offline" : "Your reply needs another try",
        body:
          controller.error?.safeMessage ??
          "Your draft and retry ID are safe. Retry sends the same reply, not a duplicate.",
      };
    case "ready_to_finish":
      return {
        icon: "flag",
        tint: "success",
        title: mode === "agent_assessment" ? "You can finish the interview" : "Ready when you are",
        body:
          recommendation ??
          (mode === "agent_assessment"
            ? "You may finish now, or continue if the composer remains available."
            : "You can close this conversation whenever you are done."),
      };
    case "finalizing":
      return {
        icon: "lock-keyhole",
        tint: "brand",
        title: "Finalizing your conversation",
        body: "The interview is now sealed. Please keep this screen open while we save it.",
        busy: true,
      };
    case "grading_pending":
      return {
        icon: "clock-3",
        tint: "info",
        title: "Your result is being prepared",
        body:
          grading?.safeMessage ??
          "We saved the interview. Check back here for the learner-safe result.",
        busy: true,
      };
    case "grading_failed":
      return {
        icon: "rotate-ccw",
        tint: "warning",
        title: "The result needs more time",
        body:
          grading?.safeMessage ??
          "Your interview remains safely saved. Refresh this screen for its current result.",
      };
    case "abandoned":
      return {
        icon: "archive",
        tint: "warning",
        title: "Conversation closed",
        body: "This conversation is no longer active.",
      };
    case "fatal":
      return {
        icon: controller.isOffline ? "wifi-off" : "cloud-off",
        tint: "error",
        title: controller.isOffline
          ? "Connection unavailable"
          : "We couldn't confirm the latest status",
        body:
          controller.error?.safeMessage ??
          "Refresh to retrieve the server-authoritative conversation status.",
      };
    case "active":
    case "completed":
      return undefined;
  }
}

const TINTS = {
  brand: { box: "border-brand/30 bg-brand-subtle", icon: colors.brand, title: "text-brand" },
  warning: {
    box: "border-amber-500/40 bg-marigold-50",
    icon: colors.warning,
    title: "text-warning",
  },
  error: { box: "border-red-500/35 bg-red-200/30", icon: colors.error, title: "text-error" },
  success: {
    box: "border-green-500/35 bg-green-200/30",
    icon: colors.success,
    title: "text-success",
  },
  info: { box: "border-sky-500/35 bg-surface-sunken", icon: colors.info, title: "text-info" },
} as const;

export function ConversationStatusCard({
  controller,
  mode,
  onFinish,
  disabled = false,
}: ConversationStatusCardProps) {
  const presentation = presentationFor(controller, mode);
  const cardRef = useRef<View>(null);
  const title = presentation?.title;
  const body = presentation?.body;
  const busy = presentation?.busy;

  useEffect(() => {
    if (!title || !body || busy) return;
    AccessibilityInfo.announceForAccessibility(`${title}. ${body}`);
    const handle = findNodeHandle(cardRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [body, busy, title]);

  if (!presentation) return null;
  const tint = TINTS[presentation.tint];
  const hasFailedPending =
    !disabled && controller.state === "send_failed" && Boolean(controller.pendingClientMessageId);
  const canRetrySend = hasFailedPending && controller.canRetryFailedTurn;
  const canRefresh =
    !disabled && (controller.state === "fatal" || controller.state === "grading_failed");

  return (
    <View
      ref={cardRef}
      accessible
      accessibilityLiveRegion={presentation.busy ? "polite" : "assertive"}
      accessibilityLabel={`${presentation.title}. ${presentation.body}`}
      className={`gap-2 rounded-lg border p-3.5 ${tint.box}`}
    >
      <View className="flex-row items-start gap-2">
        {presentation.busy ? (
          <ActivityIndicator size="small" color={tint.icon} />
        ) : (
          <Icon name={presentation.icon} size={18} color={tint.icon} />
        )}
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className={`font-ui text-sm font-semibold ${tint.title}`}>
            {presentation.title}
          </Text>
          <Text className="font-ui text-text-secondary text-sm leading-5">{presentation.body}</Text>
        </View>
      </View>
      {hasFailedPending ? (
        <View className="flex-row gap-2">
          {canRetrySend ? (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon="rotate-ccw"
              onPress={() => void controller.retrySend()}
            >
              Retry reply
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onPress={controller.discardFailedSend}>
            {canRetrySend ? "Edit instead" : "Edit reply"}
          </Button>
        </View>
      ) : null}
      {controller.state === "ready_to_finish" && controller.canFinish && !disabled ? (
        <Button variant="primary" size="sm" leadingIcon="flag" onPress={onFinish}>
          {mode === "agent_assessment" ? "Finish interview" : "Finish conversation"}
        </Button>
      ) : null}
      {canRefresh ? (
        <Button
          variant="secondary"
          size="sm"
          leadingIcon="rotate-ccw"
          onPress={() => void controller.refresh()}
        >
          Refresh status
        </Button>
      ) : null}
    </View>
  );
}
