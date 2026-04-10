import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { teamName, competitionName, venueName, countryName, confederationName } from "./i18n-data";

// Supported languages
export const LANGUAGES = [
  { code: "en", name: "English", flag: "gb", dir: "ltr" },
  { code: "ar", name: "العربية", flag: "sa", dir: "rtl" },
  { code: "es", name: "Español", flag: "es", dir: "ltr" },
  { code: "fr", name: "Français", flag: "fr", dir: "ltr" },
  { code: "de", name: "Deutsch", flag: "de", dir: "ltr" },
  { code: "pt", name: "Português", flag: "br", dir: "ltr" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "yc_lang";

// Translation dictionaries loaded eagerly (small payload, ~250 keys each)
import en from "../data/translations/en.json";
import ar from "../data/translations/ar.json";
import es from "../data/translations/es.json";
import fr from "../data/translations/fr.json";
import de from "../data/translations/de.json";
import pt from "../data/translations/pt.json";

const dictionaries: Record<LangCode, Record<string, string>> = {
  en, ar, es, fr, de, pt,
};

// ─── Arabic Plural Rules ─────────────────────────────────────────────────────
// Arabic has 6 plural forms: zero, one, two, few (3-10), many (11-99), other (100+)
// Usage: define keys like "key.zero", "key.one", "key.two", "key.few", "key.many", "key.other"
// Falls back: specific form → "key" (base) → English

function getArabicPluralForm(count: number): string {
  if (count === 0) return "zero";
  if (count === 1) return "one";
  if (count === 2) return "two";
  const mod100 = count % 100;
  if (mod100 >= 3 && mod100 <= 10) return "few";
  if (mod100 >= 11 && mod100 <= 99) return "many";
  return "other";
}

function getPluralForm(count: number, lang: LangCode): string {
  if (lang === "ar") return getArabicPluralForm(count);
  // Most European languages: 1 = one, else other
  if (count === 1) return "one";
  return "other";
}

// ─── Intl.RelativeTimeFormat helper ──────────────────────────────────────────

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

function getRelativeTimeFormatter(lang: LangCode): Intl.RelativeTimeFormat {
  if (!rtfCache.has(lang)) {
    rtfCache.set(lang, new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" }));
  }
  return rtfCache.get(lang)!;
}

/**
 * Format a relative time string like "2 min ago", "3 hours ago", "5 days ago"
 * using the browser's Intl.RelativeTimeFormat for proper localization.
 */
export function formatRelativeTime(date: Date | string | number, lang: LangCode): string {
  const now = Date.now();
  const then = typeof date === "number" ? date : new Date(date).getTime();
  const diffMs = then - now;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffMs / 60000);
  const diffHour = Math.round(diffMs / 3600000);
  const diffDay = Math.round(diffMs / 86400000);

  const rtf = getRelativeTimeFormatter(lang);

  if (Math.abs(diffSec) < 60) return rtf.format(0, "second"); // "just now" / "الآن"
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, "hour");
  return rtf.format(diffDay, "day");
}

// ─── Context & Provider ──────────────────────────────────────────────────────

interface I18nState {
  lang: LangCode;
  dir: "ltr" | "rtl";
  setLang: (code: LangCode) => void;
  /** Translate a UI string key, with optional interpolation params. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Translate with plural support. Looks up "key.one"/"key.other" (or Arabic forms).
   * Falls back to the base key with {count} interpolation.
   */
  tp: (key: string, count: number, params?: Record<string, string | number>) => string;
  /** Translate a team name by team id (e.g., "bra" → "البرازيل") */
  tTeam: (idOrName: string) => string;
  /** Get translated competition name/shortName by comp id (e.g., "WC") */
  tComp: (compId: string) => { name: string; shortName: string };
  /** Get translated venue info by venue id */
  tVenue: (venueId: string) => { name: string; city: string; country: string };
  /** Translate a country name by ISO code (e.g., "us" → "الولايات المتحدة") */
  tCountry: (isoCode: string) => string;
  /** Translate a confederation name (e.g., "UEFA" → "الاتحاد الأوروبي") */
  tConf: (confId: string) => string;
  /** Format relative time (e.g., Date → "5 min ago" / "منذ ٥ دقائق") */
  relTime: (date: Date | string | number) => string;
}

const I18nContext = createContext<I18nState | null>(null);

function getInitialLang(): LangCode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && dictionaries[stored as LangCode]) return stored as LangCode;

  // Try browser language
  const browserLang = navigator.language.split("-")[0];
  if (dictionaries[browserLang as LangCode]) return browserLang as LangCode;

  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(getInitialLang);

  const langMeta = LANGUAGES.find((l) => l.code === lang)!;
  const dir = langMeta.dir as "ltr" | "rtl";

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  // Update document dir and lang attributes
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [lang, dir]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let text = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [lang],
  );

  const tp = useCallback(
    (key: string, count: number, params?: Record<string, string | number>): string => {
      const form = getPluralForm(count, lang);
      const pluralKey = `${key}.${form}`;
      // Try plural form, fall back to base key
      const dict = dictionaries[lang];
      const enDict = dictionaries.en;
      let text = dict[pluralKey] ?? dict[key] ?? enDict[pluralKey] ?? enDict[key] ?? key;
      // Always inject count
      const allParams = { count, ...params };
      for (const [k, v] of Object.entries(allParams)) {
        text = text.split(`{${k}}`).join(String(v));
      }
      return text;
    },
    [lang],
  );

  const tTeam = useCallback((idOrName: string) => teamName(idOrName, lang), [lang]);
  const tComp = useCallback((compId: string) => competitionName(compId, lang), [lang]);
  const tVenue = useCallback((venueId: string) => venueName(venueId, lang), [lang]);
  const tCountry = useCallback((isoCode: string) => countryName(isoCode, lang), [lang]);
  const tConf = useCallback((confId: string) => confederationName(confId, lang), [lang]);
  const relTime = useCallback((date: Date | string | number) => formatRelativeTime(date, lang), [lang]);

  const value = useMemo<I18nState>(
    () => ({ lang, dir, setLang, t, tp, tTeam, tComp, tVenue, tCountry, tConf, relTime }),
    [lang, dir, setLang, t, tp, tTeam, tComp, tVenue, tCountry, tConf, relTime],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
