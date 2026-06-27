import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import { useRoutePrefetch } from "../hooks/useRoutePrefetch";
import {
  AppShell,
  AppSidebar,
  AppBreadcrumb,
  SkipToContent,
  ThemeToggle,
  PageTransition,
  RouteAnnouncer,
  MobileBottomNav,
  SWUpdateNotification,
  type NavGroup,
  type MobileNavItem,
  type BreadcrumbSegmentResolver,
} from "@levelup/shared-ui";
import {
  LayoutDashboard,
  Building2,
  Sliders,
  Activity,
  Users,
  ToggleLeft,
  Settings,
  DollarSign,
  Megaphone,
  Search,
} from "lucide-react";

const SA_ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/tenants": "Tenants",
  "/analytics": "User Analytics",
  "/feature-flags": "Feature Flags",
  "/presets": "Global Presets",
  "/llm-usage": "LLM Usage",
  "/system": "System Health",
  "/settings": "Settings",
  "/announcements": "Announcements",
  "/users": "Users",
};

/** Route prefetch map — triggers lazy imports on link hover */
const SA_PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  "/": () => import("../pages/DashboardPage"),
  "/tenants": () => import("../pages/TenantsPage"),
  "/analytics": () => import("../pages/UserAnalyticsPage"),
  "/feature-flags": () => import("../pages/FeatureFlagsPage"),
  "/presets": () => import("../pages/GlobalPresetsPage"),
  "/llm-usage": () => import("../pages/LLMUsagePage"),
  "/system": () => import("../pages/SystemHealthPage"),
  "/settings": () => import("../pages/SettingsPage"),
  "/announcements": () => import("../pages/AnnouncementsPage"),
  "/users": () => import("../pages/GlobalUsersPage"),
};

const SA_SEGMENT_RESOLVERS: BreadcrumbSegmentResolver[] = [
  {
    pattern: /^\/tenants\/[^/]+$/,
    resolve: () => [{ label: "Tenants", to: "/tenants" }, { label: "Tenant Details" }],
  },
];

export default function AppLayout() {
  const location = useLocation();
  const { user } = useAuthStore();

  // Prefetch routes on link hover for near-instant navigation
  useRoutePrefetch(SA_PREFETCH_MAP);

  const navGroups: NavGroup[] = [
    {
      label: "Overview",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: LayoutDashboard,
          isActive: location.pathname === "/",
        },
      ],
    },
    {
      label: "Platform",
      items: [
        {
          title: "Tenants",
          url: "/tenants",
          icon: Building2,
          isActive: location.pathname.startsWith("/tenants"),
        },
        {
          title: "User Analytics",
          url: "/analytics",
          icon: Users,
          isActive: location.pathname.startsWith("/analytics"),
        },
        {
          title: "Feature Flags",
          url: "/feature-flags",
          icon: ToggleLeft,
          isActive: location.pathname.startsWith("/feature-flags"),
        },
        {
          title: "Global Presets",
          url: "/presets",
          icon: Sliders,
          isActive: location.pathname.startsWith("/presets"),
        },
        {
          title: "LLM Usage",
          url: "/llm-usage",
          icon: DollarSign,
          isActive: location.pathname.startsWith("/llm-usage"),
        },
        {
          title: "Announcements",
          url: "/announcements",
          icon: Megaphone,
          isActive: location.pathname.startsWith("/announcements"),
        },
        {
          title: "Users",
          url: "/users",
          icon: Search,
          isActive: location.pathname.startsWith("/users"),
        },
      ],
    },
    {
      label: "System",
      items: [
        {
          title: "System Health",
          url: "/system",
          icon: Activity,
          isActive: location.pathname.startsWith("/system"),
        },
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          isActive: location.pathname.startsWith("/settings"),
        },
      ],
    },
  ];

  const sidebarFooter = (
    <div className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs">
      <span className="truncate">{user?.displayName ?? user?.email}</span>
    </div>
  );

  const sidebar = (
    <AppSidebar
      appName="Super Admin"
      navGroups={navGroups}
      footerContent={sidebarFooter}
      pathname={location.pathname}
      LinkComponent={Link}
    />
  );

  const headerRight = <ThemeToggle />;

  const mobileNavItems: MobileNavItem[] = [
    { icon: LayoutDashboard, label: "Home", to: "/", isActive: location.pathname === "/" },
    {
      icon: Building2,
      label: "Tenants",
      to: "/tenants",
      isActive: location.pathname.startsWith("/tenants"),
    },
    {
      icon: Activity,
      label: "Health",
      to: "/system",
      isActive: location.pathname.startsWith("/system"),
    },
    {
      icon: Settings,
      label: "Settings",
      to: "/settings",
      isActive: location.pathname.startsWith("/settings"),
    },
  ];

  return (
    <>
      <SkipToContent />
      <AppShell sidebar={sidebar} headerRight={headerRight} hasBottomNav>
        <RouteAnnouncer pathname={location.pathname} />
        <div id="main-content">
          <AppBreadcrumb routeLabels={SA_ROUTE_LABELS} segmentResolvers={SA_SEGMENT_RESOLVERS} />
          <PageTransition pageKey={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </AppShell>
      <MobileBottomNav items={mobileNavItems} LinkComponent={Link} />
      <SWUpdateNotification />
    </>
  );
}
