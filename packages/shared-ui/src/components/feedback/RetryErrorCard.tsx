import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

export interface RetryErrorCardProps {
  error: Error | string;
  onRetry: () => void;
  title?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Inline error recovery card for section-level data failures.
 * Replaces generic error boundaries with a retry-in-place pattern.
 */
export function RetryErrorCard({
  error,
  onRetry,
  title = "Something went wrong",
  compact = false,
  className,
}: RetryErrorCardProps) {
  const message = typeof error === "string" ? error : error.message;

  return (
    <div
      className={cn(
        "border-destructive/20 bg-destructive/5 rounded-lg border",
        compact ? "p-3" : "p-5",
        className
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          className={cn(
            "text-destructive flex-shrink-0",
            compact ? "mt-0.5 h-4 w-4" : "mt-0.5 h-5 w-5"
          )}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <h4 className={cn("text-destructive font-medium", compact ? "text-sm" : "text-base")}>
            {title}
          </h4>
          {message && (
            <p className={cn("text-muted-foreground mt-1", compact ? "text-xs" : "text-sm")}>
              {message}
            </p>
          )}
          <button
            onClick={onRetry}
            className={cn(
              "border-destructive/30 bg-background text-destructive hover:bg-destructive/10 mt-2 inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors",
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            )}
          >
            <RefreshCw className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
