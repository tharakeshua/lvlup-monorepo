/**
 * Teacher shell — bottom-tab navigator (coordinator-owned).
 *
 * 5 role tabs (Home · Classes · Review · Insights · More) rendered by the Lyceum
 * `Tabbar` (presentational) via a custom `tabBar`. All other teacher routes are
 * declared `href: null` (hidden from the bar, still navigable as full-screen
 * pushes that KEEP the shell). The 5 modal-style routes hide the tab bar.
 *
 * Route files re-export their screen from `src/lib/screens.tsx` (the registry),
 * so the router never imports lane code directly — the coordinator flips one
 * registry line as each lane lands its real module.
 */
import { Tabs } from "expo-router";
import { View } from "react-native";

import { Tabbar } from "../../components";

// Minimal shape of the bottom-tab `tabBar` props we use (avoids depending on
// @react-navigation/bottom-tabs being hoisted into the app's node_modules).
interface TabBarRenderProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { navigate: (name: string) => void };
}

// Tab slots (ROUTE-TREE.md teacher half). Keys == route file names.
const TABS = [
  { key: "home", icon: "layout-dashboard", label: "Home" },
  { key: "classes", icon: "users", label: "Classes" },
  { key: "review", icon: "clipboard-check", label: "Review" },
  { key: "insights", icon: "bar-chart-3", label: "Insights" },
  { key: "more", icon: "menu", label: "More" },
] as const;

// Routes that present as modals/sheets — tab bar hidden.
const MODAL_ROUTES = new Set(["assign", "override", "rubric", "release", "tenant"]);

function TeacherTabBar({ state, navigation }: TabBarRenderProps) {
  const current = state.routes[state.index]?.name ?? "home";
  if (MODAL_ROUTES.has(current)) return null;

  // Longest-prefix → active tab. Detail routes light their parent tab.
  const activeKey =
    TABS.find((t) => t.key === current)?.key ??
    (current === "classes" ||
    current === "class" ||
    current === "students" ||
    current === "student" ||
    current === "assign"
      ? "classes"
      : current === "grading" ||
          current === "grading-review" ||
          current === "submission" ||
          current === "exam-analytics"
        ? "review"
        : current === "at-risk" || current === "class-tests" || current === "space-analytics"
          ? "insights"
          : current === "announcements" || current === "notifications" || current === "settings"
            ? "more"
            : current === "assignments"
              ? "home"
              : "home");

  return (
    <Tabbar
      items={TABS.map((t) => ({ key: t.key, icon: t.icon, label: t.label }))}
      activeKey={activeKey}
      onTabPress={(key) => navigation.navigate(key)}
    />
  );
}

export default function TeacherLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#FBF8F3" }}>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TeacherTabBar {...props} />}>
        {/* 5 visible tabs */}
        <Tabs.Screen name="home" />
        <Tabs.Screen name="classes" />
        <Tabs.Screen name="review" />
        <Tabs.Screen name="insights" />
        <Tabs.Screen name="more" />

        {/* hidden full-screen detail / sub routes (keep the shell) */}
        <Tabs.Screen name="assignments" options={{ href: null }} />
        <Tabs.Screen name="class" options={{ href: null }} />
        <Tabs.Screen name="students" options={{ href: null }} />
        <Tabs.Screen name="student" options={{ href: null }} />
        <Tabs.Screen name="grading" options={{ href: null }} />
        <Tabs.Screen name="grading-review" options={{ href: null }} />
        <Tabs.Screen name="submission" options={{ href: null }} />
        <Tabs.Screen name="exam-analytics" options={{ href: null }} />
        <Tabs.Screen name="at-risk" options={{ href: null }} />
        <Tabs.Screen name="class-tests" options={{ href: null }} />
        <Tabs.Screen name="space-analytics" options={{ href: null }} />
        <Tabs.Screen name="announcements" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />

        {/* modal-style routes (tab bar hidden via MODAL_ROUTES) */}
        <Tabs.Screen name="assign" options={{ href: null }} />
        <Tabs.Screen name="override" options={{ href: null }} />
        <Tabs.Screen name="rubric" options={{ href: null }} />
        <Tabs.Screen name="release" options={{ href: null }} />
        <Tabs.Screen name="tenant" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
