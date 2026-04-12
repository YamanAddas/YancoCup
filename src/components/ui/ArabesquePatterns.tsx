import { useId, type SVGAttributes } from 'react';

type SVGProps = SVGAttributes<SVGSVGElement>;

/**
 * Arabesque geometric pattern components.
 * All use currentColor — control color via text-* utilities, opacity via opacity-*.
 * Each SVG pattern < 2KB, total < 8KB. Progressive enhancement only.
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

/** Corner geometric motif for featured cards. Self-positions absolutely —
 *  parent needs `relative overflow-hidden`. */
type CornerPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CORNER_CLASS: Record<CornerPosition, string> = {
  'top-right': 'top-0 right-0',
  'top-left': 'top-0 left-0',
  'bottom-right': 'bottom-0 right-0',
  'bottom-left': 'bottom-0 left-0',
};

const CORNER_FLIP: Record<CornerPosition, string | undefined> = {
  'top-right': undefined,
  'top-left': 'translate(32,0) scale(-1,1)',
  'bottom-right': 'translate(0,32) scale(1,-1)',
  'bottom-left': 'translate(32,32) scale(-1,-1)',
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
      width="32" height="32" viewBox="0 0 32 32"
      {...props}
    >
      <g transform={CORNER_FLIP[position]}>
        {/* Radiating lines from corner with diamond endpoints */}
        <line x1="32" y1="0" x2="20" y2="12" stroke="currentColor" strokeWidth="0.5" />
        <line x1="32" y1="0" x2="24" y2="16" stroke="currentColor" strokeWidth="0.5" />
        <line x1="32" y1="0" x2="16" y2="8" stroke="currentColor" strokeWidth="0.5" />
        <path d="M20 11L21 12L20 13L19 12Z" fill="currentColor" />
        <path d="M24 15L25 16L24 17L23 16Z" fill="currentColor" />
        <path d="M16 7L17 8L16 9L15 8Z" fill="currentColor" />
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
