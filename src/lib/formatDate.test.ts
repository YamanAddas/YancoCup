import { describe, it, expect } from "vitest";
import { getLocale, formatMatchDate, formatDatePill } from "./formatDate";

describe("getLocale", () => {
  it("en → en-US", () => expect(getLocale("en")).toBe("en-US"));
  it("ar → ar-SA", () => expect(getLocale("ar")).toBe("ar-SA"));
  it("es → es-ES", () => expect(getLocale("es")).toBe("es-ES"));
  it("fr → fr-FR", () => expect(getLocale("fr")).toBe("fr-FR"));
  it("de → de-DE", () => expect(getLocale("de")).toBe("de-DE"));
  it("pt → pt-BR", () => expect(getLocale("pt")).toBe("pt-BR"));
  it("undefined → en-US", () => expect(getLocale(undefined)).toBe("en-US"));
  it("unknown → en-US", () => expect(getLocale("xx")).toBe("en-US"));
});

describe("formatMatchDate", () => {
  it("returns a non-empty localized string", () => {
    const result = formatMatchDate("2026-06-11", "en");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    // Contains "Jun" — date may shift by ±1 day depending on local TZ
    expect(result).toContain("Jun");
  });

  it("works with Arabic locale", () => {
    const result = formatMatchDate("2026-06-11", "ar");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatDatePill", () => {
  it("returns day, weekday, month for a valid date", () => {
    const pill = formatDatePill("2026-06-11", "en");
    expect(pill.day).toBeTruthy();
    expect(pill.weekday).toBeTruthy();
    expect(pill.month).toBeTruthy();
  });

  it("month contains Jun", () => {
    const pill = formatDatePill("2026-06-15", "en");
    expect(pill.month).toContain("Jun");
  });
});
