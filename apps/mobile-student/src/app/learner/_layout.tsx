/**
 * Learner role shell — the persistent bottom tab bar.
 *
 * Three main tabs (in order): Spaces · Exams · Profile. The `learner/` segment
 * is a real folder, so its children resolve as `/learner/learn`,
 * `/learner/tests`, … Each tab name maps to a subfolder that is itself a Stack.
 *
 * A space is its own little world: once the learner steps INTO a space
 * (`/learner/learn/<spaceId>`, the content viewer, or practice), the main tab
 * bar hides and the screen renders its own space-scoped bottom nav (see
 * SpaceDetailScreen / ContentViewerScreen). Back out to the spaces library and
 * the main bar returns.
 *
 * `progress` and `home` stay mounted but hidden from the bar (`href: null`) so
 * existing `routes.progress()` / `routes.home()` links still resolve — Progress
 * is reachable from the Profile tab.
 *
 * Colors are the Lyceum "Modern Scholarly" semantic tokens (mirrored from
 * tailwind.config.js; the theme lane owns the source of truth).
 */
import { Tabs, useSegments } from "expo-router";
import { GraduationCap, LayoutGrid, User, type LucideIcon } from "lucide-react-native";
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
  // Hide the main bar inside a space (space detail / content viewer / practice)
  // — those screens carry their own space-scoped bottom nav.
  const segments = useSegments() as string[];
  const inSpace = segments[1] === "learn" && segments.length > 2;

  return (
    <Tabs
      initialRouteName="learn"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: inSpace
          ? { display: "none" }
          : {
              backgroundColor: COLORS.surface,
              borderTopColor: COLORS.border,
              borderTopWidth: 1,
              height: Platform.OS === "ios" ? 84 : 64,
              paddingTop: 6,
            },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      {/* Landing tab. `home` + `progress` are kept mounted below but hidden. */}
      <Tabs.Screen name="learn" options={{ title: "Spaces", tabBarIcon: icon(LayoutGrid) }} />
      <Tabs.Screen name="tests" options={{ title: "Exams", tabBarIcon: icon(GraduationCap) }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon(User) }} />
      {/* Removed from the tab bar but still routable (routes.progress / home). */}
      <Tabs.Screen name="progress" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ href: null }} />
    </Tabs>
  );
}
