import { useState, useEffect, useCallback, useRef } from "react";

export interface OnlineStatusResult {
  isOnline: boolean;
  lastOnlineAt: Date | null;
}

/**
 * Monitor online/offline status using navigator.onLine and periodic health checks.
 */
export function useOnlineStatus(onStatusChange?: (isOnline: boolean) => void): OnlineStatusResult {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(
    typeof navigator !== "undefined" && navigator.onLine ? new Date() : null
  );
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  const updateStatus = useCallback((online: boolean) => {
    setIsOnline((prev) => {
      if (prev !== online) {
        callbackRef.current?.(online);
      }
      return online;
    });
    if (online) {
      setLastOnlineAt(new Date());
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => updateStatus(true);
    const handleOffline = () => updateStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [updateStatus]);

  return { isOnline, lastOnlineAt };
}
