import { useMemo } from "react";
import { useScores } from "./useScores";
import type { MatchResult } from "./useScoring";

/**
 * Converts live scores from the Worker into MatchResult[] for the scoring engine.
 * Maps API statuses to scoring-friendly statuses.
 */
export function useLiveResults(): { results: MatchResult[]; loading: boolean } {
  const { scoreMap, loading } = useScores();

  const results = useMemo(() => {
    const out: MatchResult[] = [];
    for (const [localId, score] of scoreMap) {
      if (score.homeScore === null || score.awayScore === null) continue;

      let status: MatchResult["status"];
      if (score.status === "FINISHED") {
        status = "finished";
      } else if (score.status === "IN_PLAY" || score.status === "PAUSED") {
        status = "in_progress";
      } else {
        status = "scheduled";
      }

      out.push({
        matchId: localId,
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        status,
      });
    }
    return out;
  }, [scoreMap]);

  return { results, loading };
}
