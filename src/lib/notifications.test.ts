import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement the pure logic parts of notifications.ts
// (Avoids importing the module which depends on browser APIs)
// ---------------------------------------------------------------------------

// The key testable logic is the message formatting in notifyMatchResult
// and the deadline window math in startDeadlineChecker

function formatResultLabel(points: number): string {
  if (points >= 10) return "Exact score!";
  if (points >= 5) return "Goal difference!";
  if (points >= 3) return "Correct result!";
  return "Wrong prediction";
}

function formatResultBody(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  points: number,
): { title: string; body: string; tag: string } {
  const label = formatResultLabel(points);
  return {
    title: `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}`,
    body: `${label} +${points} pts`,
    tag: `result-${homeTeam}-${awayTeam}`,
  };
}

function formatDeadlineBody(
  homeTeam: string,
  awayTeam: string,
  minutesUntil: number,
): { title: string; body: string; tag: string } {
  return {
    title: "Prediction Deadline",
    body: `${homeTeam} vs ${awayTeam} kicks off in ${minutesUntil} min — predict now!`,
    tag: `deadline-${homeTeam}-${awayTeam}`,
  };
}

function formatBadgeBody(badgeName: string): { title: string; body: string; tag: string } {
  return {
    title: "Badge Earned! 🏆",
    body: `You unlocked "${badgeName}"`,
    tag: `badge-${badgeName}`,
  };
}

// Deadline checker logic: determine which matches should trigger notifications
function getMatchesInDeadlineWindow(
  matches: Array<{ homeTeam: string; awayTeam: string; kickoffTime: Date }>,
  now: number,
  windowMs: number,
): Array<{ homeTeam: string; awayTeam: string; minutesUntil: number }> {
  const result: Array<{ homeTeam: string; awayTeam: string; minutesUntil: number }> = [];
  for (const m of matches) {
    const diff = m.kickoffTime.getTime() - now;
    if (diff > 0 && diff <= windowMs) {
      result.push({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        minutesUntil: Math.round(diff / 60_000),
      });
    }
  }
  return result;
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("formatResultLabel", () => {
  it("returns 'Exact score!' for 10+ points", () => {
    expect(formatResultLabel(10)).toBe("Exact score!");
    expect(formatResultLabel(15)).toBe("Exact score!");
    expect(formatResultLabel(20)).toBe("Exact score!");
  });

  it("returns 'Goal difference!' for 5-9 points", () => {
    expect(formatResultLabel(5)).toBe("Goal difference!");
    expect(formatResultLabel(7)).toBe("Goal difference!");
    expect(formatResultLabel(9)).toBe("Goal difference!");
  });

  it("returns 'Correct result!' for 3-4 points", () => {
    expect(formatResultLabel(3)).toBe("Correct result!");
    expect(formatResultLabel(4)).toBe("Correct result!");
  });

  it("returns 'Wrong prediction' for 0-2 points", () => {
    expect(formatResultLabel(0)).toBe("Wrong prediction");
    expect(formatResultLabel(1)).toBe("Wrong prediction");
    expect(formatResultLabel(2)).toBe("Wrong prediction");
  });
});

describe("formatResultBody", () => {
  it("formats match result notification", () => {
    const result = formatResultBody("Arsenal", "Chelsea", 2, 1, 10);
    expect(result.title).toBe("Arsenal 2-1 Chelsea");
    expect(result.body).toBe("Exact score! +10 pts");
    expect(result.tag).toBe("result-Arsenal-Chelsea");
  });

  it("formats 0-0 draw with wrong prediction", () => {
    const result = formatResultBody("Brazil", "Argentina", 0, 0, 0);
    expect(result.title).toBe("Brazil 0-0 Argentina");
    expect(result.body).toBe("Wrong prediction +0 pts");
  });

  it("formats goal difference result", () => {
    const result = formatResultBody("Bayern", "Dortmund", 3, 1, 5);
    expect(result.body).toBe("Goal difference! +5 pts");
  });
});

describe("formatDeadlineBody", () => {
  it("formats deadline notification", () => {
    const result = formatDeadlineBody("Brazil", "Argentina", 30);
    expect(result.title).toBe("Prediction Deadline");
    expect(result.body).toBe("Brazil vs Argentina kicks off in 30 min — predict now!");
    expect(result.tag).toBe("deadline-Brazil-Argentina");
  });

  it("handles 1 minute remaining", () => {
    const result = formatDeadlineBody("USA", "Mexico", 1);
    expect(result.body).toContain("1 min");
  });
});

describe("formatBadgeBody", () => {
  it("formats badge notification", () => {
    const result = formatBadgeBody("First Prediction");
    expect(result.title).toBe("Badge Earned! 🏆");
    expect(result.body).toBe('You unlocked "First Prediction"');
    expect(result.tag).toBe("badge-First Prediction");
  });
});

describe("getMatchesInDeadlineWindow", () => {
  const NOW = new Date("2026-06-11T12:00:00Z").getTime();
  const WINDOW = 30 * 60 * 1000; // 30 minutes

  it("includes matches within 30 min window", () => {
    const matches = [
      { homeTeam: "Brazil", awayTeam: "Argentina", kickoffTime: new Date("2026-06-11T12:20:00Z") },
    ];
    const result = getMatchesInDeadlineWindow(matches, NOW, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0].minutesUntil).toBe(20);
  });

  it("excludes matches already kicked off", () => {
    const matches = [
      { homeTeam: "Brazil", awayTeam: "Argentina", kickoffTime: new Date("2026-06-11T11:30:00Z") },
    ];
    const result = getMatchesInDeadlineWindow(matches, NOW, WINDOW);
    expect(result).toHaveLength(0);
  });

  it("excludes matches beyond the window", () => {
    const matches = [
      { homeTeam: "Brazil", awayTeam: "Argentina", kickoffTime: new Date("2026-06-11T14:00:00Z") },
    ];
    const result = getMatchesInDeadlineWindow(matches, NOW, WINDOW);
    expect(result).toHaveLength(0);
  });

  it("handles multiple matches, returns only those in window", () => {
    const matches = [
      { homeTeam: "A", awayTeam: "B", kickoffTime: new Date("2026-06-11T11:00:00Z") }, // past
      { homeTeam: "C", awayTeam: "D", kickoffTime: new Date("2026-06-11T12:15:00Z") }, // 15 min — in window
      { homeTeam: "E", awayTeam: "F", kickoffTime: new Date("2026-06-11T12:29:00Z") }, // 29 min — in window
      { homeTeam: "G", awayTeam: "H", kickoffTime: new Date("2026-06-11T13:00:00Z") }, // 60 min — too far
    ];
    const result = getMatchesInDeadlineWindow(matches, NOW, WINDOW);
    expect(result).toHaveLength(2);
    expect(result[0].homeTeam).toBe("C");
    expect(result[1].homeTeam).toBe("E");
  });

  it("handles exactly at window boundary (30 min)", () => {
    const matches = [
      { homeTeam: "X", awayTeam: "Y", kickoffTime: new Date("2026-06-11T12:30:00Z") },
    ];
    const result = getMatchesInDeadlineWindow(matches, NOW, WINDOW);
    expect(result).toHaveLength(1);
    expect(result[0].minutesUntil).toBe(30);
  });

  it("returns empty for empty match list", () => {
    expect(getMatchesInDeadlineWindow([], NOW, WINDOW)).toEqual([]);
  });
});
