import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { GeometricBand } from './ArabesquePatterns';

interface AccordionProps {
  id?: string;
  icon: ReactNode;
  title: string;
  summary?: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Collapsible accordion section with geometric expansion border.
 * Multiple accordions open simultaneously (independent, not exclusive).
 * Uses CSS Grid 0fr→1fr transition for smooth height animation.
 * prefers-reduced-motion handled by globals.css blanket rule.
 */
export function Accordion({
  id,
  icon,
  title,
  summary,
  count,
  defaultOpen = false,
  children,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className={open ? '' : 'border-b border-yc-border'}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 py-3 group cursor-pointer"
        aria-expanded={open}
      >
        <span className="text-yc-text-tertiary group-hover:text-yc-green transition-colors shrink-0">
          {icon}
        </span>
        <span className="font-heading text-sm font-medium text-yc-text-primary">
          {title}
        </span>
        <span className="flex-1" />
        {!open && summary && (
          <span className="text-[11px] text-yc-text-tertiary truncate max-w-[40%] hidden sm:block">
            {summary}
          </span>
        )}
        {count != null && (
          <span className="bg-yc-bg-elevated text-yc-text-tertiary text-[10px] font-mono px-1.5 py-0.5 rounded-full">
            {count}
          </span>
        )}
        <ChevronDown
          size={16}
          className={`text-yc-text-tertiary shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`grid ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]`}
      >
        <div
          className={`overflow-hidden min-h-0 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="pb-5">{children}</div>
        </div>
      </div>

      {open && (
        <GeometricBand className="text-yc-green opacity-[0.06]" />
      )}
    </div>
  );
}
