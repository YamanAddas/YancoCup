import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement the merge/backfill logic from worker/src/index.ts for testing
// ---------------------------------------------------------------------------

interface MatchScore {
  apiId: number;
  competitionCode: string;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeCrest: string | null;
  awayCrest: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  winner: string | null;
}

function makeMatch(overrides: Partial<MatchScore> & { apiId: number }): MatchScore {
  return {
    competitionCode: "PD",
    utcDate: "2026-04-11T19:00:00Z",
    status: "TIMED",
    matchday: 31,
    stage: "REGULAR_SEASON",
    group: null,
    homeTeam: "SEV",
    awayTeam: "ATL",
    homeTeamId: 559,
    awayTeamId: 78,
    homeCrest: null,
    awayCrest: null,
    homeTeamName: "Sevilla",
    awayTeamName: "Atlético",
    homeScore: null,
    awayScore: null,
    halfTimeHome: null,
    halfTimeAway: null,
    winner: null,
    ...overrides,
  };
}

// ── Merge logic: overlays kvScores data onto kvSchedule data ──
// (from /api/:comp/matches endpoint)

function mergeScheduleWithScores(
  schedule: MatchScore[],
  scores: MatchScore[],
): MatchScore[] {
  const freshMap = new Map(scores.map((s) => [s.apiId, s]));
  return schedule.map((m) => {
    const fresh = freshMap.get(m.apiId);
    if (!fresh) return m;
    // Live match — always prefer kvScores (most current)
    if (fresh.status === "IN_PLAY" || fresh.status === "PAUSED") return fresh;
    // kvScores has a real score the schedule doesn't — use it
    if (fresh.homeScore !== null && m.homeScore === null) return fresh;
    // kvScores says FINISHED but has no score (stale-status cleanup artifact)
    // — prefer schedule data which may have the actual score or original status
    if (fresh.status === "FINISHED" && fresh.homeScore === null) return m;
    // kvScores has FINISHED with score, schedule doesn't — use kvScores
    if (fresh.status === "FINISHED" && m.status !== "FINISHED") return fresh;
    return m;
  });
}

// ── Backfill logic: fixes broken entries in kvScores from schedule data ──

function backfillScores(
  scoreArr: MatchScore[],
  scheduleArr: MatchScore[],
): { fixed: boolean; result: MatchScore[] } {
  const schedMap = new Map(scheduleArr.map((m) => [m.apiId, m]));
  let fixed = false;
  for (const s of scoreArr) {
    if (s.status === "FINISHED" && s.homeScore === null) {
      const fresh = schedMap.get(s.apiId);
      if (fresh && fresh.homeScore !== null) {
        s.homeScore = fresh.homeScore;
        s.awayScore = fresh.awayScore;
        s.winner = fresh.winner;
        s.halfTimeHome = fresh.halfTimeHome;
        s.halfTimeAway = fresh.halfTimeAway;
        fixed = true;
      }
    }
  }
  return { fixed, result: scoreArr };
}

// ── Stale-status cleanup logic ──

function staleStatusCleanup(
  matches: MatchScore[],
  nowMs: number,
  staleMs: number = 4 * 60 * 60 * 1000,
): { changed: boolean; result: MatchScore[] } {
  let changed = false;
  for (const m of matches) {
    if (m.status === "FINISHED") continue;
    const kickoff = new Date(m.utcDate).getTime();
    if (nowMs - kickoff > staleMs) {
      m.status = "FINISHED";
      changed = true;
    }
  }
  return { changed, result: matches };
}

// ── Cron merge logic: merges today's scores with existing KV data ──

