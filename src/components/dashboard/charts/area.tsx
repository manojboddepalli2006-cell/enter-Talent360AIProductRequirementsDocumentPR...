import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/api/command-center";
import { AXIS_TICK, TOOLTIP_STYLE } from "@/components/dashboard/chart-theme";
import { cn } from "@/lib/utils";

interface AreaTrendProps {
  data: TrendPoint[];
  color?: string;
  height?: number;
  id: string;
  axisLabel?: string;
  className?: string;
}

/** Axis-bearing area trend, used for the workforce risk series. */
export function AreaTrend({
  data,
  color = "hsl(var(--chart-3))",
  height = 200,
  id,
  axisLabel,
  className,
}: AreaTrendProps) {
  if (!data.length) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[12.5px] font-semibold text-muted-foreground">
        No trend data yet
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={44} tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
          <Area
            type="monotone"
            dataKey="value"
            name={axisLabel ?? "Value"}
            stroke={color}
            strokeWidth={2}
            fill={`url(#area-${id})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
