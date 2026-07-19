import type { LucideIcon } from "lucide-react";
import {
  Inbox,
  Search,
  Bell,
  FileText,
  BarChart3,
  BookOpen,
  Trophy,
  Users,
  Calendar,
  ClipboardList,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Button, type ButtonProps } from "./button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonProps["variant"];
}

/** Preset empty state configurations for common scenarios */
export type EmptyStatePreset =
  | "no-data"
  | "no-results"
  | "no-notifications"
  | "no-documents"
  | "no-analytics"
  | "no-courses"
  | "no-achievements"
  | "no-students"
  | "no-events"
  | "no-assignments";

const presets: Record<EmptyStatePreset, { icon: LucideIcon; title: string; description: string }> =
  {
    "no-data": {
      icon: Inbox,
      title: "No data yet",
      description: "Data will appear here once it becomes available.",
    },
    "no-results": {
      icon: Search,
      title: "No results found",
      description: "Try adjusting your search or filter criteria.",
    },
    "no-notifications": {
      icon: Bell,
      title: "All caught up!",
      description: "You have no new notifications.",
    },
    "no-documents": {
      icon: FileText,
      title: "No documents",
      description: "Documents and files will show up here.",
    },
    "no-analytics": {
      icon: BarChart3,
      title: "No analytics yet",
      description: "Analytics will populate as data is collected.",
    },
    "no-courses": {
      icon: BookOpen,
      title: "No courses available",
      description: "Courses will appear here once they are published.",
    },
    "no-achievements": {
      icon: Trophy,
      title: "No achievements yet",
      description: "Keep learning to unlock your first achievement!",
    },
    "no-students": {
      icon: Users,
      title: "No students enrolled",
      description: "Students will appear here once they join.",
    },
    "no-events": {
      icon: Calendar,
      title: "No upcoming events",
      description: "Scheduled events and deadlines will show here.",
    },
    "no-assignments": {
      icon: ClipboardList,
      title: "No assignments",
      description: "Assignments will appear here when created.",
    },
  };

export interface EmptyStateProps {
  /** Use a preset for common scenarios (overrides icon/title/description) */
  preset?: EmptyStatePreset;
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /** Compact layout with less padding */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  preset,
  icon: IconProp,
  title: titleProp,
  description: descriptionProp,
  action,
  compact,
  className,
}: EmptyStateProps) {
  const config = preset ? presets[preset] : null;
  const Icon = IconProp ?? config?.icon;
  const title = titleProp || config?.title || "No data";
  const description = descriptionProp ?? config?.description;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-3 py-6" : "px-4 py-12",
        className
      )}
    >
      {Icon && (
        <div
          className={cn("bg-muted mb-4 rounded-full p-4", compact && "mb-3 p-3")}
          aria-hidden="true"
        >
          <Icon className={cn("text-muted-foreground", compact ? "h-6 w-6" : "h-8 w-8")} />
        </div>
      )}
      <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>{title}</h3>
      {description && (
        <p className={cn("text-muted-foreground mt-1 max-w-sm", compact ? "text-xs" : "text-sm")}>
          {description}
        </p>
      )}
      {action && (
        <Button
          variant={action.variant ?? "default"}
          onClick={action.onClick}
          size={compact ? "sm" : "default"}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
