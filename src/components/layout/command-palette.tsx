import { Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { NAV_GROUPS, canSeeItem } from "@/components/layout/nav-config";
import { usePermissions } from "@/hooks/use-permissions";
import { useTheme } from "@/hooks/use-theme";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { theme, toggleTheme } = useTheme();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search modules and actions…" />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => canSeeItem(item, can));
          if (!items.length) return null;

          return (
            <CommandGroup key={group.key} heading={group.label}>
              {items.map((item) => (
                <CommandItem key={item.key} value={`${group.label} ${item.label}`} onSelect={() => go(item.to)}>
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        <CommandGroup heading="Actions">
          <CommandItem value="toggle theme appearance" onSelect={() => toggleTheme()}>
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
            ) : (
              <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
            )}
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
