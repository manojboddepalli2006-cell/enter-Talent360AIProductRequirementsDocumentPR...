import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_ICON, type Tone } from "@/lib/domain";
import { StatusPill } from "@/components/common/status-pill";

export type DeltaDirection = "up" | "down" | "flat";

interface KpiTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: Tone;
  delta?: {
    direction: DeltaDirection;
    value: string;
    /** Some metrics read better when a rise is bad, e.g. attrition risk. */
    invert?: boolean;
  };
  footnote?: string;
  className?: string;
}

const DIRECTION_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

export function KpiTile({
  label,
  value,
  icon: Icon,
  tone = "primary",
  delta,
  footnote,
  className,
}: KpiTileProps) {
  const DeltaIcon = delta ? DIRECTION_ICON[delta.direction] : null;

  // "Good" depends on the metric: a falling attrition count is good, a falling
  // headcount is not. `invert` lets the caller declare which way is good.
  const isGood =
    delta === undefined
      ? false
      : delta.direction === "flat"
        ? false
        : delta.invert
          ? delta.direction === "down"
          : delta.direction === "up";

  const deltaTone: Tone = delta?.direction === "flat" ? "neutral" : isGood ? "success" : "danger";

  return (
    <div className={cn("talent-tile p-4 shadow-card", className)}>
      <div className="flex items-start gap-2.5">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE_ICON[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[12px] font-semibold leading-tight text-muted-foreground">{label}</span>
      </div>

      <div className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-foreground">
        {value}
      </div>

      <div className="mt-3 flex items-center gap-2">
        {delta && DeltaIcon ? (
          <StatusPill tone={deltaTone} icon={<DeltaIcon className="h-3 w-3" />}>
            {delta.value}
          </StatusPill>
        ) : null}
        {footnote ? (
          <span className="truncate text-[11px] font-medium text-muted-foreground">{footnote}</span>
        ) : null}
      </div>
    </div>
  );
}
