import { useEffect, useRef } from "react";
import { useMyPredictions } from "./usePredictions";
import { useLiveResults } from "./useLiveResults";
import { useScoring } from "./useScoring";

/**
 * Auto-scores unscored predictions when the user views a page.
 * Runs once when live results and predictions are both loaded.
 * Returns the predictions refresh function so the caller can use it.
 */
export function useAutoScore() {
  const { predictions, loading: predsLoading, refresh } = useMyPredictions();
  const { results, loading: resultsLoading } = useLiveResults();
  const { scorePredictions } = useScoring();
  const hasRun = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (predsLoading || resultsLoading || hasRun.current) return;
    if (predictions.length === 0 || results.length === 0) return;

    // Check if there are any unscored predictions for finished matches
    const finishedIds = new Set(
      results.filter((r) => r.status === "finished").map((r) => r.matchId),
    );
    const unscored = predictions.filter(
      (p) => p.scored_at === null && finishedIds.has(p.match_id),
    );

    if (unscored.length === 0) return;

    hasRun.current = true;
    scorePredictions(predictions, results).then((count) => {
      if (count > 0 && mountedRef.current) refresh();
    });
  }, [predsLoading, resultsLoading, predictions, results, scorePredictions, refresh]);

  return { predictions, predsLoading, refresh };
}
