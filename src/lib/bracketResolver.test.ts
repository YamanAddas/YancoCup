import { describe, it, expect } from "vitest";
import {
  computeGroupStandings,
  computeKnockoutResults,
  resolveBracketPlaceholder,
  compareStandings,
  type GroupStandings,
  type KnockoutResults,
  type ScoreLike,
} from "./bracketResolver";
import type { Match } from "../types";

function group(
  id: number,
  groupId: string,
  home: string,
  away: string,
  homeScore: number | null = null,
  awayScore: number | null = null,
): Match {
  return {
    id,
    date: "2026-06-15",
    time: "16:00",
    homeTeam: home,
    awayTeam: away,
    venueId: "la",
    group: groupId,
    round: "group",
    matchday: 1,
    status: homeScore != null ? "FINISHED" : "TIMED",
    homeScore,
    awayScore,
  };
}

function knockout(
  id: number,
  round: Match["round"],
  home: string | null,
  away: string | null,
  homeScore: number | null = null,
  awayScore: number | null = null,
): Match {
  return {
    id,
    date: "2026-06-29",
    time: "16:00",
    homeTeam: home,
    awayTeam: away,
    venueId: "la",
    group: null,
    round,
    matchday: null,
    status: homeScore != null ? "FINISHED" : "TIMED",
    homeScore,
    awayScore,
  };
}

describe("compareStandings", () => {
  const base = {
    played: 3,
    won: 0,
    draw: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
  };

  it("sorts by points first", () => {
    const a = { ...base, tla: "a", points: 6 };
    const b = { ...base, tla: "b", points: 9 };
    expect([a, b].sort(compareStandings).map((e) => e.tla)).toEqual(["b", "a"]);
  });

  it("breaks tie by goal difference", () => {
    const a = { ...base, tla: "a", points: 6, goalDiff: 1 };
    const b = { ...base, tla: "b", points: 6, goalDiff: 4 };
    expect([a, b].sort(compareStandings).map((e) => e.tla)).toEqual(["b", "a"]);
  });

  it("breaks tie by goals scored", () => {
    const a = { ...base, tla: "a", points: 6, goalDiff: 2, goalsFor: 5 };
    const b = { ...base, tla: "b", points: 6, goalDiff: 2, goalsFor: 8 };
    expect([a, b].sort(compareStandings).map((e) => e.tla)).toEqual(["b", "a"]);
  });

  it("falls back to TLA for stable order", () => {
    const a = { ...base, tla: "alpha", points: 6 };
    const b = { ...base, tla: "bravo", points: 6 };
    expect([a, b].sort(compareStandings).map((e) => e.tla)).toEqual([
      "alpha",
      "bravo",
    ]);
  });
});

describe("computeGroupStandings", () => {
  const empty = new Map<number, ScoreLike>();

  it("returns empty map when no matches finished", () => {
    const matches = [group(1, "A", "mex", "kor")];
    expect(computeGroupStandings(matches, empty).size).toBe(0);
  });

  it("awards 3-1-0 for win-draw-loss", () => {
    const matches = [
      group(1, "A", "mex", "kor", 2, 1), // mex wins
      group(2, "A", "rsa", "cze", 0, 0), // draw
      group(3, "A", "mex", "rsa", 1, 0), // mex wins
    ];
    const s = computeGroupStandings(matches, empty);
    const a = s.get("A")!;
    const mex = a.find((e) => e.tla === "mex")!;
    expect(mex.points).toBe(6);
    expect(mex.won).toBe(2);
    expect(mex.played).toBe(2);
    const rsa = a.find((e) => e.tla === "rsa")!;
    expect(rsa.points).toBe(1);
    expect(rsa.draw).toBe(1);
    expect(rsa.lost).toBe(1);
  });

  it("computes goal difference correctly", () => {
    const matches = [
      group(1, "A", "mex", "kor", 3, 1),
      group(2, "A", "kor", "mex", 0, 2),
    ];
    const s = computeGroupStandings(matches, empty);
    const a = s.get("A")!;
    const mex = a.find((e) => e.tla === "mex")!;
    expect(mex.goalsFor).toBe(5);
    expect(mex.goalsAgainst).toBe(1);
    expect(mex.goalDiff).toBe(4);
  });

  it("sorts entries best-first per group", () => {
    const matches = [
      group(1, "A", "kor", "rsa", 0, 0), // both 1pt
      group(2, "A", "mex", "cze", 3, 0), // mex 3, cze 0
      group(3, "A", "mex", "kor", 2, 0), // mex 6, kor 1
      group(4, "A", "rsa", "cze", 1, 1), // both 2, cze 1
    ];
    const s = computeGroupStandings(matches, empty);
    const a = s.get("A")!.map((e) => e.tla);
    expect(a[0]).toBe("mex"); // 6 points
  });

  it("prefers live scoreMap over static match scores", () => {
    const matches = [group(1, "A", "mex", "kor", 0, 0)]; // static says 0-0
    const live = new Map<number, ScoreLike>([
      [1, { status: "FINISHED", homeScore: 2, awayScore: 0 }],
    ]);
    const s = computeGroupStandings(matches, live);
    const mex = s.get("A")!.find((e) => e.tla === "mex")!;
    expect(mex.points).toBe(3);
  });

  it("ignores unfinished matches", () => {
    const matches = [group(1, "A", "mex", "kor")]; // no scores
    expect(computeGroupStandings(matches, empty).size).toBe(0);
  });
});

