import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement the MatchCard score/status logic for testing
// These mirror the logic in src/components/match/MatchCard.tsx lines 131-144
// ---------------------------------------------------------------------------

interface MatchCardInput {
  date: string;
  time: string;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
}

interface LiveScore {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}

function computeEffectiveStatus(
  match: MatchCardInput,
  liveScore: LiveScore | undefined,
  nowMs: number,
): string {
  const rawStatus = liveScore?.status ?? match.status ?? "TIMED";
  const kickoffMs = new Date(`${match.date}T${match.time}:00Z`).getTime();
  if (
    rawStatus !== "FINISHED" &&
    rawStatus !== "IN_PLAY" &&
    rawStatus !== "PAUSED" &&
    nowMs - kickoffMs > 4 * 60 * 60 * 1000
  ) {
    return "FINISHED";
  }
  return rawStatus;
}

function computeScore(
  match: MatchCardInput,
  liveScore: LiveScore | undefined,
): { scoreHome: number | null; scoreAway: number | null; hasScore: boolean } {
  const scoreHome = liveScore?.homeScore ?? match.homeScore ?? null;
  const scoreAway = liveScore?.awayScore ?? match.awayScore ?? null;
  return {
    scoreHome,
    scoreAway,
    hasScore: scoreHome !== null && scoreAway !== null,
  };
}

// ---------------------------------------------------------------------------
// Re-implement UTC date formatting logic (the timezone fix)
// ---------------------------------------------------------------------------

