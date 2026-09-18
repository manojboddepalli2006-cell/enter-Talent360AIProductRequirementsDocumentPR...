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

/** Split auth surface: brand panel on the left, glass form card on the right. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-full w-full overflow-hidden bg-background">
      {/* Floating gradient orbs */}
      <span
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 animate-float-slow rounded-full blur-3xl"
        style={{ background: "hsl(262 83% 58% / 0.18)" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 bottom-4 h-80 w-80 animate-float-slow rounded-full blur-3xl"
        style={{ background: "hsl(330 81% 60% / 0.16)", animationDelay: "2s" }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-1/2 h-64 w-64 animate-float-slow rounded-full blur-3xl"
        style={{ background: "hsl(217 91% 60% / 0.1)", animationDelay: "4s" }}
      />

      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 15% 0%, hsl(var(--primary) / 0.4), transparent 70%), radial-gradient(50% 45% at 90% 100%, hsl(var(--accent) / 0.32), transparent 70%)",
          }}
          aria-hidden
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ backgroundImage: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.6), transparent)" }}
        />

        <div className="relative flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-brand text-[14px] font-extrabold text-primary-foreground shadow-glow">
            <span aria-hidden className="absolute inset-0 bg-gradient-brand bg-[length:200%_200%] animate-gradient-shift" />
            <span className="relative">T3</span>
          </span>
          <div>
            <div className="text-[16px] font-extrabold text-sidebar-accent-foreground">Talent360 AI</div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground">
              Workforce Intelligence
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-[31px] font-extrabold leading-tight text-sidebar-accent-foreground">
            One intelligence layer across the whole{" "}
            <span className="bg-gradient-brand bg-clip-text text-transparent">employee lifecycle.</span>
          </h2>
          <p className="mt-3 max-w-md text-[13.5px] font-medium leading-relaxed text-sidebar-foreground">
            Recruit, interview, onboard, develop, monitor and retain — on data you already have, with a
            human approving every consequential decision.
          </p>

          <ul className="mt-8 flex flex-col gap-4">
            {PILLARS.map((pillar) => (
              <li key={pillar.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-elevated text-sidebar-accent-foreground ring-1 ring-inset ring-white/5">
                  <pillar.icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-[13px] font-bold text-sidebar-accent-foreground">{pillar.title}</div>
                  <div className="text-[12px] font-medium leading-relaxed text-sidebar-foreground">
                    {pillar.body}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[11.5px] font-semibold text-sidebar-foreground">
          <BadgeCheck className="h-4 w-4 text-success" />
          Every AI output is logged, reviewed and attributable.
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-brand text-[13px] font-extrabold text-primary-foreground shadow-glow">
              <span aria-hidden className="absolute inset-0 bg-gradient-brand bg-[length:200%_200%] animate-gradient-shift" />
              <span className="relative">T3</span>
            </span>
            <span className="text-[15px] font-extrabold text-foreground">Talent360 AI</span>
          </div>

          <div className="talent-glass rounded-2xl border border-border p-6 shadow-panel sm:p-8">
            <h1 className="text-[23px] font-extrabold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
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
