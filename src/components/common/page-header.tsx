import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  /** Small muted status label shown next to the action buttons. */
  statusLabel?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, statusLabel, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-foreground max-md:text-[19px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] font-medium text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {statusLabel ? (
          <span className="text-[12px] font-semibold text-muted-foreground">{statusLabel}</span>
        ) : null}
        {actions}
      </div>
    </header>
  );
}
