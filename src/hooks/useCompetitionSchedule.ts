import { useState, useEffect, useMemo } from "react";
import { useCompetition } from "../lib/CompetitionProvider";
import scheduleData from "../data/schedule.json";
import type { Match } from "../types";
import { WORKER_URL } from "../lib/api";

/** WC static schedule — already typed and loaded */
const wcMatches = scheduleData as Match[];

/**
 * Returns the match schedule for the current competition.
 * - WC: static schedule.json (instant, no fetch)
 * - Leagues/other: fetched from Worker /api/:comp/matches (cached in state)
 */
export function useCompetitionSchedule(matchday?: number) {
  const comp = useCompetition();
  const [apiMatches, setApiMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(!comp.staticSchedule);

  useEffect(() => {
    if (comp.staticSchedule) return; // WC uses static data

    let cancelled = false;
    let controller = new AbortController();
    setLoading(true);

    async function fetchSchedule() {
      // Abort any in-flight request before starting a new one
      controller.abort();
      controller = new AbortController();
      try {
        const url = `${WORKER_URL}/api/${comp.id}/matches`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = (await res.json()) as {
          matches: Array<{
            apiId: number;
            utcDate: string;
            status: string;
            matchday: number | null;
            stage: string;
            group: string | null;
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
          }>;
        };

        if (cancelled) return;

        // Convert Worker MatchScore to our local Match type
        const converted: Match[] = data.matches.map((m) => {
          const d = new Date(m.utcDate);
          return {
            id: m.apiId,
            date: d.toISOString().slice(0, 10),
            time: d.toISOString().slice(11, 16),
            homeTeam: m.homeTeam?.toLowerCase() ?? null,
            awayTeam: m.awayTeam?.toLowerCase() ?? null,
            homeTeamId: m.homeTeamId ?? null,
            awayTeamId: m.awayTeamId ?? null,
            homeCrest: m.homeCrest ?? null,
            awayCrest: m.awayCrest ?? null,
            homeTeamName: m.homeTeamName ?? null,
            awayTeamName: m.awayTeamName ?? null,
            status: m.status,
            homeScore: m.homeScore ?? null,
            awayScore: m.awayScore ?? null,
            venueId: "",
            group: m.group,
            round: stageToRound(m.stage),
            matchday: m.matchday,
          };
        });

        setApiMatches(converted);
      } catch {
        // Worker unreachable — show empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSchedule();

    // Auto-refresh league schedules every 10 minutes (picks up rescheduled matches + score updates)
    const interval = setInterval(() => fetchSchedule(), 10 * 60_000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [comp.id, comp.staticSchedule]);

  // For WC, use static data. For leagues, use fetched data.
  const allMatches = comp.staticSchedule ? wcMatches : apiMatches;

  // Optional matchday filter
  const filtered = useMemo(() => {
    if (matchday === undefined) return allMatches;
    return allMatches.filter((m) => m.matchday === matchday);
  }, [allMatches, matchday]);

  // Available matchdays for league navigation
  const matchdays = useMemo(() => {
    const mds = new Set(allMatches.map((m) => m.matchday).filter((md): md is number => md !== null));
    return [...mds].sort((a, b) => a - b);
  }, [allMatches]);

  return { matches: filtered, matchdays, loading };
}

/** Map football-data.org stage names to our round type */
export function stageToRound(
  stage: string,
): Match["round"] {
  switch (stage) {
    case "GROUP_STAGE":
    case "LEAGUE_STAGE":
    case "LEAGUE_STAGE_MATCHDAY":
    case "REGULAR_SEASON":
      return "group";
    case "PRELIMINARY_ROUND":
    case "PRELIMINARY_SEMI_FINALS":
    case "PRELIMINARY_FINAL":
    case "QUALIFICATION":
    case "QUALIFICATION_ROUND_1":
    case "QUALIFICATION_ROUND_2":
    case "QUALIFICATION_ROUND_3":
    case "PLAYOFF_ROUND":
    case "PLAYOFF":
    case "KNOCKOUT_ROUND_PLAY_OFFS":
    case "ROUND_OF_16_PLAY_OFFS":
      return "playoff";
    case "LAST_32":
    case "ROUND_OF_32":
      return "round-of-32";
    case "LAST_16":
    case "ROUND_OF_16":
      return "round-of-16";
    case "QUARTER_FINALS":
      return "quarterfinal";
    case "SEMI_FINALS":
      return "semifinal";
    case "THIRD_PLACE":
      return "third-place";
    case "FINAL":
      return "final";
    default:
      return "group";
  }
}
