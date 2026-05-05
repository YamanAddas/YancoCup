import { describe, it, expect } from "vitest";

// Re-implement transformMatch locally since worker/src/index.ts isn't modular
// This tests the transform logic in isolation

interface FDMatch {
  id: number;
  competition: { id: number; code: string; name: string };
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  } | null;
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  } | null;
  score: {
    duration: string;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

const FD_ID_TO_CODE = new Map<number, string>([
  [2000, "WC"],
  [2001, "CL"],
  [2002, "BL1"],
  [2014, "PD"],
  [2015, "FL1"],
  [2019, "SA"],
  [2021, "PL"],
]);

function transformMatch(m: FDMatch) {
  const compCode = FD_ID_TO_CODE.get(m.competition.id) ?? m.competition.code;
  return {
    apiId: m.id,
    competitionCode: compCode,
    utcDate: m.utcDate,
    status: m.status,
    matchday: m.matchday,
    stage: m.stage,
    group: m.group,
    homeTeam: m.homeTeam?.tla ?? null,
    awayTeam: m.awayTeam?.tla ?? null,
    homeTeamId: m.homeTeam?.id ?? null,
    awayTeamId: m.awayTeam?.id ?? null,
    homeCrest: m.homeTeam?.crest ?? null,
    awayCrest: m.awayTeam?.crest ?? null,
    homeTeamName: m.homeTeam?.shortName ?? null,
    awayTeamName: m.awayTeam?.shortName ?? null,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    halfTimeHome: m.score.halfTime.home,
    halfTimeAway: m.score.halfTime.away,
    winner: null,
  };
}

const sampleMatch: FDMatch = {
  id: 12345,
  competition: { id: 2021, code: "PL", name: "Premier League" },
  utcDate: "2026-04-11T14:00:00Z",
  status: "TIMED",
  matchday: 32,
  stage: "REGULAR_SEASON",
  group: null,
  homeTeam: {
    id: 57,
    name: "Arsenal FC",
    shortName: "Arsenal",
    tla: "ARS",
    crest: "https://crests.football-data.org/57.svg",
  },
  awayTeam: {
    id: 1044,
    name: "AFC Bournemouth",
    shortName: "Bournemouth",
    tla: "BOU",
    crest: "https://crests.football-data.org/1044.svg",
  },
  score: {
    duration: "REGULAR",
    fullTime: { home: null, away: null },
    halfTime: { home: null, away: null },
  },
};

describe("transformMatch", () => {
  it("maps basic fields correctly", () => {
    const r = transformMatch(sampleMatch);
    expect(r.apiId).toBe(12345);
    expect(r.competitionCode).toBe("PL");
    expect(r.utcDate).toBe("2026-04-11T14:00:00Z");
    expect(r.status).toBe("TIMED");
    expect(r.matchday).toBe(32);
    expect(r.stage).toBe("REGULAR_SEASON");
    expect(r.group).toBeNull();
  });

  it("maps home team data", () => {
    const r = transformMatch(sampleMatch);
    expect(r.homeTeam).toBe("ARS");
    expect(r.homeTeamId).toBe(57);
    expect(r.homeCrest).toBe("https://crests.football-data.org/57.svg");
    expect(r.homeTeamName).toBe("Arsenal");
  });

  it("maps away team data", () => {
    const r = transformMatch(sampleMatch);
    expect(r.awayTeam).toBe("BOU");
    expect(r.awayTeamId).toBe(1044);
    expect(r.awayCrest).toBe("https://crests.football-data.org/1044.svg");
    expect(r.awayTeamName).toBe("Bournemouth");
  });

  it("handles null teams (TBD knockout matches)", () => {
    const tbdMatch: FDMatch = {
      ...sampleMatch,
      homeTeam: null,
      awayTeam: null,
    };
    const r = transformMatch(tbdMatch);
    expect(r.homeTeam).toBeNull();
    expect(r.awayTeam).toBeNull();
    expect(r.homeTeamId).toBeNull();
    expect(r.awayTeamId).toBeNull();
    expect(r.homeCrest).toBeNull();
    expect(r.awayCrest).toBeNull();
    expect(r.homeTeamName).toBeNull();
    expect(r.awayTeamName).toBeNull();
  });

  it("maps finished match scores", () => {
    const finished: FDMatch = {
      ...sampleMatch,
      status: "FINISHED",
      score: {
        duration: "REGULAR",
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 1, away: 0 },
      },
    };
    const r = transformMatch(finished);
    expect(r.homeScore).toBe(2);
    expect(r.awayScore).toBe(1);
    expect(r.halfTimeHome).toBe(1);
    expect(r.halfTimeAway).toBe(0);
  });

  it("maps timed match scores as null", () => {
    const r = transformMatch(sampleMatch);
    expect(r.homeScore).toBeNull();
    expect(r.awayScore).toBeNull();
    expect(r.halfTimeHome).toBeNull();
    expect(r.halfTimeAway).toBeNull();
  });

  it("maps competition ID via FD_ID_TO_CODE", () => {
    const wcMatch: FDMatch = {
      ...sampleMatch,
      competition: { id: 2000, code: "FIFA", name: "FIFA World Cup" },
    };
    expect(transformMatch(wcMatch).competitionCode).toBe("WC");
  });

  it("falls back to API code for unknown competition", () => {
    const unknownComp: FDMatch = {
      ...sampleMatch,
      competition: { id: 9999, code: "CSL", name: "Chinese Super League" },
    };
    expect(transformMatch(unknownComp).competitionCode).toBe("CSL");
  });

  it("handles 0-0 scores correctly", () => {
    const draw: FDMatch = {
      ...sampleMatch,
      status: "FINISHED",
      score: {
        duration: "REGULAR",
        fullTime: { home: 0, away: 0 },
        halfTime: { home: 0, away: 0 },
      },
    };
    const r = transformMatch(draw);
    expect(r.homeScore).toBe(0);
    expect(r.awayScore).toBe(0);
    expect(r.halfTimeHome).toBe(0);
    expect(r.halfTimeAway).toBe(0);
  });
});
