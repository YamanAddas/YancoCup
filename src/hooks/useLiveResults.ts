import { useMemo } from "react";
import { useScores } from "./useScores";
import { stageToRound } from "./useCompetitionSchedule";

/** A finished/live match result consumed by the scoring engine (now
 *  Worker-authoritative), derived from the live scores feed. */
export interface MatchResult {
  matchId: number;
  homeScore: number;
  awayScore: number;
  status: "finished" | "in_progress" | "scheduled";
  round?: string;
}

/**
 * Converts live scores from the Worker into MatchResult[] for the scoring engine.
 * Maps API statuses to scoring-friendly statuses.
 * matchId is the football-data.org API ID (same as schedule.json and yc_predictions).
 *
 * `comp` must be passed for non-WC competitions, otherwise this reads WC
 * scores and finished non-WC matches never get scored.
 */
export function useLiveResults(comp?: string): { results: MatchResult[]; loading: boolean } {
  const { scoreMap, loading } = useScores(comp);

  const results = useMemo(() => {
    const out: MatchResult[] = [];
    for (const [apiId, score] of scoreMap) {
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
        matchId: apiId,
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        status,
        round: stageToRound(score.stage),
      });
    }
    return out;
  }, [scoreMap]);

  return { results, loading };
}
