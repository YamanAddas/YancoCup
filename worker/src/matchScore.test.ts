import { describe, it, expect } from "vitest";
import { deriveDisplayScore } from "./matchScore";

describe("deriveDisplayScore", () => {
  it("passes regular-time scores through", () => {
    expect(
      deriveDisplayScore({
        winner: "HOME_TEAM",
        duration: "REGULAR",
        fullTime: { home: 2, away: 0 },
        halfTime: { home: 1, away: 0 },
      }),
    ).toEqual({ home: 2, away: 0 });
  });

  it("passes extra-time scores through (fullTime already = 120' result)", () => {
    expect(
      deriveDisplayScore({
        winner: "AWAY_TEAM",
        duration: "EXTRA_TIME",
        fullTime: { home: 1, away: 2 },
        halfTime: { home: 0, away: 0 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 1 },
      }),
    ).toEqual({ home: 1, away: 2 });
  });

  it("strips shootout conversions: 1-1 won 4-3 on pens reads fullTime 5-4", () => {
    // Real shape observed on the 2025/26 CL final (football-data id 552096)
    expect(
      deriveDisplayScore({
        winner: "HOME_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 5, away: 4 },
        halfTime: { home: 0, away: 1 },
        regularTime: { home: 1, away: 1 },
        extraTime: { home: 0, away: 0 },
        penalties: { home: 4, away: 3 },
      }),
    ).toEqual({ home: 1, away: 1 });
  });

  it("falls back to fullTime minus penalties when regularTime is missing", () => {
    expect(
      deriveDisplayScore({
        winner: "AWAY_TEAM",
        duration: "PENALTY_SHOOTOUT",
        fullTime: { home: 6, away: 7 },
        halfTime: { home: 1, away: 1 },
        penalties: { home: 4, away: 5 },
      }),
    ).toEqual({ home: 2, away: 2 });
  });

  it("returns nulls for unplayed matches", () => {
    expect(
      deriveDisplayScore({
        winner: null,
        duration: "REGULAR",
        fullTime: { home: null, away: null },
        halfTime: { home: null, away: null },
      }),
    ).toEqual({ home: null, away: null });
  });
});
