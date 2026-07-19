import * as React from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "../ui/sidebar";
import { Separator } from "../ui/separator";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage } from "../ui/breadcrumb";
import { useIsMobile } from "../../hooks/use-mobile";

export interface AppShellProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  pageTitle?: string;
  headerRight?: React.ReactNode;
  defaultOpen?: boolean;
  /** Add bottom padding for mobile bottom nav */
  hasBottomNav?: boolean;
  /** Bottom nav rendered inside SidebarProvider for sidebar context access */
  bottomNav?: React.ReactNode;
}

function readSidebarCookie(): boolean | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)sidebar:state=(\w+)/);
  if (!match) return null;
  return match[1] === "true";
}

export function AppShell({
  children,
  sidebar,
  pageTitle,
  headerRight,
  defaultOpen,
  hasBottomNav = false,
  bottomNav,
}: AppShellProps) {
  const isMobile = useIsMobile();
  // Compute initial open state once: explicit prop > cookie > not-mobile fallback
  const initialOpen = React.useRef<boolean | null>(null);
  if (initialOpen.current === null) {
    initialOpen.current = defaultOpen ?? readSidebarCookie() ?? !isMobile;
  }

  return (
    <SidebarProvider defaultOpen={initialOpen.current}>
      {sidebar}
      <SidebarInset>
        <header
          className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <SidebarTrigger className="-ml-1 min-h-[44px] min-w-[44px]" />
          <Separator orientation="vertical" className="mr-2 hidden h-4 md:block" />
          {pageTitle && (
            <Breadcrumb className="hidden md:flex">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          )}
          {headerRight && <div className="ml-auto flex items-center gap-2">{headerRight}</div>}
        </header>
        <main
          className={`min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 ${hasBottomNav ? "pb-20 md:pb-6" : ""}`}
        >
          {children}
        </main>
      </SidebarInset>
      {bottomNav}
    </SidebarProvider>
  );
}
