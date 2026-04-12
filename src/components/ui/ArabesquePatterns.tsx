import { useId, type SVGAttributes } from 'react';

type SVGProps = SVGAttributes<SVGSVGElement>;

/**
 * Arabesque geometric pattern components.
 * All use currentColor — control color via text-* utilities, opacity via opacity-*.
 * Mathematically-precise Islamic geometric art. Progressive enhancement only.
 */

/** Repeating octagonal lattice for hero/page backgrounds.
 *  Place inside a relative container with `absolute inset-0 pointer-events-none`. */
export function ArabesqueLattice({ className, ...props }: SVGProps) {
  const pid = `lat-${useId().replace(/:/g, '')}`;
  return (
    <svg aria-hidden="true" className={className} width="100%" height="100%" {...props}>
      <defs>
        <pattern id={pid} width="48" height="48" patternUnits="userSpaceOnUse">
          {/* Octagonal frame — tiles into classic Islamic octagon-square pattern */}
          <path
            d="M14 0L34 0L48 14L48 34L34 48L14 48L0 34L0 14Z"
            fill="none" stroke="currentColor" strokeWidth="0.5"
          />
          {/* Inner octagon — creates depth within each cell */}
          <path
            d="M18 10L30 10L38 18L38 30L30 38L18 38L10 30L10 18Z"
            fill="none" stroke="currentColor" strokeWidth="0.3"
          />
          {/* Connecting spokes — outer to inner vertices */}
          <path
            d="M14 0L18 10M34 0L30 10M48 14L38 18M48 34L38 30M34 48L30 38M14 48L18 38M0 34L10 30M0 14L10 18"
            fill="none" stroke="currentColor" strokeWidth="0.3"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  );
}

/** 12-fold rosette — the crown jewel of Islamic geometric art.
 *  Based on traditional Moroccan zellige patterns. Each tile contains
 *  a 12-pointed star formed by overlapping hexagons with interlacing paths.
 *  Use for premium hero sections and featured cards. */
export function RosetteLattice({ className, ...props }: SVGProps) {
  const pid = `ros-${useId().replace(/:/g, '')}`;
  // 12-fold star geometry: vertices at 30° intervals on radius 20, center at (30,30), tile 60×60
  const R = 20, r = 12, cx = 30, cy = 30;
  const outerPts: string[] = [];
  const innerPts: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 - 90) * Math.PI / 180;
    outerPts.push(`${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`);
    innerPts.push(`${(cx + r * Math.cos(a + 15 * Math.PI / 180)).toFixed(1)},${(cy + r * Math.sin(a + 15 * Math.PI / 180)).toFixed(1)}`);
  }
  // 12-pointed star: alternate outer/inner vertices
  const starPath = outerPts.map((o, i) => `${i === 0 ? 'M' : 'L'}${o}L${innerPts[i]}`).join('') + 'Z';
  // Inner 6-fold star (hexagram)
  const hex6: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 - 90) * Math.PI / 180;
    hex6.push(`${(cx + 8 * Math.cos(a)).toFixed(1)},${(cy + 8 * Math.sin(a)).toFixed(1)}`);
  }
  const hexPath = `M${hex6[0]}L${hex6[2]}L${hex6[4]}Z M${hex6[1]}L${hex6[3]}L${hex6[5]}Z`;
  // Radiating petals — connect outer star points to neighbors
  const petalPaths = outerPts.map((_, i) => {
    const next = (i + 1) % 12;
    return `M${outerPts[i]}Q${cx},${cy} ${outerPts[next]}`;
  }).join('');

  return (
    <svg aria-hidden="true" className={className} width="100%" height="100%" {...props}>
      <defs>
        <pattern id={pid} width="60" height="60" patternUnits="userSpaceOnUse">
          <path d={starPath} fill="none" stroke="currentColor" strokeWidth="0.4" />
          <path d={hexPath} fill="none" stroke="currentColor" strokeWidth="0.3" />
          <path d={petalPaths} fill="none" stroke="currentColor" strokeWidth="0.2" opacity="0.6" />
          <circle cx={cx} cy={cy} r="3" fill="none" stroke="currentColor" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  );
}

