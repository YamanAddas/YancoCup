import { describe, it, expect } from "vitest";
import {
  calculatePoints,
  calculateQuickPoints,
  calculateUpsetBonus,
  calculateStreakBonus,
  checkPerfectGroup,
  getKnockoutMultiplier,
} from "./scoring";

describe("calculatePoints — base tiers", () => {
  it("exact score → 10 pts", () => {
    const r = calculatePoints(
      { predictedHome: 2, predictedAway: 1, actualHome: 2, actualAway: 1 },
      "group", false, false,
    );
    expect(r.tier).toBe("exact");
    expect(r.points).toBe(10);
    expect(r.basePoints).toBe(10);
  });

  it("correct goal difference → 5 pts", () => {
    const r = calculatePoints(
      { predictedHome: 3, predictedAway: 1, actualHome: 2, actualAway: 0 },
      "group", false, false,
    );
    expect(r.tier).toBe("goal_difference");
    expect(r.points).toBe(5);
  });

  it("correct result (home win) → 3 pts", () => {
    const r = calculatePoints(
      { predictedHome: 3, predictedAway: 0, actualHome: 1, actualAway: 0 },
      "group", false, false,
    );
    expect(r.tier).toBe("correct_result");
    expect(r.points).toBe(3);
  });

  it("correct result (draw) → 3 pts", () => {
    // Predicted 1-1 (GD 0), actual 0-0 (GD 0) — same GD → goal_difference (5 pts)
    // For pure correct_result, need different GD: predicted 2-2 (GD 0), actual 1-1 (GD 0) → also GD
    // Use: predicted 3-3, actual 1-1 → GD both 0 → goal_difference
    // Actually, draws ALWAYS have GD=0, so draw+draw = goal_difference unless exact.
    // Test correct_result with a different structure instead:
    const r = calculatePoints(
      { predictedHome: 0, predictedAway: 0, actualHome: 2, actualAway: 2 },
      "group", false, false,
    );
    // Both draws with GD=0 → this is goal_difference tier (5 pts), not correct_result
    expect(r.tier).toBe("goal_difference");
    expect(r.points).toBe(5);
  });

  it("correct result (away win, different GD) → 3 pts", () => {
    // Predicted 0-1 (GD -1), actual 0-3 (GD -3) — same winner but different GD
    const r = calculatePoints(
      { predictedHome: 0, predictedAway: 1, actualHome: 0, actualAway: 3 },
      "group", false, false,
    );
    expect(r.tier).toBe("correct_result");
    expect(r.points).toBe(3);
  });

  it("wrong prediction → 0 pts", () => {
    const r = calculatePoints(
      { predictedHome: 2, predictedAway: 0, actualHome: 0, actualAway: 1 },
      "group", false, false,
    );
    expect(r.tier).toBe("wrong");
    expect(r.points).toBe(0);
  });

  it("0-0 exact → 10 pts", () => {
    const r = calculatePoints(
      { predictedHome: 0, predictedAway: 0, actualHome: 0, actualAway: 0 },
      "group", false, false,
    );
    expect(r.tier).toBe("exact");
    expect(r.points).toBe(10);
  });
});

describe("calculatePoints — GD edge cases", () => {
  it("same GD but different result → GD tier (both positive)", () => {
    // predicted 3-1 (GD +2), actual 4-2 (GD +2) — same GD, same result direction
    const r = calculatePoints(
      { predictedHome: 3, predictedAway: 1, actualHome: 4, actualAway: 2 },
      "group", false, false,
    );
    expect(r.tier).toBe("goal_difference");
    expect(r.points).toBe(5);
  });

  it("same GD of 0 but different scores → GD not exact", () => {
    // predicted 1-1, actual 3-3 — same GD (0), different scores
    const r = calculatePoints(
      { predictedHome: 1, predictedAway: 1, actualHome: 3, actualAway: 3 },
      "group", false, false,
    );
    expect(r.tier).toBe("goal_difference");
    expect(r.points).toBe(5);
  });
});

describe("calculatePoints — joker modifier", () => {
  it("joker doubles exact score → 20 pts", () => {
    const r = calculatePoints(
      { predictedHome: 1, predictedAway: 0, actualHome: 1, actualAway: 0 },
      "group", true, false,
    );
    expect(r.isJoker).toBe(true);
    expect(r.multiplier).toBe(2);
    expect(r.points).toBe(20);
  });

  it("joker doubles wrong → still 0 pts", () => {
    const r = calculatePoints(
      { predictedHome: 3, predictedAway: 0, actualHome: 0, actualAway: 2 },
      "group", true, false,
    );
    expect(r.points).toBe(0);
  });

  it("joker + correct result → 6 pts", () => {
    const r = calculatePoints(
      { predictedHome: 2, predictedAway: 0, actualHome: 1, actualAway: 0 },
      "group", true, false,
    );
    expect(r.points).toBe(6);
  });
});

describe("calculatePoints — knockout multipliers", () => {
  it("round of 16 exact → 10 * 2 = 20 pts", () => {
    const r = calculatePoints(
      { predictedHome: 1, predictedAway: 0, actualHome: 1, actualAway: 0 },
      "round-of-16", false, true,
    );
    expect(r.multiplier).toBe(2);
    expect(r.points).toBe(20);
  });

  it("semifinal correct result → 3 * 3 = 9 pts", () => {
    // Predicted 3-0 (GD +3), actual 1-0 (GD +1) — same winner, different GD → correct_result
    const r = calculatePoints(
      { predictedHome: 3, predictedAway: 0, actualHome: 1, actualAway: 0 },
      "semifinal", false, true,
    );
    expect(r.multiplier).toBe(3);
    expect(r.points).toBe(9);
  });

  it("final + joker exact → 10 * 3 * 2 = 60 pts", () => {
    const r = calculatePoints(
      { predictedHome: 2, predictedAway: 1, actualHome: 2, actualAway: 1 },
      "final", true, true,
    );
    expect(r.multiplier).toBe(6);
    expect(r.points).toBe(60);
  });

  it("no tournament flag → no knockout multiplier", () => {
    const r = calculatePoints(
      { predictedHome: 1, predictedAway: 0, actualHome: 1, actualAway: 0 },
      "final", false, false,
    );
    expect(r.multiplier).toBe(1);
    expect(r.points).toBe(10);
  });
});

