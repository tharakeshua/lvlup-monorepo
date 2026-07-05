/**
 * Learner role shell — the persistent bottom tab bar.
 *
 * Four tabs (in order): Spaces · Exams · Progress · Profile. The `learner/`
 * segment is a real folder, so its children resolve as `/learner/learn`,
 * `/learner/tests`, … Each tab name maps to a subfolder that is itself a Stack,
 * so pushing a sub-route (space detail, test gate, settings, …) keeps the tab
 * bar; the full-screen runner and the modal sheets deliberately live at the
 * root, outside this group.
 *
 * Folder/route names stay `learn` and `tests` (so [[routes]] and deep links
 * don't change) — only the tab *titles* read "Spaces" and "Exams". The `home`
 * route is kept mounted but hidden from the bar (`href: null`) so existing
 * `routes.home()` / `routes.consumer()` links still resolve without a crash;
 * the app now lands on Spaces (`initialRouteName="learn"`).
 *
 * Colors are the Lyceum "Modern Scholarly" semantic tokens (mirrored from
 * tailwind.config.js; the theme lane owns the source of truth). Navigation
 * targets come from [[routes]].
 */
import { Tabs } from "expo-router";
import { BarChart3, GraduationCap, LayoutGrid, User, type LucideIcon } from "lucide-react-native";
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
      initialRouteName="learn"
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
      {/* Landing tab. `home` is kept mounted below but hidden from the bar. */}
      <Tabs.Screen name="learn" options={{ title: "Spaces", tabBarIcon: icon(LayoutGrid) }} />
      <Tabs.Screen name="tests" options={{ title: "Exams", tabBarIcon: icon(GraduationCap) }} />
      <Tabs.Screen name="progress" options={{ title: "Progress", tabBarIcon: icon(BarChart3) }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon(User) }} />
      {/* Removed from the tab bar but still routable (routes.home / consumer). */}
      <Tabs.Screen name="home" options={{ href: null }} />
    </Tabs>
  );
}
