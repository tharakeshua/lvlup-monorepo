/**
 * Overlays: Sheet (bottom/side slide-in), Drawer (= Sheet, default right edge),
 * Modal (centered dialog). All built on RN <Modal> with a scrim.
 */
import { Modal as RNModal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cx } from "./cx";
import { IconButton } from "./primitives";
import type { ModalProps, SheetProps } from "./_types";

// --- Sheet ------------------------------------------------------------------
export function Sheet({ open, onClose, title, side = "bottom", children, className }: SheetProps) {
  const insets = useSafeAreaInsets();
  const align =
    side === "bottom"
      ? "justify-end"
      : side === "right"
        ? "flex-row justify-end"
        : "flex-row justify-start";
  const panelShape = side === "bottom" ? "w-full rounded-t-xl" : "h-full w-4/5 max-w-sm";
  return (
    <RNModal
      visible={!!open}
      transparent
      animationType={side === "bottom" ? "slide" : "fade"}
      onRequestClose={onClose}
    >
      <View className={cx("bg-ink-900/40 flex-1", align)}>
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close" />
        <View
          style={
            side === "bottom"
              ? { paddingBottom: Math.max(insets.bottom, 12) }
              : { paddingTop: insets.top }
          }
          className={cx("bg-surface p-5", panelShape, className)}
        >
          {side === "bottom" && (
            <View className="bg-border-strong mb-3 h-1 w-10 self-center rounded-full" />
          )}
          {(title != null || onClose) && (
            <View className="mb-3 flex-row items-center justify-between">
              {typeof title === "string" ? (
                <Text className="font-display text-text-primary text-lg font-semibold">
                  {title}
                </Text>
              ) : (
                <View className="flex-1">{title}</View>
              )}
              <IconButton icon="x" label="Close" size="sm" onPress={onClose} />
            </View>
          )}
          {children}
        </View>
      </View>
    </RNModal>
  );
}

// --- Drawer (side sheet) ----------------------------------------------------
export function Drawer({ side = "right", ...rest }: SheetProps) {
  return <Sheet side={side} {...rest} />;
}

// --- Modal (centered dialog) ------------------------------------------------
export function Modal({ open, onClose, title, footer, children, className }: ModalProps) {
  return (
    <RNModal visible={!!open} transparent animationType="fade" onRequestClose={onClose}>
      <View className="bg-ink-900/40 flex-1 items-center justify-center px-6">
        <Pressable className="absolute inset-0" onPress={onClose} accessibilityLabel="Close" />
        <View className={cx("bg-surface w-full max-w-md rounded-xl p-5", className)}>
          {(title != null || onClose) && (
            <View className="mb-3 flex-row items-center justify-between">
              {typeof title === "string" ? (
                <Text className="font-display text-text-primary text-lg font-semibold">
                  {title}
                </Text>
              ) : (
                <View className="flex-1">{title}</View>
              )}
              <IconButton icon="x" label="Close" size="sm" onPress={onClose} />
            </View>
          )}
          {children}
          {footer != null && <View className="mt-4 flex-row justify-end gap-2">{footer}</View>}
        </View>
      </View>
    </RNModal>
  );
}
