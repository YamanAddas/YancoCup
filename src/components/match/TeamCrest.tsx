import { useState } from "react";

const FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags";

const SIZES = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-12 h-12",
} as const;

const TEXT_SIZES = {
  xs: "text-[7px]",
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-xs",
  xl: "text-sm",
} as const;

interface TeamCrestProps {
  /** Three-letter abbreviation (e.g., "ARS", "USA") */
  tla: string;
  /** ISO country code — if provided, renders a circle-flag (national team) */
  isoCode?: string;
  /** football-data.org crest URL — if provided, renders club crest */
  crest?: string | null;
  /** Display size */
  size?: keyof typeof SIZES;
  className?: string;
}

/**
 * Renders a team visual identity:
 * 1. If isoCode → circle-flag SVG (national teams)
 * 2. If crest URL → API-hosted club crest image
 * 3. Fallback → TLA badge in a styled circle
 */
export default function TeamCrest({
  tla,
  isoCode,
  crest,
  size = "md",
  className = "",
}: TeamCrestProps) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = SIZES[size];
  const textSize = TEXT_SIZES[size];

  // National team: circle-flag
  if (isoCode) {
    return (
      <img
        src={`${FLAG_BASE}/${isoCode}.svg`}
        alt={tla}
        className={`${sizeClass} rounded-full ${className}`}
        loading="lazy"
      />
    );
  }

  // Club team with crest URL
  if (crest && !imgError) {
    return (
      <img
        src={crest}
        alt={tla}
        className={`${sizeClass} object-contain ${className}`}
        loading="lazy"
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback: TLA badge
  return (
    <div
      className={`${sizeClass} rounded-full bg-yc-bg-elevated border border-yc-border flex items-center justify-center shrink-0 ${className}`}
    >
      <span className={`text-yc-text-secondary font-bold font-mono ${textSize}`}>
        {tla.slice(0, 3)}
      </span>
    </div>
  );
}
