/**
 * ESPN enrichment — lineups, events, and statistics from ESPN's public
 * JSON API (site.api.espn.com). Free, no auth, CORS-open; chosen after
 * API-Football's free plan dropped current seasons and football-data.org's
 * free tier ships no lineups/events/stats.
 *
 * Unofficial API: no SLA, schema can change without notice. Every consumer
 * must treat a null return as "no enrichment" and degrade gracefully.
 *
 * Output shapes mirror API-Football's events/lineups/statistics because
 * that is what the deployed frontend MatchDetailPage tabs render. Team ids
 * in the output are football-data.org ids — the frontend matches sides via
 * `ev.team.id === match.homeTeam.id`.
 */

export const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

/** Our competition codes → ESPN league slugs */
export const ESPN_SLUGS: Record<string, string> = {
  WC: "fifa.world",
  CL: "uefa.champions",
  PL: "eng.1",
  PD: "esp.1",
  BL1: "ger.1",
  SA: "ita.1",
  FL1: "fra.1",
};

/** Identity of one side as football-data.org knows it */
export interface FdTeamRef {
  id: number;
  tla: string | null;
  names: Array<string | null | undefined>;
}

interface AfEventOut {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

interface AfPlayerOut {
  player: { id: number; name: string; number: number; pos: string };
}

interface AfLineupOut {
  team: { id: number; name: string };
  formation: string | null;
  startXI: AfPlayerOut[];
  substitutes: AfPlayerOut[];
  coach: { id: number; name: string } | null;
}

interface AfStatOut {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: string | number | null }>;
}

