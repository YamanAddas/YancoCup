import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  calculatePoints,
  calculateQuickPoints,
  calculateStreakBonus,
} from "../lib/scoring";
import { COMPETITIONS } from "../lib/competitions";
import { updateStreak, checkSkillBadges } from "../lib/badges";
import { useAuth } from "../lib/auth";
import type { Prediction } from "./usePredictions";

/**
 * Match result from live scores (comes from Cloudflare Worker).
 */
export interface MatchResult {
  matchId: number;
  homeScore: number;
  awayScore: number;
  status: "finished" | "in_progress" | "scheduled";
  round?: string;
}

/**
 * Score unscored predictions for a given user.
 *
 * Called when user loads the predictions or leaderboard page.
 * Finds predictions where scored_at IS NULL and the match is finished,
 * calculates points (with joker + knockout multipliers), and writes them back.
 * Also updates streaks and awards skill badges.
 */
export function useScoring(competitionId = "WC") {
  const isTournament = COMPETITIONS[competitionId]?.type === "tournament";
  const { user } = useAuth();

  const scorePredictions = useCallback(
    async (
      predictions: Prediction[],
      results: MatchResult[],
    ): Promise<number> => {
      const resultMap = new Map(
        results
          .filter((r) => r.status === "finished")
          .map((r) => [r.matchId, r]),
      );

      const toScore = predictions.filter(
        (p) => p.scored_at === null && resultMap.has(p.match_id),
      );

      if (toScore.length === 0) return 0;

      let scored = 0;
      let exactScores = 0;

      // Score predictions in chronological order so streak math is monotonic
      // (an earlier match scored later shouldn't retro-extend a later streak).
      const ordered = [...toScore].sort((a, b) => {
        const aRes = resultMap.get(a.match_id);
        const bRes = resultMap.get(b.match_id);
        return (aRes?.matchId ?? 0) - (bRes?.matchId ?? 0);
      });

      for (const pred of ordered) {
        const result = resultMap.get(pred.match_id)!;
        const scoreResult = pred.quick_pick
          ? calculateQuickPoints(
              pred.quick_pick,
              result.homeScore,
              result.awayScore,
              pred.is_joker,
            )
          : calculatePoints(
              {
                predictedHome: pred.home_score!,
                predictedAway: pred.away_score!,
                actualHome: result.homeScore,
                actualAway: result.awayScore,
              },
              result.round ?? "group",
              pred.is_joker,
              isTournament,
            );

        // Streak bonus — must update streak FIRST so we know the new length,
        // then apply the bonus if it's a 3+ run. Anonymous users (no user.id)
        // don't get streak rows; they fall back to base points.
        let streakBonus = 0;
        if (user) {
          try {
            const streakResult = await updateStreak(
              user.id,
              competitionId,
              pred.match_id,
              scoreResult.points > 0,
            );
            streakBonus = calculateStreakBonus(
              streakResult.current_streak,
              scoreResult.points,
            );
          } catch (e) {
            console.error("Streak update failed:", e);
          }
        }

        const totalPoints = scoreResult.points + streakBonus;

        const { error } = await supabase
          .from("yc_predictions")
          .update({
            points: totalPoints,
            streak_bonus: streakBonus,
            scored_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", pred.id)
          .is("scored_at", null);

        if (error) {
          console.error(`Failed to score prediction ${pred.id}:`, error.message);
        } else {
          scored++;
          if (scoreResult.tier === "exact") exactScores++;
        }
      }

      // Check skill badges after all scoring is done
      if (user && scored > 0) {
        // Count total exact scores from all predictions (already scored + newly scored)
        const allExact = predictions.filter(
          (p) => p.scored_at !== null && (p.points ?? 0) >= 10,
        ).length + exactScores;

        checkSkillBadges(user.id, { exactScores: allExact, currentStreak: 0 })
          .catch((e) => console.error("Skill badge check failed:", e));
      }

      return scored;
    },
    [isTournament, user, competitionId],
  );

  return { scorePredictions };
}
