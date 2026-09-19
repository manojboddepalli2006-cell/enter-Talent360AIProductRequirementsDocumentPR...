import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listNotifications, markAllNotificationsRead, markNotificationRead, unreadNotificationCount } from "@/lib/api/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRealtimeRecommendations } from "@/hooks/use-realtime-recommendations";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_TONE: Record<string, string> = {
  pending_review: "bg-warning",
  verdict: "bg-primary",
  task: "bg-info",
  info: "bg-muted-foreground",
};

/** Notification bell with a live unread badge and a quick dropdown. */
export function NotificationBell() {
  const queryClient = useQueryClient();
  useRealtimeRecommendations();

  const [open, setOpen] = useState(false);

  const notificationsQuery = useQuery({
    queryKey: ["talent360-notifications"],
    queryFn: listNotifications,
  });

  const unreadQuery = useQuery({
    queryKey: ["talent360-notifications-unread"],
    queryFn: unreadNotificationCount,
    refetchInterval: 60_000,
  });

  const notifications = useMemo(() => notificationsQuery.data ?? [], [notificationsQuery.data]);
  const unread = unreadQuery.data ?? 0;

  const visible = useMemo(() => notifications.slice(0, 6), [notifications]);

  const openLink = (id: string) => {
    void markNotificationRead(id).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["talent360-notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["talent360-notifications-unread"] });
    });
  };

  const markAll = () => {
    void markAllNotificationsRead().then(() => {
      void queryClient.invalidateQueries({ queryKey: ["talent360-notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["talent360-notifications-unread"] });
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={`Notifications, ${unread} unread`}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[12px] font-bold text-foreground">Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAll}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />

        <div className="talent-scroll max-h-[320px] overflow-y-auto">
          {visible.length ? (
            visible.map((notification) => (
              <Link
                key={notification.id}
                to={notification.link ?? "/app/notifications"}
                onClick={() => openLink(notification.id)}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/60",
                  !notification.read_at && "bg-primary-soft/30",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    TYPE_TONE[notification.type] ?? TYPE_TONE.info,
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-foreground">
                    {notification.title}
                  </span>
                  {notification.body ? (
                    <span className="mt-0.5 line-clamp-2 block text-[11px] font-medium leading-snug text-muted-foreground">
                      {notification.body}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                    {formatRelative(notification.created_at)}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Inbox className="h-5 w-5 text-muted-foreground" />
              <p className="text-[12px] font-semibold text-muted-foreground">You're all caught up</p>
            </div>
          )}
        </div>

        <DropdownMenuSeparator />
        <Link
          to="/app/notifications"
          onClick={() => setOpen(false)}
          className="block px-3 py-2 text-center text-[11.5px] font-bold text-primary hover:bg-muted/60"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
