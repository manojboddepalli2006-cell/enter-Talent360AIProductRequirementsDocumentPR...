import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, chartColor, TOOLTIP_STYLE } from "@/components/dashboard/chart-theme";
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarSeriesProps {
  data: BarDatum[];
  height?: number;
  /** Index of the bar to highlight in the success colour, as the reference does. */
  highlightIndex?: number;
  className?: string;
}

export function BarSeries({ data, height = 190, highlightIndex, className }: BarSeriesProps) {
  if (!data.length) {
    return (
      <div className="flex h-[190px] items-center justify-center text-[12.5px] font-semibold text-muted-foreground">
        No data in this workspace yet
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={36} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(var(--muted))", radius: 8 }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={entry.label}
                fill={index === highlightIndex ? "hsl(var(--chart-5))" : chartColor(0)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
