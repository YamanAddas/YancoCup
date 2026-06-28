import { describe, expect, it } from "vitest";
import schedule from "../data/schedule.json";
import {
  apiStandingsToGroupStandings,
  resolveWorldCupMatches,
} from "./worldCupResolution";
import type { GroupStanding } from "./api";
import type { Match } from "../types";

const wcSchedule = schedule as Match[];

const GROUPS: Record<string, string[]> = {
  A: ["mex", "rsa", "kor", "cze"],
  B: ["sui", "can", "bih", "qat"],
  C: ["bra", "mar", "sco", "hai"],
  D: ["usa", "aus", "par", "tur"],
  E: ["ger", "civ", "ecu", "cuw"],
  F: ["ned", "jpn", "swe", "tun"],
  G: ["bel", "egy", "irn", "nzl"],
  H: ["esp", "cpv", "uru", "ksa"],
  I: ["fra", "nor", "sen", "irq"],
  J: ["arg", "aut", "alg", "jor"],
  K: ["col", "por", "cod", "uzb"],
  L: ["eng", "cro", "gha", "pan"],
};

function mockApiStandings(): GroupStanding[] {
  return Object.entries(GROUPS).map(([group, tlas]) => ({
    group: `Group ${group}`,
    table: tlas.map((tla, index) => ({
      position: index + 1,
      team: {
        id: index + 1,
        tla: tla.toUpperCase(),
        name: tla.toUpperCase(),
        shortName: tla.toUpperCase(),
        crest: "",
      },
      playedGames: 3,
      won: Math.max(0, 3 - index),
      draw: 0,
      lost: index,
      goalsFor: 8 - index,
      goalsAgainst: index,
      goalDifference: 8 - index * 2,
      points: 9 - index * 2,
      form: null,
    })),
  }));
}

describe("resolveWorldCupMatches", () => {
  it("resolves the first Round of 32 match from Worker standings", () => {
    const standings = apiStandingsToGroupStandings(mockApiStandings());
    const result = resolveWorldCupMatches(wcSchedule, new Map(), {
      groupStandings: standings,
      now: new Date("2026-06-28T04:00:00Z").getTime(),
    });

    const firstR32 = result.matches.find((match) => match.fifaNum === 73);
    expect(firstR32?.homeTeam).toBe("rsa");
    expect(firstR32?.awayTeam).toBe("can");
    expect(result.summary.resolvedFutureKnockouts).toBeGreaterThan(0);
  });

  it("resolves every Round of 32 slot once group standings are complete", () => {
    const standings = apiStandingsToGroupStandings(mockApiStandings());
    const result = resolveWorldCupMatches(wcSchedule, new Map(), {
      groupStandings: standings,
      now: new Date("2026-06-28T04:00:00Z").getTime(),
    });

    const r32 = result.matches.filter((match) => match.round === "round-of-32");
    expect(r32).toHaveLength(16);
    expect(r32.every((match) => match.homeTeam && match.awayTeam)).toBe(true);
  });

  it("uses live score team data when the Worker has already filled a fixture", () => {
    const result = resolveWorldCupMatches(
      wcSchedule,
      new Map([
        [
          537423,
          {
            status: "TIMED",
            homeTeam: "BRA",
            awayTeam: "JPN",
            homeScore: null,
            awayScore: null,
          },
        ],
      ]),
    );

    const match = result.matches.find((m) => m.id === 537423);
    expect(match?.homeTeam).toBe("bra");
    expect(match?.awayTeam).toBe("jpn");
  });

  it("chains a finished knockout winner into downstream W-number placeholders", () => {
    const standings = apiStandingsToGroupStandings(mockApiStandings());
    const result = resolveWorldCupMatches(
      wcSchedule,
      new Map([
        [
          537417,
          {
            status: "FINISHED",
            homeScore: 1,
            awayScore: 2,
            winner: "AWAY_TEAM",
          },
        ],
      ]),
      {
        groupStandings: standings,
        now: new Date("2026-07-04T04:00:00Z").getTime(),
      },
    );

    const roundOf16 = result.matches.find((match) => match.fifaNum === 90);
    expect(roundOf16?.homeTeam).toBe("can");
  });
});

