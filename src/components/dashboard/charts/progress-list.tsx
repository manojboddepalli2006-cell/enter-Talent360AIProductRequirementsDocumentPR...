import type { Slice } from "@/lib/api/command-center";
import { cn } from "@/lib/utils";

interface ProgressListProps {
  data: Slice[];
  /** Value shown at the end of each row; defaults to the raw count. */
  suffix?: string;
  className?: string;
}

const BAR_TONE = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

/** Horizontal ranked progress bars, matching the "Districts" card in the reference. */
export function ProgressList({ data, suffix, className }: ProgressListProps) {
  if (!data.length) {
    return (
      <div className="flex h-[180px] items-center justify-center text-[12.5px] font-semibold text-muted-foreground">
        No data in this workspace yet
      </div>
    );
  }

  const max = Math.max(...data.map((entry) => entry.value), 1);

  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {data.slice(0, 6).map((entry, index) => {
        const percent = Math.max(4, Math.round((entry.value / max) * 100));
        return (
          <li key={entry.name} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-foreground">{entry.name}</span>
              <span className="shrink-0 text-[11.5px] font-bold text-muted-foreground">
                {entry.value}
                {suffix ? ` ${suffix}` : ""}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", BAR_TONE[index % BAR_TONE.length])}
                style={{ width: `${percent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
