import { describe, it, expect } from "vitest";
import {
  formatCountdown,
  getUrgencyTier,
  type CountdownState,
} from "./useCountdown";

function state(opts: Partial<CountdownState> = {}): CountdownState {
  return {
    totalSeconds: 0,
    totalMinutes: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    hasKickedOff: false,
    ...opts,
  };
}

describe("formatCountdown", () => {
  it("formats hours+minutes when >= 1 hour", () => {
    expect(
      formatCountdown(state({ hours: 1, minutes: 47, totalMinutes: 107, totalSeconds: 6420 })),
    ).toBe("1h 47m");
    expect(
      formatCountdown(state({ hours: 2, minutes: 0, totalMinutes: 120, totalSeconds: 7200 })),
    ).toBe("2h 0m");
  });

  it("shows minutes only when 10-59 minutes", () => {
    expect(
      formatCountdown(state({ minutes: 47, totalMinutes: 47, totalSeconds: 2820 })),
    ).toBe("47m");
    expect(
      formatCountdown(state({ minutes: 10, totalMinutes: 10, totalSeconds: 600 })),
    ).toBe("10m");
  });

  it("shows minutes+seconds when 1-9 minutes (drama tier)", () => {
    expect(
      formatCountdown(state({ minutes: 9, seconds: 3, totalMinutes: 9, totalSeconds: 543 })),
    ).toBe("9m 03s");
    expect(
      formatCountdown(state({ minutes: 1, seconds: 30, totalMinutes: 1, totalSeconds: 90 })),
    ).toBe("1m 30s");
  });

  it("shows seconds only when under 1 minute", () => {
    expect(formatCountdown(state({ seconds: 23, totalSeconds: 23 }))).toBe("23s");
    expect(formatCountdown(state({ seconds: 1, totalSeconds: 1 }))).toBe("1s");
  });

  it("shows 0s after kickoff", () => {
    expect(formatCountdown(state({ hasKickedOff: true }))).toBe("0s");
  });
});

describe("getUrgencyTier", () => {
  it("returns static for null", () => {
    expect(getUrgencyTier(null)).toBe("static");
  });

  it("returns static once kicked off", () => {
    expect(getUrgencyTier(state({ hasKickedOff: true }))).toBe("static");
  });

  it("returns static when more than 120 minutes out", () => {
    expect(getUrgencyTier(state({ totalMinutes: 121 }))).toBe("static");
    expect(getUrgencyTier(state({ totalMinutes: 1440 }))).toBe("static");
  });

  it("returns soon between 60 and 120 minutes", () => {
    expect(getUrgencyTier(state({ totalMinutes: 120 }))).toBe("soon");
    expect(getUrgencyTier(state({ totalMinutes: 90 }))).toBe("soon");
    expect(getUrgencyTier(state({ totalMinutes: 61 }))).toBe("soon");
  });

  it("returns warn between 10 and 60 minutes", () => {
    expect(getUrgencyTier(state({ totalMinutes: 60 }))).toBe("warn");
    expect(getUrgencyTier(state({ totalMinutes: 30 }))).toBe("warn");
    expect(getUrgencyTier(state({ totalMinutes: 11 }))).toBe("warn");
  });

  it("returns urgent when 10 minutes or less", () => {
    expect(getUrgencyTier(state({ totalMinutes: 10 }))).toBe("urgent");
    expect(getUrgencyTier(state({ totalMinutes: 5 }))).toBe("urgent");
    expect(getUrgencyTier(state({ totalMinutes: 0, totalSeconds: 30, seconds: 30 }))).toBe("urgent");
  });
});
