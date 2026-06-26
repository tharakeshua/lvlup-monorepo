import { useState, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, useTenantStore } from "@levelup/shared-stores";
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
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
  useTenantBranding,
  usePrefetch,
} from "@levelup/shared-hooks";

/** Route prefetch map — triggers lazy imports on link hover */
const TEACHER_PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  "/": () => import("../pages/DashboardPage"),
  "/spaces": () => import("../pages/spaces/SpaceListPage"),
  "/exams": () => import("../pages/exams/ExamListPage"),
  "/students": () => import("../pages/StudentsPage"),
  "/classes": () => import("../pages/ClassesPage"),
  "/settings": () => import("../pages/SettingsPage"),
  "/analytics/classes": () => import("../pages/ClassAnalyticsPage"),
  "/analytics/exams": () => import("../pages/ExamAnalyticsPage"),
  "/analytics/spaces": () => import("../pages/SpaceAnalyticsPage"),
  "/question-bank": () => import("../pages/spaces/QuestionBankPage"),
  "/assignments": () => import("../pages/AssignmentTrackerPage"),
  "/grading": () => import("../pages/BatchGradingPage"),
  "/rubric-presets": () => import("../pages/RubricPresetsPage"),
  "/notifications": () => import("../pages/NotificationsPage"),
};
import { getFirebaseServices } from "@levelup/shared-services";
import { doc, getDoc } from "firebase/firestore";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CheckSquare,
  BarChart3,
  Users,
  Settings,
  ListChecks,
  Library,
  Ruler,
  GraduationCap,
} from "lucide-react";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { allMemberships, currentTenantId, switchTenant, user, firebaseUser, logout } =
    useAuthStore();

  // Apply tenant branding (colors + CSS custom properties)
  useTenantBranding();

  // Prefetch routes on link hover for near-instant navigation
  usePrefetch(TEACHER_PREFETCH_MAP);

  const { data: notifData, isLoading: notifsLoading } = useNotifications(
    currentTenantId,
    firebaseUser?.uid ?? null
  );
  const unreadCount = useUnreadCount(currentTenantId, firebaseUser?.uid ?? null);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

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
      label: "Content",
      items: [
        {
          title: "Spaces",
          url: "/spaces",
          icon: BookOpen,
          isActive: location.pathname.startsWith("/spaces"),
        },
        {
          title: "Question Bank",
          url: "/question-bank",
          icon: Library,
          isActive: location.pathname === "/question-bank",
        },
        {
          title: "Exams",
          url: "/exams",
          icon: ClipboardList,
          isActive: location.pathname.startsWith("/exams"),
        },
        {
          title: "Rubric Presets",
          url: "/rubric-presets",
          icon: Ruler,
          isActive: location.pathname === "/rubric-presets",
        },
        {
          title: "Assignments",
          url: "/assignments",
          icon: ListChecks,
          isActive: location.pathname.startsWith("/assignments"),
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
          title: "Class Analytics",
          url: "/analytics/classes",
          icon: BarChart3,
          isActive: location.pathname.startsWith("/analytics/classes"),
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
      ],
    },
    {
      label: "People",
      items: [
        {
          title: "Classes",
          url: "/classes",
          icon: GraduationCap,
          isActive:
            location.pathname === "/classes" ||
            location.pathname.startsWith("/classes/"),
        },
        {
          title: "Students",
          url: "/students",
          icon: Users,
          isActive: location.pathname === "/students",
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

  const currentTenantName = useTenantStore((s) => s.tenant?.name);
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});

  const teacherMemberships = allMemberships.filter(
    (m) => m.role === "teacher" || m.role === "tenantAdmin"
  );

  useEffect(() => {
    const otherTenantIds = teacherMemberships
      .map((m) => m.tenantId)
      .filter((id) => id !== currentTenantId);
    if (otherTenantIds.length === 0) return;

    const { db } = getFirebaseServices();
    Promise.all(
      otherTenantIds.map(async (id) => {
        const snap = await getDoc(doc(db, "tenants", id));
        return [id, snap.exists() ? ((snap.data() as { name?: string }).name ?? id) : id] as const;
      })
    ).then((entries) => {
      setTenantNames(Object.fromEntries(entries));
    });
  }, [teacherMemberships.length, currentTenantId]);

  const tenantOptions: TenantOption[] = teacherMemberships.map((m) => ({
    tenantId: m.tenantId,
    tenantName:
      m.tenantId === currentTenantId
        ? (currentTenantName ?? m.tenantId)
        : (tenantNames[m.tenantId] ?? m.tenantId),
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
        notifications={notifData?.notifications ?? []}
        unreadCount={unreadCount}
        isLoading={notifsLoading}
        onNotificationClick={(notif) => {
          if (!notif.isRead && currentTenantId) {
            markRead.mutate({ tenantId: currentTenantId, notificationId: notif.id });
          }
          if (notif.actionUrl) navigate(notif.actionUrl);
        }}
        onMarkAllRead={() => {
          if (currentTenantId) markAllRead.mutate({ tenantId: currentTenantId });
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
