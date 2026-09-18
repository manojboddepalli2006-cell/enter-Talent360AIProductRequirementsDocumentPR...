import { cn } from "@/lib/utils";

export interface FilterTabItem {
  key: string;
  label: string;
  count?: number;
}

interface FilterTabsProps {
  items: FilterTabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

/** Underlined tab row sitting above a data table, as in the reference shell. */
export function FilterTabs({ items, value, onChange, className }: FilterTabsProps) {
  return (
    <div className={cn("talent-scroll flex items-center gap-1 overflow-x-auto", className)} role="tablist">
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "relative shrink-0 whitespace-nowrap px-3 pb-2.5 pt-2 text-[13px] font-semibold transition-all duration-200",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold transition-colors",
                  active ? "bg-primary-soft text-primary-soft-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {item.count}
              </span>
            ) : null}
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
