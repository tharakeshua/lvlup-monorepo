import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

/**
 * Shows a banner when the browser goes offline during a test.
 * Answers are saved to Firestore on each change, so offline means saves may fail.
 */
export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRecovered(true);
      setTimeout(() => setShowRecovered(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowRecovered(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showRecovered) return null;

  if (!isOnline) {
    return (
      <div
        role="alert"
        className="bg-destructive/10 border-destructive/30 text-destructive mb-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
      >
        <WifiOff className="h-4 w-4 flex-shrink-0" />
        <span>Connection lost. Your answers may not be saved until you reconnect.</span>
      </div>
    );
  }

  // Show "reconnected" briefly
  return (
    <div
      role="status"
      className="mb-3 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
    >
      <Wifi className="h-4 w-4 flex-shrink-0" />
      <span>Connection restored.</span>
    </div>
  );
}
