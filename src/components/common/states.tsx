import type { ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

/** Shimmering skeleton block used while a surface streams its data in. */
export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "talent-tile animate-pulse overflow-hidden rounded-2xl bg-muted/50",
        className,
      )}
    />
  );
}

export function LoadingState({ label = "Loading", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)} role="status" aria-label={label}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonBlock key={`kpi-${index}`} className="h-[118px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonBlock key={`card-${index}`} className="h-[280px]" />
        ))}
      </div>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title = "Something went wrong", message, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("talent-tile flex flex-col items-start gap-2 p-5", className)}>
      <div className="flex items-center gap-2 text-destructive">
        <TriangleAlert className="h-4 w-4" />
        <span className="text-[14px] font-bold">{title}</span>
      </div>
      <p className="text-[13px] font-medium text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 rounded-xl bg-primary px-3.5 py-1.5 text-[12px] font-bold text-primary-foreground transition-transform active:scale-[0.97]"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "talent-tile flex flex-col items-center justify-center gap-2.5 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-inset ring-border">
          {icon}
        </span>
      ) : null}
      <h3 className="text-[14px] font-bold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-md text-[12.5px] font-medium leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
