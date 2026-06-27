/**
 * Admin (tenant-admin) role shell — the persistent bottom tab bar.
 *
 * Five tabs (per app/mobile-staff/ROUTE-TREE.md, ADMIN half): Home · People ·
 * Academics · Insights · More. `admin/` is a REAL segment (the `(group)` paren
 * form breaks Metro's pnpm resolution — see mobile-student memory), so tab routes
 * resolve as `/admin/home`, `/admin/people`, … matching the design `#/admin/*`
 * namespace. Each tab name maps to a subfolder that is itself a Stack, so pushing
 * a sub-route (user detail, class detail, settings, …) keeps the tab bar; the
 * onboarding + switcher modals deliberately live at the root, outside this group.
 */
import { Tabs } from "expo-router";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Menu,
  Users,
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

export default function AdminTabsLayout() {
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
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: icon(LayoutDashboard) }} />
      <Tabs.Screen name="people" options={{ title: "People", tabBarIcon: icon(Users) }} />
      <Tabs.Screen name="academics" options={{ title: "Academics", tabBarIcon: icon(BookOpen) }} />
      <Tabs.Screen name="insights" options={{ title: "Insights", tabBarIcon: icon(BarChart3) }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: icon(Menu) }} />
    </Tabs>
  );
}
