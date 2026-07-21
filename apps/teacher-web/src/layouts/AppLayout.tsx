import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  AppShell,
  AppSidebar,
  RoleSwitcher,
  LogoutButton,
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
import {
  useNotificationCenter,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@levelup/query";
import { useAuthSession } from "../sdk/session";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CheckSquare,
  BarChart3,
  Users,
  Settings,
  GraduationCap,
  Sparkles,
  Trophy,
  Contact,
  LineChart,
} from "lucide-react";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { allMemberships, currentTenantId, switchTenant, user, currentTenantName, logout } =
    useAuthSession();

  // Notification center (bell dropdown): merged feed + announcements + unreadCount,
  // all tenant/user-scoped server-side from claims (no tenantId/uid args).
  const { data: notifInbox, isLoading: notifsLoading } = useNotificationCenter();
  const notifications =
    (notifInbox as { notifications?: unknown[] } | undefined)?.notifications ?? [];
  const unreadCount = (notifInbox as { unreadCount?: number } | undefined)?.unreadCount ?? 0;
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
        {
          title: "Spaces",
          url: "/spaces",
          icon: BookOpen,
          isActive: location.pathname.startsWith("/spaces"),
        },
        {
          title: "Exams",
          url: "/exams",
          icon: ClipboardList,
          isActive: location.pathname.startsWith("/exams"),
        },
        {
          title: "AI Settings",
          url: "/ai-settings",
          icon: Sparkles,
          isActive:
            location.pathname.startsWith("/ai-settings") ||
            location.pathname === "/rubric-presets",
        },
        {
          title: "Batch Grading",
          url: "/grading",
          icon: CheckSquare,
          isActive: location.pathname === "/grading",
        },
      ],
    },
    {
      label: "Analytics",
      items: [
        {
          title: "Student Analytics",
          url: "/analytics/students",
          icon: LineChart,
          isActive: location.pathname.startsWith("/analytics/students"),
        },
        {
          title: "Exam Analytics",
          url: "/analytics/exams",
          icon: CheckSquare,
          isActive: location.pathname.startsWith("/analytics/exams"),
        },
        {
          title: "Space Analytics",
          url: "/analytics/spaces",
          icon: BookOpen,
          isActive: location.pathname.startsWith("/analytics/spaces"),
        },
        {
          title: "Class Analytics",
          url: "/analytics/classes",
          icon: BarChart3,
          isActive: location.pathname.startsWith("/analytics/classes"),
        },
        {
          title: "Space Leaderboard",
          url: "/leaderboards/spaces",
          icon: Trophy,
          isActive: location.pathname.startsWith("/leaderboards/spaces"),
        },
      ],
    },
    {
      label: "People",
      items: [
        {
          title: "Classes",
          url: "/classes",
          icon: GraduationCap,
          isActive: location.pathname === "/classes" || location.pathname.startsWith("/classes/"),
        },
        {
          title: "Students",
          url: "/students",
          icon: Users,
          isActive: location.pathname === "/students",
        },
        {
          title: "Parents",
          url: "/parents",
          icon: Contact,
          isActive: location.pathname.startsWith("/parents"),
        },
      ],
    },
    {
      label: "System",
      items: [
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          isActive: location.pathname.startsWith("/settings"),
        },
      ],
    },
  ];

  const teacherMemberships = allMemberships.filter(
    (m) => m.role === "teacher" || m.role === "tenantAdmin"
  );

  // The active tenant's name comes from the `getMe` bootstrap (currentTenantName);
  // other memberships fall back to their tenantCode (the old per-tenant Firestore
  // name lookup is dropped — see PARITY note in the migration report).
  const tenantOptions: TenantOption[] = teacherMemberships.map((m) => ({
    tenantId: m.tenantId,
    tenantName:
      m.tenantId === currentTenantId
        ? (currentTenantName ?? m.tenantCode ?? m.tenantId)
        : (m.tenantCode ?? m.tenantId),
    role: m.role,
  }));

  const sidebarFooter = (
    <div className="space-y-2">
      <RoleSwitcher
        currentTenantId={currentTenantId}
        tenants={tenantOptions}
        onSwitch={switchTenant}
      />
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <span className="text-muted-foreground truncate text-xs">
          {user?.displayName ?? user?.email}
        </span>
        <LogoutButton
          onLogout={logout}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Sign Out
        </LogoutButton>
      </div>
    </div>
  );

  const sidebar = (
    <AppSidebar
      appName="Teacher"
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
        notifications={notifications as never}
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
      icon: BookOpen,
      label: "Spaces",
      to: "/spaces",
      isActive: location.pathname.startsWith("/spaces"),
    },
    {
      icon: ClipboardList,
      label: "Exams",
      to: "/exams",
      isActive: location.pathname.startsWith("/exams"),
    },
    {
      icon: Users,
      label: "Students",
      to: "/students",
      isActive: location.pathname === "/students",
    },
    {
      icon: BarChart3,
      label: "Analytics",
      to: "/analytics/classes",
      isActive: location.pathname.startsWith("/analytics"),
    },
  ];

  return (
    <>
      <OfflineBanner />
      <SkipToContent />
      <AppShell
        sidebar={sidebar}
        headerRight={headerRight}
        hasBottomNav
        bottomNav={<MobileBottomNav items={mobileNavItems} LinkComponent={Link} />}
      >
        <RouteAnnouncer pathname={location.pathname} />
        <div id="main-content">
          <PageTransition pageKey={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </AppShell>
      <SWUpdateNotification />
      <PWAInstallBanner />
    </>
  );
}
