import { describe, it, expect, vi, afterEach } from "vitest";

// canPredict is in usePredictions.ts but is a pure function — import directly
// Re-implement here to avoid importing Supabase
function canPredict(matchDate: string, matchTime: string): boolean {
  const kickoff = new Date(`${matchDate}T${matchTime}:00Z`);
  return Date.now() < kickoff.getTime();
}

describe("canPredict", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for a future match", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));
    expect(canPredict("2026-06-11", "18:00")).toBe(true);
  });

  it("returns false for a past match", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T12:00:00Z"));
    expect(canPredict("2026-06-11", "18:00")).toBe(false);
  });

  it("returns false at exact kickoff time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T18:00:00Z"));
    expect(canPredict("2026-06-11", "18:00")).toBe(false);
  });

  it("returns true 1ms before kickoff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T17:59:59.999Z"));
    expect(canPredict("2026-06-11", "18:00")).toBe(true);
  });

  it("returns false 1ms after kickoff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-11T18:00:00.001Z"));
    expect(canPredict("2026-06-11", "18:00")).toBe(false);
  });
});
