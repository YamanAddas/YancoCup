import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildShareText, sharePrediction } from "./share";

// Mock window.location for buildShareText
const mockLocation = {
  origin: "https://yamanaddas.github.io",
  pathname: "/YancoCup/",
};
Object.defineProperty(globalThis, "window", {
  value: { location: mockLocation },
  writable: true,
});

// Minimal types matching what buildShareText expects
const homeTeam = { name: "Brazil", fifaCode: "BRA" } as any;
const awayTeam = { name: "Argentina", fifaCode: "ARG" } as any;

describe("buildShareText", () => {
  it("builds text with team names and scores", () => {
    const match = { group: "A", round: "Group A" } as any;
    const text = buildShareText(match, homeTeam, awayTeam, 2, 1);
    expect(text).toContain("Brazil");
    expect(text).toContain("Argentina");
    expect(text).toContain("BRA 2 - 1 ARG");
  });

  it("shows group label when match has group", () => {
    const match = { group: "C", round: "Group C" } as any;
    const text = buildShareText(match, homeTeam, awayTeam, 0, 0);
    expect(text).toContain("Group C");
  });

  it("shows round when match has no group", () => {
    const match = { group: null, round: "Quarter-final" } as any;
    const text = buildShareText(match, homeTeam, awayTeam, 1, 0);
    expect(text).toContain("Quarter-final");
  });

  it("includes prediction link", () => {
    const match = { group: "A", round: "Group A" } as any;
    const text = buildShareText(match, homeTeam, awayTeam, 3, 2);
    expect(text).toContain("https://yamanaddas.github.io/YancoCup/#/predictions");
  });

  it("uses default English labels when no translator", () => {
    const match = { group: "B", round: "Group B" } as any;
    const text = buildShareText(match, homeTeam, awayTeam, 1, 1);
    expect(text).toContain("My prediction for");
    expect(text).toContain("Predict yours at YancoCup");
  });

  it("uses translator when provided", () => {
    const match = { group: "A", round: "Group A" } as any;
    const t = (key: string) => {
      const map: Record<string, string> = {
        "share.myPrediction": "توقعي لـ",
        "share.predictYours": "توقع أنت في YancoCup",
        "share.groupLabel": "المجموعة",
        "match.vs": "ضد",
      };
      return map[key] ?? key;
    };
    const text = buildShareText(match, homeTeam, awayTeam, 2, 0, t);
    expect(text).toContain("توقعي لـ");
    expect(text).toContain("ضد");
    expect(text).toContain("المجموعة A");
  });

  it("handles 0-0 score", () => {
    const match = { group: "D", round: "Group D" } as any;
    const text = buildShareText(match, homeTeam, awayTeam, 0, 0);
    expect(text).toContain("BRA 0 - 0 ARG");
  });
});

describe("sharePrediction", () => {
  beforeEach(() => {
    // Reset navigator mocks
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });
  });

  it("returns 'shared' when Web Share succeeds", async () => {
    (globalThis as any).navigator = {
      share: vi.fn().mockResolvedValue(undefined),
    };
    const result = await sharePrediction("test text");
    expect(result).toBe("shared");
    expect(navigator.share).toHaveBeenCalledWith({ text: "test text" });
  });

  it("falls back to clipboard when share throws", async () => {
    (globalThis as any).navigator = {
      share: vi.fn().mockRejectedValue(new Error("cancelled")),
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    };
    const result = await sharePrediction("test text");
    expect(result).toBe("copied");
  });

  it("falls back to clipboard when share not available", async () => {
    (globalThis as any).navigator = {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    };
    const result = await sharePrediction("test text");
    expect(result).toBe("copied");
  });

  it("returns 'failed' when both share and clipboard fail", async () => {
    (globalThis as any).navigator = {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    };
    const result = await sharePrediction("test text");
    expect(result).toBe("failed");
  });
});
