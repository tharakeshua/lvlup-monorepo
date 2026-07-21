import { useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, useTenantStore } from "@levelup/shared-stores";
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
  Button,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  type NavGroup,
  type TenantOption,
  type MobileNavItem,
} from "@levelup/shared-ui";
import {
  useNotifications,
  useNotificationBadgeQuery,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@levelup/query";
import { useTenantBranding } from "../hooks/useTenantBranding";
// Theme managed by shared ThemeToggle component
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  GraduationCap,
  BarChart3,
  Trophy,
  Settings,
  UserCircle,
  LogOut,
} from "lucide-react";

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { allMemberships, currentTenantId, switchTenant, user, logout } = useAuthStore();

  // Apply tenant branding (colors + CSS custom properties)
  useTenantBranding();

  // Reset scroll to top on route change — without this, navigating back to a
  // list (e.g. Exams) keeps the browser's prior scroll offset, landing the
  // user mid-list instead of at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const notifQuery = useNotifications();
  const notifData = notifQuery.data as { items?: unknown[] } | undefined;
  const notifsLoading = notifQuery.isLoading;
  const badgeQuery = useNotificationBadgeQuery();
  const unreadCount = (badgeQuery.data as { unreadCount?: number } | undefined)?.unreadCount ?? 0;
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const navGroups: NavGroup[] = [
    {
      label: "",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: LayoutDashboard,
          isActive: location.pathname === "/",
        },
        {
          title: "My Spaces",
          url: "/spaces",
          // Timed tests live under /spaces/:id/test/:id — keep the highlight on
          // "Tests" there so starting a test doesn't visually jump to Spaces.
          icon: BookOpen,
          isActive:
            location.pathname.startsWith("/spaces") && !location.pathname.includes("/test/"),
        },
        {
          title: "Tests",
          url: "/tests",
          icon: ClipboardList,
          isActive: location.pathname.startsWith("/tests") || location.pathname.includes("/test/"),
        },
        {
          title: "Exams",
          url: "/exams",
          icon: GraduationCap,
          isActive: location.pathname.startsWith("/exams"),
        },
        {
          title: "Progress",
          url: "/results",
          icon: BarChart3,
          isActive: location.pathname.startsWith("/results"),
        },
        {
          title: "Leaderboard",
          url: "/leaderboard",
          icon: Trophy,
          isActive: location.pathname.startsWith("/leaderboard"),
        },
        {
          title: "Profile",
          url: "/profile",
          icon: UserCircle,
          isActive: location.pathname === "/profile",
        },
        {
          title: "Settings",
          url: "/settings",
          icon: Settings,
          isActive: location.pathname === "/settings",
        },
      ],
    },
  ];

  const currentTenantName = useTenantStore((s) => s.tenant?.name);

  const studentMemberships = allMemberships.filter((m) => m.role === "student");

  // PARITY NOTE: the legacy direct-Firestore lookup of other tenants' display
  // names is dropped — there is no batch tenant-name query hook a member may call
  // (useTenants is super-admin scope). Inactive tenants fall back to their tenant
  // code; the active tenant uses the loaded tenant name.
  const tenantOptions: TenantOption[] = studentMemberships.map((m) => ({
    tenantId: m.tenantId,
    tenantName:
      m.tenantId === currentTenantId
        ? (currentTenantName ?? m.tenantCode ?? m.tenantId)
        : (m.tenantCode ?? m.tenantId),
    role: m.role,
  }));

  const displayName = user?.displayName ?? user?.email ?? "Student";
  const initials = displayName
    .split(" ")
    .map((w: string) => w.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sidebarFooter = (
    <div className="space-y-2">
      <RoleSwitcher
        currentTenantId={currentTenantId}
        tenants={tenantOptions}
        onSwitch={switchTenant}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start gap-2 px-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs">{displayName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.displayName ?? "Student"}</p>
              <p className="text-muted-foreground text-xs">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" /> Settings
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
      appName="Student"
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
        notifications={(notifData?.items ?? []) as never}
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
      isActive: location.pathname.startsWith("/spaces") && !location.pathname.includes("/test/"),
    },
    {
      icon: ClipboardList,
      label: "Tests",
      to: "/tests",
      isActive: location.pathname.startsWith("/tests") || location.pathname.includes("/test/"),
    },
    {
      icon: GraduationCap,
      label: "Exams",
      to: "/exams",
      isActive: location.pathname.startsWith("/exams"),
    },
    {
      icon: Trophy,
      label: "Rank",
      to: "/leaderboard",
      isActive: location.pathname.startsWith("/leaderboard"),
    },
    {
      icon: UserCircle,
      label: "Profile",
      to: "/profile",
      isActive: location.pathname === "/profile",
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