function cronMerge(existing: MatchScore[], todayScores: MatchScore[]): MatchScore[] {
  const todayIds = new Set(todayScores.map((s) => s.apiId));
  const kept = existing.filter((p) => !todayIds.has(p.apiId));
  return [...kept, ...todayScores];
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("mergeScheduleWithScores", () => {
  it("returns schedule data when no scores exist", () => {
    const schedule = [makeMatch({ apiId: 1 }), makeMatch({ apiId: 2 })];
    const result = mergeScheduleWithScores(schedule, []);
    expect(result).toEqual(schedule);
  });

  it("prefers live match from kvScores over schedule", () => {
    const schedule = [makeMatch({ apiId: 1, status: "TIMED" })];
    const scores = [makeMatch({ apiId: 1, status: "IN_PLAY", homeScore: 1, awayScore: 0 })];
    const result = mergeScheduleWithScores(schedule, scores);
    expect(result[0].status).toBe("IN_PLAY");
    expect(result[0].homeScore).toBe(1);
  });

  it("prefers PAUSED match from kvScores", () => {
    const schedule = [makeMatch({ apiId: 1, status: "TIMED" })];
    const scores = [makeMatch({ apiId: 1, status: "PAUSED", homeScore: 2, awayScore: 1 })];
    const result = mergeScheduleWithScores(schedule, scores);
    expect(result[0].status).toBe("PAUSED");
    expect(result[0].homeScore).toBe(2);
  });

  it("prefers kvScores when it has a score the schedule doesn't", () => {
    const schedule = [makeMatch({ apiId: 1, status: "TIMED", homeScore: null })];
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 2, awayScore: 1 })];
    const result = mergeScheduleWithScores(schedule, scores);
    expect(result[0].homeScore).toBe(2);
    expect(result[0].awayScore).toBe(1);
    expect(result[0].status).toBe("FINISHED");
  });

  it("prefers schedule when kvScores has FINISHED but no score (broken entry)", () => {
    const schedule = [makeMatch({ apiId: 1, status: "TIMED", homeScore: null })];
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: null })];
    const result = mergeScheduleWithScores(schedule, scores);
    // Schedule entry preserved (TIMED) — more informative than broken FINISHED
    expect(result[0].status).toBe("TIMED");
  });

  it("prefers schedule when it has score but kvScores has broken FINISHED", () => {
    const schedule = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 2, awayScore: 1 })];
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: null })];
    const result = mergeScheduleWithScores(schedule, scores);
    expect(result[0].homeScore).toBe(2);
    expect(result[0].awayScore).toBe(1);
  });

  it("handles 0-0 scores correctly (not treated as null)", () => {
    const schedule = [makeMatch({ apiId: 1, status: "TIMED" })];
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 0, awayScore: 0 })];
    const result = mergeScheduleWithScores(schedule, scores);
    expect(result[0].homeScore).toBe(0);
    expect(result[0].awayScore).toBe(0);
  });

  it("does not replace schedule match that has no kvScores entry", () => {
    const schedule = [
      makeMatch({ apiId: 1, status: "FINISHED", homeScore: 3, awayScore: 0 }),
      makeMatch({ apiId: 2, status: "TIMED" }),
    ];
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 3, awayScore: 0 })];
    const result = mergeScheduleWithScores(schedule, scores);
    expect(result).toHaveLength(2);
    expect(result[1].apiId).toBe(2);
    expect(result[1].status).toBe("TIMED");
  });

  it("handles FINISHED kvScores with score overriding non-FINISHED schedule", () => {
    const schedule = [makeMatch({ apiId: 1, status: "SCHEDULED" })];
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 1, awayScore: 1 })];
    const result = mergeScheduleWithScores(schedule, scores);
    expect(result[0].status).toBe("FINISHED");
    expect(result[0].homeScore).toBe(1);
  });

  it("keeps schedule entry when both have same FINISHED status with same scores", () => {
    const schedule = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 2, awayScore: 0 })];
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 2, awayScore: 0 })];
    const result = mergeScheduleWithScores(schedule, scores);
    expect(result[0].homeScore).toBe(2);
  });
});

