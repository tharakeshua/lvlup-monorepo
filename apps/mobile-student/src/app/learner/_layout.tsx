/**
 * Learner role shell — the persistent bottom tab bar.
 *
 * Five tabs (per ROUTE-TREE learner half): Home · Learn · Tests · Progress ·
 * Profile. `(learner)` is a route GROUP, so it never appears in the URL — its
 * children resolve as `/home`, `/learn`, … Each tab name maps to a subfolder
 * that is itself a Stack, so pushing a sub-route (space detail, test gate,
 * settings, …) keeps the tab bar; the full-screen runner and the modal sheets
 * deliberately live at the root, outside this group.
 *
 * Colors are the Lyceum "Modern Scholarly" semantic tokens (mirrored from
 * tailwind.config.js; the theme lane owns the source of truth). Navigation
 * targets come from [[routes]].
 */
import { Tabs } from "expo-router";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Home,
  User,
  type LucideIcon,
} from "lucide-react-native";
import { Platform } from "react-native";

// Lyceum light-theme tokens (see tailwind.config.js).
const COLORS = {
  brand: "#423A82",
  muted: "#756E61",
  surface: "#FFFDFA",
  border: "#E8DFD0",
};

const icon =
  (Icon: LucideIcon) =>
  ({ color, size }: { color: string; size: number }) => (
    <Icon color={color} size={size} strokeWidth={2} />
  );

export default function LearnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon(Home) }} />
      <Tabs.Screen name="learn" options={{ title: "Learn", tabBarIcon: icon(BookOpen) }} />
      <Tabs.Screen name="tests" options={{ title: "Tests", tabBarIcon: icon(ClipboardCheck) }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", tabBarIcon: icon(BarChart3) }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon(User) }} />
    </Tabs>
  );
}
