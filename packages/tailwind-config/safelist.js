/**
 * Tailwind CSS safelist for shared-ui sidebar, layout, and accessibility classes.
 *
 * These classes are used in packages/shared-ui but Tailwind's content scanner
 * can't detect them because they use complex data-attribute selectors.
 * Each app must include this safelist in its tailwind.config.ts.
 */
module.exports = [
  // Responsive visibility
  "hidden",
  "md:block",
  "md:flex",
  "md:hidden",
  "md:pb-6",
  "md:p-6",
  "sm:flex",
  "sm:px-4",
  "sm:p-4",
  // Accessibility
  "sr-only",
  "focus:not-sr-only",
  "focus:fixed",
  "focus:left-4",
  "focus:top-4",
  "focus:z-50",
  "focus:rounded-md",
  "focus:bg-primary",
  "focus:px-4",
  "focus:py-2",
  "focus:text-primary-foreground",
  "focus:shadow-lg",
  "focus:outline-none",
  "focus:ring-2",
  "focus:ring-ring",
  "focus:ring-offset-2",
  // Sidebar structure
  "peer",
  "group",
  // Sidebar collapsible icon mode
  "group-data-[collapsible=icon]:!size-8",
  "group-data-[collapsible=icon]:!p-0",
  "group-data-[collapsible=icon]:!p-2",
  "group-data-[collapsible=icon]:-mt-8",
  "group-data-[collapsible=icon]:hidden",
  "group-data-[collapsible=icon]:opacity-0",
  "group-data-[collapsible=icon]:overflow-hidden",
  "group-data-[collapsible=icon]:w-[--sidebar-width-icon]",
  "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]",
  "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]",
  // Sidebar collapsible offcanvas mode
  "group-data-[collapsible=offcanvas]:w-0",
  "group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
  "group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
  "group-data-[collapsible=offcanvas]:translate-x-0",
  "group-data-[collapsible=offcanvas]:after:left-full",
  "group-data-[collapsible=offcanvas]:hover:bg-sidebar",
  // Sidebar side
  "group-data-[side=left]:-right-4",
  "group-data-[side=left]:border-r",
  "group-data-[side=right]:border-l",
  "group-data-[side=right]:left-0",
  "group-data-[side=right]:rotate-180",
  // Sidebar variant
  "group-data-[variant=floating]:rounded-lg",
  "group-data-[variant=floating]:border",
  "group-data-[variant=floating]:border-sidebar-border",
  "group-data-[variant=floating]:shadow",
  "has-[[data-variant=inset]]:bg-sidebar",
  // Sidebar inset peer-data
  "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))]",
  "md:peer-data-[variant=inset]:m-2",
  "md:peer-data-[variant=inset]:ml-0",
  "md:peer-data-[variant=inset]:rounded-xl",
  "md:peer-data-[variant=inset]:shadow",
  "md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2",
  // Sidebar menu button peer-data
  "peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
  "peer-data-[size=sm]/menu-button:top-1",
  "peer-data-[size=default]/menu-button:top-1.5",
  "peer-data-[size=lg]/menu-button:top-2.5",
  // Active states
  "data-[active=true]:bg-sidebar-accent",
  "data-[active=true]:font-medium",
  "data-[active=true]:text-sidebar-accent-foreground",
  "data-[state=open]:hover:bg-sidebar-accent",
  "data-[state=open]:hover:text-sidebar-accent-foreground",
];
