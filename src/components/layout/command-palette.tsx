import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, FileText, GraduationCap, Moon, Sun, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResults {
  employees: Array<{ id: string; full_name: string; role_title: string }>;
  candidates: Array<{ id: string; full_name: string; email: string | null }>;
  skills: Array<{ id: string; name: string; category: string }>;
  policies: Array<{ id: string; title: string }>;
}

const EMPTY: SearchResults = { employees: [], candidates: [], skills: [], policies: [] };

/**
 * Universal search. Results are filtered by role automatically because every
 * lookup runs through row level security: an employee only matches their own
 * record, a manager only their reports, HR the whole workforce.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const [term, setTerm] = useState("");
  const debounced = useDebouncedValue(term.trim(), 250);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const searchQuery = useQuery({
    queryKey: ["talent360-search", debounced],
    enabled: open && debounced.length >= 2,
    staleTime: 20_000,
    queryFn: async (): Promise<SearchResults> => {
      const pattern = `%${debounced}%`;
      const [employees, candidates, skills, policies] = await Promise.all([
        supabase.from("talent_employees").select("id, full_name, role_title").ilike("full_name", pattern).limit(5),
        supabase.from("talent_candidates").select("id, full_name, email").ilike("full_name", pattern).limit(5),
        supabase.from("talent_skills").select("id, name, category").ilike("name", pattern).limit(5),
        supabase.from("talent_policy_documents").select("id, title").ilike("title", pattern).limit(5),
      ]);

      return {
        employees: employees.data ?? [],
        candidates: candidates.data ?? [],
        skills: skills.data ?? [],
        policies: policies.data ?? [],
      };
    },
  });

  const results = searchQuery.data ?? EMPTY;
  const hasResults =
    results.employees.length + results.candidates.length + results.skills.length + results.policies.length > 0;

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const navGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        key: group.key,
        label: group.label,
        items: group.items.filter((item) => canSeeItem(item, can)),
      })).filter((group) => group.items.length),
    [can],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={term}
        onValueChange={setTerm}
        placeholder="Search employees, candidates, skills, policies, or jump to a module…"
      />
      <CommandList>
        <CommandEmpty>
          {debounced.length >= 2 && searchQuery.isFetching ? "Searching…" : "Nothing matches that."}
        </CommandEmpty>

        {hasResults ? (
          <>
            {results.employees.length ? (
              <CommandGroup heading="Employees">
                {results.employees.map((employee) => (
                  <CommandItem
                    key={employee.id}
                    value={`employee ${employee.full_name}`}
                    onSelect={() => go(`/app/employees/${employee.id}`)}
                  >
                    <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{employee.full_name}</span>
                    <span className="ml-2 truncate text-[11px] text-muted-foreground">{employee.role_title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.candidates.length ? (
              <CommandGroup heading="Candidates">
                {results.candidates.map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={`candidate ${candidate.full_name}`}
                    onSelect={() => go("/app/recruitment")}
                  >
                    <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{candidate.full_name}</span>
                    <span className="ml-2 truncate text-[11px] text-muted-foreground">{candidate.email}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.skills.length ? (
              <CommandGroup heading="Skills">
                {results.skills.map((skill) => (
                  <CommandItem
                    key={skill.id}
                    value={`skill ${skill.name}`}
                    onSelect={() => go("/app/skills")}
                  >
                    <GraduationCap className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{skill.name}</span>
                    <span className="ml-2 truncate text-[11px] text-muted-foreground">{skill.category}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {results.policies.length ? (
              <CommandGroup heading="Policies">
                {results.policies.map((policy) => (
                  <CommandItem
                    key={policy.id}
                    value={`policy ${policy.title}`}
                    onSelect={() => go("/app/policies")}
                  >
                    <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{policy.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </>
        ) : null}

        {navGroups.map((group) => (
          <CommandGroup key={group.key} heading={group.label}>
            {group.items.map((item) => (
              <CommandItem key={item.key} value={`${group.label} ${item.label}`} onSelect={() => go(item.to)}>
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

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
