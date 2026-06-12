import { describe, it, expect } from "vitest";
import {
  parseEspnClock,
  espnDay,
  findEspnEventInScoreboard,
  transformEspnSummary,
} from "./espnEnrich";

// Shapes below mirror real ESPN payloads observed for the WC 2026 opener
// (event 760415, MEX 2-0 RSA) during the 2026-06-12 source audit.

const FD_HOME = { id: 769, name: "Mexico" };
const FD_AWAY = { id: 774, name: "South Africa" };

function makeSummary() {
  return {
    header: {
      competitions: [
        {
          competitors: [
            { id: "203", homeAway: "home", team: { id: "203", displayName: "Mexico", abbreviation: "MEX" } },
            { id: "182", homeAway: "away", team: { id: "182", displayName: "South Africa", abbreviation: "RSA" } },
          ],
        },
      ],
    },
    keyEvents: [
      {
        type: { text: "Goal" },
        clock: { displayValue: "9'" },
        team: { id: "203", displayName: "Mexico" },
        scoringPlay: true,
        participants: [
          { athlete: { id: "1", displayName: "Julián Quiñones" } },
          { athlete: { id: "2", displayName: "Érik Lira" } },
        ],
      },
      {
        type: { text: "Goal - Header" },
        clock: { displayValue: "67'" },
        team: { id: "203", displayName: "Mexico" },
        scoringPlay: true,
        participants: [
          { athlete: { id: "3", displayName: "Raúl Jiménez" } },
          { athlete: { id: "4", displayName: "Roberto Alvarado" } },
        ],
      },
      {
        type: { text: "Red Card" },
        clock: { displayValue: "49'" },
        team: { id: "182", displayName: "South Africa" },
        participants: [{ athlete: { id: "5", displayName: "Yaya Sithole" } }],
      },
      {
        type: { text: "Substitution" },
        clock: { displayValue: "56'" },
        team: { id: "182", displayName: "South Africa" },
        participants: [
          { athlete: { id: "6", displayName: "Thalente Mbatha" } },
          { athlete: { id: "7", displayName: "Lyle Foster" } },
        ],
      },
      {
        type: { text: "Red Card" },
        clock: { displayValue: "90'+2'" },
        team: { id: "203", displayName: "Mexico" },
        participants: [{ athlete: { id: "8", displayName: "César Montes" } }],
      },
      // Should be skipped: not goal/card/sub
      { type: { text: "Halftime" }, clock: { displayValue: "45'" } },
      { type: { text: "Kickoff" }, clock: { displayValue: "1'" }, team: { id: "203" } },
    ],
    rosters: [
      {
        homeAway: "home",
        team: { id: "203", displayName: "Mexico" },
        formation: "4-1-4-1",
        roster: [
          { starter: true, jersey: "1", formationPlace: "1", position: { abbreviation: "G" }, athlete: { id: "10", displayName: "Raúl Rangel" } },
          { starter: true, jersey: "5", formationPlace: "4", position: { abbreviation: "D" }, athlete: { id: "11", displayName: "Johan Vásquez" } },
          { starter: false, jersey: "9", position: { abbreviation: "F" }, athlete: { id: "12", displayName: "Bench Guy" } },
        ],
      },
      {
        homeAway: "away",
        team: { id: "182", displayName: "South Africa" },
        formation: "5-3-2",
        roster: [
          { starter: true, jersey: "1", formationPlace: "1", position: { abbreviation: "G" }, athlete: { id: "20", displayName: "Ronwen Williams" } },
        ],
      },
    ],
    boxscore: {
      teams: [
        {
          homeAway: "away",
          team: { id: "182", displayName: "South Africa" },
          statistics: [
            { name: "possessionPct", displayValue: "39.5" },
            { name: "totalShots", displayValue: "3" },
            { name: "shotsOnTarget", displayValue: "2" },
            { name: "redCards", displayValue: "2" },
            { name: "accuratePasses", displayValue: "200" },
            { name: "totalPasses", displayValue: "250" },
          ],
        },
        {
          homeAway: "home",
          team: { id: "203", displayName: "Mexico" },
          statistics: [
            { name: "possessionPct", displayValue: "60.5" },
            { name: "totalShots", displayValue: "16" },
            { name: "shotsOnTarget", displayValue: "4" },
            { name: "wonCorners", displayValue: "3" },
            { name: "accuratePasses", displayValue: "450" },
            { name: "totalPasses", displayValue: "500" },
          ],
        },
      ],
    },
  };
}

describe("parseEspnClock", () => {
  it("parses plain minutes", () => {
    expect(parseEspnClock("9'")).toEqual({ elapsed: 9, extra: null });
  });
  it("parses stoppage time", () => {
    expect(parseEspnClock("45'+4'")).toEqual({ elapsed: 45, extra: 4 });
    expect(parseEspnClock("90' +2'")).toEqual({ elapsed: 90, extra: 2 });
  });
  it("rejects garbage", () => {
    expect(parseEspnClock(undefined)).toBeNull();
    expect(parseEspnClock("HT")).toBeNull();
  });
});

describe("espnDay", () => {
  it("formats and offsets across month boundaries", () => {
    expect(espnDay("2026-06-12T02:00:00Z", 0)).toBe("20260612");
    expect(espnDay("2026-06-12T02:00:00Z", -1)).toBe("20260611");
    expect(espnDay("2026-07-01", -1)).toBe("20260630");
  });
});

