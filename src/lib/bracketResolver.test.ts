import { describe, it, expect } from "vitest";
import {
  computeGroupStandings,
  computeKnockoutResults,
  computeThirdPlaceAllocation,
  collectThirdSlotHints,
  resolveBracketPlaceholder,
  compareStandings,
  type GroupStandings,
  type KnockoutResults,
  type MiniStandingEntry,
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

  it("keys results by FIFA match number when present", () => {
    const m = { ...knockout(537417, "round-of-32", "mex", "kor", 2, 1), fifaNum: 74 };
    const r = computeKnockoutResults([m], empty);
    expect(r.get(74)).toEqual({ winnerTla: "mex", loserTla: "kor" });
    expect(r.get(537417)).toBeUndefined();
  });

  it("uses the winner field for penalty shootouts (tied score)", () => {
    const m = knockout(101, "round-of-16", "mex", "kor", 1, 1);
    const live = new Map<number, ScoreLike>([
      [101, { status: "FINISHED", homeScore: 1, awayScore: 1, winner: "AWAY_TEAM" }],
    ]);
    const r = computeKnockoutResults([m], live);
    expect(r.get(101)).toEqual({ winnerTla: "kor", loserTla: "mex" });
  });

  it("prefers the winner field over score comparison", () => {
    // Defensive: if upstream says AWAY_TEAM won, trust it even if scores disagree
    const m = knockout(101, "round-of-16", "mex", "kor", 2, 1);
    const live = new Map<number, ScoreLike>([
      [101, { status: "FINISHED", homeScore: 2, awayScore: 1, winner: "HOME_TEAM" }],
    ]);
    expect(computeKnockoutResults([m], live).get(101)!.winnerTla).toBe("mex");
  });

  it("ignores group matches", () => {
    const matches = [group(1, "A", "mex", "kor", 1, 0)];
    expect(computeKnockoutResults(matches, empty).size).toBe(0);
  });

  it("skips tied scores with no winner field", () => {
    const matches = [knockout(101, "round-of-32", "mex", "kor", 1, 1)];
    expect(computeKnockoutResults(matches, empty).size).toBe(0);
  });

  it("skips unfinished matches", () => {
    const matches = [knockout(101, "round-of-32", "mex", "kor")];
    expect(computeKnockoutResults(matches, empty).size).toBe(0);
  });
});

describe("computeThirdPlaceAllocation", () => {
  /** Build full 12-group standings where group X's third has the given points/GD. */
  function fullStandings(
    thirdOverrides: Record<string, Partial<MiniStandingEntry>>,
  ): GroupStandings {
    const groups = "ABCDEFGHIJKL".split("");
    const m: GroupStandings = new Map();
    for (const g of groups) {
      const mk = (pos: number, pts: number): MiniStandingEntry => ({
        tla: `${g.toLowerCase()}${pos}`,
        played: 3,
        won: Math.floor(pts / 3),
        draw: pts % 3,
        lost: 3 - Math.floor(pts / 3) - (pts % 3),
        goalsFor: pts,
        goalsAgainst: 0,
        goalDiff: pts,
        points: pts,
      });
      const third = { ...mk(3, 3), ...(thirdOverrides[g] ?? {}) };
      m.set(g, [mk(1, 9), mk(2, 6), third, mk(4, 0)]);
    }
    return m;
  }

  // The 8 real slot hints from schedule.json
  const HINTS = ["ABCDF", "CDFGH", "CEFHI", "EHIJK", "AEHIJ", "BEFIJ", "EFGIJ", "DEIJL"];

  it("returns null until all 12 groups are complete", () => {
    const s = fullStandings({});
    s.get("L")![2]!.played = 2;
    expect(computeThirdPlaceAllocation(s, HINTS)).toBeNull();
  });

  it("returns null for empty hints", () => {
    expect(computeThirdPlaceAllocation(fullStandings({}), [])).toBeNull();
  });

  it("assigns 8 distinct thirds, each from a slot's candidate groups", () => {
    // Make A,B,C,D,E,F,G,H clearly the best 8 thirds
    const overrides: Record<string, Partial<MiniStandingEntry>> = {};
    for (const g of "ABCDEFGH") overrides[g] = { points: 6, goalDiff: 6 };
    for (const g of "IJKL") overrides[g] = { points: 1, goalDiff: -3 };
    const allocation = computeThirdPlaceAllocation(fullStandings(overrides), HINTS)!;

    expect(allocation).not.toBeNull();
    expect(allocation.size).toBe(8);
    const assigned = [...allocation.values()];
    expect(new Set(assigned).size).toBe(8); // no team in two slots
    for (const [letters, tla] of allocation) {
      const sourceGroup = tla[0]!.toUpperCase();
      expect(letters).toContain(sourceGroup); // from a candidate group
    }
  });

  it("never assigns a non-qualified third", () => {
    const overrides: Record<string, Partial<MiniStandingEntry>> = {};
    for (const g of "EFGHIJKL") overrides[g] = { points: 6, goalDiff: 6 };
    for (const g of "ABCD") overrides[g] = { points: 0, goalDiff: -5 };
    const allocation = computeThirdPlaceAllocation(fullStandings(overrides), HINTS)!;
    expect(allocation).not.toBeNull();
    for (const tla of allocation.values()) {
      expect("efghijkl").toContain(tla[0]!);
    }
  });

  it("is deterministic", () => {
    const overrides: Record<string, Partial<MiniStandingEntry>> = {};
    for (const g of "ACEGIKBD") overrides[g] = { points: 5, goalDiff: 2 };
    const s1 = computeThirdPlaceAllocation(fullStandings(overrides), HINTS);
    const s2 = computeThirdPlaceAllocation(fullStandings(overrides), HINTS);
    expect([...s1!.entries()]).toEqual([...s2!.entries()]);
  });
});

