import { cn } from "@/lib/utils";

/**
 * Subtle animated orbital network used behind hero sections and the login page.
 * Slow rotation, very low opacity — atmospheric, never distracting.
 */
export function OrbitalBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {/* Large orbit */}
      <svg
        className="absolute -right-40 -top-40 h-[520px] w-[520px] opacity-[0.14]"
        viewBox="0 0 100 100"
        fill="none"
      >
        <defs>
          <linearGradient id="orb-1" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1677FF" />
            <stop offset="0.5" stopColor="#00D9FF" />
            <stop offset="1" stopColor="#9B6CFF" />
          </linearGradient>
        </defs>
        <ellipse
          cx="50"
          cy="50"
          rx="42"
          ry="16"
          stroke="url(#orb-1)"
          strokeWidth="0.6"
          style={{ animation: "t3-spin 60s linear infinite", transformOrigin: "50px 50px" }}
        />
        <circle cx="18" cy="38" r="1" fill="#00D9FF" />
        <circle cx="84" cy="62" r="1" fill="#9B6CFF" />
      </svg>

      {/* Inner orbit */}
      <svg
        className="absolute -bottom-40 -left-32 h-[460px] w-[460px] opacity-[0.1]"
        viewBox="0 0 100 100"
        fill="none"
      >
        <defs>
          <linearGradient id="orb-2" x1="0" y1="100" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9B6CFF" />
            <stop offset="0.5" stopColor="#00D9FF" />
            <stop offset="1" stopColor="#1677FF" />
          </linearGradient>
        </defs>
        <ellipse
          cx="50"
          cy="50"
          rx="38"
          ry="14"
          stroke="url(#orb-2)"
          strokeWidth="0.5"
          style={{ animation: "t3-spin-rev 80s linear infinite", transformOrigin: "50px 50px" }}
        />
        <circle cx="30" cy="64" r="0.9" fill="#1677FF" />
        <circle cx="72" cy="36" r="0.9" fill="#00D9FF" />
      </svg>

      {/* Network nodes */}
      <div className="absolute left-[12%] top-[22%] h-1.5 w-1.5 rounded-full bg-info/70 blur-[1px]" />
      <div className="absolute right-[18%] top-[30%] h-1 w-1 rounded-full bg-accent/60 blur-[1px]" />
      <div className="absolute bottom-[18%] right-[28%] h-1.5 w-1.5 rounded-full bg-primary/60 blur-[1px]" />
      <div className="absolute bottom-[30%] left-[24%] h-1 w-1 rounded-full bg-cyan-400/50 blur-[1px]" />

      <style>{`
        @keyframes t3-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes t3-spin-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
      `}</style>
    </div>
  );
}
