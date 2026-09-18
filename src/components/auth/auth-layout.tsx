import type { ReactNode } from "react";
import { BadgeCheck, BrainCircuit, ShieldCheck, Sparkles } from "lucide-react";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

const PILLARS = [
  {
    icon: BrainCircuit,
    title: "Understand, analyse, reason",
    body: "Multi-source workforce signals are read together, not one dashboard at a time.",
  },
  {
    icon: Sparkles,
    title: "Explain, never just score",
    body: "Every recommendation carries the signals behind it, their direction and their weight.",
  },
  {
    icon: ShieldCheck,
    title: "A human decides",
    body: "No recommendation becomes a workflow task until someone approves it.",
  },
];

/**
 * Apple-style split auth surface.
 * Auto-layout notes: the two panels are percentage-width flex items (46% / 54%)
 * on regular widths and stack to a single intrinsic-height column on compact
 * widths — no pixel-perfect media queries, just flex wrapping.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-full w-full flex-col bg-background lg:flex-row">
      {/* Brand panel — macOS-style translucent sidebar material */}
      <div className="relative flex w-full flex-col justify-between gap-10 overflow-hidden border-b border-border bg-sidebar p-8 backdrop-blur-2xl lg:w-[46%] lg:border-b-0 lg:border-r lg:border-sidebar-border lg:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(70% 60% at 20% 0%, hsl(var(--primary) / 0.18), transparent 70%), radial-gradient(60% 55% at 95% 100%, hsl(var(--accent) / 0.12), transparent 70%)",
          }}
          aria-hidden
        />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary text-[14px] font-bold text-primary-foreground">
            T3
          </span>
          <div>
            <div className="text-[16px] font-bold text-sidebar-accent-foreground">Talent360 AI</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground">
              Workforce Intelligence
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-[30px] font-bold leading-[1.15] tracking-tight text-sidebar-accent-foreground">
            One intelligence layer across the whole employee lifecycle.
          </h2>
          <p className="mt-3 max-w-md text-[13.5px] font-medium leading-relaxed text-sidebar-foreground">
            Recruit, interview, onboard, develop, monitor and retain — on data you already have, with a
            human approving every consequential decision.
          </p>

          <ul className="mt-8 flex flex-col gap-4">
            {PILLARS.map((pillar) => (
              <li key={pillar.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sidebar-elevated text-sidebar-accent-foreground">
                  <pillar.icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[13px] font-semibold text-sidebar-accent-foreground">
                    {pillar.title}
                  </div>
                  <div className="text-[12px] font-medium leading-relaxed text-sidebar-foreground">
                    {pillar.body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[11.5px] font-medium text-sidebar-foreground">
          <BadgeCheck className="h-4 w-4 text-success" />
          Every AI output is logged, reviewed and attributable.
        </div>
      </div>

      {/* Form panel — material card on a hairline-separated canvas */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-[13px] font-bold text-primary-foreground">
              T3
            </span>
            <span className="text-[15px] font-bold text-foreground">Talent360 AI</span>
          </div>

          <div className="talent-glass rounded-3xl border border-border p-6 shadow-panel sm:p-8">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-muted-foreground">{subtitle}</p>

            <div className="mt-6">{children}</div>

            {footer ? (
              <div className="mt-6 text-center text-[12.5px] font-medium">{footer}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
