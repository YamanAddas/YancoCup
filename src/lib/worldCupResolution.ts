import {
  collectThirdSlotHints,
  computeGroupStandings,
  computeKnockoutResults,
  computeThirdPlaceAllocation,
  resolveBracketPlaceholder,
} from "./bracketResolver";
import type { GroupStandings, MiniStandingEntry, ScoreLike } from "./bracketResolver";
import type { GroupStanding } from "./api";
import type { Match } from "../types";

export interface SlotScoreLike extends ScoreLike {
  homeTeam?: string | null;
  awayTeam?: string | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeCrest?: string | null;
  awayCrest?: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
}

export interface WorldCupResolutionSummary {
  standingsSource: "api" | "static" | "scores" | "none";
  thirdAllocationReady: boolean;
  futureKnockouts: number;
  resolvedFutureKnockouts: number;
  unresolvedFutureKnockouts: number;
}

export interface WorldCupResolutionResult {
  matches: Match[];
  standings: GroupStandings;
  thirdAllocation: Map<string, string> | null;
  summary: WorldCupResolutionSummary;
}

export interface StoredWorldCupStandings {
  groups: Record<string, MiniStandingEntry[]>;
}

const KNOCKOUT_ROUNDS: Match["round"][] = [
  "round-of-32",
  "round-of-16",
  "quarterfinal",
  "semifinal",
  "third-place",
  "final",
];

function normalizeTla(tla: string | null | undefined): string | null {
  const trimmed = tla?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function parseGroupId(label: string | null | undefined): string | null {
  if (!label) return null;
  const upper = label.toUpperCase();
  const match = /(?:GROUP[_\s-]*)?([A-L])$/.exec(upper);
  return match?.[1] ?? null;
}

function apiStandingToMini(row: GroupStanding["table"][number]): MiniStandingEntry | null {
  const tla = normalizeTla(row.team.tla);
  if (!tla) return null;
  return {
    tla,
    played: row.playedGames,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDiff: row.goalDifference,
    points: row.points,
  };
}

/** Convert Worker standings into the same shape used by bracket resolution. */
export function apiStandingsToGroupStandings(apiStandings: GroupStanding[]): GroupStandings {
  const out: GroupStandings = new Map();

  for (const group of apiStandings) {
    const id = parseGroupId(group.group);
    if (!id) continue;

    const table = [...group.table]
      .sort((a, b) => a.position - b.position)
      .map(apiStandingToMini)
      .filter((row): row is MiniStandingEntry => row !== null);

    if (table.length > 0) out.set(id, table);
  }

  return out;
}

export function storedStandingsToGroupStandings(
  stored: StoredWorldCupStandings,
): GroupStandings {
  const out: GroupStandings = new Map();
  for (const [group, table] of Object.entries(stored.groups)) {
    out.set(group, table.map((row) => ({ ...row, tla: row.tla.toLowerCase() })));
  }
  return out;
}

function withLiveScore(match: Match, live?: SlotScoreLike): Match {
  if (!live) return match;

  return {
    ...match,
    homeTeam: normalizeTla(live.homeTeam) ?? match.homeTeam,
    awayTeam: normalizeTla(live.awayTeam) ?? match.awayTeam,
    homeTeamId: live.homeTeamId ?? match.homeTeamId,
    awayTeamId: live.awayTeamId ?? match.awayTeamId,
    homeCrest: live.homeCrest ?? match.homeCrest,
    awayCrest: live.awayCrest ?? match.awayCrest,
    homeTeamName: live.homeTeamName ?? match.homeTeamName,
    awayTeamName: live.awayTeamName ?? match.awayTeamName,
    status: live.status ?? match.status,
    homeScore: live.homeScore ?? match.homeScore,
    awayScore: live.awayScore ?? match.awayScore,
  };
}

function sortByKickoff(a: Match, b: Match): number {
  const dateCompare = a.date.localeCompare(b.date);
  return dateCompare !== 0 ? dateCompare : a.time.localeCompare(b.time);
}

function kickoffMs(match: Match): number {
  return new Date(`${match.date}T${match.time}:00Z`).getTime();
}

function hasBothTeams(match: Match): boolean {
  return Boolean(match.homeTeam && match.awayTeam);
}

export function resolveWorldCupMatches(
  matches: Match[],
  scoreMap: Map<number, SlotScoreLike>,
  options?: {
    groupStandings?: GroupStandings;
    groupStandingsSource?: "api" | "static";
    now?: number;
  },
): WorldCupResolutionResult {
  let resolved = matches.map((match) => withLiveScore(match, scoreMap.get(match.id)));

  const scoreStandings = computeGroupStandings(resolved, scoreMap);
  const standings = options?.groupStandings && options.groupStandings.size > 0
    ? options.groupStandings
    : scoreStandings;
  const standingsSource = options?.groupStandings && options.groupStandings.size > 0
    ? (options.groupStandingsSource ?? "api")
    : scoreStandings.size > 0
      ? "scores"
      : "none";
  const thirdAllocation = computeThirdPlaceAllocation(
    standings,
    collectThirdSlotHints(resolved),
  );

  // Resolve one layer at a time. Once a finished knockout result becomes known,
  // the next pass can use W## / L## placeholders downstream.
  for (let pass = 0; pass < KNOCKOUT_ROUNDS.length + 1; pass++) {
    const knockoutResults = computeKnockoutResults(resolved, scoreMap);
    let changed = false;

    resolved = resolved.map((match) => {
      if (match.round === "group") return match;
      let next = match;

      if (!next.homeTeam) {
        const home = resolveBracketPlaceholder(
          next.homePlaceholder,
          standings,
          knockoutResults,
          thirdAllocation,
        );
        if (home) {
          next = { ...next, homeTeam: home };
          changed = true;
        }
      }

      if (!next.awayTeam) {
        const away = resolveBracketPlaceholder(
          next.awayPlaceholder,
          standings,
          knockoutResults,
          thirdAllocation,
        );
        if (away) {
          next = { ...next, awayTeam: away };
          changed = true;
        }
      }

      return next;
    });

    if (!changed) break;
  }

  const now = options?.now ?? Date.now();
  const futureKnockouts = resolved
    .filter((match) => match.round !== "group" && kickoffMs(match) > now)
    .sort(sortByKickoff);
  const resolvedFutureKnockouts = futureKnockouts.filter(hasBothTeams).length;

  return {
    matches: resolved,
    standings,
    thirdAllocation,
    summary: {
      standingsSource,
      thirdAllocationReady: thirdAllocation !== null,
      futureKnockouts: futureKnockouts.length,
      resolvedFutureKnockouts,
      unresolvedFutureKnockouts: futureKnockouts.length - resolvedFutureKnockouts,
    },
  };
}