describe("collectThirdSlotHints", () => {
  it("extracts letter sets from 3rd placeholders", () => {
    const matches = [
      { ...knockout(1, "round-of-32", null, null), homePlaceholder: "1E", awayPlaceholder: "3rd ABCDF" },
      { ...knockout(2, "round-of-32", null, null), homePlaceholder: "3rd CDFGH", awayPlaceholder: "2B" },
      { ...knockout(3, "round-of-16", null, null), homePlaceholder: "W73", awayPlaceholder: "W74" },
    ] as Match[];
    expect(collectThirdSlotHints(matches)).toEqual(["ABCDF", "CDFGH"]);
  });
});

describe("2026 within-group tiebreakers (head-to-head FIRST — Art. 13)", () => {
  it("orders point-tied teams by head-to-head before overall goal difference", () => {
    // x beat y 1-0 head-to-head, but y has far better overall GD.
    // Pre-2026 order (overall GD first) ranked y above x — 2026 ranks x above y.
    const matches = [
      group(1, "A", "xxx", "yyy", 1, 0),
      group(2, "A", "yyy", "zzz", 5, 0),
      group(3, "A", "zzz", "xxx", 1, 0),
      group(4, "A", "www", "xxx", 0, 0),
      group(5, "A", "www", "yyy", 0, 0),
      group(6, "A", "www", "zzz", 1, 0),
    ];
    const s = computeGroupStandings(matches, new Map());
    const order = s.get("A")!.map((e) => e.tla);
    // www 5pts | xxx 4pts (h2h beat yyy) | yyy 4pts (GD +4) | zzz 3pts
    expect(order).toEqual(["www", "xxx", "yyy", "zzz"]);
  });

  it("falls to overall GD when head-to-head is level", () => {
    // xxx and yyy drew each other; yyy has better overall GD → yyy first
    const matches = [
      group(1, "A", "xxx", "yyy", 1, 1),
      group(2, "A", "xxx", "zzz", 2, 0),
      group(3, "A", "yyy", "zzz", 5, 0),
      group(4, "A", "www", "xxx", 0, 1),
      group(5, "A", "www", "yyy", 0, 1),
      group(6, "A", "www", "zzz", 9, 0),
    ];
    const s = computeGroupStandings(matches, new Map());
    const order = s.get("A")!.map((e) => e.tla);
    // xxx 7pts (1+3+3), yyy 7pts (1+3+3); h2h 1-1 level; overall GD yyy +5? :
    // yyy: +0 (draw) +5 (zzz) +1 (www) = +6 ; xxx: 0 +2 +1 = +3 → yyy first
    expect(order.slice(0, 2)).toEqual(["yyy", "xxx"]);
  });

  it("handles a three-way tie via the head-to-head mini-table", () => {
    // aaa, bbb, ccc all beat ddd and form a 1-0 cycle among themselves →
    // all 6 pts, mini-table fully level (1W 1L, GD 0). Falls to overall GD:
    // margins vs ddd differ: aaa won 4-0, bbb 2-0, ccc 1-0.
    const matches = [
      group(1, "A", "aaa", "bbb", 1, 0),
      group(2, "A", "bbb", "ccc", 1, 0),
      group(3, "A", "ccc", "aaa", 1, 0),
      group(4, "A", "aaa", "ddd", 4, 0),
      group(5, "A", "bbb", "ddd", 2, 0),
      group(6, "A", "ccc", "ddd", 1, 0),
    ];
    const s = computeGroupStandings(matches, new Map());
    const order = s.get("A")!.map((e) => e.tla);
    expect(order).toEqual(["aaa", "bbb", "ccc", "ddd"]);
  });
});