describe("findEspnEventInScoreboard", () => {
  const scoreboard = {
    events: [
      {
        id: "760415",
        date: "2026-06-11T19:00Z",
        competitions: [
          {
            competitors: [
              { team: { abbreviation: "MEX", displayName: "Mexico" } },
              { team: { abbreviation: "RSA", displayName: "South Africa" } },
            ],
          },
        ],
      },
      {
        id: "760414",
        date: "2026-06-12T02:00Z",
        competitions: [
          {
            competitors: [
              { team: { abbreviation: "KOR", displayName: "South Korea" } },
              { team: { abbreviation: "CZE", displayName: "Czech Republic" } },
            ],
          },
        ],
      },
    ],
  };

  it("finds by kickoff + both team TLAs", () => {
    const id = findEspnEventInScoreboard(
      scoreboard,
      "2026-06-11T19:00:00Z",
      { id: 769, tla: "MEX", names: ["Mexico"] },
      { id: 774, tla: "RSA", names: ["South Africa"] },
    );
    expect(id).toBe("760415");
  });

  it("matches via TLA when FD and ESPN names diverge (Korea Republic vs South Korea)", () => {
    const id = findEspnEventInScoreboard(
      scoreboard,
      "2026-06-12T02:00:00Z",
      { id: 772, tla: "KOR", names: ["Korea Republic"] },
      { id: 798, tla: "CZE", names: ["Czechia"] },
    );
    expect(id).toBe("760414");
  });

  it("returns null when kickoff matches nothing", () => {
    const id = findEspnEventInScoreboard(
      scoreboard,
      "2026-06-13T19:00:00Z",
      { id: 769, tla: "MEX", names: ["Mexico"] },
      { id: 774, tla: "RSA", names: ["South Africa"] },
    );
    expect(id).toBeNull();
  });
});

describe("transformEspnSummary", () => {
  const result = transformEspnSummary(makeSummary(), FD_HOME, FD_AWAY)!;

  it("produces events with FD team ids and AF type/detail strings", () => {
    expect(result).not.toBeNull();
    const goals = result.events.filter((e) => e.type === "Goal");
    expect(goals).toHaveLength(2);
    expect(goals[0]).toMatchObject({
      time: { elapsed: 9, extra: null },
      team: { id: 769, name: "Mexico" },
      player: { name: "Julián Quiñones" },
      assist: { name: "Érik Lira" },
      detail: "Normal Goal",
    });
    const reds = result.events.filter((e) => e.detail === "Red Card");
    expect(reds).toHaveLength(2);
    expect(reds[1]!.time).toEqual({ elapsed: 90, extra: 2 });
    expect(reds[1]!.team.id).toBe(769);
  });

  it("maps substitutions as assist=in, player=out (frontend renders assist as primary)", () => {
    const subs = result.events.filter((e) => e.type === "subst");
    expect(subs).toHaveLength(1);
    expect(subs[0]!.assist.name).toBe("Thalente Mbatha"); // coming on
    expect(subs[0]!.player.name).toBe("Lyle Foster"); // going off
    expect(subs[0]!.team.id).toBe(774);
  });

  it("skips non-event entries (Halftime, Kickoff)", () => {
    expect(result.events).toHaveLength(5); // 2 goals + 2 reds + 1 sub
  });

  it("builds lineups keyed by FD ids with formation, numbers, positions", () => {
    expect(result.lineups).toHaveLength(2);
    const mex = result.lineups.find((l) => l.team.id === 769)!;
    expect(mex.formation).toBe("4-1-4-1");
    expect(mex.startXI).toHaveLength(2);
    expect(mex.startXI[0]!.player).toMatchObject({ name: "Raúl Rangel", number: 1, pos: "G" });
    expect(mex.substitutes).toHaveLength(1);
    expect(mex.substitutes[0]!.player.name).toBe("Bench Guy");
  });

  it("maps statistics to the frontend's AF type strings for both teams", () => {
    expect(result.statistics).toHaveLength(2);
    const mex = result.statistics.find((s) => s.team.id === 769)!;
    const byType = new Map(mex.statistics.map((s) => [s.type, s.value]));
    expect(byType.get("Ball Possession")).toBe("60.5%");
    expect(byType.get("Total Shots")).toBe(16);
    expect(byType.get("Shots on Goal")).toBe(4);
    expect(byType.get("Shots off Goal")).toBe(12);
    expect(byType.get("Passes %")).toBe("90%");
    const rsa = result.statistics.find((s) => s.team.id === 774)!;
    const rsaByType = new Map(rsa.statistics.map((s) => [s.type, s.value]));
    expect(rsaByType.get("Red Cards")).toBe(2);
  });

  it("returns null for an empty summary", () => {
    expect(transformEspnSummary({}, FD_HOME, FD_AWAY)).toBeNull();
  });

  it("extracts venue and attendance from gameInfo", () => {
    const withInfo = {
      ...makeSummary(),
      gameInfo: { venue: { fullName: "Estadio Banorte" }, attendance: 80824 },
    };
    const r = transformEspnSummary(withInfo, FD_HOME, FD_AWAY)!;
    expect(r.matchInfo).toEqual({ venue: "Estadio Banorte", attendance: 80824 });
    // No gameInfo → null matchInfo, rest unaffected
    expect(result.matchInfo).toBeNull();
  });
});
