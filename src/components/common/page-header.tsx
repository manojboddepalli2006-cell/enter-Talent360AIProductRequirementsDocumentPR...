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
        <div className="flex items-center gap-2.5">
          <h1 className="text-[23px] font-extrabold leading-tight tracking-tight text-foreground max-md:text-[20px]">
            {title}
          </h1>
          {statusLabel ? (
            <span className="hidden rounded-full bg-muted px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground sm:inline-block">
              {statusLabel}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] font-medium leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </header>
  );
}