/** Horizontal diamond chain strip, 12px tall. Use as section divider. */
export function GeometricBand({ className, ...props }: SVGProps) {
  const pid = `band-${useId().replace(/:/g, '')}`;
  return (
    <svg aria-hidden="true" className={className} width="100%" height="12" {...props}>
      <defs>
        <pattern id={pid} width="24" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0L24 6L12 12L0 6Z" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <path d="M12 3L18 6L12 9L6 6Z" fill="none" stroke="currentColor" strokeWidth="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="12" fill={`url(#${pid})`} />
    </svg>
  );
}

/** Ornate interlacing band — Moorish knotwork strip, 20px tall.
 *  Uses overlapping sine-wave arcs that weave over/under each other.
 *  Premium alternative to GeometricBand for featured sections. */
export function InterlaceBand({ className, ...props }: SVGProps) {
  const pid = `ilb-${useId().replace(/:/g, '')}`;
  return (
    <svg aria-hidden="true" className={className} width="100%" height="20" {...props}>
      <defs>
        <pattern id={pid} width="40" height="20" patternUnits="userSpaceOnUse">
          {/* Primary wave */}
          <path d="M0 10Q10 0 20 10Q30 20 40 10" fill="none" stroke="currentColor" strokeWidth="0.6" />
          {/* Counter-wave — creates interlace illusion */}
          <path d="M0 10Q10 20 20 10Q30 0 40 10" fill="none" stroke="currentColor" strokeWidth="0.6" />
          {/* Interlace break — small gap to simulate over/under weaving */}
          <rect x="9" y="8" width="2.5" height="4" fill="var(--color-yc-bg-deep, #060b14)" rx="0.5" />
          <rect x="29" y="8" width="2.5" height="4" fill="var(--color-yc-bg-deep, #060b14)" rx="0.5" />
          {/* Junction diamonds */}
          <path d="M20 8.5L21.5 10L20 11.5L18.5 10Z" fill="currentColor" opacity="0.5" />
          <path d="M0 8.5L1.5 10L0 11.5L-1.5 10Z" fill="currentColor" opacity="0.5" />
          <path d="M40 8.5L41.5 10L40 11.5L38.5 10Z" fill="currentColor" opacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="20" fill={`url(#${pid})`} />
    </svg>
  );
}

/** Corner geometric motif for featured cards — ornate rosette quarter.
 *  Self-positions absolutely — parent needs `relative overflow-hidden`. */
type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CORNER_CLASS: Record<CornerPosition, string> = {
  'top-right': 'top-0 right-0',
  'top-left': 'top-0 left-0',
  'bottom-right': 'bottom-0 right-0',
  'bottom-left': 'bottom-0 left-0',
};

const CORNER_FLIP: Record<CornerPosition, string | undefined> = {
  'top-right': undefined,
  'top-left': 'translate(48,0) scale(-1,1)',
  'bottom-right': 'translate(0,48) scale(1,-1)',
  'bottom-left': 'translate(48,48) scale(-1,-1)',
};

export function CornerAccent({
  position = 'top-right',
  className,
  ...props
}: { position?: CornerPosition } & SVGProps) {
  return (
    <svg
      aria-hidden="true"
      className={['absolute pointer-events-none', CORNER_CLASS[position], className].filter(Boolean).join(' ')}
      width="48" height="48" viewBox="0 0 48 48"
      {...props}
    >
      <g transform={CORNER_FLIP[position]}>
        {/* Quarter rosette — radiating arcs with diamond nodes */}
        <path d="M48 0Q36 6 30 18" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <path d="M48 0Q42 12 36 24" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <path d="M48 0Q30 2 18 12" fill="none" stroke="currentColor" strokeWidth="0.4" />
        <path d="M48 0Q44 18 42 36" fill="none" stroke="currentColor" strokeWidth="0.3" />
        {/* Ornate diamond nodes at intersections */}
        <path d="M30 17L31.5 18.5L30 20L28.5 18.5Z" fill="currentColor" opacity="0.7" />
        <path d="M36 23L37.5 24.5L36 26L34.5 24.5Z" fill="currentColor" opacity="0.7" />
        <path d="M18 11L19.5 12.5L18 14L16.5 12.5Z" fill="currentColor" opacity="0.5" />
        <path d="M42 35L43 36.5L42 38L41 36.5Z" fill="currentColor" opacity="0.3" />
        {/* Petal arc — gives organic feel */}
        <path d="M38 8Q34 14 30 18Q26 14 22 8" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
        <path d="M44 16Q40 22 36 24Q32 22 28 16" fill="none" stroke="currentColor" strokeWidth="0.3" opacity="0.4" />
      </g>
    </svg>
  );
}

