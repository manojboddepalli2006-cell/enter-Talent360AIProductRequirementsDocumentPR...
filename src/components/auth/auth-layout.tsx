import type { ReactNode } from "react";
import { TalentLogo } from "@/components/brand/talent-logo";
import { OrbitalBackground } from "@/components/brand/orbital-background";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

const PILLARS = ["Recruit.", "Develop.", "Understand.", "Act."];

/**
 * Premium dark login surface: the brand mark with its orbital network on the
 * left, the credential card on the right, and the AI engine status beneath.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-full w-full flex-col overflow-hidden bg-background lg:flex-row">
      <OrbitalBackground />

      {/* Brand panel */}
      <div className="relative flex w-full flex-col justify-between gap-10 border-b border-border p-8 lg:w-1/2 lg:border-b-0 lg:border-r lg:p-12">
        <TalentLogo size={44} withWordmark />

        <div>
          <h2 className="max-w-lg text-[34px] font-extrabold leading-[1.15] tracking-tight text-foreground">
            Intelligence for Every Stage of the{" "}
            <span className="talent-ai-text">Employee Journey.</span>
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {PILLARS.map((pillar) => (
              <span
                key={pillar}
                className="rounded-full border border-border bg-card/60 px-3 py-1 text-[12px] font-bold text-muted-foreground"
              >
                {pillar}
              </span>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-card/60 shadow-glow">
              <TalentLogo size={38} />
            </span>
            <p className="max-w-xs text-[12.5px] font-medium leading-relaxed text-muted-foreground">
              AI generates insight. A person reviews it. Enter Pro executes the approved workflow. Talent360
              measures the outcome.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11.5px] font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          <span className="text-muted-foreground">AI Engine — Operational</span>
        </div>
      </div>

      {/* Credential card */}
      <div className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="talent-tile p-6 shadow-panel sm:p-8">
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-muted-foreground">{subtitle}</p>
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-6 text-center text-[12.5px] font-medium">{footer}</div> : null}
          </div>

          <p className="mt-4 text-center text-[11px] font-medium text-muted-foreground">
            The future of workforce intelligence — human-centered, AI-powered, explainable, and actionable.
          </p>
        </div>
      </div>
    </div>
  );
}
