import { useEffect, useRef } from "react";
import { useMyPredictions } from "./usePredictions";
import { useLiveResults } from "./useLiveResults";
import { useScoring } from "./useScoring";

const RESCORE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level throttle — shared across all hook instances to prevent
// double-scoring when rapid navigation creates multiple instances (#40)
let lastRunGlobal = 0;
let scoringInProgress = false;

/**
 * Auto-scores unscored predictions when the user views a page.
 * Re-runs if >5 minutes have passed since the last scoring attempt.
 */
export function useAutoScore(competitionId = "WC") {
  const { predictions, loading: predsLoading, refresh } = useMyPredictions(competitionId);
  const { results, loading: resultsLoading } = useLiveResults();
  const { scorePredictions } = useScoring(competitionId);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (predsLoading || resultsLoading) return;
    if (predictions.length === 0 || results.length === 0) return;

    const now = Date.now();
    if (now - lastRunGlobal < RESCORE_INTERVAL_MS) return;
    if (scoringInProgress) return;

    // Check if there are any unscored predictions for finished matches
    const finishedIds = new Set(
      results.filter((r) => r.status === "finished").map((r) => r.matchId),
    );
    const unscored = predictions.filter(
      (p) => p.scored_at === null && finishedIds.has(p.match_id),
    );

    if (unscored.length === 0) return;

    lastRunGlobal = now;
    scoringInProgress = true;
    scorePredictions(predictions, results)
      .then((count) => {
        if (count > 0 && mountedRef.current) refresh();
      })
      .catch((err) => console.error("Auto-scoring failed:", err))
      .finally(() => { scoringInProgress = false; });
  }, [predsLoading, resultsLoading, predictions, results, scorePredictions, refresh]);

  return { predictions, predsLoading, refresh };
}