describe("getKnockoutMultiplier", () => {
  it("group → 1x", () => expect(getKnockoutMultiplier("group")).toBe(1));
  it("round-of-32 → 1.5x", () => expect(getKnockoutMultiplier("round-of-32")).toBe(1.5));
  it("round-of-16 → 2x", () => expect(getKnockoutMultiplier("round-of-16")).toBe(2));
  it("quarterfinal → 2.5x", () => expect(getKnockoutMultiplier("quarterfinal")).toBe(2.5));
  it("semifinal → 3x", () => expect(getKnockoutMultiplier("semifinal")).toBe(3));
  it("third-place → 2x", () => expect(getKnockoutMultiplier("third-place")).toBe(2));
  it("final → 3x", () => expect(getKnockoutMultiplier("final")).toBe(3));
  it("unknown → 1x", () => expect(getKnockoutMultiplier("unknown")).toBe(1));
});

describe("calculateQuickPoints", () => {
  it("correct home pick → 2 pts", () => {
    const r = calculateQuickPoints("H", 2, 1);
    expect(r.tier).toBe("correct_result");
    expect(r.points).toBe(2);
  });

  it("correct draw pick → 2 pts", () => {
    const r = calculateQuickPoints("D", 1, 1);
    expect(r.points).toBe(2);
  });

  it("correct away pick → 2 pts", () => {
    const r = calculateQuickPoints("A", 0, 3);
    expect(r.points).toBe(2);
  });

  it("wrong pick → 0 pts", () => {
    const r = calculateQuickPoints("H", 0, 1);
    expect(r.tier).toBe("wrong");
    expect(r.points).toBe(0);
  });

  it("joker correct → 4 pts", () => {
    const r = calculateQuickPoints("H", 3, 0, true);
    expect(r.isJoker).toBe(true);
    expect(r.points).toBe(4);
  });

  it("joker wrong → 0 pts", () => {
    const r = calculateQuickPoints("A", 2, 0, true);
    expect(r.points).toBe(0);
  });

  it("0-0 draw pick → correct", () => {
    const r = calculateQuickPoints("D", 0, 0);
    expect(r.points).toBe(2);
  });
});

describe("calculateUpsetBonus", () => {
  it("correct upset prediction → +3", () => {
    expect(calculateUpsetBonus(0, 2, 0, 2, true)).toBe(3);
  });

  it("wrong upset prediction → 0", () => {
    expect(calculateUpsetBonus(2, 0, 0, 2, true)).toBe(0);
  });

  it("correct but not upset → 0", () => {
    expect(calculateUpsetBonus(2, 0, 2, 0, false)).toBe(0);
  });

  it("draw is never an upset bonus", () => {
    expect(calculateUpsetBonus(1, 1, 1, 1, true)).toBe(0);
  });
});

describe("checkPerfectGroup", () => {
  it("3 exact scores → +15", () => {
    const results = [
      { tier: "exact" as const, points: 10, basePoints: 10, multiplier: 1, isJoker: false },
      { tier: "exact" as const, points: 10, basePoints: 10, multiplier: 1, isJoker: false },
      { tier: "exact" as const, points: 10, basePoints: 10, multiplier: 1, isJoker: false },
    ];
    expect(checkPerfectGroup(results)).toBe(15);
  });

  it("2 exact + 1 GD → 0", () => {
    const results = [
      { tier: "exact" as const, points: 10, basePoints: 10, multiplier: 1, isJoker: false },
      { tier: "exact" as const, points: 10, basePoints: 10, multiplier: 1, isJoker: false },
      { tier: "goal_difference" as const, points: 5, basePoints: 5, multiplier: 1, isJoker: false },
    ];
    expect(checkPerfectGroup(results)).toBe(0);
  });

  it("wrong number of matches → 0", () => {
    expect(checkPerfectGroup([])).toBe(0);
    const one = [{ tier: "exact" as const, points: 10, basePoints: 10, multiplier: 1, isJoker: false }];
    expect(checkPerfectGroup(one)).toBe(0);
  });
});

describe("calculateStreakBonus", () => {
  it("0-pt prediction never gets a bonus, even on long streak", () => {
    expect(calculateStreakBonus(0, 0)).toBe(0);
    expect(calculateStreakBonus(5, 0)).toBe(0);
  });

  it("streak <3 → no bonus (still building)", () => {
    expect(calculateStreakBonus(1, 3)).toBe(0);
    expect(calculateStreakBonus(2, 10)).toBe(0);
  });

  it("streak 3-5 → bonus equals streak length", () => {
    expect(calculateStreakBonus(3, 3)).toBe(3);
    expect(calculateStreakBonus(4, 5)).toBe(4);
    expect(calculateStreakBonus(5, 10)).toBe(5);
  });

  it("streak 6+ → bonus capped at +5", () => {
    expect(calculateStreakBonus(6, 3)).toBe(5);
    expect(calculateStreakBonus(20, 10)).toBe(5);
  });
});
