import { cn } from "../../lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export type RiskLevel = "high" | "medium" | "low" | "none";

export interface AtRiskBadgeProps {
  isAtRisk: boolean;
  reasons?: string[];
  className?: string;
}

export function AtRiskBadge({ isAtRisk, reasons, className }: AtRiskBadgeProps) {
  if (!isAtRisk) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400",
          className
        )}
        role="status"
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        On Track
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400",
        className
      )}
      role="status"
      title={reasons?.join(", ")}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      At Risk
    </span>
  );
}