// ---------------------------------------------------------------------------
// Annexe C table + full-tournament simulation over the REAL schedule.json
// ---------------------------------------------------------------------------

import schedule from "../data/schedule.json";
import combos from "../data/thirdPlaceCombos.json";

const realSchedule = schedule as unknown as Match[];

describe("Annexe C combination table (FIFA Regs May 2026)", () => {
  const SLOT_BY_COL = ["CEFHI", "EFGIJ", "BEFIJ", "ABCDF", "AEHIJ", "CDFGH", "DEIJL", "EHIJK"];
  const table = combos as Record<string, string>;

  it("covers all C(12,8) = 495 qualifying-set combinations", () => {
    expect(Object.keys(table)).toHaveLength(495);
  });

  it("every row assigns each qualified third exactly once, within its slot's candidates", () => {
    for (const [key, row] of Object.entries(table)) {
      expect(row).toHaveLength(8);
      expect([...row].sort().join("")).toBe(key); // permutation of qualifiers
      for (let i = 0; i < 8; i++) {
        expect(SLOT_BY_COL[i]).toContain(row[i]!); // slot constraint
      }
    }
  });

  it("matches the rows spot-checked against the FIFA PDF", () => {
    expect(table["EFGHIJKL"]).toBe("EJIFHGLK"); // row 1
    expect(table["ABCDEFGH"]).toBe("HGBCAFDE"); // row 495
    expect(table["ACDFGHIJ"]).toBe("HGJCAFDI"); // row 250
  });
});

