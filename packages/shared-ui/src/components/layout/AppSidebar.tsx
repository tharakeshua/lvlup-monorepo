import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "../ui/sidebar";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: string | number;
  isActive?: boolean;
  /** Stable hook for product tours / e2e — rendered as `data-tour` on the row. */
  dataTour?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface AppSidebarProps {
  appName: string;
  appLogo?: React.ReactNode;
  navGroups: NavGroup[];
  footerContent?: React.ReactNode;
  /** Current pathname — used to auto-close mobile sidebar on navigation */
  pathname?: string;
  LinkComponent?: React.ComponentType<{
    to: string;
    className?: string;
    children: React.ReactNode;
  }>;
}

// ---------------------------------------------------------------------------
// Role-based navigation configs
// ---------------------------------------------------------------------------

export type AppRole = "tenantAdmin" | "teacher" | "student" | "parent" | "superAdmin";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppSidebar({
  appName,
  appLogo,
  navGroups,
  footerContent,
  pathname,
  LinkComponent,
}: AppSidebarProps) {
  const Link = LinkComponent ?? DefaultLink;

  return (
    <Sidebar collapsible="icon">
      <SidebarMobileAutoClose pathname={pathname} />
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" className="flex items-center gap-2">
                {appLogo ?? (
                  <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                    <span className="text-sm font-bold">{appName.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <span className="truncate font-semibold">{appName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label || "_flat"}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url} data-tour={item.dataTour}>
                    <SidebarMenuButton asChild isActive={item.isActive} tooltip={item.title}>
                      <Link to={item.url}>
                        {item.icon &&
                          React.createElement(item.icon, {
                            className: "size-4",
                          })}
                        <span>{item.title}</span>
                        {item.badge != null && (
                          <span className="text-muted-foreground ml-auto text-xs">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {footerContent && <SidebarFooter>{footerContent}</SidebarFooter>}

      <SidebarRail />
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// Default <a> fallback when no Link component is provided
// ---------------------------------------------------------------------------

function DefaultLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Auto-close mobile sidebar sheet on pathname change
// ---------------------------------------------------------------------------

function SidebarMobileAutoClose({ pathname }: { pathname?: string }) {
  const { setOpenMobile, isMobile } = useSidebar();
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    // Skip closing on the initial render — only close on subsequent navigations
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isMobile && pathname != null) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return null;
}
