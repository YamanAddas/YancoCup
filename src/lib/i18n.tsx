import { createContext, useContext, useState, useCallback, useEffect } from "react";

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

// Translation dictionaries loaded eagerly (small payload, ~100 keys each)
import en from "../data/translations/en.json";
import ar from "../data/translations/ar.json";
import es from "../data/translations/es.json";
import fr from "../data/translations/fr.json";
import de from "../data/translations/de.json";
import pt from "../data/translations/pt.json";

const dictionaries: Record<LangCode, Record<string, string>> = {
  en, ar, es, fr, de, pt,
};

interface I18nState {
  lang: LangCode;
  dir: "ltr" | "rtl";
  setLang: (code: LangCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
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

  return (
    <I18nContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
