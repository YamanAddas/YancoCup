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
import thirdPlaceCombos from "../data/thirdPlaceCombos.json";

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
 * Both expose `status`, `homeScore`, `awayScore`; live entries also carry
 * football-data's `winner`, which is authoritative for knockout matches
 * decided in extra time or on penalties.
 */
export interface ScoreLike {
  status?: string;
  homeScore: number | null;
  awayScore: number | null;
  winner?: string | null;
  /** Penalty-shootout conversions (football-data score.penalties) */
  penaltyHome?: number | null;
  penaltyAway?: number | null;
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
 * Cross-group comparator (used to rank the 12 third-placed teams):
 * points → goalDiff → goalsFor → TLA (deterministic).
 *
 * FIFA's full third-place criteria (Regs Art. 13) continue with team
 * conduct score and then FIFA World Ranking — neither modeled here (no
 * card/ranking data in this path), so an exact pts/GD/GF tie falls to a
 * deterministic TLA sort. Within-group ordering does NOT use this — see
 * sortGroupTable (2026 uses head-to-head first).
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

/** A finished group match in (home, away, score) form for head-to-head math. */
interface PlayedGroupMatch {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

/** Mini-table (pts/GD/GF) computed only over matches among the given teams. */
function miniStats(
  teams: Set<string>,
  played: PlayedGroupMatch[],
): Map<string, { pts: number; gd: number; gf: number }> {
  const out = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const t of teams) out.set(t, { pts: 0, gd: 0, gf: 0 });
  for (const m of played) {
    if (!teams.has(m.home) || !teams.has(m.away)) continue;
    const h = out.get(m.home)!;
    const a = out.get(m.away)!;
    h.gf += m.homeGoals;
    h.gd += m.homeGoals - m.awayGoals;
    a.gf += m.awayGoals;
    a.gd += m.awayGoals - m.homeGoals;
    if (m.homeGoals > m.awayGoals) h.pts += 3;
    else if (m.awayGoals > m.homeGoals) a.pts += 3;
    else {
      h.pts += 1;
      a.pts += 1;
    }
  }
  return out;
}

/**
 * Order a block of point-tied teams per the 2026 regulations (Art. 13):
 * head-to-head FIRST — (a) points, (b) GD, (c) GF in matches among the tied
 * teams; if a strict subset remains tied, criteria a-c are re-applied to
 * that subset once (the procedure "does not restart" beyond that); then
 * (d) overall GD, (e) overall GF. Team conduct and FIFA-ranking steps are
 * not modeled (no data) — a still-perfect tie falls to TLA, deterministic.
 *
 * NOTE: this is the NEW 2026 order — pre-2026 World Cups applied overall
 * GD/GF before head-to-head. Do not "fix" this back.
 */
function orderTiedBlock(
  block: MiniStandingEntry[],
  played: PlayedGroupMatch[],
  reapplied = false,
): MiniStandingEntry[] {
  if (block.length <= 1) return block;

  const tlas = new Set(block.map((e) => e.tla));
  const mini = miniStats(tlas, played);
  const overall = (a: MiniStandingEntry, b: MiniStandingEntry) =>
    b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.tla.localeCompare(b.tla);

  const sorted = [...block].sort((a, b) => {
    const ma = mini.get(a.tla)!;
    const mb = mini.get(b.tla)!;
    return mb.pts - ma.pts || mb.gd - ma.gd || mb.gf - ma.gf || overall(a, b);
  });

  if (reapplied) return sorted;

  // Partition by identical head-to-head triple; re-apply once to any strict
  // subset that is still tied
  const out: MiniStandingEntry[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    const mi = mini.get(sorted[i]!.tla)!;
    while (j < sorted.length) {
      const mj = mini.get(sorted[j]!.tla)!;
      if (mj.pts !== mi.pts || mj.gd !== mi.gd || mj.gf !== mi.gf) break;
      j++;
    }
    const sub = sorted.slice(i, j);
    if (sub.length > 1 && sub.length < block.length) {
      out.push(...orderTiedBlock(sub, played, true));
    } else {
      out.push(...sub);
    }
    i = j;
  }
  return out;
}

/** Sort a full group table per the 2026 rules: points, then h2h blocks. */
export function sortGroupTable(
  entries: MiniStandingEntry[],
  played: PlayedGroupMatch[],
): MiniStandingEntry[] {
  const byPoints = [...entries].sort((a, b) => b.points - a.points);
  const out: MiniStandingEntry[] = [];
  let i = 0;
  while (i < byPoints.length) {
    let j = i + 1;
    while (j < byPoints.length && byPoints[j]!.points === byPoints[i]!.points) j++;
    out.push(...orderTiedBlock(byPoints.slice(i, j), played));
    i = j;
  }
  return out;
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
  const playedByGroup = new Map<string, PlayedGroupMatch[]>();

  for (const m of matches) {
    if (m.round !== "group" || !m.group) continue;
    if (!m.homeTeam || !m.awayTeam) continue;
    const score = resolveScore(m, scoreMap);
    if (!score) continue;

    let playedList = playedByGroup.get(m.group);
    if (!playedList) {
      playedList = [];
      playedByGroup.set(m.group, playedList);
    }
    playedList.push({
      home: m.homeTeam,
      away: m.awayTeam,
      homeGoals: score.home,
      awayGoals: score.away,
    });

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
    out.set(
      groupId,
      sortGroupTable([...teamMap.values()], playedByGroup.get(groupId) ?? []),
    );
  }
  return out;
}

/**
 * Compute knockout match winners and losers from finished matches.
 *
 * Keyed by the OFFICIAL FIFA match number (m.fifaNum) when present — the
 * "W74"/"L101" bracket placeholders reference FIFA numbers, not
 * football-data ids. Falls back to m.id for data without fifaNum.
 *
 * football-data's `winner` field is preferred over score comparison: a
 * knockout decided on penalties is FINISHED with a level fullTime score,
 * and only `winner` says who advanced.
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

    const live = scoreMap.get(m.id);
    let result: KnockoutResult | null = null;
    if (live?.winner === "HOME_TEAM") {
      result = { winnerTla: m.homeTeam, loserTla: m.awayTeam };
    } else if (live?.winner === "AWAY_TEAM") {
      result = { winnerTla: m.awayTeam, loserTla: m.homeTeam };
    } else if (
      // football-data can leave winner null for days after a shootout —
      // the penalties node still decides it
      live?.penaltyHome != null &&
      live?.penaltyAway != null &&
      live.penaltyHome !== live.penaltyAway
    ) {
      result =
        live.penaltyHome > live.penaltyAway
          ? { winnerTla: m.homeTeam, loserTla: m.awayTeam }
          : { winnerTla: m.awayTeam, loserTla: m.homeTeam };
    } else if (score.home > score.away) {
      result = { winnerTla: m.homeTeam, loserTla: m.awayTeam };
    } else if (score.away > score.home) {
      result = { winnerTla: m.awayTeam, loserTla: m.homeTeam };
    }
    // Tied with no winner signal at all — skip until upstream decides
    if (!result) continue;

    out.set(m.fifaNum ?? m.id, result);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Third-place allocation (global)
//
// FIFA does NOT fill each "3rd from A/B/C/D/F" slot with the best third among
// those groups independently — that can place one team in several slots. The
// real procedure: rank all 12 third-placed teams, the best 8 qualify, then
// assign each qualified third to exactly one R32 slot such that every slot
// receives a third from one of its candidate groups.
// ---------------------------------------------------------------------------

const ALL_GROUPS = "ABCDEFGHIJKL".split("");

/** Extract the candidate-group letter sets from "3rd XXXX" placeholders. */
export function collectThirdSlotHints(matches: Match[]): string[] {
  const hints: string[] = [];
  for (const m of matches) {
    for (const p of [m.homePlaceholder, m.awayPlaceholder]) {
      const t = /^3rd\s+([A-L]+)$/.exec((p ?? "").trim());
      if (t) hints.push(t[1]!);
    }
  }
  return hints;
}

/** All 12 groups complete = every group has 4 teams that played 3 matches. */
function allGroupsComplete(standings: GroupStandings): boolean {
  for (const g of ALL_GROUPS) {
    const table = standings.get(g);
    if (!table || table.length < 4) return false;
    if (!table.every((t) => t.played >= 3)) return false;
  }
  return true;
}

/**
 * Annexe C column order: each column is a group winner's R32 match, and the
 * value is the candidate-group letter set of that match's third-place slot
 * (1A=M79, 1B=M85, 1D=M81, 1E=M74, 1G=M82, 1I=M77, 1K=M87, 1L=M80 — FIFA
 * Regulations Art. 12.6, May 2026 edition).
 */
const ANNEXE_C_SLOT_ORDER = [
  "CEFHI", // 1A — M79
  "EFGIJ", // 1B — M85
  "BEFIJ", // 1D — M81
  "ABCDF", // 1E — M74
  "AEHIJ", // 1G — M82
  "CDFGH", // 1I — M77
  "DEIJL", // 1K — M87
  "EHIJK", // 1L — M80
] as const;

const COMBOS = thirdPlaceCombos as Record<string, string>;

/**
 * Allocate the 8 best third-placed teams to the third-place R32 slots,
 * exactly as FIFA will: rank the 12 thirds (Art. 13), take the top 8, then
 * look up the assignment in the official 495-row Annexe C combination
 * table — keyed solely by WHICH 8 groups qualified, not by their ranking
 * order. Fully deterministic, no draw.
 *
 * Returns Map<slotLetters ("ABCDF") → TLA>, or null until all 12 groups
 * are complete (FIFA doesn't allocate earlier either).
 */
export function computeThirdPlaceAllocation(
  standings: GroupStandings,
  slotHints: string[],
): Map<string, string> | null {
  if (slotHints.length === 0) return null;
  if (!allGroupsComplete(standings)) return null;

  // Rank the 12 thirds; best 8 qualify
  const thirds = ALL_GROUPS
    .map((g) => ({ group: g, entry: standings.get(g)![2]! }))
    .sort((a, b) => compareStandings(a.entry, b.entry));
  const qualifiedGroups = thirds.slice(0, 8).map((t) => t.group);

  const key = [...qualifiedGroups].sort().join("");
  const row = COMBOS[key];
  if (!row) return null; // impossible: table covers all C(12,8)=495 sets

  const out = new Map<string, string>();
  for (let i = 0; i < ANNEXE_C_SLOT_ORDER.length; i++) {
    const slotLetters = ANNEXE_C_SLOT_ORDER[i]!;
    const thirdGroup = row[i]!;
    out.set(slotLetters, standings.get(thirdGroup)![2]!.tla);
  }
  return out;
}

/**
 * Resolve a bracket placeholder to a team TLA, or null if not yet determined.
 *
 * Supported patterns:
 *   "1A" .. "3L"     — group X position 1 / 2 / 3 (1-indexed)
 *   "W##" / "L##"    — winner / loser of FIFA match number ##
 *   "3rd ABCDF"      — the third-placed team ALLOCATED to this slot; requires
 *                      thirdAllocation from computeThirdPlaceAllocation()
 *                      (null until all 12 groups finish)
 */
export function resolveBracketPlaceholder(
  placeholder: string | null | undefined,
  standings: GroupStandings,
  knockoutResults: KnockoutResults,
  thirdAllocation?: Map<string, string> | null,
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
    return thirdAllocation?.get(thirdMatch[1]!) ?? null;
  }

  return null;
}
