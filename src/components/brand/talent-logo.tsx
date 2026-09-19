import { cn } from "@/lib/utils";

/**
 * Talent360 AI brand mark.
 *
 * The identity is translated into geometry: a 360° orbital ring, connected AI
 * nodes sitting on the orbit, and an upward growth arrow at the centre. The
 * electric-blue → cyan → violet gradient is the AI language of the product.
 */
export function TalentLogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="t3-ai" x1="6" y1="58" x2="58" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1677FF" />
          <stop offset="0.5" stopColor="#00D9FF" />
          <stop offset="1" stopColor="#9B6CFF" />
        </linearGradient>
        <linearGradient id="t3-ai-soft" x1="6" y1="58" x2="58" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1677FF" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#00D9FF" stopOpacity="0.4" />
          <stop offset="1" stopColor="#9B6CFF" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* Orbital ring (tilted) */}
      <ellipse cx="32" cy="32" rx="25" ry="9.5" transform="rotate(-24 32 32)" stroke="url(#t3-ai-soft)" strokeWidth="1.6" />
      <ellipse cx="32" cy="32" rx="25" ry="9.5" transform="rotate(24 32 32)" stroke="url(#t3-ai-soft)" strokeWidth="1.2" />

      {/* Connected AI nodes on the orbit */}
      <circle cx="20" cy="18" r="2.4" fill="#00D9FF" />
      <circle cx="44" cy="46" r="2.4" fill="#9B6CFF" />
      <circle cx="49" cy="20" r="1.8" fill="#1677FF" />
      <circle cx="15" cy="46" r="1.8" fill="#00D9FF" />
      <line x1="20" y1="18" x2="32" y2="26" stroke="#1677FF" strokeWidth="1" opacity="0.6" />
      <line x1="44" y1="46" x2="32" y2="38" stroke="#9B6CFF" strokeWidth="1" opacity="0.6" />

      {/* Upward growth arrow */}
      <path d="M26 40 L32 24 L38 40 L34.6 40 L32 32.6 L29.4 40 Z" fill="url(#t3-ai)" />
    </svg>
  );
}

interface TalentLogoProps {
  size?: number;
  className?: string;
  /** Renders the wordmark next to the mark (sidebar / login / loading). */
  withWordmark?: boolean;
  subtitle?: string;
}

export function TalentLogo({ size = 36, className, withWordmark = false, subtitle }: TalentLogoProps) {
  if (!withWordmark) return <TalentLogoMark size={size} className={className} />;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <TalentLogoMark size={size} />
      <div className="min-w-0 leading-none">
        <div className="text-[15px] font-extrabold tracking-tight text-foreground">
          Talent360 <span className="talent-ai-text">AI</span>
        </div>
        <div className="mt-1 truncate text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {subtitle ?? "Workforce Intelligence"}
        </div>
      </div>
    </div>
  );
}