describe("backfillScores", () => {
  it("fixes FINISHED match with null scores from schedule data", () => {
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: null })];
    const schedule = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 2, awayScore: 1, winner: "HOME_TEAM" })];
    const { fixed, result } = backfillScores(scores, schedule);
    expect(fixed).toBe(true);
    expect(result[0].homeScore).toBe(2);
    expect(result[0].awayScore).toBe(1);
    expect(result[0].winner).toBe("HOME_TEAM");
  });

  it("does not touch FINISHED match that already has scores", () => {
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 3, awayScore: 0 })];
    const schedule = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 3, awayScore: 0 })];
    const { fixed } = backfillScores(scores, schedule);
    expect(fixed).toBe(false);
  });

  it("does not touch TIMED match with null scores", () => {
    const scores = [makeMatch({ apiId: 1, status: "TIMED", homeScore: null })];
    const schedule = [makeMatch({ apiId: 1, status: "TIMED", homeScore: null })];
    const { fixed } = backfillScores(scores, schedule);
    expect(fixed).toBe(false);
  });

  it("does not backfill if schedule also has null scores", () => {
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: null })];
    const schedule = [makeMatch({ apiId: 1, status: "TIMED", homeScore: null })];
    const { fixed } = backfillScores(scores, schedule);
    expect(fixed).toBe(false);
  });

  it("backfills half-time scores and winner too", () => {
    const scores = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: null })];
    const schedule = [makeMatch({
      apiId: 1, status: "FINISHED",
      homeScore: 2, awayScore: 1,
      halfTimeHome: 1, halfTimeAway: 0,
      winner: "HOME_TEAM",
    })];
    const { result } = backfillScores(scores, schedule);
    expect(result[0].halfTimeHome).toBe(1);
    expect(result[0].halfTimeAway).toBe(0);
    expect(result[0].winner).toBe("HOME_TEAM");
  });

  it("handles multiple broken entries", () => {
    const scores = [
      makeMatch({ apiId: 1, status: "FINISHED", homeScore: null }),
      makeMatch({ apiId: 2, status: "FINISHED", homeScore: null }),
      makeMatch({ apiId: 3, status: "FINISHED", homeScore: 1, awayScore: 0 }),
    ];
    const schedule = [
      makeMatch({ apiId: 1, status: "FINISHED", homeScore: 2, awayScore: 1 }),
      makeMatch({ apiId: 2, status: "FINISHED", homeScore: 0, awayScore: 0 }),
      makeMatch({ apiId: 3, status: "FINISHED", homeScore: 1, awayScore: 0 }),
    ];
    const { fixed, result } = backfillScores(scores, schedule);
    expect(fixed).toBe(true);
    expect(result[0].homeScore).toBe(2);
    expect(result[1].homeScore).toBe(0);
    expect(result[1].awayScore).toBe(0);
    expect(result[2].homeScore).toBe(1); // unchanged
  });
});

