import { describe, it, expect } from "vitest";
import {
  calculateBasePoints,
  calculatePoints,
  calculateQuickPoints,
  calculateStreakBonus,
  getKnockoutMultiplier,
  stageToRound,
  applyStreakStep,
  type StreakState,
} from "./predictionScoring";

describe("calculateBasePoints", () => {
  it("exact score = 10", () => {
    expect(calculateBasePoints(2, 1, 2, 1)).toEqual({ tier: "exact", points: 10 });
  });
  it("correct goal difference = 5", () => {
    expect(calculateBasePoints(2, 1, 3, 2)).toEqual({ tier: "goal_difference", points: 5 });
  });
  it("correct result only = 3", () => {
    expect(calculateBasePoints(3, 0, 1, 0)).toEqual({ tier: "correct_result", points: 3 });
  });
  it("draw GD match before result fallthrough = 5 (0-0 vs 1-1)", () => {
    expect(calculateBasePoints(0, 0, 1, 1)).toEqual({ tier: "goal_difference", points: 5 });
  });
  it("wrong = 0", () => {
    expect(calculateBasePoints(2, 1, 0, 3)).toEqual({ tier: "wrong", points: 0 });
  });
});

describe("calculatePoints multipliers", () => {
  it("group exact, no joker = 10", () => {
    expect(calculatePoints(2, 1, 2, 1, "group", false, true).points).toBe(10);
  });
  it("joker doubles a group exact = 20", () => {
    expect(calculatePoints(2, 1, 2, 1, "group", true, true).points).toBe(20);
  });
  it("round-of-16 exact = 10 * 2 = 20", () => {
    expect(calculatePoints(2, 1, 2, 1, "round-of-16", false, true).points).toBe(20);
  });
  it("final exact with joker = 10 * 3 * 2 = 60", () => {
    expect(calculatePoints(2, 1, 2, 1, "final", true, true).points).toBe(60);
  });
  it("round-of-32 GD = round(5 * 1.5) = 8", () => {
    expect(calculatePoints(3, 1, 4, 2, "round-of-32", false, true).points).toBe(8);
  });
  it("league mode ignores knockout multiplier", () => {
    expect(calculatePoints(2, 1, 2, 1, "final", false, false).points).toBe(10);
  });
  it("wrong stays 0 regardless of multiplier", () => {
    expect(calculatePoints(2, 0, 0, 2, "final", true, true).points).toBe(0);
  });
});

describe("calculateQuickPoints", () => {
  it("correct result = 2", () => {
    expect(calculateQuickPoints("H", 2, 1).points).toBe(2);
  });
  it("joker doubles = 4", () => {
    expect(calculateQuickPoints("A", 0, 1, true).points).toBe(4);
  });
  it("wrong = 0", () => {
    expect(calculateQuickPoints("D", 2, 1).points).toBe(0);
  });
});

describe("getKnockoutMultiplier / stageToRound", () => {
  it("maps FD stages to rounds", () => {
    expect(stageToRound("GROUP_STAGE")).toBe("group");
    expect(stageToRound("ROUND_OF_32")).toBe("round-of-32");
    expect(stageToRound("LAST_16")).toBe("round-of-16");
    expect(stageToRound("QUARTER_FINALS")).toBe("quarterfinal");
    expect(stageToRound("SEMI_FINALS")).toBe("semifinal");
    expect(stageToRound("THIRD_PLACE")).toBe("third-place");
    expect(stageToRound("FINAL")).toBe("final");
    expect(stageToRound("WHATEVER")).toBe("group");
  });
  it("multipliers", () => {
    expect(getKnockoutMultiplier("group")).toBe(1);
    expect(getKnockoutMultiplier("final")).toBe(3);
    expect(getKnockoutMultiplier("unknown")).toBe(1);
  });
});

describe("calculateStreakBonus", () => {
  it("no bonus below 3", () => {
    expect(calculateStreakBonus(2, 10)).toBe(0);
  });
  it("+3 at 3, +4 at 4, +5 cap at 5 and beyond", () => {
    expect(calculateStreakBonus(3, 10)).toBe(3);
    expect(calculateStreakBonus(4, 10)).toBe(4);
    expect(calculateStreakBonus(5, 10)).toBe(5);
    expect(calculateStreakBonus(9, 10)).toBe(5);
  });
  it("no bonus on a zero-point pick even if streak is long", () => {
    expect(calculateStreakBonus(5, 0)).toBe(0);
  });
});

describe("applyStreakStep", () => {
  const fresh: StreakState = {
    current: 0,
    best: 0,
    lastMatchId: null,
    freezeAvailable: true,
    freezeUsedAt: null,
  };

  it("increments on correct", () => {
    const { next, changed } = applyStreakStep(fresh, 1, true, "T");
    expect(changed).toBe(true);
    expect(next.current).toBe(1);
    expect(next.best).toBe(1);
    expect(next.lastMatchId).toBe(1);
  });

  it("resets to 0 on wrong when streak < 3 (no freeze spent)", () => {
    const s: StreakState = { ...fresh, current: 2, best: 2 };
    const { next } = applyStreakStep(s, 5, false, "T");
    expect(next.current).toBe(0);
    expect(next.freezeAvailable).toBe(true);
    expect(next.best).toBe(2);
  });

  it("consumes freeze to hold a 3+ streak on a wrong pick", () => {
    const s: StreakState = { ...fresh, current: 4, best: 4 };
    const { next } = applyStreakStep(s, 7, false, "NOW");
    expect(next.current).toBe(4);
    expect(next.freezeAvailable).toBe(false);
    expect(next.freezeUsedAt).toBe("NOW");
  });

  it("resets a 3+ streak when no freeze left", () => {
    const s: StreakState = { ...fresh, current: 5, best: 5, freezeAvailable: false };
    const { next } = applyStreakStep(s, 9, false, "T");
    expect(next.current).toBe(0);
    expect(next.best).toBe(5);
  });

  it("is a no-op when the same match is applied twice", () => {
    const s: StreakState = { ...fresh, current: 3, best: 3, lastMatchId: 9 };
    const { next, changed } = applyStreakStep(s, 9, true, "T");
    expect(changed).toBe(false);
    expect(next.current).toBe(3);
  });

  it("sequential run builds then a freeze holds it", () => {
    let s = fresh;
    s = applyStreakStep(s, 1, true, "T").next; // 1
    s = applyStreakStep(s, 2, true, "T").next; // 2
    s = applyStreakStep(s, 3, true, "T").next; // 3
    expect(s.current).toBe(3);
    s = applyStreakStep(s, 4, false, "T").next; // freeze holds at 3
    expect(s.current).toBe(3);
    expect(s.freezeAvailable).toBe(false);
    s = applyStreakStep(s, 5, false, "T").next; // no freeze → reset
    expect(s.current).toBe(0);
    expect(s.best).toBe(3);
  });
});
