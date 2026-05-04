/**
 * Bracket placeholder resolver.
 *
 * The static WC schedule encodes knockout slots as placeholders ("1A", "2B",
 * "W49", "3rd ABCDF") that get resolved at runtime once group-stage results
 * are known. Without this, R32 nodes stay as text labels even after the
 * group stage ends and football-data.org hasn't yet pushed real teams.
 *
 * Pure functions — easy to test, no React, no fetching.
 */

import type { Match } from "../types";

export interface MiniStandingEntry {
  tla: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

/** Group ID ("A".."L") → standings sorted best-first. */
export type GroupStandings = Map<string, MiniStandingEntry[]>;

export interface KnockoutResult {
  winnerTla: string;
  loserTla: string;
}

/** Knockout match ID → winner / loser TLAs. */
export type KnockoutResults = Map<number, KnockoutResult>;

/**
 * Minimal score shape — accepts either a Match or a useScores entry.
 * Both expose `status`, `homeScore`, `awayScore`.
 */
export interface ScoreLike {
  status?: string;
  homeScore: number | null;
  awayScore: number | null;
}

function ensureEntry(
  map: Map<string, MiniStandingEntry>,
  tla: string,
): MiniStandingEntry {
  let e = map.get(tla);
  if (!e) {
    e = {
      tla,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    };
    map.set(tla, e);
  }
  return e;
}

/**
 * Sort comparator: points → goalDiff → goalsFor → TLA (deterministic).
 * Real FIFA tiebreakers include head-to-head and fair-play; we approximate.
 */
export function compareStandings(
  a: MiniStandingEntry,
  b: MiniStandingEntry,
): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.tla.localeCompare(b.tla);
}

/** Resolve a finished match's score, preferring live data over the static schedule. */
function resolveScore(
  m: Match,
  scoreMap: Map<number, ScoreLike>,
): { home: number; away: number } | null {
  const live = scoreMap.get(m.id);
  const status = live?.status ?? m.status ?? "";
  const home = live?.homeScore ?? m.homeScore ?? null;
  const away = live?.awayScore ?? m.awayScore ?? null;
  if (status !== "FINISHED" || home == null || away == null) return null;
  return { home, away };
}

/**
 * Compute group standings from finished group-stage matches.
 * Unfinished matches are silently skipped — partial standings are valid input
 * to the resolver and produce partial bracket resolutions.
 */
export function computeGroupStandings(
  matches: Match[],
  scoreMap: Map<number, ScoreLike>,
): GroupStandings {
  const byGroup = new Map<string, Map<string, MiniStandingEntry>>();

  for (const m of matches) {
    if (m.round !== "group" || !m.group) continue;
    if (!m.homeTeam || !m.awayTeam) continue;
    const score = resolveScore(m, scoreMap);
    if (!score) continue;

    let groupMap = byGroup.get(m.group);
    if (!groupMap) {
      groupMap = new Map();
      byGroup.set(m.group, groupMap);
    }

    const home = ensureEntry(groupMap, m.homeTeam);
    const away = ensureEntry(groupMap, m.awayTeam);

    home.played++;
    away.played++;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;
    home.goalDiff = home.goalsFor - home.goalsAgainst;
    away.goalDiff = away.goalsFor - away.goalsAgainst;

    if (score.home > score.away) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (score.away > score.home) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.draw++;
      home.points++;
      away.draw++;
      away.points++;
    }
  }

  const out: GroupStandings = new Map();
  for (const [groupId, teamMap] of byGroup) {
    out.set(groupId, [...teamMap.values()].sort(compareStandings));
  }
  return out;
}

/**
 * Compute knockout match winners and losers from finished matches.
 * Tied scores (which shouldn't happen in real knockouts but might in mocks)
 * are skipped — resolver downstream returns null for those slots.
 */
export function computeKnockoutResults(
  matches: Match[],
  scoreMap: Map<number, ScoreLike>,
): KnockoutResults {
  const out: KnockoutResults = new Map();
  for (const m of matches) {
    if (m.round === "group") continue;
    if (!m.homeTeam || !m.awayTeam) continue;
    const score = resolveScore(m, scoreMap);
    if (!score) continue;
    if (score.home === score.away) continue;

    if (score.home > score.away) {
      out.set(m.id, { winnerTla: m.homeTeam, loserTla: m.awayTeam });
    } else {
      out.set(m.id, { winnerTla: m.awayTeam, loserTla: m.homeTeam });
    }
  }
  return out;
}

/**
 * Resolve a bracket placeholder to a team TLA, or null if not yet determined.
 *
 * Supported patterns:
 *   "1A" .. "3L"     — group X position 1 / 2 / 3 (1-indexed)
 *   "W##" / "L##"    — winner / loser of knockout match #
 *   "3rd ABCDF"      — best third-placed team from the listed groups
 *                      (only considers groups whose 3rd has played >= 3 matches)
 */
export function resolveBracketPlaceholder(
  placeholder: string | null | undefined,
  standings: GroupStandings,
  knockoutResults: KnockoutResults,
): string | null {
  if (!placeholder) return null;
  const p = placeholder.trim();

  const groupPosMatch = /^([1-3])([A-L])$/.exec(p);
  if (groupPosMatch) {
    const pos = parseInt(groupPosMatch[1]!, 10) - 1;
    const groupId = groupPosMatch[2]!;
    const standing = standings.get(groupId);
    return standing?.[pos]?.tla ?? null;
  }

  const koMatch = /^([WL])(\d+)$/.exec(p);
  if (koMatch) {
    const id = parseInt(koMatch[2]!, 10);
    const result = knockoutResults.get(id);
    if (!result) return null;
    return koMatch[1] === "W" ? result.winnerTla : result.loserTla;
  }

  const thirdMatch = /^3rd\s+([A-L]+)$/.exec(p);
  if (thirdMatch) {
    const groupIds = thirdMatch[1]!.split("");
    const candidates: MiniStandingEntry[] = [];
    for (const gid of groupIds) {
      const third = standings.get(gid)?.[2];
      if (third && third.played >= 3) candidates.push(third);
    }
    if (candidates.length === 0) return null;
    candidates.sort(compareStandings);
    return candidates[0]!.tla;
  }

  return null;
}
