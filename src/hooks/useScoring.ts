import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { calculatePoints } from "../lib/scoring";
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
 */
export function useScoring() {
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
      for (const pred of toScore) {
        const result = resultMap.get(pred.match_id)!;
        const { points } = calculatePoints(
          {
            predictedHome: pred.home_score,
            predictedAway: pred.away_score,
            actualHome: result.homeScore,
            actualAway: result.awayScore,
          },
          result.round ?? "group",
          pred.is_joker,
          true,
        );

        const { error } = await supabase
          .from("yc_predictions")
          .update({
            points,
            scored_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", pred.id);

        if (error) {
          console.error(`Failed to score prediction ${pred.id}:`, error.message);
        } else {
          scored++;
        }
      }

      return scored;
    },
    [],
  );

  return { scorePredictions };
}
