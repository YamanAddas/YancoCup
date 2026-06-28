import { useEffect, useMemo, useState } from "react";
import { fetchStandings, type GroupStanding } from "../lib/api";
import {
  apiStandingsToGroupStandings,
  resolveWorldCupMatches,
  storedStandingsToGroupStandings,
  type WorldCupResolutionSummary,
} from "../lib/worldCupResolution";
import { useScores } from "./useScores";
import type { Match } from "../types";
import fallbackStandings from "../data/worldcup-final-standings.json";

const EMPTY_SUMMARY: WorldCupResolutionSummary = {
  standingsSource: "none",
  thirdAllocationReady: false,
  futureKnockouts: 0,
  resolvedFutureKnockouts: 0,
  unresolvedFutureKnockouts: 0,
};

export function useResolvedWorldCupMatches(
  baseMatches: Match[],
  competitionId: string,
): {
  matches: Match[];
  scoreMap: ReturnType<typeof useScores>["scoreMap"];
  scoresLoading: boolean;
  standingsLoading: boolean;
  summary: WorldCupResolutionSummary;
  fetchedAt: string | null;
} {
  const { scoreMap, loading: scoresLoading, fetchedAt } = useScores(competitionId);
  const [apiStandings, setApiStandings] = useState<GroupStanding[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(competitionId === "WC");

  useEffect(() => {
    if (competitionId !== "WC") {
      setApiStandings([]);
      setStandingsLoading(false);
      return;
    }

    let cancelled = false;
    setStandingsLoading(true);
    fetchStandings("WC")
      .then((standings) => {
        if (!cancelled) setApiStandings(standings);
      })
      .catch((err) => {
        console.error("Failed to fetch WC standings for knockout resolution:", err);
        if (!cancelled) setApiStandings([]);
      })
      .finally(() => {
        if (!cancelled) setStandingsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  const resolved = useMemo(() => {
    if (competitionId !== "WC") {
      return {
        matches: baseMatches,
        summary: EMPTY_SUMMARY,
      };
    }

    const liveGroupStandings = apiStandingsToGroupStandings(apiStandings);
    const hasLiveStandings = liveGroupStandings.size > 0;
    const groupStandings = hasLiveStandings
      ? liveGroupStandings
      : storedStandingsToGroupStandings(fallbackStandings);
    const result = resolveWorldCupMatches(baseMatches, scoreMap, {
      groupStandings,
      groupStandingsSource: hasLiveStandings ? "api" : "static",
    });
    return {
      matches: result.matches,
      summary: result.summary,
    };
  }, [apiStandings, baseMatches, competitionId, scoreMap]);

  return {
    matches: resolved.matches,
    scoreMap,
    scoresLoading,
    standingsLoading,
    summary: resolved.summary,
    fetchedAt,
  };
}
