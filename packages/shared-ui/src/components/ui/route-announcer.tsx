import { useEffect, useRef, useState } from "react";

export interface RouteAnnouncerProps {
  /** Current pathname to announce changes for */
  pathname: string;
}

/**
 * Announces route changes to screen readers using an aria-live region.
 * Place once in each app layout. When the pathname changes, the page title
 * (or a fallback derived from the path) is announced to assistive technology.
 */
export function RouteAnnouncer({ pathname }: RouteAnnouncerProps) {
  const [announcement, setAnnouncement] = useState("");
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (pathname === previousPathname.current) return;
    previousPathname.current = pathname;

    // Derive a readable page name from the path
    const pageName =
      document.title ||
      pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => segment.replace(/[-_]/g, " "))
        .join(" - ") ||
      "Home";

    setAnnouncement(`Navigated to ${pageName}`);
  }, [pathname]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
