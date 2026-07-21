/**
 * PermissionBanner — the kind mic/camera-denied recovery prompt (`.banner--warn`
 * from D3) with a Settings deep link. Shown when the OS permission is denied so
 * the learner never hits a dead end; the captured draft is preserved regardless
 * (04/05 offline-and-error notes). Icon + text + colour together (a11y).
 */
import { Linking, Pressable, Text, View } from "react-native";

import { colors } from "../../../theme";
import { Icon } from "../../../components/Icon";

export interface PermissionBannerProps {
  kind: "mic" | "camera";
  /** Override copy if needed. */
  message?: string;
}

export function PermissionBanner({ kind, message }: PermissionBannerProps) {
  const copy =
    message ??
    (kind === "mic" ? "Microphone is off for Lyceum." : "Camera access is off for Lyceum.");
  return (
    <View
      className="flex-row items-center gap-2 rounded-md border px-3 py-2"
      style={{ borderColor: colors.warning, backgroundColor: "#FBF3E3" }}
      accessibilityRole="alert"
    >
      <Icon name={kind === "mic" ? "mic-off" : "camera-off"} size={15} color={colors.warning} />
      <Text className="font-ui flex-1 text-xs" style={{ color: colors.warning }}>
        {copy}
      </Text>
      <Pressable
        onPress={() => Linking.openSettings().catch(() => {})}
        accessibilityRole="button"
        accessibilityLabel="Open Settings"
        hitSlop={8}
      >
        <Text className="font-ui text-brand text-xs font-semibold">Open Settings</Text>
      </Pressable>
    </View>
  );
}
