/**
 * YancoCup scoring engine — client-side, deterministic.
 *
 * Tiers:
 *   Exact score:          10 pts
 *   Correct GD:            5 pts
 *   Correct winner/draw:   3 pts
 *   Wrong:                 0 pts
 *
 * Bonuses:
 *   Upset bonus:          +3 (lower-ranked team wins and you predicted it)
 *   Perfect group stage:  +15 (all 3 group matches exact for one group)
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
}

function getResult(home: number, away: number): "home" | "draw" | "away" {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

export function calculatePoints(input: ScoreInput): ScoreResult {
  const { predictedHome, predictedAway, actualHome, actualAway } = input;

  // Exact score
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return { tier: "exact", points: 10 };
  }

  // Correct goal difference
  const predictedGD = predictedHome - predictedAway;
  const actualGD = actualHome - actualAway;
  if (predictedGD === actualGD) {
    return { tier: "goal_difference", points: 5 };
  }

  // Correct winner/draw
  const predictedResult = getResult(predictedHome, predictedAway);
  const actualResult = getResult(actualHome, actualAway);
  if (predictedResult === actualResult) {
    return { tier: "correct_result", points: 3 };
  }

  // Wrong
  return { tier: "wrong", points: 0 };
}

/**
 * Upset bonus: awarded when the lower-seeded team wins
 * and the user predicted that team to win.
 * In group stage, Pot 1 teams are higher-ranked (listed as home in MD1).
 * For simplicity, we check if the user predicted the away team to win
 * and the away team actually won (crude upset heuristic).
 * A more accurate version would use FIFA rankings.
 */
export function calculateUpsetBonus(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  isUpset: boolean,
): number {
  if (!isUpset) return 0;
  // User must have predicted the upset winner correctly
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
