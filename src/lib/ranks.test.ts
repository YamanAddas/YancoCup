import { describe, it, expect } from "vitest";
import { getRank, getRankStars, RANK_TIERS } from "./ranks";

describe("getRank", () => {
  it("0 points → Bronze", () => {
    expect(getRank(0).id).toBe("bronze");
  });

  it("99 points → Bronze", () => {
    expect(getRank(99).id).toBe("bronze");
  });

  it("100 points → Silver", () => {
    expect(getRank(100).id).toBe("silver");
  });

  it("299 points → Silver", () => {
    expect(getRank(299).id).toBe("silver");
  });

  it("300 points → Gold", () => {
    expect(getRank(300).id).toBe("gold");
  });

  it("599 points → Gold", () => {
    expect(getRank(599).id).toBe("gold");
  });

  it("600 points → Platinum", () => {
    expect(getRank(600).id).toBe("platinum");
  });

  it("999 points → Platinum", () => {
    expect(getRank(999).id).toBe("platinum");
  });

  it("1000 points → Diamond", () => {
    expect(getRank(1000).id).toBe("diamond");
  });

  it("5000 points → Diamond", () => {
    expect(getRank(5000).id).toBe("diamond");
  });

  it("negative points → Bronze (fallback)", () => {
    expect(getRank(-10).id).toBe("bronze");
  });
});

describe("getRankStars", () => {
  it("0 points → 0 stars (start of Bronze)", () => {
    expect(getRankStars(0)).toBe(0);
  });

  it("50 points → 2 stars in Bronze (halfway to Silver)", () => {
    // Bronze range: 0-99 (100 pts), progress = 50, stars = floor(50/100 * 5) = 2
    expect(getRankStars(50)).toBe(2);
  });

  it("99 points → 4 stars in Bronze (almost Silver)", () => {
    // progress = 99/100 * 5 = 4.95, floor = 4 (capped at 4)
    expect(getRankStars(99)).toBe(4);
  });

  it("100 points → 0 stars in Silver (just promoted)", () => {
    // Silver range: 100-299 (200 pts), progress = 0
    expect(getRankStars(100)).toBe(0);
  });

  it("200 points → 2 stars in Silver (halfway)", () => {
    // progress = 100/200 * 5 = 2.5, floor = 2
    expect(getRankStars(200)).toBe(2);
  });

  it("1000+ points → 5 stars (max tier, max stars)", () => {
    expect(getRankStars(1000)).toBe(5);
    expect(getRankStars(9999)).toBe(5);
  });
});

describe("RANK_TIERS", () => {
  it("has 5 tiers", () => {
    expect(RANK_TIERS).toHaveLength(5);
  });

  it("is sorted descending by minPoints", () => {
    for (let i = 1; i < RANK_TIERS.length; i++) {
      expect(RANK_TIERS[i - 1]!.minPoints).toBeGreaterThan(RANK_TIERS[i]!.minPoints);
    }
  });

  it("Diamond is the highest tier", () => {
    expect(RANK_TIERS[0]!.id).toBe("diamond");
  });

  it("Bronze has minPoints 0", () => {
    expect(RANK_TIERS[RANK_TIERS.length - 1]!.minPoints).toBe(0);
  });
});
