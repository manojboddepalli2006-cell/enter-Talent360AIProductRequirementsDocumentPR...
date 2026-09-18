/** Chart colour helpers. Series always resolve through chart tokens so both themes stay legible. */

export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

export const CHART_MUTED = "hsl(var(--muted-foreground))";

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/** Recharts tooltip styling that follows the design tokens rather than hardcoded hex. */
export const TOOLTIP_STYLE: React.CSSProperties = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.75rem",
  boxShadow: "0 10px 30px -12px hsl(var(--foreground) / 0.25)",
  fontSize: "12px",
  fontWeight: 600,
  color: "hsl(var(--popover-foreground))",
  padding: "8px 10px",
};

export const AXIS_TICK = {
  fontSize: 11,
  fontWeight: 600,
  fill: "hsl(var(--muted-foreground))",
} as const;
