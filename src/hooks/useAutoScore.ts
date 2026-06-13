import { useEffect, useRef } from "react";
import { useMyPredictions } from "./usePredictions";
import { useLiveResults } from "./useLiveResults";
import { WORKER_URL } from "../lib/api";

const RESCORE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Module-level throttle — shared across all hook instances to prevent
// hammering the score endpoint when rapid navigation creates multiple instances.
let lastRunGlobal = 0;
let triggerInProgress = false;

/**
 * Nudges the authoritative Worker scorer when the user views a page that has
 * unscored finished predictions, then refreshes the local view.
 *
 * Scoring is NO LONGER done client-side. The Worker (cron + POST /api/score) is
 * the single writer for points/streaks across ALL users, so a friend's
 * prediction counts whether or not they ever reopen the app. This call just
 * gives the current viewer immediate feedback; the cron catches everything else.
 */
export function useAutoScore(competitionId = "WC") {
  const { predictions, loading: predsLoading, refresh } = useMyPredictions(competitionId);
  const { results, loading: resultsLoading } = useLiveResults(competitionId);
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
    if (triggerInProgress) return;

    // Only nudge if WE can see an unscored finished prediction worth scoring.
    const finishedIds = new Set(
      results.filter((r) => r.status === "finished").map((r) => r.matchId),
    );
    const unscored = predictions.filter(
      (p) => p.scored_at === null && finishedIds.has(p.match_id),
    );
    if (unscored.length === 0) return;

    lastRunGlobal = now;
    triggerInProgress = true;
    // The endpoint awaits the scoring pass, so by the time the fetch resolves
    // the points are written — refresh then to reflect them.
    fetch(`${WORKER_URL}/api/score`, { method: "POST" })
      .then(() => {
        if (mountedRef.current) refresh();
      })
      .catch((err) => console.error("Score trigger failed:", err))
      .finally(() => {
        triggerInProgress = false;
      });
  }, [predsLoading, resultsLoading, predictions, results, refresh]);

  return { predictions, predsLoading, refresh };
}
