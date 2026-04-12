import { useState, useEffect, useCallback, useRef } from "react";
import { fetchScores } from "../lib/api";
import type { LiveMatchScore, ApiError } from "../lib/api";

/** Live score keyed by API match ID */
export interface LocalLiveScore {
  apiId: number;
  status: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeCrest: string | null;
  awayCrest: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  winner: string | null;
  stage: string;
}

/** Whether any match is currently live */
function hasLiveMatch(scores: LiveMatchScore[]): boolean {
  return scores.some((s) => s.status === "IN_PLAY" || s.status === "PAUSED");
}

/**
 * Polls the Worker for live scores.
 * - Every 60s when a match is live (IN_PLAY or PAUSED)
 * - Every 5 min otherwise
 * - Returns a Map<apiId, LocalLiveScore> for easy lookup
 * - Exposes `error` state so UI can distinguish "no matches" from "API down"
 */
export function useScores(comp?: string) {
  const [scoreMap, setScoreMap] = useState<Map<number, LocalLiveScore>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [hasLive, setHasLive] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const { scores: raw, fetchedAt: ts, error: fetchError } = await fetchScores(comp);

    if (fetchError) {
      setError(fetchError);
      setLoading(false);
      return;
    }

    setError(null);
    setFetchedAt(ts);

    if (raw.length === 0) {
      setScoreMap(new Map());
      setHasLive(false);
      setLoading(false);
      return;
    }

    const map = new Map<number, LocalLiveScore>();
    for (const s of raw) {
      map.set(s.apiId, {
        apiId: s.apiId,
        status: s.status,
        homeTeam: s.homeTeam,
        awayTeam: s.awayTeam,
        homeTeamId: s.homeTeamId ?? null,
        awayTeamId: s.awayTeamId ?? null,
        homeCrest: s.homeCrest ?? null,
        awayCrest: s.awayCrest ?? null,
        homeTeamName: s.homeTeamName ?? null,
        awayTeamName: s.awayTeamName ?? null,
        homeScore: s.homeScore,
        awayScore: s.awayScore,
        halfTimeHome: s.halfTimeHome,
        halfTimeAway: s.halfTimeAway,
        winner: s.winner,
        stage: s.stage,
      });
    }

    setScoreMap(map);
    setHasLive(hasLiveMatch(raw));
    setLoading(false);
  }, [comp]);

  useEffect(() => {
    poll();

    // Adjust interval based on whether matches are live
    function startInterval() {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const ms = hasLive ? 60_000 : 300_000; // 60s live, 5min idle
      intervalRef.current = setInterval(poll, ms);
    }

    startInterval();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, hasLive]);

  return { scoreMap, loading, hasLive, error, fetchedAt };
}
