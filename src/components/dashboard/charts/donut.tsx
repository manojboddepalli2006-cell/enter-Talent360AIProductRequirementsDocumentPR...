import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Slice } from "@/lib/api/command-center";
import { chartColor, TOOLTIP_STYLE } from "@/components/dashboard/chart-theme";
import { cn } from "@/lib/utils";

interface DonutChartProps {
  data: Slice[];
  /** Large figure rendered in the middle of the ring. */
  centerValue: string;
  centerLabel: string;
  height?: number;
  className?: string;
}

const LEGEND_DOT = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

export function DonutChart({ data, centerValue, centerLabel, height = 200, className }: DonutChartProps) {
  const usable = data.filter((entry) => entry.value > 0);

  if (!usable.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[12.5px] font-semibold text-muted-foreground">
        No data in this workspace yet
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={usable}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke="none"
            >
              {usable.map((entry, index) => (
                <Cell key={entry.name} fill={chartColor(index)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-extrabold leading-none tracking-tight text-foreground">
            {centerValue}
          </span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {centerLabel}
          </span>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        {usable.map((entry, index) => {
          const total = usable.reduce((sum, item) => sum + item.value, 0);
          const percent = total ? ((entry.value / total) * 100).toFixed(1) : "0.0";
          return (
            <li key={entry.name} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", LEGEND_DOT[index % LEGEND_DOT.length])} />
              <span className="text-[11px] font-semibold text-muted-foreground">
                {entry.name} {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
