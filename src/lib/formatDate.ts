/** Format a Date to local time with timezone abbreviation, e.g. "21:00 CEST" */
export function formatTimeWithTZ(date: Date): string {
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const tz = Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  return tz ? `${time} ${tz}` : time;
}