export interface EspnEnrichment {
  events: AfEventOut[];
  lineups: AfLineupOut[];
  statistics: AfStatOut[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Parse ESPN clock display like "9'", "45'+4'", "90' +2'" */
export function parseEspnClock(
  display: string | undefined | null,
): { elapsed: number; extra: number | null } | null {
  if (!display) return null;
  const m = display.match(/^(\d+)'(?:\s*\+\s*(\d+)')?/);
  if (!m) return null;
  return { elapsed: parseInt(m[1]!, 10), extra: m[2] ? parseInt(m[2], 10) : null };
}

function up(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().trim();
}

/** Does an ESPN competitor/team object refer to this football-data team? */
function teamMatches(fd: FdTeamRef, espnTeam: Record<string, unknown>): boolean {
  const cands = [
    espnTeam.abbreviation,
    espnTeam.displayName,
    espnTeam.shortDisplayName,
    espnTeam.name,
    espnTeam.location,
  ]
    .map((v) => up(typeof v === "string" ? v : null))
    .filter(Boolean);
  if (fd.tla && cands.includes(up(fd.tla))) return true;
  const fdNames = fd.names.map((n) => up(n)).filter((n) => n.length >= 4);
  return fdNames.some((n) => cands.some((c) => c === n || c.includes(n) || n.includes(c)));
}

/**
 * Find the ESPN event id for a fixture inside a scoreboard payload.
 * Match by kickoff time (±10 min) plus team identity. ESPN buckets
 * scoreboard days by US Eastern date, so callers must fetch a date RANGE
 * covering [utcDay-1, utcDay].
 */
export function findEspnEventInScoreboard(
  scoreboard: Record<string, unknown>,
  utcDate: string,
  home: FdTeamRef,
  away: FdTeamRef,
): string | null {
  const events = Array.isArray(scoreboard.events)
    ? (scoreboard.events as Array<Record<string, unknown>>)
    : [];
  const kickoff = new Date(utcDate).getTime();
  if (!Number.isFinite(kickoff)) return null;

  const TEN_MIN = 10 * 60 * 1000;
  const candidates: Array<{ id: string; both: boolean; one: boolean }> = [];

  for (const ev of events) {
    const t = new Date(String(ev.date ?? "")).getTime();
    if (!Number.isFinite(t) || Math.abs(t - kickoff) > TEN_MIN) continue;
    const comps =
      ((ev.competitions as Array<Record<string, unknown>> | undefined)?.[0]
        ?.competitors as Array<Record<string, unknown>> | undefined) ?? [];
    const teams = comps
      .map((c) => c.team as Record<string, unknown> | undefined)
      .filter((t2): t2 is Record<string, unknown> => !!t2);
    const homeHit = teams.some((t2) => teamMatches(home, t2));
    const awayHit = teams.some((t2) => teamMatches(away, t2));
    const id = String(ev.id ?? "");
    if (!id) continue;
    candidates.push({ id, both: homeHit && awayHit, one: homeHit || awayHit });
  }

  const both = candidates.filter((c) => c.both);
  if (both.length === 1) return both[0]!.id;
  if (both.length > 1) return null; // ambiguous — refuse to guess
  const one = candidates.filter((c) => c.one);
  if (one.length === 1) return one[0]!.id;
  // Single event at this exact kickoff and nothing contradicts it
  if (candidates.length === 1) return candidates[0]!.id;
  return null;
}

/** Build espn-side lookup: ESPN team id / name → "home" | "away" */
function buildSideMaps(summary: Record<string, unknown>): {
  byId: Map<string, "home" | "away">;
  byName: Map<string, "home" | "away">;
} {
  const byId = new Map<string, "home" | "away">();
  const byName = new Map<string, "home" | "away">();
  const competitions =
    ((summary.header as Record<string, unknown> | undefined)?.competitions as
      | Array<Record<string, unknown>>
      | undefined) ?? [];
  const competitors =
    (competitions[0]?.competitors as Array<Record<string, unknown>> | undefined) ?? [];
  for (const c of competitors) {
    const side = c.homeAway === "home" ? "home" : c.homeAway === "away" ? "away" : null;
    if (!side) continue;
    const team = (c.team as Record<string, unknown> | undefined) ?? {};
    for (const idCand of [c.id, team.id]) {
      if (idCand != null) byId.set(String(idCand), side);
    }
    for (const nameCand of [team.displayName, team.shortDisplayName, team.name]) {
      if (typeof nameCand === "string") byName.set(up(nameCand), side);
    }
  }
  return { byId, byName };
}

/**
 * Transform an ESPN summary payload into API-Football-shaped enrichment.
 * Returns null when nothing useful could be extracted.
 */
export function transformEspnSummary(
  summary: Record<string, unknown>,
  fdHome: { id: number; name: string },
  fdAway: { id: number; name: string },
): EspnEnrichment | null {
  const { byId, byName } = buildSideMaps(summary);
  const fdTeamFor = (side: "home" | "away") => (side === "home" ? fdHome : fdAway);
  const sideOf = (espnTeam: Record<string, unknown> | undefined): "home" | "away" | null => {
    if (!espnTeam) return null;
    for (const idCand of [espnTeam.id]) {
      if (idCand != null && byId.has(String(idCand))) return byId.get(String(idCand))!;
    }
    for (const nameCand of [espnTeam.displayName, espnTeam.shortDisplayName, espnTeam.name]) {
      if (typeof nameCand === "string" && byName.has(up(nameCand))) return byName.get(up(nameCand))!;
    }
    return null;
  };

  // ── Events ────────────────────────────────────────────────────────────
  const events: AfEventOut[] = [];
  const keyEvents = Array.isArray(summary.keyEvents)
    ? (summary.keyEvents as Array<Record<string, unknown>>)
    : [];
  for (const ev of keyEvents) {
    const typeText = up((ev.type as Record<string, unknown> | undefined)?.text as string);
    const clock = parseEspnClock(
      (ev.clock as Record<string, unknown> | undefined)?.displayValue as string,
    );
    if (!clock) continue;
    const side = sideOf(ev.team as Record<string, unknown> | undefined);
    if (!side) continue;
    const participants = Array.isArray(ev.participants)
      ? (ev.participants as Array<Record<string, unknown>>).map((p) => {
          const ath = p.athlete as Record<string, unknown> | undefined;
          return {
            id: ath?.id != null ? Number(ath.id) : null,
            name: typeof ath?.displayName === "string" ? ath.displayName : null,
          };
        })
      : [];
    const p0 = participants[0] ?? { id: null, name: null };
    const p1 = participants[1] ?? { id: null, name: null };
    const team = { id: fdTeamFor(side).id, name: fdTeamFor(side).name };

    if (typeText.includes("OWN GOAL")) {
      events.push({ time: clock, team, player: p0, assist: { id: null, name: null }, type: "Goal", detail: "Own Goal" });
    } else if (typeText.includes("GOAL") && ev.scoringPlay !== false) {
      const detail = typeText.includes("PENALTY") ? "Penalty" : "Normal Goal";
      events.push({ time: clock, team, player: p0, assist: p1, type: "Goal", detail });
    } else if (typeText.includes("YELLOW CARD")) {
      events.push({ time: clock, team, player: p0, assist: { id: null, name: null }, type: "Card", detail: "Yellow Card" });
    } else if (typeText.includes("RED CARD")) {
      events.push({ time: clock, team, player: p0, assist: { id: null, name: null }, type: "Card", detail: "Red Card" });
    } else if (typeText.includes("SUBSTITUTION")) {
      // Frontend renders assist.name as the player coming ON and player.name
      // (prefixed ↓) as the player going OFF. ESPN participants = [in, out].
      events.push({ time: clock, team, player: p1, assist: p0, type: "subst", detail: "Substitution 1" });
    }
  }

  // ── Lineups ───────────────────────────────────────────────────────────
  const lineups: AfLineupOut[] = [];
  const rosters = Array.isArray(summary.rosters)
    ? (summary.rosters as Array<Record<string, unknown>>)
    : [];
  for (const r of rosters) {
    const side =
      r.homeAway === "home" ? "home" : r.homeAway === "away" ? "away"
      : sideOf(r.team as Record<string, unknown> | undefined);
    if (!side) continue;
    const roster = Array.isArray(r.roster) ? (r.roster as Array<Record<string, unknown>>) : [];
    const mapPlayer = (p: Record<string, unknown>): AfPlayerOut => {
      const ath = (p.athlete as Record<string, unknown> | undefined) ?? {};
      const pos = (p.position as Record<string, unknown> | undefined)?.abbreviation;
      return {
        player: {
          id: ath.id != null ? Number(ath.id) : 0,
          name: typeof ath.displayName === "string" ? ath.displayName : "",
          number: parseInt(String(p.jersey ?? ""), 10) || 0,
          pos: typeof pos === "string" ? pos : "",
        },
      };
    };
    const starters = roster.filter((p) => p.starter === true);
    // Keep formation order when ESPN provides it
    starters.sort((a, b) => (Number(a.formationPlace) || 99) - (Number(b.formationPlace) || 99));
    const startXI = starters.map(mapPlayer).filter((p) => p.player.name);
    const substitutes = roster
      .filter((p) => p.starter !== true)
      .map(mapPlayer)
      .filter((p) => p.player.name);
    if (startXI.length === 0 && substitutes.length === 0) continue;

    const coachRaw = Array.isArray(r.coach)
      ? (r.coach as Array<Record<string, unknown>>)[0]
      : (r.coach as Record<string, unknown> | undefined);
    const coachName =
      typeof coachRaw?.displayName === "string" ? coachRaw.displayName
      : typeof coachRaw?.name === "string" ? coachRaw.name
      : [coachRaw?.firstName, coachRaw?.lastName].filter((x) => typeof x === "string").join(" ").trim();

    lineups.push({
      team: { id: fdTeamFor(side).id, name: fdTeamFor(side).name },
      formation: typeof r.formation === "string" ? r.formation : null,
      startXI,
      substitutes,
      coach: coachName ? { id: 0, name: coachName } : null,
    });
  }

  // ── Statistics ────────────────────────────────────────────────────────
  const statistics: AfStatOut[] = [];
  const boxTeams = Array.isArray((summary.boxscore as Record<string, unknown> | undefined)?.teams)
    ? (((summary.boxscore as Record<string, unknown>).teams) as Array<Record<string, unknown>>)
    : [];
  for (const bt of boxTeams) {
    const side =
      bt.homeAway === "home" ? "home" : bt.homeAway === "away" ? "away"
      : sideOf(bt.team as Record<string, unknown> | undefined);
    if (!side) continue;
    const raw = Array.isArray(bt.statistics)
      ? (bt.statistics as Array<Record<string, unknown>>)
      : [];
    const byEspnName = new Map<string, string>();
    for (const s of raw) {
      if (typeof s.name === "string") byEspnName.set(s.name, String(s.displayValue ?? ""));
    }
    const num = (name: string): number | null => {
      const v = byEspnName.get(name);
      if (v == null || v === "") return null;
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    // ESPN stat name → frontend's API-Football type string
    const out: Array<{ type: string; value: string | number | null }> = [];
    const possession = byEspnName.get("possessionPct");
    if (possession) out.push({ type: "Ball Possession", value: possession.endsWith("%") ? possession : `${possession}%` });
    const simple: Array<[string, string]> = [
      ["totalShots", "Total Shots"],
      ["shotsOnTarget", "Shots on Goal"],
      ["wonCorners", "Corner Kicks"],
      ["foulsCommitted", "Fouls"],
      ["offsides", "Offsides"],
      ["yellowCards", "Yellow Cards"],
      ["redCards", "Red Cards"],
      ["totalPasses", "Total passes"],
    ];
    for (const [espnName, afType] of simple) {
      const v = num(espnName);
      if (v !== null) out.push({ type: afType, value: v });
    }
    const shots = num("totalShots");
    const onTarget = num("shotsOnTarget");
    if (shots !== null && onTarget !== null) {
      out.push({ type: "Shots off Goal", value: shots - onTarget });
    }
    const accPasses = num("accuratePasses");
    const totPasses = num("totalPasses");
    if (accPasses !== null && totPasses !== null && totPasses > 0) {
      out.push({ type: "Passes %", value: `${Math.round((accPasses / totPasses) * 100)}%` });
    }
    if (out.length > 0) {
      statistics.push({ team: { id: fdTeamFor(side).id, name: fdTeamFor(side).name }, statistics: out });
    }
  }
  // Frontend requires both teams to render the stats tab
  const stats = statistics.length === 2 ? statistics : [];

  if (events.length === 0 && lineups.length === 0 && stats.length === 0) return null;
  return { events, lineups, statistics: stats };
}

/** YYYYMMDD for the ESPN scoreboard, offset by days from an ISO date */
export function espnDay(isoDate: string, offsetDays = 0): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}
