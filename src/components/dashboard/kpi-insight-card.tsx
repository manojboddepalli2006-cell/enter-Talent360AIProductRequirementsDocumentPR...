import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimatedNumber } from "@/hooks/use-animated-number";
import type { TrendPoint } from "@/lib/api/command-center";
import { SparklineChart } from "@/components/dashboard/charts/sparkline";

export type DeltaDirection = "up" | "down";

interface KpiInsightCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  delta?: { direction: DeltaDirection; value: string; invert?: boolean };
  trend: TrendPoint[];
  insight: string;
  tone?: "primary" | "info" | "accent" | "warning" | "danger" | "success";
  id: string;
  className?: string;
}

const TONE_ICON: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  info: "bg-info/15 text-info",
  accent: "bg-accent/15 text-accent",
  warning: "bg-warning/15 text-warning",
  danger: "bg-destructive/15 text-destructive",
  success: "bg-success/15 text-success",
};

const TREND_COLOR: Record<string, string> = {
  primary: "hsl(var(--chart-1))",
  info: "hsl(var(--chart-2))",
  accent: "hsl(var(--chart-3))",
  warning: "hsl(var(--chart-4))",
  danger: "hsl(var(--destructive))",
  success: "hsl(var(--chart-5))",
};
export function KpiInsightCard({
  label,
  value,
  icon: Icon,
  delta,
  trend,
  insight,
  tone = "primary",
  id,
  className,
}: KpiInsightCardProps) {
  const animated = useAnimatedNumber(value);

  const isGood =
    delta === undefined
      ? false
      : delta.invert
        ? delta.direction === "down"
        : delta.direction === "up";

  const deltaTone = isGood ? "text-success" : "text-destructive";

  return (
    <div className={cn("talent-tile talent-tile-hover flex flex-col gap-3 p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", TONE_ICON[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        {delta ? (
          <span className={cn("flex items-center gap-1 text-[11.5px] font-bold", deltaTone)}>
            {delta.direction === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {delta.value}
          </span>
        ) : null}
      </div>

      <div>
        <div className="text-[24px] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
          {animated}
        </div>
        <div className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </div>
      </div>

      <div className="h-9 w-full">
        <SparklineChart id={id} data={trend} color={TREND_COLOR[tone]} height={36} />
      </div>

      <p className="flex items-start gap-1.5 text-[10.5px] font-medium leading-snug text-muted-foreground">
        <span className="talent-ai-text mt-0.5 text-[9px] font-extrabold">AI</span>
        {insight}
      </p>
    </div>
  );
}
