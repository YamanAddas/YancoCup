import { describe, it, expect } from "vitest";
import groupsData from "../data/groups.json";
import teamsData from "../data/teams.json";

interface Group {
  id: string;
  teams: string[];
}

interface Team {
  id: string;
  group: string;
}

const groups = groupsData as Group[];
const teams = teamsData as Team[];

function getGroups(): Group[] {
  return groups;
}

function getGroup(id: string): Group | undefined {
  return groups.find((g) => g.id === id);
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("getGroups (useGroups logic)", () => {
  it("returns 12 groups (A–L)", () => {
    expect(getGroups()).toHaveLength(12);
  });

  it("each group has a valid id and teams array", () => {
    getGroups().forEach((g) => {
      expect(g.id).toBeTruthy();
      expect(Array.isArray(g.teams)).toBe(true);
      expect(g.teams.length).toBe(4);
    });
  });

  it("group ids are A through L", () => {
    const ids = getGroups().map((g) => g.id).sort();
    expect(ids).toEqual("ABCDEFGHIJKL".split(""));
  });
});

describe("getGroup (useGroup logic)", () => {
  it("finds group A", () => {
    const a = getGroup("A");
    expect(a).toBeDefined();
    expect(a!.teams).toHaveLength(4);
  });

  it("returns undefined for non-existent group", () => {
    expect(getGroup("Z")).toBeUndefined();
  });
});

describe("group ↔ team consistency", () => {
  it("every team in groups.json exists in teams.json", () => {
    const teamIds = new Set(teams.map((t) => t.id));
    groups.forEach((g) => {
      g.teams.forEach((tid) => {
        expect(teamIds.has(tid)).toBe(true);
      });
    });
  });

  it("every team in teams.json appears in its group", () => {
    teams.forEach((t) => {
      const group = getGroup(t.group);
      expect(group).toBeDefined();
      expect(group!.teams).toContain(t.id);
    });
  });

  it("total teams across all groups = 48", () => {
    const total = groups.reduce((sum, g) => sum + g.teams.length, 0);
    expect(total).toBe(48);
  });

  it("no team appears in multiple groups", () => {
    const seen = new Set<string>();
    groups.forEach((g) => {
      g.teams.forEach((tid) => {
        expect(seen.has(tid)).toBe(false);
        seen.add(tid);
      });
    });
  });
});
