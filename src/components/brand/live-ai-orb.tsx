import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export type AiEngineState =
  | "operational"
  | "processing"
  | "recommendation"
  | "workflow"
  | "degraded"
  | "offline";

const STATE_META: Record<AiEngineState, { label: string; color: string; spin: number }> = {
  operational: { label: "Operational", color: "hsl(var(--success))", spin: 60 },
  processing: { label: "Processing", color: "hsl(var(--primary))", spin: 18 },
  recommendation: { label: "Recommendation ready", color: "hsl(var(--info))", spin: 30 },
  workflow: { label: "Workflow running", color: "hsl(var(--accent))", spin: 12 },
  degraded: { label: "Degraded", color: "hsl(var(--warning))", spin: 90 },
  offline: { label: "AI Engine Offline", color: "hsl(var(--muted-foreground))", spin: 0 },
};

/**
 * The Talent360 AI live intelligence symbol.
 *
 * A lightweight SVG orbital: a human/AI core, a 360° orbit, connected nodes and
 * drifting data particles. Animation speed reflects the engine state, and the
 * whole thing becomes static (and declares itself offline) when the platform is
 * unavailable. Purely decorative — it is aria-hidden and never blocks pointer
 * events, and it respects prefers-reduced-motion.
 */
export function LiveAiOrb({
  state = "operational",
  size = 260,
  className,
  intensity = 1,
}: {
  state?: AiEngineState;
  size?: number;
  className?: string;
  /** 0.4–1.2 — how visible the orb is in the composition. */
  intensity?: number;
}) {
  const reduced = useReducedMotion();
  const meta = STATE_META[state];
  const animate = !reduced && state !== "offline";
  const spinDuration = animate ? meta.spin : 0;

  const nodeStates =
    state === "workflow"
      ? [0, 1, 2, 3]
      : state === "recommendation"
        ? [0, 1, 2]
        : [0, 1];

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      style={{ opacity: intensity }}
    >
      <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        <defs>
          <linearGradient id="live-orb" x1="20" y1="180" x2="180" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1677FF" />
            <stop offset="0.5" stopColor="#00D9FF" />
            <stop offset="1" stopColor="#9B6CFF" />
          </linearGradient>
          <radialGradient id="live-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00D9FF" stopOpacity="0.5" />
            <stop offset="70%" stopColor="#1677FF" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#1677FF" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Core glow */}
        <circle cx="100" cy="100" r="46" fill="url(#live-core)" />

        {/* Orbit 1 — 360° ring */}
        <g
          style={
            animate
              ? { animation: `live-spin ${spinDuration}s linear infinite`, transformOrigin: "100px 100px" }
              : undefined
          }
        >
          <ellipse cx="100" cy="100" rx="76" ry="28" stroke="url(#live-orb)" strokeWidth="1" opacity="0.5" />
        </g>

        {/* Orbit 2 — counter rotation */}
        <g
          style={
            animate
              ? { animation: `live-spin-rev ${spinDuration * 1.4}s linear infinite`, transformOrigin: "100px 100px" }
              : undefined
          }
        >
          <ellipse
            cx="100"
            cy="100"
            rx="64"
            ry="24"
            transform="rotate(58 100 100)"
            stroke="url(#live-orb)"
            strokeWidth="0.8"
            opacity="0.35"
          />
        </g>

        {/* Connected AI nodes */}
        {[
          { cx: 24, cy: 100 },
          { cx: 176, cy: 100 },
          { cx: 140, cy: 46 },
          { cx: 60, cy: 154 },
          { cx: 100, cy: 24 },
        ].map((node, index) => {
          const lit = nodeStates.includes(index);
          return (
            <g key={`${node.cx}-${node.cy}`}>
              <line
                x1="100"
                y1="100"
                x2={node.cx}
                y2={node.cy}
                stroke="url(#live-orb)"
                strokeWidth="0.6"
                opacity={lit ? 0.5 : 0.18}
              />
              <circle
                cx={node.cx}
                cy={node.cy}
                r={lit ? 3.4 : 2.4}
                fill={lit ? meta.color : "url(#live-orb)"}
                opacity={lit ? 1 : 0.5}
              >
                {animate && lit ? (
                  <animate
                    attributeName="opacity"
                    values="0.45;1;0.45"
                    dur={`${2.6 + index * 0.35}s`}
                    repeatCount="indefinite"
                  />
                ) : null}
              </circle>
            </g>
          );
        })}

        {/* Human/AI core with upward growth arrow */}
        <circle cx="100" cy="100" r="15" fill="url(#live-orb)" opacity="0.9" />
        <path d="M94 106 L100 90 L106 106 L102.6 106 L100 98.6 L97.4 106 Z" fill="hsl(var(--background))" />

        {/* Data particles drifting upward */}
        {animate
          ? [
              { x: 66, delay: 0 },
              { x: 132, delay: 1.4 },
              { x: 100, delay: 2.6 },
            ].map((particle) => (
              <circle key={particle.x} cx={particle.x} cy="120" r="1.4" fill="#00D9FF" opacity="0.6">
                <animate
                  attributeName="cy"
                  values="124;66"
                  dur="6s"
                  begin={`${particle.delay}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.7;0"
                  dur="6s"
                  begin={`${particle.delay}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))
          : null}

        <style>{`
          @keyframes live-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes live-spin-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        `}</style>
      </svg>

      {state === "offline" ? (
        <div className="mt-1 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          AI Engine Offline
        </div>
      ) : null}
    </div>
  );
}

/** Compact status pill for the top bar and sidebars. */
export function AiStatusPill({ state = "operational", className }: { state?: AiEngineState; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-1.5",
        className,
      )}
      role="status"
      aria-label={`AI Engine ${meta.label}`}
    >
      <span className="relative flex h-2 w-2">
        {state !== "offline" ? (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ backgroundColor: meta.color }}
          />
        ) : null}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />
      </span>
      <span className="text-[11.5px] font-bold text-foreground">AI Engine</span>
      <span className="text-[11px] font-medium" style={{ color: meta.color }}>
        {meta.label}
      </span>
    </span>
  );
}
