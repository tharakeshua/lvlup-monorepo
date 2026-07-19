import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, useConsumerStore } from "@levelup/shared-stores";
import {
  useNotifications,
  useNotificationBadgeQuery,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@levelup/query";
import {
  AppShell,
  AppSidebar,
  NotificationBell,
  ThemeToggle,
  SkipToContent,
  PageTransition,
  RouteAnnouncer,
  MobileBottomNav,
  SWUpdateNotification,
  PWAInstallBanner,
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
  type MobileNavItem,
} from "@levelup/shared-ui";
import { LayoutDashboard, ShoppingBag, ShoppingCart, User, LogOut } from "lucide-react";

export default function ConsumerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const cartCount = useConsumerStore((s) => s.cart.length);

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
          title: "My Learning",
          url: "/consumer",
          icon: LayoutDashboard,
          isActive: location.pathname === "/consumer" || location.pathname === "/my-spaces",
        },
        {
          title: "Space Store",
          url: "/store",
          icon: ShoppingBag,
          isActive:
            location.pathname.startsWith("/store") && !location.pathname.includes("checkout"),
        },
        ...(cartCount > 0
          ? [
              {
                title: `Cart (${cartCount})`,
                url: "/store/checkout",
                icon: ShoppingCart,
                isActive: location.pathname === "/store/checkout",
              },
            ]
          : []),
        {
          title: "Profile",
          url: "/consumer/profile",
          icon: User,
          isActive: location.pathname === "/consumer/profile",
        },
      ],
    },
  ];

  const displayName = user?.displayName ?? user?.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((w: string) => w.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sidebarFooter = (
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
            <p className="text-sm font-medium">{user?.displayName ?? "User"}</p>
            <p className="text-muted-foreground text-xs">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
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
  );

  const sidebar = (
    <AppSidebar
      appName="LevelUp"
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
        onViewAll={() => navigate("/consumer/notifications")}
      />
    </div>
  );

  const mobileNavItems: MobileNavItem[] = [
    {
      icon: LayoutDashboard,
      label: "Home",
      to: "/consumer",
      isActive: location.pathname === "/consumer" || location.pathname === "/my-spaces",
    },
    {
      icon: ShoppingBag,
      label: "Store",
      to: "/store",
      isActive: location.pathname.startsWith("/store") && !location.pathname.includes("checkout"),
    },
    ...(cartCount > 0
      ? [
          {
            icon: ShoppingCart,
            label: "Cart",
            to: "/store/checkout",
            isActive: location.pathname === "/store/checkout",
            badge: cartCount,
          },
        ]
      : []),
    {
      icon: User,
      label: "Profile",
      to: "/consumer/profile",
      isActive: location.pathname === "/consumer/profile",
    },
  ];

  return (
    <>
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
