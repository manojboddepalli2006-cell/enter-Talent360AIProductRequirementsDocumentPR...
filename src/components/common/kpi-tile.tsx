import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_ICON, type Tone } from "@/lib/domain";
import { StatusPill } from "@/components/common/status-pill";
import { useAnimatedNumber } from "@/hooks/use-animated-number";

export type DeltaDirection = "up" | "down" | "flat";

interface KpiTileProps {
  label: string;
  value: string | number;
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
  const animatedValue = useAnimatedNumber(value);

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
    <div
      className={cn(
        "talent-tile talent-tile-hover group relative flex flex-col gap-3 overflow-hidden p-4",
        className,
      )}
    >
      {/* Soft gradient wash that appears on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{
          backgroundImage: `radial-gradient(circle, hsl(var(--primary) / 0.16), transparent 70%)`,
        }}
      />

      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/[0.03] transition-transform duration-200 group-hover:scale-105",
            TONE_ICON[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[12px] font-semibold leading-tight text-muted-foreground">{label}</span>
      </div>

      <div className="text-[27px] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
        {animatedValue}
      </div>

      <div className="flex items-center gap-2">
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
