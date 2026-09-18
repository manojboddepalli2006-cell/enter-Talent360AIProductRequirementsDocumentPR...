import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface RadialDialProps {
  percent: number;
  caption: string;
  subcaption?: string;
  className?: string;
}

/** Segmented radial progress dial used for evaluation and verification rates. */
export function RadialDial({ percent, caption, subcaption, className }: RadialDialProps) {
  const safePercent = Math.max(0, Math.min(100, percent));

  // Twelve ticks around the ring, with the completed share filled in.
  const segments = Array.from({ length: 12 }).map((_, index) => ({
    name: `segment-${index}`,
    value: 1,
    filled: index < Math.round((safePercent / 100) * 12),
  }));

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative h-[170px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              innerRadius="68%"
              outerRadius="96%"
              paddingAngle={3}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {segments.map((segment) => (
                <Cell
                  key={segment.name}
                  fill={segment.filled ? "hsl(var(--chart-1))" : "hsl(var(--muted))"}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-extrabold leading-none tracking-tight text-foreground">
            {Math.round(safePercent)}%
          </span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {caption}
          </span>
          {subcaption ? (
            <span className="mt-0.5 text-[10.5px] font-semibold text-muted-foreground">{subcaption}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
