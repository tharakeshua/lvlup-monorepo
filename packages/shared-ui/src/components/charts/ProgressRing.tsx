import * as React from "react";
import { cn } from "../../lib/utils";
import { SkeletonShimmer } from "../motion/SkeletonShimmer";

export interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  color?: string;
  showValue?: boolean;
  /** Show loading skeleton instead of the ring */
  loading?: boolean;
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 8,
  className,
  label,
  color,
  showValue = true,
  loading = false,
}: ProgressRingProps) {
  const prevValueRef = React.useRef(value);
  const [announcement, setAnnouncement] = React.useState("");

  React.useEffect(() => {
    if (prevValueRef.current !== value) {
      setAnnouncement(`Progress updated to ${Math.round(value)}%`);
      prevValueRef.current = value;
    }
  }, [value]);

  if (loading) {
    return <SkeletonShimmer preset="circle" className={className} />;
  }
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  const resolvedColor =
    color ??
    (clamped >= 70
      ? "hsl(var(--success))"
      : clamped >= 40
        ? "hsl(var(--warning))"
        : "hsl(var(--destructive))");

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${Math.round(clamped)}% complete`}
      className={cn("relative inline-flex items-center justify-center", className)}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      {showValue && (
        <div className="absolute flex flex-col items-center" aria-hidden="true">
          <span className="text-sm font-bold">{Math.round(clamped)}%</span>
          {label && <span className="text-muted-foreground text-[10px]">{label}</span>}
        </div>
      )}
      {announcement && (
        <span className="sr-only" aria-live="polite" role="status">
          {announcement}
        </span>
      )}
    </div>
  );
}
