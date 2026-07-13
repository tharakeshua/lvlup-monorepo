import { useEffect, useRef, useState } from "react";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "blue" | "green" | "orange" | "red";
  /** Animate the bar filling up on mount */
  animate?: boolean;
}

const colorMap = {
  blue: "bg-primary",
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-destructive",
};

const sizeMap = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
};

export default function ProgressBar({
  value,
  max = 100,
  label,
  showPercent = true,
  size = "md",
  color = "blue",
  animate = false,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const [displayPercent, setDisplayPercent] = useState(animate ? 0 : percentage);
  const mounted = useRef(false);

  useEffect(() => {
    if (animate && !mounted.current) {
      mounted.current = true;
      // Delay to trigger CSS transition after initial render at 0
      const timer = requestAnimationFrame(() => {
        setDisplayPercent(percentage);
      });
      return () => cancelAnimationFrame(timer);
    }
    setDisplayPercent(percentage);
  }, [percentage, animate]);

  return (
    <div>
      {(label || showPercent) && (
        <div className="text-muted-foreground mb-1 flex justify-between text-xs">
          {label && <span>{label}</span>}
          {showPercent && <span>{percentage}%</span>}
        </div>
      )}
      <div
        className={`bg-muted w-full rounded-full ${sizeMap[size]}`}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
      >
        <div
          className={`rounded-full ${sizeMap[size]} ${colorMap[color]} transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(displayPercent, 100)}%` }}
        />
      </div>
    </div>
  );
}
