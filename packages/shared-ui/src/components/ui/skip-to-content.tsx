import { cn } from "../../lib/utils";

export interface SkipToContentProps {
  targetId?: string;
  className?: string;
}

/**
 * Visually hidden link that becomes visible on focus.
 * Place at the top of each app layout for keyboard users.
 */
export function SkipToContent({ targetId = "main-content", className }: SkipToContentProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50",
        "focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg",
        "focus:ring-ring focus:outline-none focus:ring-2 focus:ring-offset-2",
        className
      )}
    >
      Skip to main content
    </a>
  );
}
