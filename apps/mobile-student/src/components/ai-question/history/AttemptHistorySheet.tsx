/**
 * AttemptHistorySheet — the bottom-sheet presentation of Surface H. Mounts the
 * AttemptHistory trail; tapping a row swaps in-place to that attempt's
 * AttemptDetail with a back affordance (no route needed, so a host screen can
 * open it from the history button without owning navigation).
 *
 * W1 wires this: pass `open`, the per-item progress `entry`, `promptText`, and
 * `onTryAgain`. State (list ↔ detail) is owned here.
 */
import { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable } from "react-native";

import { Sheet } from "../../overlays";
import { Icon } from "../../Icon";
import { cx } from "../../cx";
import { colors } from "../../../theme";
import { AttemptHistory } from "./AttemptHistory";
import { AttemptDetail } from "./AttemptDetail";
import type { AttemptRow, ItemProgressEntryLike } from "./model";

export interface AttemptHistorySheetProps {
  open: boolean;
  onClose: () => void;
  entry: ItemProgressEntryLike | null | undefined;
  promptText?: string;
  /** Retry the question; the sheet closes first so the composer takes focus. */
  onTryAgain?: () => void;
}

function SheetTitle({ detail, onBack }: { detail: boolean; onBack: () => void }) {
  return (
    <View className="flex-row items-center gap-2">
      {detail ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to attempt history"
          className="active:bg-surface-sunken -ml-1 h-8 w-8 items-center justify-center rounded-full"
        >
          <Icon name="arrow-left" size={18} color={colors.textPrimary} />
        </Pressable>
      ) : (
        <Icon name="history" size={18} color={colors.brand} />
      )}
      <Text className="font-display text-text-primary text-lg font-semibold">
        {detail ? "Attempt" : "Attempt history"}
      </Text>
    </View>
  );
}

export function AttemptHistorySheet({
  open,
  onClose,
  entry,
  promptText,
  onTryAgain,
}: AttemptHistorySheetProps) {
  const [selected, setSelected] = useState<AttemptRow | null>(null);

  // Reset to the list whenever the sheet re-opens.
  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<SheetTitle detail={selected != null} onBack={() => setSelected(null)} />}
      className={cx("max-h-[88%]")}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-2"
      >
        {selected ? (
          <AttemptDetail attempt={selected} />
        ) : (
          <AttemptHistory
            entry={entry}
            promptText={promptText}
            onOpenAttempt={setSelected}
            onTryAgain={
              onTryAgain
                ? () => {
                    onClose();
                    onTryAgain();
                  }
                : undefined
            }
          />
        )}
      </ScrollView>
    </Sheet>
  );
}
