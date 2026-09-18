import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/format";

interface UserCellProps {
  name: string | null | undefined;
  subtext?: string | null;
  tone?: "primary" | "accent" | "info" | "success" | "warning";
  trailing?: ReactNode;
  className?: string;
}

const AVATAR_TONE: Record<string, string> = {
  primary: "bg-primary-soft text-primary-soft-foreground",
  accent: "bg-accent-soft text-accent-soft-foreground",
  info: "bg-info-soft text-info-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
};

/** Deterministic tint so the same person keeps the same avatar colour. */
function pickTone(name: string): keyof typeof AVATAR_TONE {
  const options = Object.keys(AVATAR_TONE);
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 9973;
  }
  return options[hash % options.length] as keyof typeof AVATAR_TONE;
}

export function UserCell({ name, subtext, tone, trailing, className }: UserCellProps) {
  const label = name?.trim() || "Unnamed";
  const resolvedTone = tone ?? pickTone(label);

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          AVATAR_TONE[resolvedTone],
        )}
      >
        {initialsOf(label)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold text-foreground">{label}</div>
        {subtext ? (
          <div className="truncate text-[11px] font-medium text-muted-foreground">{subtext}</div>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}