/** Inline diamond separator for stats and lists.
 *  Set `gold` for traditional green+gold accent at star intersections. */
export function StarDivider({
  gold = false,
  className,
  ...props
}: { gold?: boolean } & SVGProps) {
  return (
    <svg
      aria-hidden="true"
      className={['inline-block align-middle', className].filter(Boolean).join(' ')}
      width="12" height="12" viewBox="0 0 12 12"
      {...props}
    >
      <path d="M6 1L10 6L6 11L2 6Z" fill="none" stroke="currentColor" strokeWidth="0.6" />
      <path d="M6 3L8 6L6 9L4 6Z" fill={gold ? '#ffc800' : 'currentColor'} />
    </svg>
  );
}

/** Ornate section divider — 8-pointed star with radiating filigree.
 *  Use between major content sections for visual breathing room. */
export function OrnamentDivider({ className, ...props }: SVGProps) {
  return (
    <svg
      aria-hidden="true"
      className={['block mx-auto', className].filter(Boolean).join(' ')}
      width="120" height="24" viewBox="0 0 120 24"
      {...props}
    >
      {/* Central 8-pointed star */}
      <path d="M60 4L63 9L68 8L65 12L68 16L63 15L60 20L57 15L52 16L55 12L52 8L57 9Z" fill="currentColor" opacity="0.6" />
      <path d="M60 7L62 10.5L60 14L58 10.5Z" fill="currentColor" opacity="0.9" />
      {/* Left filigree — diminishing diamonds and arcs */}
      <path d="M48 12L45 10L42 12L45 14Z" fill="currentColor" opacity="0.4" />
      <path d="M38 12L36 11L34 12L36 13Z" fill="currentColor" opacity="0.25" />
      <path d="M30 12L29 11.5L28 12L29 12.5Z" fill="currentColor" opacity="0.15" />
      <path d="M50 12Q46 8 42 12Q46 16 50 12" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
      <line x1="24" y1="12" x2="34" y2="12" stroke="currentColor" strokeWidth="0.3" opacity="0.1" />
      {/* Right filigree — mirror */}
      <path d="M72 12L75 10L78 12L75 14Z" fill="currentColor" opacity="0.4" />
      <path d="M82 12L84 11L86 12L84 13Z" fill="currentColor" opacity="0.25" />
      <path d="M90 12L91 11.5L92 12L91 12.5Z" fill="currentColor" opacity="0.15" />
      <path d="M70 12Q74 8 78 12Q74 16 70 12" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
      <line x1="86" y1="12" x2="96" y2="12" stroke="currentColor" strokeWidth="0.3" opacity="0.1" />
    </svg>
  );
}

/** Muqarnas-inspired arch frame — ornate pointed arch with nested layers.
 *  Use as a decorative frame around featured content (next match, CTA). */
export function ArchFrame({ className, ...props }: SVGProps) {
  return (
    <svg
      aria-hidden="true"
      className={['absolute inset-0 w-full h-full pointer-events-none', className].filter(Boolean).join(' ')}
      viewBox="0 0 300 160" preserveAspectRatio="none"
      {...props}
    >
      {/* Outer arch — pointed (ogee) profile */}
      <path
        d="M10 160L10 60Q10 30 40 15Q80 0 150 0Q220 0 260 15Q290 30 290 60L290 160"
        fill="none" stroke="currentColor" strokeWidth="0.5"
      />
      {/* Inner arch — creates depth banding */}
      <path
        d="M20 160L20 64Q20 38 46 24Q82 10 150 10Q218 10 254 24Q280 38 280 64L280 160"
        fill="none" stroke="currentColor" strokeWidth="0.3"
      />
      {/* Keystone diamond */}
      <path d="M150 2L153 6L150 10L147 6Z" fill="currentColor" opacity="0.4" />
      {/* Shoulder diamonds */}
      <path d="M40 16L42 18.5L40 21L38 18.5Z" fill="currentColor" opacity="0.25" />
      <path d="M260 16L262 18.5L260 21L258 18.5Z" fill="currentColor" opacity="0.25" />
      {/* Decorative spandrel arcs */}
      <path d="M10 50Q40 45 70 55" fill="none" stroke="currentColor" strokeWidth="0.25" opacity="0.4" />
      <path d="M290 50Q260 45 230 55" fill="none" stroke="currentColor" strokeWidth="0.25" opacity="0.4" />
    </svg>
  );
}
