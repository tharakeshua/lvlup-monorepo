/**
 * CaptureRow — the `.cap-row` pill actions under the composer (Camera / Photo
 * library / Re-record / Add a note). W1 owns the capability-pills that decide
 * WHICH actions show per question type; W3 provides this ready-made row for the
 * capture affordances so the icon/label/press idiom stays consistent with the
 * `.cap` / `.cap--brand` design.
 */
import { Pressable, Text, View } from "react-native";

import { colors } from "../../../theme";
import { Icon } from "../../../components/Icon";
import { cx } from "../../../components/cx";

export interface CaptureAction {
  key: string;
  icon: string;
  label: string;
  onPress: () => void;
  /** Brand-tinted variant (`.cap--brand`) — e.g. "Add a note". */
  brand?: boolean;
  disabled?: boolean;
}

export function CaptureButton({ action }: { action: CaptureAction }) {
  return (
    <Pressable
      onPress={action.onPress}
      disabled={action.disabled}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: action.disabled }}
      className={cx(
        "rounded-pill border-border-subtle bg-surface flex-row items-center gap-2 border px-4",
        action.disabled ? "opacity-50" : "active:opacity-80"
      )}
      style={{ height: 44 }}
    >
      <Icon name={action.icon} size={17} color={action.brand ? colors.brand : colors.spark} />
      <Text className="font-ui text-text-primary text-sm font-medium">{action.label}</Text>
    </Pressable>
  );
}

export function CaptureRow({ actions }: { actions: CaptureAction[] }) {
  if (actions.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {actions.map((a) => (
        <CaptureButton key={a.key} action={a} />
      ))}
    </View>
  );
}
