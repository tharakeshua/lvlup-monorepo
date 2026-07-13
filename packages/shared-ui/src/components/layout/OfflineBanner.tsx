import { useState, useEffect } from "react";
import { useOnlineStatus } from "@levelup/shared-hooks";
import { WifiOff, X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface OfflineBannerProps {
  className?: string;
}

/**
 * Slim banner displayed when the user goes offline.
 * Dismissible, but re-appears on page navigation if still offline.
 */
export function OfflineBanner({ className }: OfflineBannerProps) {
  const { isOnline } = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);

  // Re-show banner when transitioning from online to offline
  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (isOnline || dismissed) return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-md",
        "animate-in slide-in-from-top duration-300",
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>You're offline. Some data may be outdated.</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 rounded-full p-0.5 transition-colors hover:bg-white/20"
        aria-label="Dismiss offline notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
