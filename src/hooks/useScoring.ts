import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { calculatePoints } from "../lib/scoring";
import type { Prediction } from "./usePredictions";

/**
 * Match result from live scores (will come from Cloudflare Worker in Phase 3).
 * For now this interface is ready; scoring triggers when results are available.
 */
export interface MatchResult {
  matchId: number;
  homeScore: number;
  awayScore: number;
  status: "finished" | "in_progress" | "scheduled";
}

/**
 * Score unscored predictions for a given user.
 *
 * Called when user loads the predictions or leaderboard page.
 * Finds predictions where scored_at IS NULL and the match is finished,
 * calculates points, and writes them back to Supabase.
 *
 * Each user scores their own predictions (RLS: update own rows only).
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
        const { points } = calculatePoints({
          predictedHome: pred.home_score,
          predictedAway: pred.away_score,
          actualHome: result.homeScore,
          actualAway: result.awayScore,
        });

        const { error } = await supabase
          .from("yc_predictions")
          .update({
            points,
            scored_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", pred.id);

        if (!error) scored++;
      }

      return scored;
    },
    [],
  );

  return { scorePredictions };
}
