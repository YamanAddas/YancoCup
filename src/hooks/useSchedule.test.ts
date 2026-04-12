import { describe, it, expect } from "vitest";
import scheduleData from "../data/schedule.json";

interface Match {
  id: number;
  date: string;
  time: string;
  homeTeam: string | null;
  awayTeam: string | null;
  venueId: string;
  group: string | null;
  round: string;
  matchday: number | null;
}

const matches = scheduleData as Match[];

// Re-implement useSchedule filter logic
interface ScheduleFilters {
  group?: string;
  team?: string;
  date?: string;
  venueId?: string;
  round?: string;
}

function filterSchedule(filters?: ScheduleFilters): Match[] {
  if (!filters) return matches;
  return matches.filter((m) => {
    if (filters.group && m.group !== filters.group) return false;
    if (filters.team && m.homeTeam !== filters.team && m.awayTeam !== filters.team) return false;
    if (filters.date && m.date !== filters.date) return false;
    if (filters.venueId && m.venueId !== filters.venueId) return false;
    if (filters.round && m.round !== filters.round) return false;
    return true;
  });
}

function findMatch(id: number): Match | undefined {
  return matches.find((m) => m.id === id);
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("filterSchedule (useSchedule logic)", () => {
  it("returns all matches when no filters", () => {
    const all = filterSchedule();
    expect(all.length).toBe(matches.length);
    expect(all.length).toBeGreaterThan(0);
  });

  it("filters by group", () => {
    const groupA = filterSchedule({ group: "A" });
    expect(groupA.length).toBeGreaterThan(0);
    groupA.forEach((m) => expect(m.group).toBe("A"));
  });

  it("filters by team (home or away)", () => {
    const mexMatches = filterSchedule({ team: "mex" });
    expect(mexMatches.length).toBeGreaterThan(0);
    mexMatches.forEach((m) => {
      expect(m.homeTeam === "mex" || m.awayTeam === "mex").toBe(true);
    });
  });

  it("filters by date", () => {
    const opening = filterSchedule({ date: "2026-06-11" });
    expect(opening.length).toBeGreaterThan(0);
    opening.forEach((m) => expect(m.date).toBe("2026-06-11"));
  });

  it("filters by venueId", () => {
    const guadalajara = filterSchedule({ venueId: "guadalajara" });
    expect(guadalajara.length).toBeGreaterThan(0);
    guadalajara.forEach((m) => expect(m.venueId).toBe("guadalajara"));
  });

  it("filters by round", () => {
    const groupMatches = filterSchedule({ round: "group" });
    expect(groupMatches.length).toBeGreaterThan(0);
    groupMatches.forEach((m) => expect(m.round).toBe("group"));
  });

  it("combines multiple filters", () => {
    const result = filterSchedule({ group: "A", team: "mex" });
    result.forEach((m) => {
      expect(m.group).toBe("A");
      expect(m.homeTeam === "mex" || m.awayTeam === "mex").toBe(true);
    });
  });

  it("returns empty for impossible filter combination", () => {
    // Mexico is in group A, not group B
    const result = filterSchedule({ group: "B", team: "mex" });
    expect(result).toHaveLength(0);
  });
});

describe("findMatch (useMatch logic)", () => {
  it("finds opening match by id", () => {
    const m = findMatch(537327);
    expect(m).toBeDefined();
    expect(m!.homeTeam).toBe("mex");
    expect(m!.awayTeam).toBe("rsa");
    expect(m!.date).toBe("2026-06-11");
  });

  it("returns undefined for non-existent match", () => {
    expect(findMatch(999999)).toBeUndefined();
  });
});

describe("schedule data integrity", () => {
  it("every group match has both teams assigned", () => {
    const groupMatches = filterSchedule({ round: "group" });
    groupMatches.forEach((m) => {
      expect(m.homeTeam).toBeTruthy();
      expect(m.awayTeam).toBeTruthy();
    });
  });

  it("each group has 6 matches (4 teams, round-robin)", () => {
    const groupIds = "ABCDEFGHIJKL".split("");
    groupIds.forEach((gid) => {
      const gMatches = filterSchedule({ group: gid });
      expect(gMatches).toHaveLength(6);
    });
  });

  it("all match ids are unique", () => {
    const ids = matches.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all dates are valid ISO format", () => {
    matches.forEach((m) => {
      expect(m.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("all times are valid HH:MM format", () => {
    matches.forEach((m) => {
      expect(m.time).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  it("group matches have matchday 1, 2, or 3", () => {
    filterSchedule({ round: "group" }).forEach((m) => {
      expect([1, 2, 3]).toContain(m.matchday);
    });
  });

  it("knockout matches have null group", () => {
    const knockoutRounds = ["round-of-32", "round-of-16", "quarterfinal", "semifinal", "third-place", "final"];
    knockoutRounds.forEach((round) => {
      filterSchedule({ round }).forEach((m) => {
        expect(m.group).toBeNull();
      });
    });
  });
});
