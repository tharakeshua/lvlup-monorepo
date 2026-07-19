import * as React from "react";
import { cn } from "../../lib/utils";

export interface MobileNavItem {
  icon: React.ElementType;
  label: string;
  to: string;
  badge?: number;
  isActive: boolean;
  /** Optional click handler — renders a button instead of a link when provided */
  onClick?: () => void;
}

export interface MobileBottomNavProps {
  items: MobileNavItem[];
  LinkComponent?: React.ComponentType<{
    to: string;
    className?: string;
    children: React.ReactNode;
  }>;
}

function NavTab({
  icon: Icon,
  label,
  to,
  badge,
  isActive,
  onClick,
  LinkComponent,
}: MobileNavItem & { LinkComponent: MobileBottomNavProps["LinkComponent"] }) {
  const Link = LinkComponent ?? DefaultLink;
  const sharedClassName = cn(
    "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 py-1 text-xs transition-colors",
    isActive ? "text-primary" : "text-muted-foreground"
  );

  const content = (
    <>
      <div className="relative">
        <Icon className="h-5 w-5" />
        {badge != null && badge > 0 && (
          <span className="bg-destructive text-destructive-foreground absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className="truncate">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={sharedClassName}>
        {content}
      </button>
    );
  }

  return (
    <Link to={to} className={sharedClassName}>
      {content}
    </Link>
  );
}

export function MobileBottomNav({ items, LinkComponent }: MobileBottomNavProps) {
  return (
    <nav
      className="bg-background fixed bottom-0 left-0 right-0 z-40 border-t md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-14 items-center justify-around">
        {items.map((item) => (
          <NavTab key={item.to} {...item} LinkComponent={LinkComponent} />
        ))}
      </div>
    </nav>
  );
}

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
