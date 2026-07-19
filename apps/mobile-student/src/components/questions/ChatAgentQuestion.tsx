/**
 * Thin `chat_agent_question` adapter.
 *
 * The transcript, lifecycle and completion are all server-authoritative through
 * the shared conversation controller. In particular, this component never
 * builds a client transcript or feeds `recordItemAttempt` a generic answer.
 */
import { useEffect, useMemo, useRef } from "react";
import { Text, View } from "react-native";

import {
  useConversationController,
  useConversationOperations,
  type ConversationPublicConfig,
} from "../../features/conversation";
import { ConversationScaffold } from "../conversation";
import { Icon } from "../Icon";
import { colors } from "../../theme";

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

function sessionIdFromAnswer(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  return raw.questionType === "chat_agent_question" && typeof raw.sessionId === "string"
    ? raw.sessionId
    : undefined;
}

function publicConfigFrom(data: Record<string, unknown>): ConversationPublicConfig {
  const rawObjectives = Array.isArray(data.publicLearningObjectives)
    ? data.publicLearningObjectives
    : [];
  const objectives = rawObjectives.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const raw = value as Record<string, unknown>;
    const label = asString(raw.label);
    return label ? [{ id: asString(raw.id) || `objective-${index}`, label }] : [];
  });
  const starters = Array.isArray(data.conversationStarters)
    ? data.conversationStarters.filter((value): value is string => typeof value === "string")
    : [];
  const rawPolicy =
    data.completionPolicy && typeof data.completionPolicy === "object"
      ? (data.completionPolicy as Record<string, unknown>)
      : {};

  return {
    scenario: asString(data.scenario) || undefined,
    publicLearningObjectives: objectives,
    conversationStarters: starters,
    completionPolicy: {
      ...(typeof rawPolicy.minLearnerTurns === "number"
        ? { minLearnerTurns: rawPolicy.minLearnerTurns }
        : {}),
      ...(typeof rawPolicy.maxLearnerTurns === "number"
        ? { maxLearnerTurns: rawPolicy.maxLearnerTurns }
        : {}),
      ...(typeof rawPolicy.allowEarlyFinish === "boolean"
        ? { allowEarlyFinish: rawPolicy.allowEarlyFinish }
        : {}),
      ...(rawPolicy.hardLimitAction === "auto_finalize"
        ? { hardLimitAction: "auto_finalize" }
        : {}),
    },
  };
}

export interface ChatAgentQuestionProps {
  /** Learner-safe `chat_agent_question` data only. */
  data: Record<string, unknown>;
  /** A prior server session reference reopens its authoritative result/state. */
  value: unknown;
  onChange?: (value: unknown) => void;
  disabled?: boolean;
  itemId?: string;
  spaceId?: string;
  storyPointId?: string;
}

export function ChatAgentQuestion({
  data,
  value,
  onChange,
  disabled,
  itemId,
  spaceId,
  storyPointId,
}: ChatAgentQuestionProps) {
  const operations = useConversationOperations();
  const validContext = Boolean(spaceId && storyPointId && itemId);
  const context = useMemo(
    () => ({
      kind: "agent_assessment" as const,
      spaceId: spaceId ?? "",
      storyPointId: storyPointId ?? "",
      itemId: itemId ?? "",
    }),
    [itemId, spaceId, storyPointId]
  );
  const publicConfig = useMemo(() => publicConfigFrom(data), [data]);
  const sessionId = useMemo(() => sessionIdFromAnswer(value), [value]);
  const controller = useConversationController({
    mode: "agent_assessment",
    context,
    operations,
    sessionId,
    autoStart: validContext,
  });
  const emittedRef = useRef<string>();

  useEffect(() => {
    const session = controller.session;
    if (!session) return;
    const answer = {
      questionType: "chat_agent_question" as const,
      sessionId: session.id,
      ...(session.result?.submissionId ? { submissionId: session.result.submissionId } : {}),
    };
    const encoded = JSON.stringify(answer);
    if (encoded === emittedRef.current) return;
    emittedRef.current = encoded;
    onChange?.(answer);
  }, [controller.session, onChange]);

  if (!validContext) {
    return (
      <View
        accessibilityLiveRegion="assertive"
        className="border-warning bg-marigold-50 flex-row gap-2 rounded-md border p-3"
      >
        <Icon name="triangle-alert" size={18} color={colors.warning} />
        <View className="flex-1 gap-0.5">
          <Text className="font-ui text-warning text-sm font-semibold">Interview unavailable</Text>
          <Text className="font-ui text-text-secondary text-sm leading-5">
            This assessment needs its space, lesson and question context before it can begin.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityState={{ disabled: Boolean(disabled) }}
      className={disabled ? "opacity-70" : undefined}
    >
      <ConversationScaffold
        controller={controller}
        mode="agent_assessment"
        title="Interview"
        contextLabel="Your responses are evaluated only after you explicitly finish."
        publicConfig={publicConfig}
        assistantLabel="Interviewer"
        compact
        disabled={disabled}
      />
    </View>
  );
}
