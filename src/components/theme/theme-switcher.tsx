import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { ThemePreference } from "@/components/theme/theme-context";

const OPTIONS: Array<{ key: ThemePreference; label: string; icon: typeof Moon }> = [
  { key: "dark", label: "Dark", icon: Moon },
  { key: "light", label: "Light", icon: Sun },
  { key: "system", label: "System", icon: Monitor },
];

/**
 * Three theme choices for the user menu (☾ Dark / ☀ Light / ◐ System).
 * Rendered as dropdown items so the switcher lives in the top-right account menu.
 */
export function ThemeMenuItems() {
  const { preference, setPreference } = useTheme();

  return (
    <>
      {OPTIONS.map((option) => (
        <DropdownMenuItem
          key={option.key}
          onSelect={(event) => {
            event.preventDefault();
            setPreference(option.key);
          }}
          className="flex items-center gap-2"
        >
          <option.icon className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">{option.label} theme</span>
          {preference === option.key ? (
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-primary">Active</span>
          ) : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}

/** Compact ☾ / ☀ toggle. The accessible label states where it will take you. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={resolved === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/** Segmented three-way control, used on the login screen and in settings. */
export function ThemeSegmented({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("flex items-center gap-1 rounded-xl border border-border bg-card/40 p-1", className)}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={preference === option.key}
          onClick={() => setPreference(option.key)}
          title={`${option.label} theme`}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors",
            preference === option.key
              ? "bg-gradient-ai text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <option.icon className="h-3.5 w-3.5" />
          {!compact ? option.label : null}
        </button>
      ))}
    </div>
  );
}
