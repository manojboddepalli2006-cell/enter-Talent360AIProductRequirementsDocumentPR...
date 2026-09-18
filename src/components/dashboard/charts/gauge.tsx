import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface GaugeChartProps {
  percent: number;
  caption: string;
  /** Muted remainder is drawn as a second arc behind the value. */
  remainderLabel?: string;
  className?: string;
}

/** Semi-circular meter, mirroring the "Account Status" gauge in the reference grid. */
export function GaugeChart({ percent, caption, remainderLabel, className }: GaugeChartProps) {
  const safePercent = Math.max(0, Math.min(100, percent));
  const data = [
    { name: caption, value: safePercent },
    { name: remainderLabel ?? "Remaining", value: 100 - safePercent },
  ];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="82%"
              innerRadius="72%"
              outerRadius="100%"
              stroke="none"
            >
              <Cell fill="hsl(var(--chart-5))" />
              <Cell fill="hsl(var(--muted))" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
          <span className="text-[24px] font-extrabold leading-none tracking-tight text-foreground">
            {Math.round(safePercent)}%
          </span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {caption}
          </span>
        </div>
      </div>
    </div>
  );
}
