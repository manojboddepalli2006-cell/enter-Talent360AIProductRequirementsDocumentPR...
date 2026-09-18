import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { TrendPoint } from "@/lib/api/command-center";
import { AXIS_TICK, TOOLTIP_STYLE } from "@/components/dashboard/chart-theme";
import { cn } from "@/lib/utils";

interface SparklineChartProps {
  data: TrendPoint[];
  /** Gradient start colour; defaults to the accent series. */
  color?: string;
  height?: number;
  className?: string;
  id: string;
  /** Renders a sparse time axis so trends are readable without tooltips. */
  showAxis?: boolean;
}

/** Compact single-series area used at the foot of a card. */
export function SparklineChart({
  data,
  color = "hsl(var(--chart-3))",
  height = 92,
  className,
  id,
  showAxis = false,
}: SparklineChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-[92px] items-center justify-center text-[12px] font-semibold text-muted-foreground">
        No trend data yet
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
        <AreaChart data={data} margin={{ top: 6, right: showAxis ? 10 : 0, left: showAxis ? 10 : 0, bottom: showAxis ? 4 : 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showAxis ? (
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ ...AXIS_TICK, fontSize: 9.5 }}
              interval={Math.max(1, Math.floor(data.length / 4))}
            />
          ) : null}
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={false} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#spark-${id})`}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
