import * as React from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { NotificationDropdown } from "./NotificationDropdown";
import type { Notification } from "@levelup/shared-types";
import { cn } from "../../lib/utils";

export interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  isLoading?: boolean;
  onNotificationClick: (notification: Notification) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  isLoading,
  onNotificationClick,
  onMarkAllRead,
  onViewAll,
}: NotificationBellProps) {
  const [open, setOpen] = React.useState(false);

  const handleNotificationClick = (notification: Notification) => {
    onNotificationClick(notification);
    setOpen(false);
  };

  const handleViewAll = () => {
    onViewAll();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              className={cn(
                "bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full text-[10px] font-bold",
                unreadCount > 9 ? "h-5 w-5" : "h-4 w-4"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">
            Notifications{unreadCount > 0 ? `, ${unreadCount} unread` : ""}
          </span>
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : ""}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0" sideOffset={8}>
        <NotificationDropdown
          notifications={notifications}
          onNotificationClick={handleNotificationClick}
          onMarkAllRead={onMarkAllRead}
          onViewAll={handleViewAll}
          isLoading={isLoading}
        />
      </PopoverContent>
    </Popover>
  );
}