function formatMatchDateUTC(dateStr: string, locale: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ===========================================================================
// TESTS — Effective Status
// ===========================================================================

describe("computeEffectiveStatus", () => {
  const match: MatchCardInput = {
    date: "2026-04-11",
    time: "19:00",
    status: "TIMED",
  };

  it("returns raw status when match is within 4 hours of kickoff", () => {
    const now = new Date("2026-04-11T21:00:00Z").getTime(); // 2h after kickoff
    expect(computeEffectiveStatus(match, undefined, now)).toBe("TIMED");
  });

  it("overrides to FINISHED when >4h past kickoff and status is TIMED", () => {
    const now = new Date("2026-04-12T00:00:00Z").getTime(); // 5h after kickoff
    expect(computeEffectiveStatus(match, undefined, now)).toBe("FINISHED");
  });

  it("overrides to FINISHED when >4h past kickoff and status is SCHEDULED", () => {
    const m = { ...match, status: "SCHEDULED" };
    const now = new Date("2026-04-12T00:00:00Z").getTime();
    expect(computeEffectiveStatus(m, undefined, now)).toBe("FINISHED");
  });

  it("does NOT override when status is already FINISHED", () => {
    const m = { ...match, status: "FINISHED" };
    const now = new Date("2026-04-12T00:00:00Z").getTime();
    expect(computeEffectiveStatus(m, undefined, now)).toBe("FINISHED");
  });

  it("does NOT override when status is IN_PLAY (even if >4h)", () => {
    const m = { ...match, status: "IN_PLAY" };
    const now = new Date("2026-04-12T00:00:00Z").getTime();
    expect(computeEffectiveStatus(m, undefined, now)).toBe("IN_PLAY");
  });

  it("does NOT override when status is PAUSED (even if >4h)", () => {
    const m = { ...match, status: "PAUSED" };
    const now = new Date("2026-04-12T00:00:00Z").getTime();
    expect(computeEffectiveStatus(m, undefined, now)).toBe("PAUSED");
  });

  it("uses liveScore status when available", () => {
    const live: LiveScore = { status: "IN_PLAY", homeScore: 1, awayScore: 0 };
    const now = new Date("2026-04-11T20:00:00Z").getTime();
    expect(computeEffectiveStatus(match, live, now)).toBe("IN_PLAY");
  });

  it("uses liveScore FINISHED status", () => {
    const live: LiveScore = { status: "FINISHED", homeScore: 2, awayScore: 1 };
    const now = new Date("2026-04-11T21:00:00Z").getTime();
    expect(computeEffectiveStatus(match, live, now)).toBe("FINISHED");
  });

  it("does NOT override liveScore FINISHED even if within 4h", () => {
    const live: LiveScore = { status: "FINISHED", homeScore: 2, awayScore: 1 };
    const now = new Date("2026-04-11T20:30:00Z").getTime(); // 1.5h after kickoff
    expect(computeEffectiveStatus(match, live, now)).toBe("FINISHED");
  });
});

// ===========================================================================
// TESTS — Score Fallback Chain
// ===========================================================================

describe("computeScore", () => {
  it("uses liveScore when available", () => {
    const match: MatchCardInput = { date: "2026-04-11", time: "19:00", homeScore: null, awayScore: null };
    const live: LiveScore = { status: "FINISHED", homeScore: 2, awayScore: 1 };
    const { scoreHome, scoreAway, hasScore } = computeScore(match, live);
    expect(scoreHome).toBe(2);
    expect(scoreAway).toBe(1);
    expect(hasScore).toBe(true);
  });

  it("falls back to match.homeScore when liveScore is undefined", () => {
    const match: MatchCardInput = { date: "2026-04-11", time: "19:00", homeScore: 3, awayScore: 0 };
    const { scoreHome, scoreAway, hasScore } = computeScore(match, undefined);
    expect(scoreHome).toBe(3);
    expect(scoreAway).toBe(0);
    expect(hasScore).toBe(true);
  });

  it("falls back to match.homeScore when liveScore.homeScore is null", () => {
    const match: MatchCardInput = { date: "2026-04-11", time: "19:00", homeScore: 2, awayScore: 1 };
    const live: LiveScore = { status: "FINISHED", homeScore: null, awayScore: null };
    const { scoreHome, scoreAway, hasScore } = computeScore(match, live);
    // null ?? 2 = 2 (nullish coalescing falls through)
    expect(scoreHome).toBe(2);
    expect(scoreAway).toBe(1);
    expect(hasScore).toBe(true);
  });

  it("returns null when both sources have null scores", () => {
    const match: MatchCardInput = { date: "2026-04-11", time: "19:00", homeScore: null, awayScore: null };
    const live: LiveScore = { status: "FINISHED", homeScore: null, awayScore: null };
    const { hasScore } = computeScore(match, live);
    expect(hasScore).toBe(false);
  });

  it("returns null when no liveScore and match has no scores", () => {
    const match: MatchCardInput = { date: "2026-04-11", time: "19:00" };
    const { hasScore } = computeScore(match, undefined);
    expect(hasScore).toBe(false);
  });

  it("handles 0-0 score correctly (0 is not null)", () => {
    const match: MatchCardInput = { date: "2026-04-11", time: "19:00" };
    const live: LiveScore = { status: "FINISHED", homeScore: 0, awayScore: 0 };
    const { scoreHome, scoreAway, hasScore } = computeScore(match, live);
    expect(scoreHome).toBe(0);
    expect(scoreAway).toBe(0);
    expect(hasScore).toBe(true);
  });

  it("handles mixed: liveScore has homeScore, match has awayScore", () => {
    // Edge case: shouldn't happen in practice but tests the fallback chain
    const match: MatchCardInput = { date: "2026-04-11", time: "19:00", homeScore: null, awayScore: 3 };
    const live: LiveScore = { status: "IN_PLAY", homeScore: 2, awayScore: null };
    const { scoreHome, scoreAway, hasScore } = computeScore(match, live);
    expect(scoreHome).toBe(2); // from liveScore
    expect(scoreAway).toBe(3); // falls through: null ?? 3
    expect(hasScore).toBe(true);
  });
});

// ===========================================================================
// TESTS — UTC Date Formatting (timezone fix)
// ===========================================================================

describe("formatMatchDateUTC", () => {
  it("formats date in UTC — does not shift day for western timezones", () => {
    // "2026-04-11" at midnight UTC. Without timeZone: "UTC", this would show
    // as April 10 in US timezones (UTC-4 to UTC-8).
    const result = formatMatchDateUTC("2026-04-11", "en-US");
    expect(result).toContain("11"); // day must be 11, not 10
    expect(result).toContain("April");
  });

  it("formats correctly for different dates", () => {
    expect(formatMatchDateUTC("2026-06-11", "en-US")).toContain("11");
    expect(formatMatchDateUTC("2026-06-11", "en-US")).toContain("June");
  });

  it("formats correctly for January 1 (edge case: year boundary)", () => {
    const result = formatMatchDateUTC("2026-01-01", "en-US");
    expect(result).toContain("1");
    expect(result).toContain("January");
    expect(result).toContain("2026");
  });

  it("formats correctly for December 31 (edge case: year boundary)", () => {
    const result = formatMatchDateUTC("2025-12-31", "en-US");
    expect(result).toContain("31");
    expect(result).toContain("December");
    expect(result).toContain("2025");
  });
});

// ===========================================================================
// TESTS — The specific bug scenario: FINISHED match, no score, schedule merge
// ===========================================================================

describe("end-to-end: FINISHED match with null scores from stale-cleanup", () => {
  it("schedule merge provides correct score even when kvScores is broken", () => {
    // Scenario: cron stale-cleanup marked match FINISHED (no score).
    // Schedule has the correct score from full-season fetch.
    const match: MatchCardInput = {
      date: "2026-04-11",
      time: "19:00",
      status: "FINISHED",
      homeScore: 2, // from schedule (full season data)
      awayScore: 1,
    };
    const brokenLive: LiveScore = {
      status: "FINISHED",
      homeScore: null, // broken: stale-cleanup set FINISHED but no score
      awayScore: null,
    };

    const { scoreHome, scoreAway, hasScore } = computeScore(match, brokenLive);
    // null ?? 2 = 2 — falls through to match.homeScore
    expect(scoreHome).toBe(2);
    expect(scoreAway).toBe(1);
    expect(hasScore).toBe(true);
  });

  it("client-side fallback marks stale match as FINISHED, but no score shown", () => {
    // Scenario: both schedule and kvScores have no score (worst case)
    const match: MatchCardInput = {
      date: "2026-04-11",
      time: "19:00",
      status: "TIMED",
      homeScore: null,
      awayScore: null,
    };
    const now = new Date("2026-04-12T00:00:00Z").getTime(); // 5h after kickoff

    const effectiveStatus = computeEffectiveStatus(match, undefined, now);
    expect(effectiveStatus).toBe("FINISHED");

    const { hasScore } = computeScore(match, undefined);
    expect(hasScore).toBe(false);
    // MatchCard would show "FT" without a score — acceptable degraded state
  });
});
