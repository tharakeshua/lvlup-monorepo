import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@levelup/shared-stores";
import {
  AppShell,
  AppSidebar,
  RoleSwitcher,
  NotificationBell,
  SkipToContent,
  ThemeToggle,
  PageTransition,
  RouteAnnouncer,
  MobileBottomNav,
  SWUpdateNotification,
  PWAInstallBanner,
  OfflineBanner,
  type NavGroup,
  type TenantOption,
  type MobileNavItem,
} from "@levelup/shared-ui";
// useTenantBranding has no @levelup/query equivalent yet (documented parity gap),
// so it stays on the legacy shared-hooks package. Notifications moved to the SDK.
import { useTenantBranding } from "@levelup/shared-hooks";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useNotificationBadgeQuery,
  useNotificationBadge,
} from "@levelup/query";
import type { Notification } from "@levelup/shared-types";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Settings,
  Bell,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useTenantNames } from "../hooks/useTenantNames";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { allMemberships, currentTenantId, switchTenant, user, firebaseUser } = useAuthStore();

  const parentTenantIds = allMemberships.filter((m) => m.role === "parent").map((m) => m.tenantId);
  const { data: tenantNames } = useTenantNames(parentTenantIds);

  // Apply tenant branding (colors + CSS custom properties)
  useTenantBranding();

  const { data: notifResult, isLoading: notifsLoading } = useNotifications();
  const notifications = ((notifResult as { items?: Notification[] } | undefined)?.items ??
    []) as Notification[];
  // One-shot badge read seeds the count; the live subscription keeps it fresh
  // (both write the same `notificationBadge` cache key).
  const { data: badgeData } = useNotificationBadgeQuery();
  useNotificationBadge();
  const unreadCount = (badgeData as { unreadCount?: number } | undefined)?.unreadCount ?? 0;
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

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
      label: "My Children",
      items: [
        {
          title: "Children",
          url: "/children",
          icon: Users,
          isActive: location.pathname.startsWith("/children"),
        },
        {
          title: "Exam Results",
          url: "/results",
          icon: ClipboardList,
          isActive: location.pathname.startsWith("/results"),
        },
        {
          title: "Space Progress",
          url: "/progress",
          icon: BookOpen,
          isActive: location.pathname.startsWith("/progress"),
        },
        {
          title: "Child Progress",
          url: "/child-progress",
          icon: TrendingUp,
          isActive: location.pathname.startsWith("/child-progress"),
        },
        {
          title: "Alerts",
          url: "/alerts",
          icon: AlertTriangle,
          isActive: location.pathname.startsWith("/alerts"),
        },
        {
          title: "Compare Children",
          url: "/compare",
          icon: BarChart3,
          isActive: location.pathname === "/compare",
        },
      ],
    },
    {
      label: "Account",
      items: [
        {
          title: "Notifications",
          url: "/notifications",
          icon: Bell,
          isActive: location.pathname.startsWith("/notifications"),
          badge: unreadCount > 0 ? unreadCount : undefined,
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

  const tenantOptions: TenantOption[] = allMemberships
    .filter((m) => m.role === "parent")
    .map((m) => ({
      tenantId: m.tenantId,
      tenantName: tenantNames?.[m.tenantId] ?? m.tenantCode ?? m.tenantId,
      role: m.role,
    }));

  const sidebarFooter = (
    <div className="space-y-2">
      <RoleSwitcher
        currentTenantId={currentTenantId}
        tenants={tenantOptions}
        onSwitch={switchTenant}
      />
      <div className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-xs">
        <span className="truncate">{user?.displayName ?? user?.email}</span>
      </div>
    </div>
  );

  const sidebar = (
    <AppSidebar
      appName="Parent"
      navGroups={navGroups}
      footerContent={sidebarFooter}
      pathname={location.pathname}
      LinkComponent={Link}
    />
  );

  const headerRight = (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <NotificationBell
        notifications={notifications}
        unreadCount={unreadCount}
        isLoading={notifsLoading}
        onNotificationClick={(notif) => {
          if (!notif.isRead) {
            markRead.mutate({ notificationId: notif.id });
          }
          if (notif.actionUrl) navigate(notif.actionUrl);
        }}
        onMarkAllRead={() => {
          markAllRead.mutate();
        }}
        onViewAll={() => navigate("/notifications")}
      />
    </div>
  );

  const mobileNavItems: MobileNavItem[] = [
    { icon: LayoutDashboard, label: "Home", to: "/", isActive: location.pathname === "/" },
    {
      icon: Users,
      label: "Children",
      to: "/children",
      isActive: location.pathname.startsWith("/children"),
    },
    {
      icon: ClipboardList,
      label: "Results",
      to: "/results",
      isActive: location.pathname.startsWith("/results"),
    },
    {
      icon: Bell,
      label: "Alerts",
      to: "/notifications",
      badge: unreadCount > 0 ? unreadCount : undefined,
      isActive: location.pathname.startsWith("/notifications"),
    },
  ];

  return (
    <>
      <OfflineBanner />
      <SkipToContent />
      <AppShell sidebar={sidebar} headerRight={headerRight} hasBottomNav>
        <RouteAnnouncer pathname={location.pathname} />
        <div id="main-content">
          <PageTransition pageKey={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </AppShell>
      <MobileBottomNav items={mobileNavItems} LinkComponent={Link} />
      <SWUpdateNotification />
      <PWAInstallBanner />
    </>
  );
}
