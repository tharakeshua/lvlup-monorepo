import type { Notification } from "@levelup/shared-types";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { cn } from "../../lib/utils";

export interface NotificationsPageProps {
  notifications: Notification[];
  isLoading?: boolean;
  hasMore?: boolean;
  filter: "all" | "unread";
  onFilterChange: (filter: "all" | "unread") => void;
  onNotificationClick: (notification: Notification) => void;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onLoadMore?: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

const typeLabels: Record<string, string> = {
  exam_results_released: "Exam Results",
  new_exam_assigned: "New Exam",
  new_space_assigned: "New Space",
  submission_graded: "Grading",
  grading_complete: "Grading Complete",
  student_at_risk: "At Risk Alert",
  deadline_reminder: "Deadline",
  space_published: "Space Published",
  bulk_import_complete: "Import Complete",
  ai_budget_alert: "Budget Alert",
  system_announcement: "Announcement",
};

export function NotificationsPage({
  notifications,
  isLoading,
  hasMore,
  filter,
  onFilterChange,
  onNotificationClick,
  onMarkRead,
  onMarkAllRead,
  onLoadMore,
}: NotificationsPageProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <Button variant="outline" size="sm" onClick={onMarkAllRead}>
          Mark all as read
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => onFilterChange(v as "all" | "unread")}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "hover:bg-muted/50 flex items-start gap-4 px-6 py-4 transition-colors",
                    !notif.isRead && "bg-primary/5"
                  )}
                >
                  <button
                    onClick={() => onNotificationClick(notif)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("text-sm", !notif.isRead ? "font-semibold" : "font-medium")}
                      >
                        {notif.title}
                      </span>
                      <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                        {typeLabels[notif.type] ?? notif.type}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-sm">{notif.body}</p>
                    <p className="text-muted-foreground/70 mt-1 text-xs">
                      {formatDate(notif.createdAt as unknown as string)}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {!notif.isRead && (
                      <>
                        <span className="bg-primary h-2 w-2 rounded-full" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => onMarkRead(notif.id)}
                        >
                          Mark read
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <div className="border-t p-4 text-center">
              <Button variant="outline" size="sm" onClick={onLoadMore}>
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
