import { useMemo, Suspense } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  AppShell,
  AppSidebar,
  AppBreadcrumb,
  RoleSwitcher,
  NotificationBell,
  Button,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  SkipToContent,
  ThemeToggle,
  PageTransition,
  RouteAnnouncer,
  MobileBottomNav,
  SWUpdateNotification,
  useSidebar,
  type NavGroup,
  type TenantOption,
  type MobileNavItem,
} from "@levelup/shared-ui";
import {
  useNotifications,
  useNotificationBadgeQuery,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useSwitchTenant,
} from "@levelup/query";
import {
  useSession,
  useCurrentUser,
  useCurrentTenantId,
  useCurrentTenant,
  useAllMemberships,
} from "@/sdk/identity";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  ClipboardList,
  BookOpen,
  Settings,
  DollarSign,
  FileText,
  BarChart3,
  Library,
  CalendarDays,
  LogOut,
  Settings as SettingsIcon,
  Shield,
  Menu,
  Megaphone,
  DatabaseBackup,
  Upload,
  ScanLine,
} from "lucide-react";
import QuotaWarningBanner from "../components/layout/QuotaWarningBanner";

const ADMIN_ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/classes": "Classes",
  "/exams": "Exams",
  "/spaces": "Spaces",
  "/courses": "Courses",
  "/analytics": "Analytics",
  "/reports": "Reports",
  "/ai-usage": "AI Usage",
  "/academic-sessions": "Academic Sessions",
  "/settings": "Settings",
  "/notifications": "Notifications",
  "/staff": "Staff & Permissions",
  "/onboarding": "Setup Wizard",
  "/announcements": "Announcements",
  "/data-export": "Data Export",
  "/bulk-import": "Bulk Import",
  "/scanner": "Scanner Ops",
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const allMemberships = useAllMemberships();
  const currentTenantId = useCurrentTenantId();
  const user = useCurrentUser();
  const { logout } = useSession();
  const switchTenant = useSwitchTenant();

  // Notifications + badge are tenant-implicit (claims-scoped) in the fat-SDK.
  const notifQ = useNotifications();
  const notifsLoading = notifQ.isLoading;
  const badgeQ = useNotificationBadgeQuery();
  const unreadCount = (badgeQ.data as { unreadCount?: number } | undefined)?.unreadCount ?? 0;
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = (
    Array.isArray(notifQ.data)
      ? notifQ.data
      : ((notifQ.data as { notifications?: unknown[] } | undefined)?.notifications ?? [])
  ) as never[];

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
      label: "Management",
      items: [
        {
          title: "Users",
          url: "/users",
          icon: Users,
          isActive: location.pathname.startsWith("/users"),
        },
        {
          title: "Classes",
          url: "/classes",
          icon: GraduationCap,
          isActive: location.pathname.startsWith("/classes"),
        },
        {
          title: "Exams",
          url: "/exams",
          icon: ClipboardList,
          isActive: location.pathname.startsWith("/exams"),
        },
        {
          title: "Spaces",
          url: "/spaces",
          icon: BookOpen,
          isActive: location.pathname.startsWith("/spaces"),
        },
        {
          title: "Courses",
          url: "/courses",
          icon: Library,
          isActive: location.pathname.startsWith("/courses"),
        },
        {
          title: "Staff & Permissions",
          url: "/staff",
          icon: Shield,
          isActive: location.pathname.startsWith("/staff"),
        },
        {
          title: "Bulk Import",
          url: "/bulk-import",
          icon: Upload,
          isActive: location.pathname.startsWith("/bulk-import"),
        },
        {
          title: "Scanner Ops",
          url: "/scanner",
          icon: ScanLine,
          isActive: location.pathname.startsWith("/scanner"),
        },
        {
          title: "Announcements",
          url: "/announcements",
          icon: Megaphone,
          isActive: location.pathname.startsWith("/announcements"),
        },
      ],
    },
    {
      label: "Analytics",
      items: [
        {
          title: "Analytics",
          url: "/analytics",
          icon: BarChart3,
          isActive: location.pathname.startsWith("/analytics"),
        },
        {
          title: "Reports",
          url: "/reports",
          icon: FileText,
          isActive: location.pathname.startsWith("/reports"),
        },
        {
          title: "AI Usage",
          url: "/ai-usage",
          icon: DollarSign,
          isActive: location.pathname.startsWith("/ai-usage"),
        },
      ],
    },
    {
      label: "Configuration",
      items: [
        {
          title: "Academic Sessions",
          url: "/academic-sessions",
          icon: CalendarDays,
          isActive: location.pathname.startsWith("/academic-sessions"),
        },
        {
          title: "Data Export",
          url: "/data-export",
          icon: DatabaseBackup,
          isActive: location.pathname.startsWith("/data-export"),
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

  const currentTenant = useCurrentTenant();
  const currentTenantName = (currentTenant.data as { name?: string } | undefined)?.name;

  const adminMemberships = useMemo(
    () => allMemberships.filter((m) => m.role === "tenantAdmin"),
    [allMemberships]
  );

  // Tenant display names come from the `useMe` membership rows (no direct
  // firestore read). The active tenant's name is refined by `useCurrentTenant()`.
  const tenantOptions: TenantOption[] = adminMemberships.map((m) => ({
    tenantId: m.tenantId,
    tenantName:
      m.tenantId === currentTenantId
        ? (currentTenantName ?? m.tenantName ?? m.tenantId)
        : (m.tenantName ?? m.tenantId),
    role: m.role as TenantOption["role"],
  }));

  const sidebarFooter = (
    <div className="space-y-2">
      <RoleSwitcher
        currentTenantId={currentTenantId}
        tenants={tenantOptions}
        onSwitch={(tenantId) => switchTenant.mutate(tenantId)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 px-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {(user?.displayName ?? user?.email ?? "A").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs">{user?.displayName ?? user?.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.displayName ?? "Admin"}</p>
              <p className="text-muted-foreground text-xs">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <SettingsIcon className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const sidebar = (
    <AppSidebar
      appName="Admin"
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
        onMarkAllRead={() => markAllRead.mutate()}
        onViewAll={() => navigate("/notifications")}
      />
    </div>
  );

  return (
    <>
      <SkipToContent />
      <AppShell
        sidebar={sidebar}
        headerRight={headerRight}
        hasBottomNav
        bottomNav={<AppMobileBottomNav />}
      >
        <RouteAnnouncer pathname={location.pathname} />
        <AppBreadcrumb routeLabels={ADMIN_ROUTE_LABELS} />
        <QuotaWarningBanner />
        <div id="main-content">
          <Suspense
            fallback={
              <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-64 w-full" />
              </div>
            }
          >
            <PageTransition pageKey={location.pathname}>
              <Outlet />
            </PageTransition>
          </Suspense>
        </div>
      </AppShell>
      <SWUpdateNotification />
    </>
  );
}

/** Mobile bottom nav with "More" button that opens the sidebar sheet */
function AppMobileBottomNav() {
  const location = useLocation();
  const { toggleSidebar } = useSidebar();

  const mobileNavItems: MobileNavItem[] = [
    { icon: LayoutDashboard, label: "Home", to: "/", isActive: location.pathname === "/" },
    { icon: Users, label: "Users", to: "/users", isActive: location.pathname.startsWith("/users") },
    {
      icon: GraduationCap,
      label: "Classes",
      to: "/classes",
      isActive: location.pathname.startsWith("/classes"),
    },
    {
      icon: BarChart3,
      label: "Analytics",
      to: "/analytics",
      isActive: location.pathname.startsWith("/analytics"),
    },
    { icon: Menu, label: "More", to: "#", isActive: false, onClick: toggleSidebar },
  ];

  return <MobileBottomNav items={mobileNavItems} LinkComponent={Link} />;
}