describe("computeKnockoutResults", () => {
  const empty = new Map<number, ScoreLike>();

  it("returns winner/loser by ID", () => {
    const matches = [knockout(101, "round-of-32", "mex", "kor", 2, 1)];
    const r = computeKnockoutResults(matches, empty);
    expect(r.get(101)).toEqual({ winnerTla: "mex", loserTla: "kor" });
  });

  it("ignores group matches", () => {
    const matches = [group(1, "A", "mex", "kor", 1, 0)];
    expect(computeKnockoutResults(matches, empty).size).toBe(0);
  });

  it("skips tied scores", () => {
    const matches = [knockout(101, "round-of-32", "mex", "kor", 1, 1)];
    expect(computeKnockoutResults(matches, empty).size).toBe(0);
  });

  it("skips unfinished matches", () => {
    const matches = [knockout(101, "round-of-32", "mex", "kor")];
    expect(computeKnockoutResults(matches, empty).size).toBe(0);
  });
});

describe("resolveBracketPlaceholder", () => {
  function mkStandings(): GroupStandings {
    const m = new Map();
    m.set("A", [
      { tla: "mex", played: 3, won: 3, draw: 0, lost: 0, goalsFor: 7, goalsAgainst: 1, goalDiff: 6, points: 9 },
      { tla: "kor", played: 3, won: 1, draw: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, goalDiff: 0, points: 4 },
      { tla: "rsa", played: 3, won: 0, draw: 2, lost: 1, goalsFor: 1, goalsAgainst: 3, goalDiff: -2, points: 2 },
      { tla: "cze", played: 3, won: 0, draw: 1, lost: 2, goalsFor: 1, goalsAgainst: 5, goalDiff: -4, points: 1 },
    ]);
    m.set("B", [
      { tla: "can", played: 3, won: 2, draw: 1, lost: 0, goalsFor: 5, goalsAgainst: 1, goalDiff: 4, points: 7 },
      { tla: "sui", played: 3, won: 1, draw: 1, lost: 1, goalsFor: 3, goalsAgainst: 3, goalDiff: 0, points: 4 },
      { tla: "qat", played: 3, won: 1, draw: 0, lost: 2, goalsFor: 3, goalsAgainst: 4, goalDiff: -1, points: 3 },
      { tla: "bih", played: 3, won: 0, draw: 0, lost: 3, goalsFor: 1, goalsAgainst: 4, goalDiff: -3, points: 0 },
    ]);
    return m;
  }

  function mkKoResults(): KnockoutResults {
    const r = new Map();
    r.set(74, { winnerTla: "mex", loserTla: "kor" });
    r.set(102, { winnerTla: "esp", loserTla: "uru" });
    return r;
  }

  it("returns null for null/empty", () => {
    expect(resolveBracketPlaceholder(null, new Map(), new Map())).toBeNull();
    expect(resolveBracketPlaceholder("", new Map(), new Map())).toBeNull();
  });

  it("resolves group winner", () => {
    expect(resolveBracketPlaceholder("1A", mkStandings(), new Map())).toBe("mex");
    expect(resolveBracketPlaceholder("1B", mkStandings(), new Map())).toBe("can");
  });

  it("resolves group runner-up", () => {
    expect(resolveBracketPlaceholder("2A", mkStandings(), new Map())).toBe("kor");
    expect(resolveBracketPlaceholder("2B", mkStandings(), new Map())).toBe("sui");
  });

  it("resolves group third", () => {
    expect(resolveBracketPlaceholder("3A", mkStandings(), new Map())).toBe("rsa");
  });

  it("returns null when group not in standings yet", () => {
    expect(resolveBracketPlaceholder("1Z", mkStandings(), new Map())).toBeNull();
    expect(resolveBracketPlaceholder("1C", mkStandings(), new Map())).toBeNull();
  });

  it("resolves match winners", () => {
    expect(resolveBracketPlaceholder("W74", new Map(), mkKoResults())).toBe("mex");
    expect(resolveBracketPlaceholder("W102", new Map(), mkKoResults())).toBe("esp");
  });

  it("resolves match losers", () => {
    expect(resolveBracketPlaceholder("L74", new Map(), mkKoResults())).toBe("kor");
    expect(resolveBracketPlaceholder("L102", new Map(), mkKoResults())).toBe("uru");
  });

  it("returns null for unknown match id", () => {
    expect(resolveBracketPlaceholder("W999", new Map(), mkKoResults())).toBeNull();
  });

  it("resolves third-place from listed groups (best by points)", () => {
    // 3rd of A is rsa with 2pts; 3rd of B is qat with 3pts → qat wins
    expect(
      resolveBracketPlaceholder("3rd AB", mkStandings(), new Map()),
    ).toBe("qat");
  });

  it("ignores groups whose 3rd hasn't played all 3 matches", () => {
    const partial = mkStandings();
    partial.get("A")![2]!.played = 2; // rsa hasn't finished
    // Only B's qat is eligible
    expect(
      resolveBracketPlaceholder("3rd AB", partial, new Map()),
    ).toBe("qat");
  });

  it("returns null if no group is complete", () => {
    const partial = mkStandings();
    partial.get("A")![2]!.played = 2;
    partial.get("B")![2]!.played = 2;
    expect(
      resolveBracketPlaceholder("3rd AB", partial, new Map()),
    ).toBeNull();
  });

  it("returns null for unrecognized patterns", () => {
    expect(resolveBracketPlaceholder("XYZ", mkStandings(), new Map())).toBeNull();
    expect(resolveBracketPlaceholder("4A", mkStandings(), new Map())).toBeNull();
  });
});
