import type { ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = "Loading", className }: LoadingStateProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2 py-10 text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-[13px] font-medium">{label}…</span>
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("talent-tile h-32 animate-pulse bg-muted/60", className)} />;
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
          className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
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
        "talent-tile flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
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
