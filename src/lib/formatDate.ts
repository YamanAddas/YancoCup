/** Map app language codes to BCP-47 locale tags */
const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  ar: "ar-SA",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
};

/** Get BCP-47 locale for Intl formatting */
export function getLocale(lang?: string): string {
  return (lang && LOCALE_MAP[lang]) ?? "en-US";
}

/** Format a Date to local time with timezone abbreviation, e.g. "21:00 CEST" */
export function formatTimeWithTZ(date: Date, lang?: string): string {
  const locale = getLocale(lang);
  const time = date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const tz = Intl.DateTimeFormat(locale, { timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  return tz ? `${time} ${tz}` : time;
}

/** Format a date string to localized short date, e.g. "Thu, Apr 10" */
export function formatMatchDate(date: string, lang?: string): string {
  const locale = getLocale(lang);
  const dt = new Date(`${date}T00:00:00Z`);
  return dt.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
}

/** Format a date pill (day/weekday/month) */
export function formatDatePill(date: string, lang?: string): { day: string; weekday: string; month: string } {
  const locale = getLocale(lang);
  const dt = new Date(`${date}T00:00:00Z`);
  return {
    day: dt.toLocaleDateString(locale, { day: "numeric" }),
    weekday: dt.toLocaleDateString(locale, { weekday: "short" }),
    month: dt.toLocaleDateString(locale, { month: "short" }),
  };
}
