import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_CHIP, type Tone } from "@/lib/domain";

interface StatusPillProps {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Soft-tinted pill used for statuses, roles and categories.
 * Uses semantic token pairs so foreground and background always move together
 * between light and dark mode.
 */
export function StatusPill({ tone = "neutral", icon, children, className }: StatusPillProps) {
  return (
    <span className={cn("talent-chip", TONE_CHIP[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
