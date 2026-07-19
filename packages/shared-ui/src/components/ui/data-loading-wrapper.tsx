import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { EmptyState, type EmptyStateAction } from "./empty-state";
import { ErrorState } from "./error-state";
import { SkeletonShimmer } from "../motion/SkeletonShimmer";

export interface DataLoadingWrapperProps {
  /** Whether data is currently loading */
  loading?: boolean;
  /** Error message to display (truthy value triggers error state) */
  error?: string | null;
  /** Whether the loaded data is empty (triggers empty state) */
  isEmpty?: boolean;
  /** Content to render when data is loaded successfully */
  children: React.ReactNode;
  /** Custom loading skeleton — defaults to SkeletonShimmer */
  loadingSkeleton?: React.ReactNode;
  /** Number of skeleton lines when using default skeleton */
  skeletonLines?: number;
  /** Icon for the empty state */
  emptyIcon?: LucideIcon;
  /** Title for the empty state */
  emptyTitle?: string;
  /** Description for the empty state */
  emptyDescription?: string;
  /** Action button for the empty state */
  emptyAction?: EmptyStateAction;
  /** Callback for retrying after an error */
  onRetry?: () => void;
  /** Custom error title */
  errorTitle?: string;
  className?: string;
}

export function DataLoadingWrapper({
  loading,
  error,
  isEmpty,
  children,
  loadingSkeleton,
  skeletonLines = 3,
  emptyIcon,
  emptyTitle = "No data yet",
  emptyDescription,
  emptyAction,
  onRetry,
  errorTitle = "Something went wrong",
  className,
}: DataLoadingWrapperProps) {
  if (loading) {
    return (
      <div className={cn(className)}>
        {loadingSkeleton ?? <SkeletonShimmer lines={skeletonLines} />}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(className)}>
        <ErrorState title={errorTitle} description={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={cn(className)}>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return <>{children}</>;
}
