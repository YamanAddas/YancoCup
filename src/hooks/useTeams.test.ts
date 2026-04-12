import { describe, it, expect } from "vitest";
import teamsData from "../data/teams.json";

// ---------------------------------------------------------------------------
// Re-implement hook logic as pure functions (avoids React import in node env)
// ---------------------------------------------------------------------------

interface Team {
  id: string;
  name: string;
  fifaCode: string;
  isoCode: string;
  confederation: string;
  group: string;
}

const teams = teamsData as Team[];

function getTeams(groupId?: string): Team[] {
  return groupId ? teams.filter((t) => t.group === groupId) : teams;
}

function getTeam(id: string): Team | undefined {
  return teams.find((t) => t.id === id);
}

function getTeamMap(): Map<string, Team> {
  return new Map(teams.map((t) => [t.id, t]));
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("getTeams (useTeams logic)", () => {
  it("returns all 48 teams when no group filter", () => {
    const all = getTeams();
    expect(all).toHaveLength(48);
  });

  it("returns 4 teams for group A", () => {
    const groupA = getTeams("A");
    expect(groupA).toHaveLength(4);
    groupA.forEach((t) => expect(t.group).toBe("A"));
  });

  it("returns empty array for non-existent group", () => {
    expect(getTeams("Z")).toHaveLength(0);
  });

  it("each team has required fields", () => {
    const all = getTeams();
    all.forEach((t) => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.fifaCode).toBeTruthy();
      expect(t.isoCode).toBeTruthy();
      expect(t.confederation).toBeTruthy();
      expect(t.group).toBeTruthy();
    });
  });
});

describe("getTeam (useTeam logic)", () => {
  it("finds Mexico by id", () => {
    const mex = getTeam("mex");
    expect(mex).toBeDefined();
    expect(mex!.name).toBe("Mexico");
    expect(mex!.fifaCode).toBe("MEX");
    expect(mex!.isoCode).toBe("mx");
  });

  it("returns undefined for non-existent team", () => {
    expect(getTeam("nonexistent")).toBeUndefined();
  });

  it("all teams in groups A through L", () => {
    const validGroups = new Set("ABCDEFGHIJKL".split(""));
    getTeams().forEach((t) => {
      expect(validGroups.has(t.group)).toBe(true);
    });
  });
});

describe("getTeamMap (useTeamMap logic)", () => {
  it("creates a map with 48 entries", () => {
    const map = getTeamMap();
    expect(map.size).toBe(48);
  });

  it("maps id → team correctly", () => {
    const map = getTeamMap();
    const kor = map.get("kor");
    expect(kor).toBeDefined();
    expect(kor!.name).toBe("South Korea");
  });

  it("every team.id is a unique key", () => {
    const ids = teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
