import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { TOOLTIP_STYLE } from "@/components/dashboard/chart-theme";
import { cn } from "@/lib/utils";

export interface RadarDatum {
  label: string;
  proficiency: number;
  target: number;
}

interface SkillRadarProps {
  data: RadarDatum[];
  height?: number;
  className?: string;
}

/** Skills-versus-target radar. Two series always share the same 0–100 scale. */
export function SkillRadar({ data, height = 260, className }: SkillRadarProps) {
  if (data.length < 3) {
    return (
      <div className="flex h-[240px] items-center justify-center px-6 text-center text-[12.5px] font-semibold text-muted-foreground">
        A radar needs at least three evaluated skills. This profile has {data.length}.
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fontSize: 10.5, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Radar
            name="Target"
            dataKey="target"
            stroke="hsl(var(--chart-4))"
            fill="hsl(var(--chart-4))"
            fillOpacity={0.12}
            strokeWidth={2}
          />
          <Radar
            name="Assessed"
            dataKey="proficiency"
            stroke="hsl(var(--chart-1))"
            fill="hsl(var(--chart-1))"
            fillOpacity={0.28}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