describe("staleStatusCleanup", () => {
  it("marks stale match as FINISHED after 4 hours", () => {
    const kickoff = "2026-04-11T14:00:00Z";
    const now = new Date(kickoff).getTime() + 5 * 60 * 60 * 1000; // 5h later
    const matches = [makeMatch({ apiId: 1, status: "TIMED", utcDate: kickoff })];
    const { changed, result } = staleStatusCleanup(matches, now);
    expect(changed).toBe(true);
    expect(result[0].status).toBe("FINISHED");
  });

  it("does not mark match within 4 hours as FINISHED", () => {
    const kickoff = "2026-04-11T14:00:00Z";
    const now = new Date(kickoff).getTime() + 3 * 60 * 60 * 1000; // 3h later
    const matches = [makeMatch({ apiId: 1, status: "TIMED", utcDate: kickoff })];
    const { changed } = staleStatusCleanup(matches, now);
    expect(changed).toBe(false);
  });

  it("does not touch already FINISHED matches", () => {
    const kickoff = "2026-04-11T14:00:00Z";
    const now = new Date(kickoff).getTime() + 24 * 60 * 60 * 1000;
    const matches = [makeMatch({ apiId: 1, status: "FINISHED", utcDate: kickoff, homeScore: 2, awayScore: 1 })];
    const { changed, result } = staleStatusCleanup(matches, now);
    expect(changed).toBe(false);
    expect(result[0].homeScore).toBe(2); // score preserved
  });

  it("marks IN_PLAY as FINISHED if stale", () => {
    const kickoff = "2026-04-11T14:00:00Z";
    const now = new Date(kickoff).getTime() + 5 * 60 * 60 * 1000;
    const matches = [makeMatch({ apiId: 1, status: "IN_PLAY", utcDate: kickoff })];
    const { changed, result } = staleStatusCleanup(matches, now);
    expect(changed).toBe(true);
    expect(result[0].status).toBe("FINISHED");
  });

  it("marks PAUSED as FINISHED if stale", () => {
    const kickoff = "2026-04-11T14:00:00Z";
    const now = new Date(kickoff).getTime() + 5 * 60 * 60 * 1000;
    const matches = [makeMatch({ apiId: 1, status: "PAUSED", utcDate: kickoff })];
    const { changed, result } = staleStatusCleanup(matches, now);
    expect(changed).toBe(true);
    expect(result[0].status).toBe("FINISHED");
  });

  it("marks SCHEDULED as FINISHED if stale", () => {
    const kickoff = "2026-04-11T14:00:00Z";
    const now = new Date(kickoff).getTime() + 5 * 60 * 60 * 1000;
    const matches = [makeMatch({ apiId: 1, status: "SCHEDULED", utcDate: kickoff })];
    const { changed, result } = staleStatusCleanup(matches, now);
    expect(changed).toBe(true);
    expect(result[0].status).toBe("FINISHED");
  });

  it("does not modify scores during cleanup (scores stay null)", () => {
    const kickoff = "2026-04-11T14:00:00Z";
    const now = new Date(kickoff).getTime() + 5 * 60 * 60 * 1000;
    const matches = [makeMatch({ apiId: 1, status: "TIMED", utcDate: kickoff })];
    const { result } = staleStatusCleanup(matches, now);
    expect(result[0].homeScore).toBeNull();
    expect(result[0].awayScore).toBeNull();
  });

  it("handles multiple matches with different states", () => {
    const kickoff = "2026-04-11T14:00:00Z";
    const now = new Date(kickoff).getTime() + 5 * 60 * 60 * 1000;
    const matches = [
      makeMatch({ apiId: 1, status: "FINISHED", utcDate: kickoff }),
      makeMatch({ apiId: 2, status: "TIMED", utcDate: kickoff }),
      makeMatch({ apiId: 3, status: "TIMED", utcDate: "2026-04-12T14:00:00Z" }), // future
    ];
    const { changed, result } = staleStatusCleanup(matches, now);
    expect(changed).toBe(true);
    expect(result[0].status).toBe("FINISHED"); // unchanged
    expect(result[1].status).toBe("FINISHED"); // cleaned up
    expect(result[2].status).toBe("TIMED"); // future, not stale
  });
});

describe("cronMerge", () => {
  it("merges today's scores with existing data", () => {
    const existing = [
      makeMatch({ apiId: 1, status: "FINISHED", homeScore: 2, awayScore: 0 }),
      makeMatch({ apiId: 2, status: "TIMED" }),
    ];
    const today = [makeMatch({ apiId: 2, status: "IN_PLAY", homeScore: 1, awayScore: 0 })];
    const merged = cronMerge(existing, today);
    expect(merged).toHaveLength(2);
    expect(merged.find((m) => m.apiId === 1)?.status).toBe("FINISHED");
    expect(merged.find((m) => m.apiId === 2)?.status).toBe("IN_PLAY");
  });

  it("preserves old matches not in today's data", () => {
    const existing = [
      makeMatch({ apiId: 1, status: "FINISHED", homeScore: 3, awayScore: 1 }),
      makeMatch({ apiId: 2, status: "FINISHED", homeScore: 0, awayScore: 0 }),
    ];
    const today: MatchScore[] = []; // no matches today
    const merged = cronMerge(existing, today);
    expect(merged).toHaveLength(2);
    expect(merged[0].homeScore).toBe(3);
    expect(merged[1].homeScore).toBe(0);
  });

  it("replaces existing entry when today's data has the same match", () => {
    const existing = [makeMatch({ apiId: 1, status: "TIMED", homeScore: null })];
    const today = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 2, awayScore: 1 })];
    const merged = cronMerge(existing, today);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("FINISHED");
    expect(merged[0].homeScore).toBe(2);
  });

  it("adds new matches not in existing data", () => {
    const existing = [makeMatch({ apiId: 1, status: "FINISHED", homeScore: 1, awayScore: 0 })];
    const today = [makeMatch({ apiId: 3, status: "TIMED" })];
    const merged = cronMerge(existing, today);
    expect(merged).toHaveLength(2);
  });
});