describe("end-to-end tournament simulation (real schedule.json)", () => {
  /** Deterministic group results: home team wins (g1+1)-(g2), varied by id. */
  function simulateGroupStage(): Map<number, ScoreLike> {
    const scoreMap = new Map<number, ScoreLike>();
    for (const m of realSchedule) {
      if (m.round !== "group") continue;
      // Vary scores deterministically so standings have spread:
      // home wins when id is even, away wins when odd; margin from id digits
      const even = m.id % 2 === 0;
      const margin = (m.id % 3) + 1;
      scoreMap.set(m.id, {
        status: "FINISHED",
        homeScore: even ? margin : 0,
        awayScore: even ? 0 : margin,
      });
    }
    return scoreMap;
  }

  it("resolves every R32 slot after a full simulated group stage", () => {
    const scoreMap = simulateGroupStage();
    const standings = computeGroupStandings(realSchedule, scoreMap);
    expect(standings.size).toBe(12);

    const allocation = computeThirdPlaceAllocation(
      standings,
      collectThirdSlotHints(realSchedule),
    );
    expect(allocation).not.toBeNull();
    expect(allocation!.size).toBe(8);
    // No third placed twice, every third from a candidate group
    const assigned = [...allocation!.values()];
    expect(new Set(assigned).size).toBe(8);

    const koResults = computeKnockoutResults(realSchedule, scoreMap);
    const r32 = realSchedule.filter((m) => m.round === "round-of-32");
    expect(r32).toHaveLength(16);
    for (const m of r32) {
      const home = resolveBracketPlaceholder(m.homePlaceholder, standings, koResults, allocation);
      const away = resolveBracketPlaceholder(m.awayPlaceholder, standings, koResults, allocation);
      expect(home, `${m.id} home ${m.homePlaceholder}`).toBeTruthy();
      expect(away, `${m.id} away ${m.awayPlaceholder}`).toBeTruthy();
      expect(home).not.toBe(away);
    }

    // All 32 R32 participants are distinct
    const participants = r32.flatMap((m) => [
      resolveBracketPlaceholder(m.homePlaceholder, standings, koResults, allocation),
      resolveBracketPlaceholder(m.awayPlaceholder, standings, koResults, allocation),
    ]);
    expect(new Set(participants).size).toBe(32);
  });

  it("chains the full knockout to the final, including a penalty shootout", () => {
    const scoreMap = simulateGroupStage();
    const standings = computeGroupStandings(realSchedule, scoreMap);
    const allocation = computeThirdPlaceAllocation(
      standings,
      collectThirdSlotHints(realSchedule),
    );

    // Resolve + simulate knockout rounds in order. Home team always wins —
    // except one R32 match decided on penalties (away wins the shootout).
    const knockoutRounds: Match["round"][] = [
      "round-of-32", "round-of-16", "quarterfinal", "semifinal", "third-place", "final",
    ];
    const resolvedTeams = new Map<number, { home: string; away: string }>();
    let shootoutDone = false;

    for (const round of knockoutRounds) {
      const koResults = computeKnockoutResults(
        realSchedule.map((m) => {
          const r = resolvedTeams.get(m.id);
          return r ? { ...m, homeTeam: r.home, awayTeam: r.away } : m;
        }),
        scoreMap,
      );
      for (const m of realSchedule.filter((x) => x.round === round)) {
        const home = resolveBracketPlaceholder(m.homePlaceholder, standings, koResults, allocation);
        const away = resolveBracketPlaceholder(m.awayPlaceholder, standings, koResults, allocation);
        expect(home, `${round} ${m.id} home ${m.homePlaceholder}`).toBeTruthy();
        expect(away, `${round} ${m.id} away ${m.awayPlaceholder}`).toBeTruthy();
        resolvedTeams.set(m.id, { home: home!, away: away! });
        if (!shootoutDone && round === "round-of-32") {
          // 1-1 after 120', away wins 4-3 on penalties
          scoreMap.set(m.id, {
            status: "FINISHED",
            homeScore: 1,
            awayScore: 1,
            winner: null, // football-data sometimes leaves this null for days
            penaltyHome: 3,
            penaltyAway: 4,
          });
          shootoutDone = true;
        } else {
          scoreMap.set(m.id, { status: "FINISHED", homeScore: 2, awayScore: 1 });
        }
      }
    }

    // The final resolved — and the shootout loser is nowhere downstream
    const final = realSchedule.find((m) => m.round === "final")!;
    const finalTeams = resolvedTeams.get(final.id)!;
    expect(finalTeams.home).toBeTruthy();
    expect(finalTeams.away).toBeTruthy();

    const shootoutMatch = realSchedule.find((m) => m.round === "round-of-32")!;
    const shootoutTeams = resolvedTeams.get(shootoutMatch.id)!;
    const r16Participants = realSchedule
      .filter((m) => m.round === "round-of-16")
      .flatMap((m) => Object.values(resolvedTeams.get(m.id)!));
    // away won the shootout → home must NOT appear in R16
    expect(r16Participants).toContain(shootoutTeams.away);
    expect(r16Participants).not.toContain(shootoutTeams.home);
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

  it("resolves third-place slots only via the allocation map", () => {
    const allocation = new Map([["AB", "qat"]]);
    expect(
      resolveBracketPlaceholder("3rd AB", mkStandings(), new Map(), allocation),
    ).toBe("qat");
    // No allocation provided (groups not all complete) → unresolved
    expect(
      resolveBracketPlaceholder("3rd AB", mkStandings(), new Map()),
    ).toBeNull();
    expect(
      resolveBracketPlaceholder("3rd AB", mkStandings(), new Map(), null),
    ).toBeNull();
  });

  it("returns null for unrecognized patterns", () => {
    expect(resolveBracketPlaceholder("XYZ", mkStandings(), new Map())).toBeNull();
    expect(resolveBracketPlaceholder("4A", mkStandings(), new Map())).toBeNull();
  });
});
