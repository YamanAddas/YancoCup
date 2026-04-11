import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement pure badge threshold logic (no Supabase calls)
// The actual functions in badges.ts call supabase to award badges,
// but the threshold logic is what we want to verify.
// ---------------------------------------------------------------------------

// Activity badge thresholds
const ACTIVITY_THRESHOLDS: [string, number][] = [
  ["first_prediction", 1],
  ["ten_predictions", 10],
  ["fifty_predictions", 50],
  ["century_club", 100],
];

function getActivityBadgesEarned(totalPredictions: number): string[] {
  return ACTIVITY_THRESHOLDS
    .filter(([, threshold]) => totalPredictions >= threshold)
    .map(([id]) => id);
}

// Skill badge thresholds
function getSkillBadgesEarned(stats: { exactScores: number; currentStreak: number }): string[] {
  const badges: string[] = [];
  if (stats.exactScores >= 1) badges.push("first_exact");
  if (stats.exactScores >= 5) badges.push("five_exact");
  if (stats.currentStreak >= 3) badges.push("streak_3");
  if (stats.currentStreak >= 5) badges.push("streak_5");
  if (stats.currentStreak >= 10) badges.push("streak_10");
  return badges;
}

// Streak update logic (pure part)
function computeStreakUpdate(
  existing: { current_streak: number; best_streak: number; last_match_id: number | null } | null,
  matchId: number,
  correct: boolean,
): { current_streak: number; best_streak: number; skipped: boolean } {
  // Guard: don't double-increment if same match is scored twice
  if (existing && existing.last_match_id === matchId) {
    return { current_streak: existing.current_streak, best_streak: existing.best_streak, skipped: true };
  }

  const currentStreak = correct ? (existing?.current_streak ?? 0) + 1 : 0;
  const bestStreak = Math.max(currentStreak, existing?.best_streak ?? 0);

  return { current_streak: currentStreak, best_streak: bestStreak, skipped: false };
}

