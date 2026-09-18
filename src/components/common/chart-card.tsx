import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ChartCardAction {
  label: string;
  onSelect: () => void;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: ChartCardAction[];
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Disables the hover lift for cards that are interactive themselves. */
  noHover?: boolean;
}

/** White analytical card: title, muted subtitle, overflow menu, chart body. */
export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  noHover,
}: ChartCardProps) {
  return (
    <section
      className={cn(
        "talent-tile talent-tile-hover flex flex-col p-5",
        noHover && "hover:translate-y-0 hover:shadow-card hover:border-border",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-extrabold text-foreground">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        {actions?.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${title} options`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.map((action) => (
                <DropdownMenuItem key={action.label} onSelect={action.onSelect}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <div className={cn("mt-4 min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
