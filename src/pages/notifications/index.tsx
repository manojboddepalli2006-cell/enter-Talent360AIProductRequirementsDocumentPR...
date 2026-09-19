import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { PageHeader } from "@/components/common/page-header";
import { KpiTile } from "@/components/common/kpi-tile";
import { FilterTabs } from "@/components/common/filter-tabs";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread";

const TYPE_LABEL: Record<string, string> = {
  pending_review: "Needs review",
  verdict: "Verdict",
  task: "Task",
  info: "Update",
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const query = useQuery({ queryKey: ["talent360-notifications"], queryFn: listNotifications });
  const notifications = useMemo(() => query.data ?? [], [query.data]);

  const counts = useMemo(
    () => ({
      all: notifications.length,
      unread: notifications.filter((notification) => !notification.read_at).length,
    }),
    [notifications],
  );

  const visible = useMemo(
    () =>
      notifications.filter((notification) => (filter === "unread" ? !notification.read_at : true)),
    [notifications, filter],
  );

  const open = async (id: string, link: string | null) => {
    if (!notifications.find((notification) => notification.id === id)?.read_at) {
      await markNotificationRead(id);
      await queryClient.invalidateQueries({ queryKey: ["talent360-notifications"] });
    }
    if (link) navigate(link);
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    await queryClient.invalidateQueries({ queryKey: ["talent360-notifications"] });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notifications"
        description="What the AI and your team surfaced for you — new reviews to action, verdicts ready, and assigned tasks."
        statusLabel={`${counts.unread} unread`}
        actions={
          counts.unread > 0 ? (
            <Button size="sm" variant="outline" onClick={() => void markAll()}>
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiTile label="All notifications" value={String(counts.all)} icon={Bell} tone="primary" />
        <KpiTile
          label="Unread"
          value={String(counts.unread)}
          icon={Bell}
          tone={counts.unread ? "warning" : "success"}
          footnote={counts.unread ? "Action needed" : "All caught up"}
        />
      </div>

      <div className="talent-tile px-4 pb-1 pt-3 shadow-card">
        <FilterTabs
          items={[
            { key: "all", label: "All", count: counts.all },
            { key: "unread", label: "Unread", count: counts.unread },
          ]}
          value={filter}
          onChange={(key) => setFilter(key as Filter)}
        />
      </div>

      {query.isLoading ? <LoadingState label="Reading notifications" /> : null}

      {query.error ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Notifications could not be loaded."}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isLoading && !query.error && !visible.length ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Nothing here"
          description="Notifications appear when a verdict is ready, a review needs your decision, or a task is assigned to you."
        />
      ) : null}

      {!query.isLoading && !query.error && visible.length ? (
        <div className="flex flex-col gap-2">
          {visible.map((notification) => {
            const unread = !notification.read_at;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => void open(notification.id, notification.link)}
                className={cn(
                  "talent-tile talent-tile-hover flex items-start gap-3 p-4 text-left",
                  unread && "border-primary/25",
                )}
              >
                <span
                  className={cn(
                    "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                    notification.type === "pending_review"
                      ? "bg-warning-soft text-warning-soft-foreground"
                      : notification.type === "verdict"
                        ? "bg-primary-soft text-primary-soft-foreground"
                        : "bg-info-soft text-info-soft-foreground",
                  )}
                >
                  <Bell className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-bold text-foreground">{notification.title}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {TYPE_LABEL[notification.type] ?? "Update"}
                    </span>
                  </span>
                  {notification.body ? (
                    <span className="mt-1 block text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                      {notification.body}
                    </span>
                  ) : null}
                  <span className="mt-1 block text-[10.5px] font-medium text-muted-foreground">
                    {formatRelative(notification.created_at)}
                    {unread ? " · unread" : ""}
                  </span>
                </span>
                {unread ? (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
