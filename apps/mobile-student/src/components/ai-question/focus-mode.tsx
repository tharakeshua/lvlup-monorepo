/**
 * ai-question/focus-mode — Surface B, the full-screen distraction-free writing
 * surface (the composer maximized). paragraph opens into this by default (owner
 * decision); other write/code types get an opt-in expand. Maximum blankness:
 * a one-line collapsed prompt header, the full-bleed writing area, and a slim
 * bottom bar (capture affordances + word count + Done + Submit reachable here).
 */
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";
import { Icon } from "../Icon";
import { Button } from "../primitives";
import { WriteArea, CodeArea, type WordTarget } from "./composer";
import type { CapabilityConfig } from "./capability";

export function FocusComposer({
  visible,
  onClose,
  config,
  promptLine,
  text,
  onChangeText,
  language,
  wordTarget,
  submitLabel,
  submitting,
  canSubmit,
  onSubmit,
  onRecord,
  onCamera,
}: {
  visible: boolean;
  onClose: () => void;
  config: CapabilityConfig;
  promptLine: string;
  text: string;
  onChangeText: (t: string) => void;
  language?: string;
  wordTarget?: WordTarget;
  submitLabel: string;
  submitting?: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onRecord?: () => void;
  onCamera?: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <SafeAreaView edges={["top", "bottom"]} className="bg-canvas flex-1">
        {/* collapsed prompt header + collapse control */}
        <View className="flex-row items-center gap-2 px-4 py-2">
          <Text className="font-display text-text-secondary flex-1 text-sm" numberOfLines={1}>
            {promptLine}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Collapse focus mode"
            hitSlop={8}
            className="h-11 w-11 items-center justify-center"
          >
            <Icon name="minimize-2" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* full-bleed writing area */}
        <View className="flex-1 px-6 pt-2">
          {config.variant === "code" ? (
            <CodeArea
              value={text}
              onChangeText={onChangeText}
              language={language}
              minHeight={320}
              autoFocus
            />
          ) : (
            <WriteArea
              value={text}
              onChangeText={onChangeText}
              target={wordTarget}
              bare
              showWordCount={false}
              autoFocus
            />
          )}
        </View>

        {/* slim bottom bar */}
        <View className="border-border-subtle bg-canvas gap-2 border-t px-5 pb-2 pt-3">
          <View className="flex-row items-center gap-2">
            {config.record ? (
              <Pressable
                onPress={onRecord}
                accessibilityRole="button"
                accessibilityLabel="Record"
                className="border-border-subtle bg-surface rounded-pill h-9 w-9 items-center justify-center border"
              >
                <Icon name="mic" size={17} color={colors.spark} />
              </Pressable>
            ) : null}
            {config.camera || config.photo ? (
              <Pressable
                onPress={onCamera}
                accessibilityRole="button"
                accessibilityLabel="Camera"
                className="border-border-subtle bg-surface rounded-pill h-9 w-9 items-center justify-center border"
              >
                <Icon name="camera" size={17} color={colors.spark} />
              </Pressable>
            ) : null}
            <View className="flex-1" />
            <FocusWordCount text={text} target={wordTarget} />
          </View>
          <Button
            variant="primary"
            block
            disabled={!canSubmit || submitting}
            loading={submitting}
            onPress={onSubmit}
          >
            {submitLabel}
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function FocusWordCount({ text, target }: { text: string; target?: WordTarget }) {
  const count = text.trim() ? text.trim().split(/\s+/).length : 0;
  const near = target?.max != null && count >= Math.round(target.max * 0.9);
  const label =
    target && (target.min != null || target.max != null)
      ? `${count} / ${target.min ?? ""}${target.min != null && target.max != null ? "–" : ""}${target.max ?? ""} words`
      : `${count} words`;
  return (
    <Text
      className={near ? "text-warning text-2xs font-mono" : "text-text-muted text-2xs font-mono"}
    >
      {label}
    </Text>
  );
}
