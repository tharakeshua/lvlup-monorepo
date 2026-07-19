import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";

import { ConversationProjectionSync } from "../../features/conversation";
import type {
  ConversationController,
  ConversationMode,
  ConversationPublicConfig,
} from "../../features/conversation/types";
import { Button, IconButton } from "../primitives";
import { Modal } from "../overlays";
import { ConversationComposer } from "./ConversationComposer";
import { ConversationModeHeader } from "./ConversationModeHeader";
import { ConversationResult } from "./ConversationResult";
import { ConversationStatusCard } from "./ConversationStatusCard";
import { ConversationTranscript } from "./ConversationTranscript";

export interface ConversationScaffoldProps {
  controller: ConversationController;
  mode: ConversationMode;
  title?: string;
  contextLabel?: string;
  /** Used before the server projection arrives (e.g. assessment framing). */
  publicConfig?: ConversationPublicConfig;
  onClose?: () => void;
  compact?: boolean;
  assistantLabel?: string;
  disabled?: boolean;
}

export function ConversationScaffold({
  controller,
  mode,
  title,
  contextLabel,
  publicConfig,
  onClose,
  compact,
  assistantLabel = mode === "agent_assessment" ? "Interviewer" : "Tutor",
  disabled = false,
}: ConversationScaffoldProps) {
  const [earlyFinishOpen, setEarlyFinishOpen] = useState(false);
  const serverConfig = controller.session?.publicConfig;
  // The item carries public assessment framing (scenario) before start; the
  // server projection becomes authoritative for objectives/policy/starters.
  const config: ConversationPublicConfig | undefined = serverConfig
    ? {
        ...publicConfig,
        ...serverConfig,
        scenario: serverConfig.scenario ?? publicConfig?.scenario,
        publicLearningObjectives:
          serverConfig.publicLearningObjectives ?? publicConfig?.publicLearningObjectives,
        conversationStarters:
          serverConfig.conversationStarters ?? publicConfig?.conversationStarters,
        completionPolicy: serverConfig.completionPolicy ?? publicConfig?.completionPolicy,
      }
    : publicConfig;
  const completionPolicy = config?.completionPolicy;
  const isHardLimit =
    completionPolicy?.hardLimitReached === true ||
    (typeof controller.session?.completionRecommendation === "object" &&
      controller.session.completionRecommendation?.hardLimitReached === true);
  const minTurns = completionPolicy?.minLearnerTurns ?? 0;
  const learnerTurns = controller.session?.learnerTurnCount ?? 0;
  const shouldConfirmEarly =
    mode === "agent_assessment" &&
    learnerTurns < minTurns &&
    completionPolicy?.allowEarlyFinish === true;
  const sealedMessage = useMemo(() => {
    if (controller.state === "finalizing") return "Finalizing this conversation…";
    if (controller.state === "grading_pending")
      return "Your conversation is saved while the result is prepared.";
    if (controller.state === "grading_failed")
      return "Your conversation is saved while the result is retried.";
    if (controller.state === "completed") return "This conversation is complete.";
    if (controller.state === "abandoned") return "This conversation has been closed.";
    if (isHardLimit) return "This interview reached its turn limit and is being finalized.";
    return undefined;
  }, [controller.state, isHardLimit]);

  const handleFinish = () => {
    if (disabled) return;
    if (shouldConfirmEarly) {
      setEarlyFinishOpen(true);
      return;
    }
    void controller.finish();
  };

  const outerClass = compact ? "gap-3" : "flex-1 gap-4";
  const transcriptCompact = compact || controller.state === "bootstrapping";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className={outerClass}
      keyboardVerticalOffset={compact ? 0 : 8}
    >
      <ConversationProjectionSync controller={controller} />
      <View className="gap-3">
        <View className="flex-row items-start gap-2">
          <View className="flex-1">
            <ConversationModeHeader
              mode={mode}
              title={title ?? controller.session?.title}
              contextLabel={contextLabel}
              publicConfig={config}
              onSelectStarter={disabled ? undefined : controller.setDraft}
              compact={compact}
            />
          </View>
          {onClose ? (
            <IconButton icon="x" label="Close conversation" size="md" onPress={onClose} />
          ) : null}
        </View>
        {mode === "agent_assessment" && completionPolicy ? (
          <View className="bg-surface-sunken flex-row items-center justify-between rounded-md px-3 py-2">
            <View>
              <Text className="font-ui text-text-secondary text-xs font-semibold">
                Interview progress
              </Text>
              <Text className="font-ui text-text-muted text-xs">
                {learnerTurns} of {completionPolicy.maxLearnerTurns ?? "—"} learner turns
              </Text>
            </View>
            {controller.canFinish && !disabled ? (
              <Button variant="secondary" size="sm" leadingIcon="flag" onPress={handleFinish}>
                Finish interview
              </Button>
            ) : null}
          </View>
        ) : null}
      </View>

      <ConversationStatusCard
        controller={controller}
        mode={mode}
        onFinish={handleFinish}
        disabled={disabled}
      />

      {controller.state === "completed" ? (
        <ConversationResult mode={mode} result={controller.session?.result} />
      ) : (
        <ConversationTranscript
          messages={controller.messages}
          assistantLabel={assistantLabel}
          isTurnActive={controller.isTurnActive}
          failedClientMessageId={
            controller.state === "send_failed" ? controller.pendingClientMessageId : undefined
          }
          failure={controller.error}
          onRetryFailedTurn={
            !disabled && controller.canRetryFailedTurn
              ? () => void controller.retrySend()
              : undefined
          }
          compact={transcriptCompact}
        />
      )}

      {controller.state !== "completed" && controller.state !== "abandoned" ? (
        <View className="gap-2">
          <ConversationComposer
            value={controller.draft}
            onChangeText={controller.setDraft}
            onSend={() => void controller.send()}
            canSend={controller.canSend && !disabled}
            disabled={
              disabled ||
              controller.state === "sending" ||
              controller.state === "finalizing" ||
              controller.state === "grading_pending" ||
              controller.state === "grading_failed" ||
              controller.state === "send_failed" ||
              controller.isOffline
            }
            isSending={controller.state === "sending"}
            placeholder={
              mode === "agent_assessment"
                ? "Respond to the interviewer…"
                : mode === "question_help"
                  ? "Tell your tutor where you are stuck…"
                  : "Ask your tutor anything…"
            }
            sealedMessage={sealedMessage}
          />
          {mode !== "agent_assessment" && controller.canFinish && !disabled ? (
            <Button variant="ghost" size="sm" leadingIcon="check" onPress={handleFinish}>
              Finish conversation
            </Button>
          ) : null}
          {controller.canAbandon && !disabled ? (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon="archive"
              onPress={() => void controller.abandon()}
            >
              Close without finishing
            </Button>
          ) : null}
        </View>
      ) : null}

      <Modal
        open={earlyFinishOpen}
        onClose={() => setEarlyFinishOpen(false)}
        title="Finish interview early?"
        footer={
          <>
            <Button variant="secondary" size="sm" onPress={() => setEarlyFinishOpen(false)}>
              Keep talking
            </Button>
            <Button
              variant="primary"
              size="sm"
              onPress={() => {
                setEarlyFinishOpen(false);
                void controller.finish({ earlyFinishConfirmed: true });
              }}
            >
              Finish interview
            </Button>
          </>
        }
      >
        <Text className="font-ui text-text-secondary text-sm leading-5">
          You have completed {learnerTurns} of the recommended {minTurns} learner turns. Once
          finished, the interview is sealed and cannot be edited.
        </Text>
      </Modal>
    </KeyboardAvoidingView>
  );
}
