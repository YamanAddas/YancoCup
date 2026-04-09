import { useState, useEffect, useCallback, useRef } from "react";
import { fetchScores } from "../lib/api";
import type { LiveMatchScore } from "../lib/api";

/** Live score keyed by API match ID */
export interface LocalLiveScore {
  apiId: number;
  status: string;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  winner: string | null;
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
 */
export function useScores() {
  const [scoreMap, setScoreMap] = useState<Map<number, LocalLiveScore>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [hasLive, setHasLive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const raw = await fetchScores();
    if (raw.length === 0) {
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
        homeScore: s.homeScore,
        awayScore: s.awayScore,
        halfTimeHome: s.halfTimeHome,
        halfTimeAway: s.halfTimeAway,
        winner: s.winner,
      });
    }

    setScoreMap(map);
    setHasLive(hasLiveMatch(raw));
    setLoading(false);
  }, []);

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

  return { scoreMap, loading, hasLive };
}
