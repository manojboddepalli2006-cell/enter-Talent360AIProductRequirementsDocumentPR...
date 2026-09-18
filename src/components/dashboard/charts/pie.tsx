import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Slice } from "@/lib/api/command-center";
import { chartColor, TOOLTIP_STYLE } from "@/components/dashboard/chart-theme";
import { cn } from "@/lib/utils";

interface CategoryPieProps {
  data: Slice[];
  height?: number;
  /** Renders the percentage callouts used beside the ring, as in the reference. */
  showCallouts?: boolean;
  className?: string;
}

const LEGEND_DOT = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

export function CategoryPie({ data, height = 180, showCallouts = true, className }: CategoryPieProps) {
  const usable = data.filter((entry) => entry.value > 0);
  const total = usable.reduce((sum, entry) => sum + entry.value, 0);

  if (!usable.length || total === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center text-[12.5px] font-semibold text-muted-foreground">
        No data in this workspace yet
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
          <PieChart>
            <Pie data={usable} dataKey="value" nameKey="name" outerRadius="92%" stroke="none">
              {usable.map((entry, index) => (
                <Cell key={entry.name} fill={chartColor(index)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 flex w-full flex-col gap-1.5">
        {usable.map((entry, index) => {
          const percent = Math.round((entry.value / total) * 100);
          return (
            <li key={entry.name} className="flex items-center gap-2">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", LEGEND_DOT[index % LEGEND_DOT.length])} />
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-muted-foreground">
                {entry.name}
              </span>
              <span className="text-[11.5px] font-bold text-foreground">
                {showCallouts ? `${percent}%` : entry.value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
