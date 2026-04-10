import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { calculatePoints } from "../lib/scoring";
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

      for (const pred of toScore) {
        const result = resultMap.get(pred.match_id)!;
        const scoreResult = calculatePoints(
          {
            predictedHome: pred.home_score,
            predictedAway: pred.away_score,
            actualHome: result.homeScore,
            actualAway: result.awayScore,
          },
          result.round ?? "group",
          pred.is_joker,
          isTournament,
        );

        const { error } = await supabase
          .from("yc_predictions")
          .update({
            points: scoreResult.points,
            scored_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", pred.id);

        if (error) {
          console.error(`Failed to score prediction ${pred.id}:`, error.message);
        } else {
          scored++;
          if (scoreResult.tier === "exact") exactScores++;

          // Update streak (correct = points > 0)
          if (user) {
            updateStreak(
              user.id,
              competitionId,
              pred.match_id,
              scoreResult.points > 0,
            ).catch((e) => console.error("Streak update failed:", e));
          }
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
