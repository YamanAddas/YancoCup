import { useState, useRef, useEffect } from "react";
import { LANGUAGES, useI18n } from "../../lib/i18n";
import type { LangCode } from "../../lib/i18n";

const FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags";

export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === lang)!;

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-yc-bg-elevated transition-colors"
        title="Language"
      >
        <img
          src={`${FLAG_BASE}/${current.flag}.svg`}
          alt={current.name}
          className="w-5 h-5 rounded-full"
        />
        <span className="text-yc-text-secondary text-xs uppercase hidden sm:inline">
          {lang}
        </span>
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1 bg-yc-bg-surface border border-yc-border rounded-lg shadow-xl py-1 min-w-[160px] z-50">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code as LangCode);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                lang === l.code
                  ? "text-yc-green bg-yc-green-dark/20"
                  : "text-yc-text-secondary hover:text-yc-text-primary hover:bg-yc-bg-elevated"
              }`}
            >
              <img
                src={`${FLAG_BASE}/${l.flag}.svg`}
                alt={l.name}
                className="w-5 h-5 rounded-full"
              />
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