// Night owl badge logic
function isNightOwlHour(hour: number): boolean {
  return hour >= 0 && hour < 5;
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("getActivityBadgesEarned", () => {
  it("returns empty for 0 predictions", () => {
    expect(getActivityBadgesEarned(0)).toEqual([]);
  });

  it("returns first_prediction for 1", () => {
    expect(getActivityBadgesEarned(1)).toEqual(["first_prediction"]);
  });

  it("returns first + ten for 10", () => {
    expect(getActivityBadgesEarned(10)).toEqual(["first_prediction", "ten_predictions"]);
  });

  it("returns first + ten + fifty for 50", () => {
    expect(getActivityBadgesEarned(50)).toEqual(["first_prediction", "ten_predictions", "fifty_predictions"]);
  });

  it("returns all 4 badges for 100+", () => {
    const badges = getActivityBadgesEarned(100);
    expect(badges).toEqual(["first_prediction", "ten_predictions", "fifty_predictions", "century_club"]);
  });

  it("returns all 4 badges for 500", () => {
    expect(getActivityBadgesEarned(500)).toHaveLength(4);
  });

  it("returns correct badges at boundary -1", () => {
    expect(getActivityBadgesEarned(9)).toEqual(["first_prediction"]);
    expect(getActivityBadgesEarned(49)).toEqual(["first_prediction", "ten_predictions"]);
    expect(getActivityBadgesEarned(99)).toEqual(["first_prediction", "ten_predictions", "fifty_predictions"]);
  });
});

describe("getSkillBadgesEarned", () => {
  it("returns empty for no exact scores and no streak", () => {
    expect(getSkillBadgesEarned({ exactScores: 0, currentStreak: 0 })).toEqual([]);
  });

  it("returns first_exact for 1 exact score", () => {
    expect(getSkillBadgesEarned({ exactScores: 1, currentStreak: 0 })).toEqual(["first_exact"]);
  });

  it("returns first_exact + five_exact for 5 exact scores", () => {
    const badges = getSkillBadgesEarned({ exactScores: 5, currentStreak: 0 });
    expect(badges).toEqual(["first_exact", "five_exact"]);
  });

  it("returns streak badges at thresholds", () => {
    expect(getSkillBadgesEarned({ exactScores: 0, currentStreak: 3 })).toEqual(["streak_3"]);
    expect(getSkillBadgesEarned({ exactScores: 0, currentStreak: 5 })).toEqual(["streak_3", "streak_5"]);
    expect(getSkillBadgesEarned({ exactScores: 0, currentStreak: 10 })).toEqual(["streak_3", "streak_5", "streak_10"]);
  });

  it("returns combined exact + streak badges", () => {
    const badges = getSkillBadgesEarned({ exactScores: 5, currentStreak: 10 });
    expect(badges).toEqual(["first_exact", "five_exact", "streak_3", "streak_5", "streak_10"]);
  });

  it("handles boundary -1 correctly", () => {
    expect(getSkillBadgesEarned({ exactScores: 4, currentStreak: 2 })).toEqual(["first_exact"]);
    expect(getSkillBadgesEarned({ exactScores: 0, currentStreak: 4 })).toEqual(["streak_3"]);
    expect(getSkillBadgesEarned({ exactScores: 0, currentStreak: 9 })).toEqual(["streak_3", "streak_5"]);
  });
});

describe("computeStreakUpdate", () => {
  it("starts new streak on first correct prediction", () => {
    const result = computeStreakUpdate(null, 1001, true);
    expect(result.current_streak).toBe(1);
    expect(result.best_streak).toBe(1);
    expect(result.skipped).toBe(false);
  });

  it("starts at 0 on first wrong prediction", () => {
    const result = computeStreakUpdate(null, 1001, false);
    expect(result.current_streak).toBe(0);
    expect(result.best_streak).toBe(0);
    expect(result.skipped).toBe(false);
  });

  it("increments existing streak on correct", () => {
    const existing = { current_streak: 5, best_streak: 7, last_match_id: 1000 };
    const result = computeStreakUpdate(existing, 1001, true);
    expect(result.current_streak).toBe(6);
    expect(result.best_streak).toBe(7); // best unchanged (7 > 6)
  });

  it("resets streak on wrong prediction", () => {
    const existing = { current_streak: 5, best_streak: 7, last_match_id: 1000 };
    const result = computeStreakUpdate(existing, 1001, false);
    expect(result.current_streak).toBe(0);
    expect(result.best_streak).toBe(7); // best preserved
  });

  it("updates best_streak when current exceeds it", () => {
    const existing = { current_streak: 7, best_streak: 7, last_match_id: 1000 };
    const result = computeStreakUpdate(existing, 1001, true);
    expect(result.current_streak).toBe(8);
    expect(result.best_streak).toBe(8);
  });

  it("skips when same match is scored twice", () => {
    const existing = { current_streak: 5, best_streak: 7, last_match_id: 1001 };
    const result = computeStreakUpdate(existing, 1001, true);
    expect(result.skipped).toBe(true);
    expect(result.current_streak).toBe(5); // unchanged
    expect(result.best_streak).toBe(7); // unchanged
  });

  it("skips when same match scored twice even for wrong prediction", () => {
    const existing = { current_streak: 5, best_streak: 7, last_match_id: 1001 };
    const result = computeStreakUpdate(existing, 1001, false);
    expect(result.skipped).toBe(true);
    expect(result.current_streak).toBe(5); // unchanged — not reset
  });
});

describe("isNightOwlHour", () => {
  it("returns true for midnight (0)", () => {
    expect(isNightOwlHour(0)).toBe(true);
  });

  it("returns true for 1-4 AM", () => {
    expect(isNightOwlHour(1)).toBe(true);
    expect(isNightOwlHour(2)).toBe(true);
    expect(isNightOwlHour(3)).toBe(true);
    expect(isNightOwlHour(4)).toBe(true);
  });

  it("returns false for 5 AM onwards", () => {
    expect(isNightOwlHour(5)).toBe(false);
    expect(isNightOwlHour(12)).toBe(false);
    expect(isNightOwlHour(23)).toBe(false);
  });
});
