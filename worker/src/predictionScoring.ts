/**
 * Server-side prediction scoring — pure functions.
 *
 * Ported FAITHFULLY from the frontend src/lib/scoring.ts + the streak logic in
 * src/lib/badges.ts so the Worker (authoritative cron scorer) and any residual
 * client path compute identical points. If you change the frontend scoring,
 * change this too (and vice-versa) — the two must never diverge.
 *
 * Base tiers: exact 10 / correct GD 5 / correct result 3 / wrong 0.
 * Modifiers: joker 2x, knockout-round multiplier (tournaments only).
 * Streak bonus: +3 at a 3-run, +4 at 4, +5 cap at 5+, only on a scoring pick.
 */

export type ScoringTier = "exact" | "goal_difference" | "correct_result" | "wrong";

const KNOCKOUT_MULTIPLIERS: Record<string, number> = {
  group: 1,
  "round-of-32": 1.5,
  "round-of-16": 2,
  quarterfinal: 2.5,
  semifinal: 3,
  "third-place": 2,
  final: 3,
};

export function getKnockoutMultiplier(round: string): number {
  return KNOCKOUT_MULTIPLIERS[round] ?? 1;
}

function resultOf(home: number, away: number): "home" | "draw" | "away" {
  if (home > away) return "home";
  if (home < away) return "away";
  return "draw";
}

export function calculateBasePoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
): { tier: ScoringTier; points: number } {
  if (predHome === actualHome && predAway === actualAway) {
    return { tier: "exact", points: 10 };
  }
  if (predHome - predAway === actualHome - actualAway) {
    return { tier: "goal_difference", points: 5 };
  }
  if (resultOf(predHome, predAway) === resultOf(actualHome, actualAway)) {
    return { tier: "correct_result", points: 3 };
  }
  return { tier: "wrong", points: 0 };
}

/** Exact-score prediction points with joker + knockout multipliers. */
export function calculatePoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
  round = "group",
  isJoker = false,
  isTournament = true,
): { tier: ScoringTier; points: number } {
  const base = calculateBasePoints(predHome, predAway, actualHome, actualAway);
  let multiplier = isTournament ? getKnockoutMultiplier(round) : 1;
  if (isJoker) multiplier *= 2;
  return { tier: base.tier, points: Math.round(base.points * multiplier) };
}

/** Quick-predict (1X2): 2 pts correct result, joker 2x. */
export function calculateQuickPoints(
  pick: "H" | "D" | "A",
  actualHome: number,
  actualAway: number,
  isJoker = false,
): { tier: ScoringTier; points: number } {
  const actual = resultOf(actualHome, actualAway);
  const pickMap = { H: "home", D: "draw", A: "away" } as const;
  const correct = pickMap[pick] === actual;
  const basePoints = correct ? 2 : 0;
  return {
    tier: correct ? "correct_result" : "wrong",
    points: basePoints * (isJoker ? 2 : 1),
  };
}

export function calculateStreakBonus(
  newStreakLength: number,
  predictionPoints: number,
): number {
  if (predictionPoints <= 0) return 0;
  if (newStreakLength < 3) return 0;
  return Math.min(newStreakLength, 5);
}

/**
 * Confidence stake (risk/reward). The user wagers points by confidence level:
 * a correct pick GAINS the stake, a wrong pick LOSES it. Applied as a flat
 * amount AFTER base × multipliers + streak, so it never compounds.
 *   1 Wild Guess → ±0   2 Risky Call → ±2   3 Sure Thing → ±5
 * `correct` = the pick earned base points (tier !== "wrong").
 */
export function confidenceStake(
  confidence: number | null | undefined,
  correct: boolean,
): number {
  const stake = confidence === 3 ? 5 : confidence === 2 ? 2 : 0;
  if (stake === 0) return 0; // avoid -0 for Wild Guess / unset
  return correct ? stake : -stake;
}

/** football-data.org `stage` → scoring round key. Mirrors the frontend
 *  stageToRound in src/hooks/useCompetitionSchedule.ts. */
export function stageToRound(stage: string): string {
  switch (stage) {
    case "LAST_32":
    case "ROUND_OF_32":
      return "round-of-32";
    case "LAST_16":
    case "ROUND_OF_16":
      return "round-of-16";
    case "QUARTER_FINALS":
      return "quarterfinal";
    case "SEMI_FINALS":
      return "semifinal";
    case "THIRD_PLACE":
      return "third-place";
    case "FINAL":
      return "final";
    default:
      // GROUP_STAGE, LEAGUE_STAGE, REGULAR_SEASON, qualifiers/playoffs → 1x
      return "group";
  }
}

export interface StreakState {
  current: number;
  best: number;
  lastMatchId: number | null;
  freezeAvailable: boolean;
  freezeUsedAt: string | null;
}

/**
 * Apply one scored prediction to a streak. Mirrors updateStreak in
 * src/lib/badges.ts: a wrong pick resets to 0 UNLESS a freeze is available and
 * the streak was worth protecting (>=3), in which case the freeze is consumed
 * and the streak held. Re-scoring the same match is a no-op (guard).
 */
export function applyStreakStep(
  s: StreakState,
  matchId: number,
  correct: boolean,
  nowIso: string,
): { next: StreakState; changed: boolean } {
  if (s.lastMatchId === matchId) return { next: s, changed: false };

  let current: number;
  let freezeAvailable = s.freezeAvailable;
  let freezeUsedAt = s.freezeUsedAt;

  if (correct) {
    current = s.current + 1;
  } else if (freezeAvailable && s.current >= 3) {
    current = s.current;
    freezeAvailable = false;
    freezeUsedAt = nowIso;
  } else {
    current = 0;
  }

  const best = Math.max(current, s.best);
  return {
    next: { current, best, lastMatchId: matchId, freezeAvailable, freezeUsedAt },
    changed: true,
  };
}
