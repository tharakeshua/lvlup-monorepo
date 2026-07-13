import type { LucideIcon } from "lucide-react";
import { AlertCircle, WifiOff, ServerCrash, Search, ShieldX, Clock, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

type ErrorPreset = "network-error" | "server-error" | "not-found" | "forbidden" | "timeout";

const presetConfig: Record<ErrorPreset, { icon: LucideIcon; title: string; description: string }> =
  {
    "network-error": {
      icon: WifiOff,
      title: "Connection lost",
      description: "Please check your internet connection and try again.",
    },
    "server-error": {
      icon: ServerCrash,
      title: "Server error",
      description: "Something went wrong on our end. Please try again later.",
    },
    "not-found": {
      icon: Search,
      title: "Not found",
      description: "The resource you're looking for doesn't exist or has been moved.",
    },
    forbidden: {
      icon: ShieldX,
      title: "Access denied",
      description: "You don't have permission to view this content.",
    },
    timeout: {
      icon: Clock,
      title: "Request timed out",
      description: "The server took too long to respond. Please try again.",
    },
  };

export interface ErrorStateProps {
  /** Use a preset error configuration */
  preset?: ErrorPreset;
  /** Custom title (overrides preset) */
  title?: string;
  /** Custom description (overrides preset) */
  description?: string;
  /** Retry callback — renders a retry button when provided */
  onRetry?: () => void;
  /** Custom icon (overrides preset) */
  icon?: LucideIcon;
  /** Compact mode for inline usage */
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  preset,
  title,
  description,
  onRetry,
  icon,
  compact = false,
  className,
}: ErrorStateProps) {
  const config = preset ? presetConfig[preset] : undefined;
  const Icon = icon ?? config?.icon ?? AlertCircle;
  const resolvedTitle = title ?? config?.title ?? "Something went wrong";
  const resolvedDescription = description ?? config?.description ?? "An unexpected error occurred.";

  if (compact) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          "border-destructive/20 bg-destructive/5 flex items-center gap-3 rounded-lg border p-3",
          className
        )}
      >
        <Icon className="text-destructive h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{resolvedTitle}</p>
          <p className="text-muted-foreground text-xs">{resolvedDescription}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 gap-1.5">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn("flex flex-col items-center justify-center px-4 py-12 text-center", className)}
    >
      <div className="bg-destructive/10 mb-4 rounded-full p-4" aria-hidden="true">
        <Icon className="text-destructive h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold">{resolvedTitle}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-sm">{resolvedDescription}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
