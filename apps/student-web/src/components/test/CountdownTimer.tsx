import { useState, useEffect, useRef } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { sonnerToast as toast } from "@levelup/shared-ui";

interface CountdownTimerProps {
  deadline: number; // server deadline as epoch ms
  onTimeUp: () => void;
  serverOffset?: number; // local time - server time in ms
  onWarning?: (minutesLeft: number) => void;
}

export default function CountdownTimer({
  deadline,
  onTimeUp,
  serverOffset = 0,
  onWarning,
}: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => {
    const serverNow = Date.now() - serverOffset;
    return Math.max(0, deadline - serverNow);
  });
  const warned5min = useRef(false);
  const warned1min = useRef(false);
  const timeUpFired = useRef(false);
  // Track previous threshold for aria announcements
  const lastAnnouncedThreshold = useRef<"normal" | "warning" | "critical">("normal");

  useEffect(() => {
    const interval = setInterval(() => {
      const serverNow = Date.now() - serverOffset;
      const left = Math.max(0, deadline - serverNow);
      setRemaining(left);

      const leftSec = Math.floor(left / 1000);

      // Warning at 5 minutes — fire once when crossing threshold
      if (leftSec <= 300 && !warned5min.current) {
        warned5min.current = true;
        onWarning?.(5);
        toast.warning("5 minutes remaining", {
          description: "Please review your answers before time runs out.",
        });
      }

      // Warning at 1 minute — fire once when crossing threshold
      if (leftSec <= 60 && !warned1min.current) {
        warned1min.current = true;
        onWarning?.(1);
        toast.error("1 minute remaining!", {
          description: "Your test will be auto-submitted when time runs out.",
        });
      }

      if (left <= 0 && !timeUpFired.current) {
        timeUpFired.current = true;
        clearInterval(interval);
        onTimeUp();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, serverOffset, onTimeUp, onWarning]);

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const isWarning = totalSeconds <= 300; // 5 min
  const isCritical = totalSeconds <= 60; // 1 min
  const isUrgent = totalSeconds <= 30; // 30 sec

  const pad = (n: number) => n.toString().padStart(2, "0");

  // Only update aria-label at threshold crossings to reduce screen reader noise
  const currentThreshold: "normal" | "warning" | "critical" = isCritical
    ? "critical"
    : isWarning
      ? "warning"
      : "normal";
  const shouldAnnounce = currentThreshold !== lastAnnouncedThreshold.current;
  if (shouldAnnounce) {
    lastAnnouncedThreshold.current = currentThreshold;
  }

  const timeText = `${hours > 0 ? `${pad(hours)}:` : ""}${pad(minutes)}:${pad(seconds)}`;

  return (
    <div
      role="timer"
      aria-live={isCritical ? "assertive" : "off"}
      aria-label={
        isCritical
          ? `Warning: ${minutes} minutes ${seconds} seconds remaining`
          : `Time remaining: ${hours > 0 ? `${hours} hours ` : ""}${minutes} minutes ${seconds} seconds`
      }
      className={`flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-sm font-bold transition-colors ${
        isUrgent
          ? "bg-destructive text-destructive-foreground animate-pulse"
          : isCritical
            ? "bg-destructive/15 text-destructive animate-[pulse_1.5s_ease-in-out_infinite]"
            : isWarning
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-muted text-foreground"
      }`}
    >
      {isCritical ? (
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Clock className="h-4 w-4" aria-hidden="true" />
      )}
      <span className={isUrgent ? "text-base" : ""}>{timeText}</span>
    </div>
  );
}
