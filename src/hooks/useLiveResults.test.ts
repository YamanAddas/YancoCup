import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement the status mapping and result building from useLiveResults.ts
// ---------------------------------------------------------------------------

interface LiveScore {
  apiId: number;
  status: string;
  stage: string;
  homeScore: number | null;
  awayScore: number | null;
}

interface MatchResult {
  matchId: number;
  homeScore: number;
  awayScore: number;
  status: "finished" | "in_progress" | "scheduled";
  round?: string;
}

// Copied from useCompetitionSchedule.ts
function stageToRound(stage: string): string {
  const s = stage.toUpperCase();
  if (s.includes("GROUP") || s.includes("LEAGUE_STAGE") || s === "REGULAR_SEASON") return "group";
  if (s.includes("PLAYOFF") || s.includes("QUALIFICATION") || s.includes("PRELIMINARY") || s === "ROUND_OF_16_PLAY_OFFS") return "playoff";
  if (s === "LAST_32" || s === "ROUND_OF_32") return "round-of-32";
  if (s === "LAST_16" || s === "ROUND_OF_16") return "round-of-16";
  if (s === "QUARTER_FINALS") return "quarterfinal";
  if (s === "SEMI_FINALS") return "semifinal";
  if (s === "THIRD_PLACE") return "third-place";
  if (s === "FINAL") return "final";
  return "group";
}

function buildResults(scoreMap: Map<number, LiveScore>): MatchResult[] {
  const out: MatchResult[] = [];
  for (const [apiId, score] of scoreMap) {
    if (score.homeScore === null || score.awayScore === null) continue;

    let status: MatchResult["status"];
    if (score.status === "FINISHED") {
      status = "finished";
    } else if (score.status === "IN_PLAY" || score.status === "PAUSED") {
      status = "in_progress";
    } else {
      status = "scheduled";
    }

    out.push({
      matchId: apiId,
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      status,
      round: stageToRound(score.stage),
    });
  }
  return out;
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("buildResults (useLiveResults logic)", () => {
  it("returns empty for empty scoreMap", () => {
    expect(buildResults(new Map())).toEqual([]);
  });

  it("skips entries with null scores", () => {
    const map = new Map<number, LiveScore>([
      [1, { apiId: 1, status: "TIMED", stage: "GROUP_STAGE", homeScore: null, awayScore: null }],
      [2, { apiId: 2, status: "FINISHED", stage: "GROUP_STAGE", homeScore: 2, awayScore: 1 }],
    ]);
    const results = buildResults(map);
    expect(results).toHaveLength(1);
    expect(results[0].matchId).toBe(2);
  });

  it("maps FINISHED → finished", () => {
    const map = new Map<number, LiveScore>([
      [1, { apiId: 1, status: "FINISHED", stage: "GROUP_STAGE", homeScore: 3, awayScore: 0 }],
    ]);
    expect(buildResults(map)[0].status).toBe("finished");
  });

  it("maps IN_PLAY → in_progress", () => {
    const map = new Map<number, LiveScore>([
      [1, { apiId: 1, status: "IN_PLAY", stage: "QUARTER_FINALS", homeScore: 1, awayScore: 1 }],
    ]);
    const r = buildResults(map)[0];
    expect(r.status).toBe("in_progress");
    expect(r.round).toBe("quarterfinal");
  });

  it("maps PAUSED → in_progress", () => {
    const map = new Map<number, LiveScore>([
      [1, { apiId: 1, status: "PAUSED", stage: "SEMI_FINALS", homeScore: 0, awayScore: 0 }],
    ]);
    expect(buildResults(map)[0].status).toBe("in_progress");
  });

  it("maps TIMED → scheduled", () => {
    const map = new Map<number, LiveScore>([
      [1, { apiId: 1, status: "TIMED", stage: "FINAL", homeScore: 0, awayScore: 0 }],
    ]);
    const r = buildResults(map)[0];
    expect(r.status).toBe("scheduled");
    expect(r.round).toBe("final");
  });

  it("maps other statuses to scheduled", () => {
    for (const status of ["POSTPONED", "CANCELLED", "SUSPENDED", "AWARDED"]) {
      const map = new Map<number, LiveScore>([
        [1, { apiId: 1, status, stage: "GROUP_STAGE", homeScore: 0, awayScore: 0 }],
      ]);
      expect(buildResults(map)[0].status).toBe("scheduled");
    }
  });

  it("preserves scores correctly", () => {
    const map = new Map<number, LiveScore>([
      [42, { apiId: 42, status: "FINISHED", stage: "ROUND_OF_16", homeScore: 4, awayScore: 2 }],
    ]);
    const r = buildResults(map)[0];
    expect(r.matchId).toBe(42);
    expect(r.homeScore).toBe(4);
    expect(r.awayScore).toBe(2);
    expect(r.round).toBe("round-of-16");
  });

  it("handles 0-0 scores (not null)", () => {
    const map = new Map<number, LiveScore>([
      [1, { apiId: 1, status: "FINISHED", stage: "GROUP_STAGE", homeScore: 0, awayScore: 0 }],
    ]);
    const results = buildResults(map);
    expect(results).toHaveLength(1);
    expect(results[0].homeScore).toBe(0);
    expect(results[0].awayScore).toBe(0);
  });

  it("processes multiple matches", () => {
    const map = new Map<number, LiveScore>([
      [1, { apiId: 1, status: "FINISHED", stage: "GROUP_STAGE", homeScore: 2, awayScore: 1 }],
      [2, { apiId: 2, status: "IN_PLAY", stage: "GROUP_STAGE", homeScore: 0, awayScore: 0 }],
      [3, { apiId: 3, status: "TIMED", stage: "GROUP_STAGE", homeScore: null, awayScore: null }],
    ]);
    const results = buildResults(map);
    expect(results).toHaveLength(2); // match 3 skipped (null scores)
    expect(results[0].status).toBe("finished");
    expect(results[1].status).toBe("in_progress");
  });
});
