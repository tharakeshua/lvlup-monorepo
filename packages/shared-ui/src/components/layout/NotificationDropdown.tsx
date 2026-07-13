import * as React from "react";
import { CheckCircle } from "lucide-react";
import type { Notification } from "@levelup/shared-types";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "../../lib/utils";

export interface NotificationDropdownProps {
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
  isLoading?: boolean;
}

function getRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateDay.getTime() === today.getTime()) return "Today";
  if (dateDay.getTime() === yesterday.getTime()) return "Yesterday";
  return "Earlier";
}

function NotificationIcon({ type }: { type: string }) {
  const iconMap: Record<string, string> = {
    exam_results_released: "📊",
    new_exam_assigned: "📝",
    new_space_assigned: "📚",
    submission_graded: "✅",
    grading_complete: "🎯",
    student_at_risk: "⚠️",
    deadline_reminder: "⏰",
    space_published: "🚀",
    bulk_import_complete: "📥",
    ai_budget_alert: "💰",
    system_announcement: "📢",
  };
  return <span className="text-lg">{iconMap[type] ?? "🔔"}</span>;
}

export function NotificationDropdown({
  notifications,
  onNotificationClick,
  onMarkAllRead,
  onViewAll,
  isLoading,
}: NotificationDropdownProps) {
  // Group notifications by date
  const grouped = React.useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    for (const notif of notifications) {
      const group = getDateGroup(notif.createdAt as unknown as string);
      if (!groups[group]) groups[group] = [];
      groups[group].push(notif);
    }
    return groups;
  }, [notifications]);

  const groupOrder = ["Today", "Yesterday", "Earlier"];

  return (
    <div className="bg-popover text-popover-foreground w-80 rounded-lg border shadow-lg">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Notifications</h3>
        {notifications.some((n) => !n.isRead) && (
          <button onClick={onMarkAllRead} className="text-primary text-xs hover:underline">
            Mark all as read
          </button>
        )}
      </div>

      <ScrollArea className="max-h-96">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground mt-2 text-sm">All caught up!</p>
          </div>
        ) : (
          <div>
            {groupOrder.map(
              (group) =>
                grouped[group] && (
                  <div key={group}>
                    <div className="bg-muted/50 text-muted-foreground sticky top-0 px-4 py-1.5 text-xs font-medium">
                      {group}
                    </div>
                    {grouped[group].map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => onNotificationClick(notif)}
                        className={cn(
                          "hover:bg-muted/50 flex w-full gap-3 px-4 py-3 text-left transition-colors",
                          !notif.isRead && "bg-primary/5"
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          <NotificationIcon type={notif.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "truncate text-sm",
                                !notif.isRead ? "font-semibold" : "font-medium"
                              )}
                            >
                              {notif.title}
                            </p>
                            {!notif.isRead && (
                              <span className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full" />
                            )}
                          </div>
                          <p className="text-muted-foreground line-clamp-2 text-xs">{notif.body}</p>
                          <p className="text-muted-foreground/70 mt-1 text-xs">
                            {getRelativeDate(notif.createdAt as unknown as string)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )
            )}
          </div>
        )}
      </ScrollArea>

      <div className="border-t">
        <button
          onClick={onViewAll}
          className="text-primary hover:bg-muted/50 block w-full py-2.5 text-center text-xs font-medium"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
