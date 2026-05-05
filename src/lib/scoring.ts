/**
 * YancoCup scoring engine — client-side, deterministic.
 *
 * Base tiers:
 *   Exact score:          10 pts
 *   Correct GD:            5 pts
 *   Correct winner/draw:   3 pts
 *   Wrong:                 0 pts
 *
 * Modifiers:
 *   Joker:                2x (one per matchday per competition)
 *   Knockout multiplier:  1.5x-3x by round (tournaments only)
 *   Upset bonus:          +3 (correctly predict underdog win)
 *   Perfect group stage:  +15 (all 3 group matches exact)
 */

export interface ScoreInput {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
}

export type ScoringTier = "exact" | "goal_difference" | "correct_result" | "wrong";

export interface ScoreResult {
  tier: ScoringTier;
  points: number;
  basePoints: number;
  multiplier: number;
  isJoker: boolean;
  /** Streak bonus added on top of (basePoints * multiplier). 0 if no streak. */
  streakBonus?: number;
}

/** Knockout round multipliers for tournaments */
const KNOCKOUT_MULTIPLIERS: Record<string, number> = {
  "group": 1,
  "round-of-32": 1.5,
  "round-of-16": 2,
  "quarterfinal": 2.5,
  "semifinal": 3,
  "third-place": 2,
  "final": 3,
};

/** Get the knockout multiplier for a round */
export function getKnockoutMultiplier(round: string): number {
  return KNOCKOUT_MULTIPLIERS[round] ?? 1;
}

function getResult(home: number, away: number): "home" | "draw" | "away" {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

/** Calculate base points (before multipliers) */
function calculateBasePoints(input: ScoreInput): { tier: ScoringTier; points: number } {
  const { predictedHome, predictedAway, actualHome, actualAway } = input;

  if (predictedHome === actualHome && predictedAway === actualAway) {
    return { tier: "exact", points: 10 };
  }

  const predictedGD = predictedHome - predictedAway;
  const actualGD = actualHome - actualAway;
  if (predictedGD === actualGD) {
    return { tier: "goal_difference", points: 5 };
  }

  const predictedResult = getResult(predictedHome, predictedAway);
  const actualResult = getResult(actualHome, actualAway);
  if (predictedResult === actualResult) {
    return { tier: "correct_result", points: 3 };
  }

  return { tier: "wrong", points: 0 };
}

/**
 * Calculate points with all modifiers applied.
 * @param input - predicted vs actual scores
 * @param round - match round (for knockout multiplier), defaults to "group"
 * @param isJoker - whether this is a joker pick (2x)
 * @param isTournament - whether to apply knockout multipliers
 */
export function calculatePoints(
  input: ScoreInput,
  round = "group",
  isJoker = false,
  isTournament = true,
): ScoreResult {
  const base = calculateBasePoints(input);

  let multiplier = 1;
  if (isTournament) {
    multiplier = getKnockoutMultiplier(round);
  }
  if (isJoker) {
    multiplier *= 2;
  }

  const finalPoints = Math.round(base.points * multiplier);

  return {
    tier: base.tier,
    points: finalPoints,
    basePoints: base.points,
    multiplier,
    isJoker,
  };
}

/**
 * Quick-predict scoring: 2 pts for correct result, 0 for wrong.
 * @param pick - 'H' (home win), 'D' (draw), 'A' (away win)
 * @param actualHome - actual home score
 * @param actualAway - actual away score
 * @param isJoker - whether this is a joker pick (2x)
 */
export function calculateQuickPoints(
  pick: "H" | "D" | "A",
  actualHome: number,
  actualAway: number,
  isJoker = false,
): ScoreResult {
  const actualResult = getResult(actualHome, actualAway);
  const pickMap = { H: "home", D: "draw", A: "away" } as const;
  const correct = pickMap[pick] === actualResult;

  const basePoints = correct ? 2 : 0;
  const multiplier = isJoker ? 2 : 1;

  return {
    tier: correct ? "correct_result" : "wrong",
    points: basePoints * multiplier,
    basePoints,
    multiplier,
    isJoker,
  };
}

/**
 * Upset bonus: awarded when the lower-seeded team wins
 * and the user predicted that team to win.
 */
export function calculateUpsetBonus(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  isUpset: boolean,
): number {
  if (!isUpset) return 0;
  const predictedResult = getResult(predictedHome, predictedAway);
  const actualResult = getResult(actualHome, actualAway);
  if (predictedResult === actualResult && actualResult !== "draw") {
    return 3;
  }
  return 0;
}

/**
 * Perfect group stage bonus: +15 if the user predicted
 * all 3 group matches for a single group with exact scores.
 */
export function checkPerfectGroup(
  groupMatchResults: ScoreResult[],
): number {
  if (groupMatchResults.length !== 3) return 0;
  if (groupMatchResults.every((r) => r.tier === "exact")) return 15;
  return 0;
}

/**
 * Streak bonus: rewards consecutive correct predictions in a competition.
 *
 *   streak length (post-prediction) | bonus
 *   -------------------------------- | -----
 *   1                                | 0
 *   2                                | 0
 *   3                                | +3
 *   4                                | +4
 *   5+                               | +5  (cap)
 *
 * The streak only increments on non-zero predictions; a 0-pt pick resets it
 * (one streak-freeze per competition shields a single break, see updateStreak
 * in lib/badges.ts). This bonus is only awarded when the prediction itself
 * scored ≥ 1 pt — you can't extend a streak with a wrong pick, even if the
 * freeze preserved the count.
 */
export function calculateStreakBonus(
  newStreakLength: number,
  predictionPoints: number,
): number {
  if (predictionPoints <= 0) return 0;
  if (newStreakLength < 3) return 0;
  return Math.min(newStreakLength, 5);
}
