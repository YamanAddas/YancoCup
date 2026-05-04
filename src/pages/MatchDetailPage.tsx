import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, Users, BarChart3, User } from "lucide-react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import { formatTimeWithTZ, getLocale } from "../lib/formatDate";
import { useMyPredictions } from "../hooks/usePredictions";
import { useConsensus } from "../hooks/useConsensus";
import { useMyPools, usePoolMembers } from "../hooks/usePools";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import TeamCrest from "../components/match/TeamCrest";
import ConfidenceBadge from "../components/predictions/ConfidenceBadge";
import { WORKER_URL } from "../lib/api";

// ---------------------------------------------------------------------------
// Types — match detail from football-data.org /v4/matches/{id}
// ---------------------------------------------------------------------------

interface TeamDetail {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  coach?: { id: number; name: string; nationality: string } | null;
  lineup?: Array<{ id: number; name: string; position: string; shirtNumber: number }>;
  bench?: Array<{ id: number; name: string; position: string; shirtNumber: number }>;
  formation?: string | null;
}

interface Goal {
  minute: number;
  injuryTime?: number | null;
  team: { id: number };
  scorer: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
  type: string; // REGULAR, OWN_GOAL, PENALTY
}

interface Booking {
  minute: number;
  team: { id: number };
  player: { id: number; name: string };
  card: string; // YELLOW, YELLOW_RED, RED
}

interface Substitution {
  minute: number;
  team: { id: number };
  playerOut: { id: number; name: string };
  playerIn: { id: number; name: string };
}

interface Referee {
  name: string;
  type: string;
  nationality: string;
}

interface MatchData {
  id: number;
  competition: { id: number; name: string; code: string; emblem: string };
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: TeamDetail;
  awayTeam: TeamDetail;
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  goals: Goal[];
  bookings: Booking[];
  substitutions: Substitution[];
  referees: Referee[];
  venue: string | null;
}

interface H2HMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  score: { fullTime: { home: number | null; away: number | null }; winner: string | null };
}

interface H2HData {
  numberOfMatches: number;
  totalGoals: number;
  homeTeam: { id: number; name: string; wins: number; draws: number; losses: number };
  awayTeam: { id: number; name: string; wins: number; draws: number; losses: number };
  matches: H2HMatch[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type TabId = "overview" | "stats" | "lineup" | "h2h" | "predictions";
const TAB_IDS: TabId[] = ["overview", "stats", "lineup", "h2h", "predictions"];

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex border-b border-yc-border mb-6">
      {TAB_IDS.map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            active === id
              ? "text-yc-green"
              : "text-yc-text-tertiary hover:text-yc-text-secondary"
          }`}
        >
          {t(`match.tabs.${id}`)}
          {active === id && (
            <span className="absolute bottom-0 inset-x-0 h-0.5 bg-yc-green rounded-t" />
          )}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status, minute }: { status: string; minute?: string }) {
  const { t } = useI18n();
  if (status === "IN_PLAY" || status === "PAUSED") {
    return (
      <span className="flex items-center gap-1.5 text-yc-green text-sm font-medium">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yc-green" />
        </span>
        {status === "PAUSED" ? t("match.ht") : minute ?? t("match.live")}
      </span>
    );
  }
  if (status === "FINISHED") {
    return <span className="text-yc-text-tertiary text-sm font-medium">{t("match.ft")}</span>;
  }
  if (status === "TIMED" || status === "SCHEDULED") {
    return <span className="text-yc-text-secondary text-sm font-medium">{t("match.upcoming")}</span>;
  }
  return <span className="text-yc-text-tertiary text-sm font-medium">{status}</span>;
}

/** Event icon for the timeline */
function EventIcon({ type }: { type: "goal" | "own_goal" | "penalty" | "yellow" | "yellow_red" | "red" | "sub" }) {
  const icons: Record<string, { bg: string; text: string; label: string }> = {
    goal: { bg: "bg-yc-green/20", text: "text-yc-green", label: "⚽" },
    own_goal: { bg: "bg-yc-danger/20", text: "text-yc-danger", label: "⚽" },
    penalty: { bg: "bg-yc-green/20", text: "text-yc-green", label: "P" },
    yellow: { bg: "bg-yc-warning/20", text: "text-yc-warning", label: "▮" },
    yellow_red: { bg: "bg-yc-danger/20", text: "text-yc-danger", label: "▮▮" },
    red: { bg: "bg-yc-danger/20", text: "text-yc-danger", label: "▮" },
    sub: { bg: "bg-sky-500/20", text: "text-sky-400", label: "⇄" },
  };
  const style = icons[type] ?? icons["goal"];
  const bg = style?.bg ?? "bg-yc-bg-elevated";
  const text = style?.text ?? "text-yc-text-secondary";
  const label = style?.label ?? "•";
  return (
    <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center shrink-0`}>
      <span className={`${text} text-xs font-bold`}>{label}</span>
    </div>
  );
}

/** API-Football event shape */
interface AFEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string; // "Goal", "Card", "subst", "Var"
  detail: string; // "Normal Goal", "Penalty", "Own Goal", "Yellow Card", "Red Card", "Substitution 1", etc.
}

/** API-Football stat shape */
interface AFStat {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: string | number | null }>;
}

/** API-Football lineup shape */
interface AFLineup {
  team: { id: number; name: string };
  formation: string | null;
  startXI: Array<{ player: { id: number; name: string; number: number; pos: string } }>;
  substitutes: Array<{ player: { id: number; name: string; number: number; pos: string } }>;
  coach: { id: number; name: string } | null;
}

/** Events timeline: uses API-Football events if available, falls back to football-data.org */
function EventsTimeline({ match }: { match: MatchData }) {
  const { t } = useI18n();
  // API-Football events (enriched)
  const afEvents = (match as unknown as Record<string, unknown>).events as AFEvent[] | undefined;

  const events: Array<{
    minute: number;
    extra?: number | null;
    side: "home" | "away";
    type: "goal" | "own_goal" | "penalty" | "yellow" | "yellow_red" | "red" | "sub";
    primary: string;
    secondary?: string;
  }> = [];

  if (afEvents && afEvents.length > 0) {
    // Use API-Football events (rich data)
    for (const ev of afEvents) {
      if (!ev.team || !ev.player) continue;
      const side = ev.team.id === match.homeTeam.id ? "home" : "away";
      let type: typeof events[number]["type"] = "goal";
      if (ev.type === "Goal") {
        type = ev.detail === "Own Goal" ? "own_goal" : ev.detail === "Penalty" ? "penalty" : "goal";
      } else if (ev.type === "Card") {
        type = ev.detail.includes("Red") ? "red" : ev.detail === "Second Yellow card" ? "yellow_red" : "yellow";
      } else if (ev.type === "subst") {
        type = "sub";
      } else {
        continue; // Skip VAR and other types
      }

      events.push({
        minute: ev.time.elapsed,
        extra: ev.time.extra,
        side,
        type,
        primary: type === "sub" ? (ev.assist.name ?? "Unknown") : (ev.player.name ?? "Unknown"),
        secondary: type === "goal" && ev.assist.name ? `${t("match.events.assist")} ${ev.assist.name}`
          : type === "own_goal" ? t("match.events.ownGoal")
          : type === "sub" ? `↓ ${ev.player.name ?? ""}`
          : undefined,
      });
    }
  } else {
    // Fallback to football-data.org data
    for (const g of Array.isArray(match.goals) ? match.goals : []) {
      const side = g.team.id === match.homeTeam.id ? "home" : "away";
      const goalType = g.type === "OWN_GOAL" ? "own_goal" : g.type === "PENALTY" ? "penalty" : "goal";
      events.push({
        minute: g.minute,
        extra: g.injuryTime,
        side,
        type: goalType,
        primary: g.scorer?.name ?? "Unknown",
        secondary: g.type === "OWN_GOAL" ? t("match.events.ownGoal") : g.assist?.name ? `${t("match.events.assist")} ${g.assist.name}` : undefined,
      });
    }
    for (const b of Array.isArray(match.bookings) ? match.bookings : []) {
      const side = b.team.id === match.homeTeam.id ? "home" : "away";
      events.push({ minute: b.minute, side, type: b.card === "RED" ? "red" : b.card === "YELLOW_RED" ? "yellow_red" : "yellow", primary: b.player.name });
    }
    for (const s of Array.isArray(match.substitutions) ? match.substitutions : []) {
      const side = s.team.id === match.homeTeam.id ? "home" : "away";
      events.push({ minute: s.minute, side, type: "sub", primary: s.playerIn.name, secondary: `↓ ${s.playerOut.name}` });
    }
  }

  events.sort((a, b) => a.minute - b.minute);

  if (events.length === 0) {
    return <p className="text-yc-text-tertiary text-sm text-center py-6">{t("match.events.none")}</p>;
  }

  return (
    <div className="space-y-1">
      {events.map((ev, i) => {
        const minuteLabel = ev.extra ? `${ev.minute}+${ev.extra}'` : `${ev.minute}'`;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-yc-bg-elevated/30 transition-colors ${
              ev.side === "away" ? "flex-row-reverse text-end" : ""
            }`}
          >
            <EventIcon type={ev.type} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-yc-text-primary font-medium truncate">{ev.primary}</p>
              {ev.secondary && (
                <p className="text-xs text-yc-text-tertiary truncate">{ev.secondary}</p>
              )}
            </div>
            <span className="text-xs font-mono text-yc-text-tertiary shrink-0">{minuteLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Match statistics comparison (from API-Football) */
function StatsTab({ match }: { match: MatchData }) {
  const { t } = useI18n();
  const afStats = (match as unknown as Record<string, unknown>).statistics as AFStat[] | undefined;

  if (!afStats || afStats.length < 2) {
    return <p className="text-yc-text-tertiary text-sm text-center py-8">{t("stats.notAvailable")}</p>;
  }

  const homeStats = afStats.find((s) => s.team.id === match.homeTeam.id)?.statistics ?? [];
  const awayStats = afStats.find((s) => s.team.id === match.awayTeam.id)?.statistics ?? [];

  // Pair stats by type
  const DISPLAY_ORDER = [
    "Ball Possession", "Total Shots", "Shots on Goal", "Shots off Goal",
    "Corner Kicks", "Fouls", "Offsides", "Yellow Cards", "Red Cards",
    "Passes %", "Total passes", "expected_goals",
  ];

  const statPairs: Array<{ label: string; home: string; away: string; homeNum: number; awayNum: number }> = [];
  for (const statType of DISPLAY_ORDER) {
    const h = homeStats.find((s) => s.type === statType);
    const a = awayStats.find((s) => s.type === statType);
    if (h || a) {
      const hVal = h?.value ?? 0;
      const aVal = a?.value ?? 0;
      const hStr = String(hVal);
      const aStr = String(aVal);
      const hNum = typeof hVal === "number" ? hVal : parseFloat(hStr) || 0;
      const aNum = typeof aVal === "number" ? aVal : parseFloat(aStr) || 0;
      const STAT_KEYS: Record<string, string> = {
        "Ball Possession": "stats.ballPossession",
        "Total Shots": "stats.totalShots",
        "Shots on Goal": "stats.shotsOnGoal",
        "Shots off Goal": "stats.shotsOffGoal",
        "Corner Kicks": "stats.cornerKicks",
        "Fouls": "stats.fouls",
        "Offsides": "stats.offsides",
        "Yellow Cards": "stats.yellowCards",
        "Red Cards": "stats.redCards",
        "Passes %": "stats.passAccuracy",
        "Total passes": "stats.totalPasses",
        "expected_goals": "stats.xG",
      };
      const label = STAT_KEYS[statType] ? t(STAT_KEYS[statType]) : statType;
      statPairs.push({ label, home: hStr, away: aStr, homeNum: hNum, awayNum: aNum });
    }
  }

  if (statPairs.length === 0) {
    return <p className="text-yc-text-tertiary text-sm text-center py-8">{t("stats.notAvailableShort")}</p>;
  }

  return (
    <div className="space-y-3">
      {statPairs.map((stat) => {
        const total = stat.homeNum + stat.awayNum || 1;
        const homePct = (stat.homeNum / total) * 100;
        return (
          <div key={stat.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-mono text-yc-text-primary w-12 text-start">{stat.home}</span>
              <span className="text-xs text-yc-text-tertiary">{stat.label}</span>
              <span className="text-sm font-mono text-yc-text-primary w-12 text-end">{stat.away}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-yc-bg-elevated">
              <div className="bg-yc-green rounded-s-full" style={{ width: `${homePct}%` }} />
              <div className="bg-sky-400 rounded-e-full" style={{ width: `${100 - homePct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Lineup display for one team — uses API-Football data if available */
function TeamLineup({ team, afLineup, side }: { team: TeamDetail; afLineup?: AFLineup; side: "home" | "away" }) {
  const { t } = useI18n();
  const align = side === "home" ? "text-start" : "text-end";

  // Prefer API-Football lineup (has formation, coach, full starting XI)
  const lineup = afLineup?.startXI?.map((p) => p.player) ?? team.lineup ?? [];
  const bench = afLineup?.substitutes?.map((p) => p.player) ?? team.bench ?? [];
  const formation = afLineup?.formation ?? team.formation;
  const coachName = afLineup?.coach?.name ?? team.coach?.name;

  return (
    <div className={`flex-1 ${align}`}>
      {/* Coach + formation */}
      <div className="mb-3">
        {coachName && (
          <p className="text-xs text-yc-text-tertiary mb-0.5">
            {t("match.lineup.coach")} <span className="text-yc-text-secondary">{coachName}</span>
          </p>
        )}
        {formation && (
          <p className="text-xs text-yc-text-tertiary">
            {t("match.lineup.formation")} <span className="text-yc-green font-mono">{formation}</span>
          </p>
        )}
      </div>

      {/* Starting XI */}
      {lineup.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-1.5">{t("match.lineup.startingXI")}</p>
          <div className="space-y-0.5">
            {lineup.map((p) => (
              <div key={p.id ?? p.name} className={`flex items-center gap-2 ${side === "away" ? "flex-row-reverse" : ""}`}>
                <span className="text-xs font-mono text-yc-text-tertiary w-5 text-center shrink-0">
                  {"number" in p ? p.number : ""}
                </span>
                <span className="text-sm text-yc-text-primary truncate">{p.name}</span>
                {"pos" in p && p.pos && (
                  <span className="text-[10px] text-yc-text-tertiary shrink-0">{p.pos}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bench */}
      {bench.length > 0 && (
        <div>
          <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-1.5">{t("match.lineup.bench")}</p>
          <div className="space-y-0.5">
            {bench.map((p) => (
              <div key={p.id ?? p.name} className={`flex items-center gap-2 ${side === "away" ? "flex-row-reverse" : ""}`}>
                <span className="text-xs font-mono text-yc-text-tertiary w-5 text-center shrink-0">
                  {"number" in p ? p.number : ""}
                </span>
                <span className="text-sm text-yc-text-secondary truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lineup.length === 0 && bench.length === 0 && (
        <p className="text-yc-text-tertiary text-sm">{t("match.lineup.notAvailable")}</p>
      )}
    </div>
  );
}

/** H2H tab */
function H2HTab({ matchId }: { matchId: string }) {
  const { t, lang, tTeam } = useI18n();
  const [data, setData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${WORKER_URL}/api/h2h/${matchId}`);
        if (!res.ok) { setLoading(false); return; }
        const json = (await res.json()) as { aggregates: H2HData; matches: H2HMatch[] };
        if (json.aggregates) {
          setData({ ...json.aggregates, matches: json.matches ?? [] });
        }
      } catch {
        // H2H unavailable
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [matchId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 bg-yc-bg-elevated rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return <p className="text-yc-text-tertiary text-sm text-center py-8">{t("match.h2h.notAvailable")}</p>;
  }

  const total = data.homeTeam.wins + data.homeTeam.draws + data.homeTeam.losses;

  return (
    <div className="space-y-6">
      {/* Aggregate */}
      <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4">
        <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-3">
          {t("match.h2h.previousMeetings", { total: String(total) })}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-yc-green font-mono">{data.homeTeam.wins}</p>
            <p className="text-xs text-yc-text-tertiary mt-0.5">{tTeam(data.homeTeam.name)}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-yc-text-secondary font-mono">{data.homeTeam.draws}</p>
            <p className="text-xs text-yc-text-tertiary mt-0.5">{t("match.h2h.draws")}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-yc-green font-mono">{data.awayTeam.wins}</p>
            <p className="text-xs text-yc-text-tertiary mt-0.5">{tTeam(data.awayTeam.name)}</p>
          </div>
        </div>
        {/* Win bar */}
        {total > 0 && (
          <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-yc-bg-elevated">
            <div className="bg-yc-green" style={{ width: `${(data.homeTeam.wins / total) * 100}%` }} />
            <div className="bg-yc-text-tertiary/40" style={{ width: `${(data.homeTeam.draws / total) * 100}%` }} />
            <div className="bg-sky-400" style={{ width: `${(data.awayTeam.wins / total) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Recent meetings */}
      {data.matches.length > 0 && (
        <div>
          <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-2">{t("match.h2h.recentMatches")}</p>
          <div className="space-y-1">
            {data.matches.map((m) => {
              const date = new Date(m.utcDate);
              const dateStr = date.toLocaleDateString(getLocale(lang), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-yc-bg-surface border border-yc-border/50 rounded-lg"
                >
                  <span className="text-xs text-yc-text-tertiary w-24 shrink-0">{dateStr}</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="text-sm text-yc-text-primary truncate">{(() => { const n = tTeam(m.homeTeam.name); return n !== m.homeTeam.name ? n : tTeam(m.homeTeam.tla); })()}</span>
                    <TeamCrest tla={m.homeTeam.tla} crest={m.homeTeam.crest} size="xs" />
                  </div>
                  <span className="font-mono text-sm font-bold text-yc-text-primary shrink-0 w-12 text-center">
                    {m.score.fullTime.home ?? "-"} - {m.score.fullTime.away ?? "-"}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <TeamCrest tla={m.awayTeam.tla} crest={m.awayTeam.crest} size="xs" />
                    <span className="text-sm text-yc-text-primary truncate">{(() => { const n = tTeam(m.awayTeam.name); return n !== m.awayTeam.name ? n : tTeam(m.awayTeam.tla); })()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formation diagram — visual pitch with players positioned by formation
// ---------------------------------------------------------------------------

/** Parse formation string (e.g. "4-3-3") into rows of player counts */
function parseFormation(formation: string): number[] {
  const parts = formation.split("-").map(Number).filter((n) => !isNaN(n) && n > 0);
  if (parts.length < 2) return [];
  return parts;
}

/** Position presets for common formation rows (how many players, x-offsets 0-1) */
function getRowPositions(count: number): number[] {
  if (count === 1) return [0.5];
  if (count === 2) return [0.3, 0.7];
  if (count === 3) return [0.2, 0.5, 0.8];
  if (count === 4) return [0.1, 0.37, 0.63, 0.9];
  if (count === 5) return [0.08, 0.28, 0.5, 0.72, 0.92];
  if (count === 6) return [0.05, 0.22, 0.39, 0.61, 0.78, 0.95];
  // Fallback: evenly distribute
  return Array.from({ length: count }, (_, i) => (i + 1) / (count + 1));
}

interface FormationPlayer {
  name: string;
  number: number;
  pos: string;
}

function FormationPitch({
  formation,
  players,
  teamColor = "#00ff88",
}: {
  formation: string;
  players: FormationPlayer[];
  teamColor?: string;
}) {
  const rows = parseFormation(formation);
  if (rows.length === 0 || players.length === 0) return null;

  // GK + outfield rows from back to front
  const allRows = [1, ...rows]; // GK is 1 player
  const totalRows = allRows.length;

  // Assign players to rows: GK first, then by formation rows
  let playerIdx = 0;
  const positioned: Array<{ x: number; y: number; name: string; number: number }> = [];

  for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
    const count = allRows[rowIdx] ?? 1;
    const xPositions = getRowPositions(count);
    // y: GK at bottom (0.92), last row at top (0.12)
    const y = 0.92 - (rowIdx / (totalRows - 1 || 1)) * 0.8;

    for (const x of xPositions) {
      if (playerIdx < players.length) {
        positioned.push({ x, y, name: players[playerIdx]!.name, number: players[playerIdx]!.number });
        playerIdx++;
      }
    }
  }

  return (
    <div className="relative w-full aspect-[2/3] max-w-[280px] mx-auto">
      {/* Pitch SVG */}
      <svg viewBox="0 0 200 300" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {/* Pitch background */}
        <rect x="0" y="0" width="200" height="300" rx="8" fill="var(--yc-bg-elevated)" />
        {/* Outline */}
        <rect x="10" y="10" width="180" height="280" rx="2" fill="none" stroke="var(--yc-border-hover)" strokeWidth="1" />
        {/* Center line */}
        <line x1="10" y1="150" x2="190" y2="150" stroke="var(--yc-border-hover)" strokeWidth="0.8" />
        {/* Center circle */}
        <circle cx="100" cy="150" r="25" fill="none" stroke="var(--yc-border-hover)" strokeWidth="0.8" />
        <circle cx="100" cy="150" r="2" fill="var(--yc-border-hover)" />
        {/* Penalty areas */}
        <rect x="45" y="10" width="110" height="45" fill="none" stroke="var(--yc-border-hover)" strokeWidth="0.8" />
        <rect x="45" y="245" width="110" height="45" fill="none" stroke="var(--yc-border-hover)" strokeWidth="0.8" />
        {/* Goal areas */}
        <rect x="65" y="10" width="70" height="18" fill="none" stroke="var(--yc-border-hover)" strokeWidth="0.6" />
        <rect x="65" y="272" width="70" height="18" fill="none" stroke="var(--yc-border-hover)" strokeWidth="0.6" />
        {/* Penalty spots */}
        <circle cx="100" cy="42" r="1.5" fill="var(--yc-border-hover)" />
        <circle cx="100" cy="258" r="1.5" fill="var(--yc-border-hover)" />
      </svg>

      {/* Player dots */}
      {positioned.map((p, i) => (
        <div
          key={i}
          className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2"
            style={{
              backgroundColor: `${teamColor}20`,
              borderColor: teamColor,
              color: teamColor,
            }}
          >
            {p.number}
          </div>
          <span className="text-[8px] text-yc-text-secondary mt-0.5 max-w-[50px] text-center leading-tight truncate">
            {p.name.split(" ").pop()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Predictions tab — community consensus + pool members' picks
// ---------------------------------------------------------------------------

interface PoolPrediction {
  user_id: string;
  home_score: number | null;
  away_score: number | null;
  quick_pick: "H" | "D" | "A" | null;
  points: number | null;
  is_joker: boolean;
  confidence: 1 | 2 | 3 | null;
}

interface PoolMemberProfile {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

function PredictionsTab({
  matchId,
  homeTeam,
  awayTeam,
  competitionId,
  hasPrediction,
  isLocked,
}: {
  matchId: number;
  homeTeam: { name: string; tla: string };
  awayTeam: { name: string; tla: string };
  competitionId: string;
  hasPrediction: boolean;
  isLocked: boolean;
}) {
  const { t, tTeam } = useI18n();
  const { user } = useAuth();
  const consensus = useConsensus(matchId, hasPrediction, competitionId, isLocked);
  const { pools } = useMyPools();

  // Filter pools for this competition
  const compPools = useMemo(
    () => pools.filter((p) => p.competition_id === competitionId),
    [pools, competitionId],
  );

  // Track selected pool for member picks
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const activePoolId = selectedPoolId ?? compPools[0]?.id ?? null;
  const { members } = usePoolMembers(activePoolId);

  // Fetch pool members' predictions for this match
  const [poolPredictions, setPoolPredictions] = useState<PoolPrediction[]>([]);
  const [poolPredLoading, setPoolPredLoading] = useState(false);
  const [poolPredError, setPoolPredError] = useState<string | null>(null);

  useEffect(() => {
    if (!activePoolId || members.length === 0 || !isLocked) {
      setPoolPredictions([]);
      return;
    }

    setPoolPredLoading(true);
    setPoolPredError(null);
    const memberIds = members.map((m) => m.user_id);

    supabase
      .from("yc_predictions")
      .select("user_id, home_score, away_score, quick_pick, points, is_joker, confidence")
      .eq("match_id", matchId)
      .eq("competition_id", competitionId)
      .in("user_id", memberIds)
      .then(
        ({ data }) => {
          setPoolPredictions((data as PoolPrediction[]) ?? []);
          setPoolPredLoading(false);
        },
        () => {
          setPoolPredError("Could not load data");
          setPoolPredLoading(false);
        },
      );
  }, [activePoolId, members, matchId, competitionId, isLocked]);

  // Build member profile map
  const memberMap = useMemo(() => {
    const map = new Map<string, PoolMemberProfile>();
    for (const m of members) {
      map.set(m.user_id, {
        user_id: m.user_id,
        handle: m.handle ?? "user",
        display_name: m.display_name ?? null,
        avatar_url: m.avatar_url ?? null,
      });
    }
    return map;
  }, [members]);

  const homeName = (() => { const n = tTeam(homeTeam.name); return n !== homeTeam.name ? n : tTeam(homeTeam.tla); })();
  const awayName = (() => { const n = tTeam(awayTeam.name); return n !== awayTeam.name ? n : tTeam(awayTeam.tla); })();

  return (
    <div className="space-y-6">
      {/* Community consensus */}
      <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={16} className="text-yc-green" />
          <h3 className="text-sm font-semibold text-yc-text-primary">{t("match.predictions.consensus")}</h3>
        </div>

        {!hasPrediction ? (
          <p className="text-sm text-yc-text-tertiary text-center py-4">{t("match.predictions.predictFirst")}</p>
        ) : !isLocked ? (
          <p className="text-sm text-yc-text-tertiary text-center py-4">{t("match.predictions.afterKickoff")}</p>
        ) : !consensus ? (
          <p className="text-sm text-yc-text-tertiary text-center py-4">{t("match.predictions.notEnough")}</p>
        ) : (
          <>
            {/* H/D/A percentage bar */}
            <div className="flex h-10 rounded-lg overflow-hidden mb-3">
              {consensus.home > 0 && (
                <div
                  className="flex items-center justify-center bg-yc-green/20 border-r border-yc-bg-deep/30 transition-all"
                  style={{ width: `${consensus.home}%` }}
                >
                  <span className="text-sm font-bold text-yc-green">{consensus.home}%</span>
                </div>
              )}
              {consensus.draw > 0 && (
                <div
                  className="flex items-center justify-center bg-yc-draw/20 border-r border-yc-bg-deep/30 transition-all"
                  style={{ width: `${consensus.draw}%` }}
                >
                  <span className="text-sm font-bold text-yc-draw">{consensus.draw}%</span>
                </div>
              )}
              {consensus.away > 0 && (
                <div
                  className="flex items-center justify-center bg-sky-500/20 transition-all"
                  style={{ width: `${consensus.away}%` }}
                >
                  <span className="text-sm font-bold text-sky-400">{consensus.away}%</span>
                </div>
              )}
            </div>

            {/* Labels */}
            <div className="flex justify-between text-xs text-yc-text-tertiary">
              <span>{homeName}</span>
              <span>{t("match.predictions.draw")}</span>
              <span>{awayName}</span>
            </div>

            <p className="text-xs text-yc-text-tertiary text-center mt-3">
              {t("match.predictions.totalVotes", { count: String(consensus.total) })}
            </p>
          </>
        )}
      </div>

      {/* Pool members' predictions */}
      {user && compPools.length > 0 && isLocked && (
        <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-yc-green" />
            <h3 className="text-sm font-semibold text-yc-text-primary">{t("match.predictions.poolPicks")}</h3>
          </div>

          {/* Pool selector (if multiple pools) */}
          {compPools.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {compPools.map((pool) => (
                <button
                  key={pool.id}
                  onClick={() => setSelectedPoolId(pool.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    activePoolId === pool.id
                      ? "bg-yc-green/20 text-yc-green border border-yc-green-muted/30"
                      : "bg-yc-bg-elevated text-yc-text-secondary border border-yc-border hover:border-yc-border-hover"
                  }`}
                >
                  {pool.name}
                </button>
              ))}
            </div>
          )}

          {poolPredError && <p className="text-center text-sm text-yc-danger py-4">{poolPredError}</p>}
          {poolPredLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-yc-bg-elevated rounded-lg animate-pulse" />
              ))}
            </div>
          ) : poolPredictions.length === 0 ? (
            <p className="text-sm text-yc-text-tertiary text-center py-4">{t("match.predictions.noPoolPicks")}</p>
          ) : (
            <div className="space-y-1.5">
              {poolPredictions
                .sort((a, b) => (b.points ?? -1) - (a.points ?? -1))
                .map((pred) => {
                  const member = memberMap.get(pred.user_id);
                  const isMe = pred.user_id === user?.id;
                  const displayName = member?.display_name ?? member?.handle ?? "?";

                  return (
                    <div
                      key={pred.user_id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg min-w-0 ${
                        isMe
                          ? "bg-yc-green/5 border border-yc-green-muted/20"
                          : "bg-yc-bg-elevated/50"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-7 h-7 rounded-full bg-yc-bg-elevated flex items-center justify-center shrink-0 overflow-hidden">
                        {member?.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={14} className="text-yc-text-tertiary" />
                        )}
                      </div>

                      {/* Name */}
                      <span className={`text-sm flex-1 truncate ${isMe ? "text-yc-green font-medium" : "text-yc-text-primary"}`}>
                        {displayName}
                      </span>

                      {/* Prediction */}
                      <span className="font-mono text-sm font-bold text-yc-text-primary shrink-0">
                        {pred.quick_pick
                          ? { H: homeTeam.tla, D: "X", A: awayTeam.tla }[pred.quick_pick]
                          : `${pred.home_score}-${pred.away_score}`}
                      </span>

                      {/* Confidence stars */}
                      <ConfidenceBadge level={pred.confidence} />

                      {/* Joker badge */}
                      {pred.is_joker && (
                        <span className="text-[10px] font-bold text-yc-draw bg-yc-draw/10 px-1.5 py-0.5 rounded">2x</span>
                      )}

                      {/* Points */}
                      {pred.points !== null && (
                        <span className={`font-mono text-xs font-bold shrink-0 min-w-[32px] text-end ${
                          pred.points >= 5 ? "text-yc-green" : pred.points > 0 ? "text-yc-draw" : "text-yc-danger"
                        }`}>
                          {pred.points} {t("pts")}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="h-6 w-24 bg-yc-bg-elevated rounded animate-pulse mb-6" />
      {/* Score header skeleton */}
      <div className="flex items-center justify-center gap-6 py-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-yc-bg-elevated rounded-full animate-pulse" />
          <div className="w-12 h-4 bg-yc-bg-elevated rounded animate-pulse" />
        </div>
        <div className="w-24 h-10 bg-yc-bg-elevated rounded animate-pulse" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-yc-bg-elevated rounded-full animate-pulse" />
          <div className="w-12 h-4 bg-yc-bg-elevated rounded animate-pulse" />
        </div>
      </div>
      {/* Events skeleton */}
      <div className="space-y-2 mt-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-yc-bg-elevated rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const comp = useCompetition();
  const navigate = useNavigate();
  const { t, lang, tTeam } = useI18n();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");
  const { predictions } = useMyPredictions(comp.id);
  const myPrediction = predictions.find((p) => p.match_id === Number(id));

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const res = await fetch(`${WORKER_URL}/api/match/${id}/detail`);
        if (!res.ok) { setLoading(false); return; }
        const data = (await res.json()) as MatchData;
        setMatch(data);
      } catch {
        // API error
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Auto-refresh: live (30s), upcoming within 24h (5min), recently finished within 1h (2min)
  useEffect(() => {
    if (!match) return;
    const isLiveNow = match.status === "IN_PLAY" || match.status === "PAUSED";
    const kickoffMs = new Date(match.utcDate).getTime();
    const msUntilKickoff = kickoffMs - Date.now();
    const isUpcoming = match.status === "TIMED" && msUntilKickoff > 0 && msUntilKickoff <= 24 * 60 * 60_000;
    // Recently finished: refresh to pick up updated lineups/events/stats
    const msSinceKickoff = Date.now() - kickoffMs;
    const isRecentlyFinished = match.status === "FINISHED" && msSinceKickoff < 60 * 60_000;

    if (!isLiveNow && !isUpcoming && !isRecentlyFinished) return;

    const pollMs = isLiveNow ? 30_000 : isRecentlyFinished ? 2 * 60_000 : 5 * 60_000;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/match/${id}/detail`);
        if (res.ok) {
          const data = (await res.json()) as MatchData;
          setMatch(data);
        }
      } catch { /* silent */ }
    }, pollMs);
    return () => clearInterval(interval);
  }, [match?.status, id, match?.utcDate]);

  if (loading) return <DetailSkeleton />;

  if (!match) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-yc-text-tertiary text-sm">Match data not available.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-yc-green text-sm hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const hasScore = match.score.fullTime.home !== null;
  const kickoff = new Date(match.utcDate);
  const dateStr = kickoff.toLocaleDateString(getLocale(lang), {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const timeStr = formatTimeWithTZ(kickoff, lang);
  const mainRef = (match.referees ?? []).find((r) => r.type === "REFEREE");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Back button */}
      <button
        onClick={() => navigate(`/${comp.id}/matches`)}
        className="flex items-center gap-1.5 text-yc-text-tertiary hover:text-yc-text-primary text-sm mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        {comp.shortName} — {t("nav.matches")}
      </button>

      {/* Score header */}
      <div
        className={`bg-yc-bg-surface border rounded-xl p-4 sm:p-5 mb-6 ${
          isLive ? "border-yc-green-muted/50 shadow-[0_0_16px_rgba(0,255,136,0.1)]" : "border-yc-border"
        }`}
      >
        {/* Status + meta */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <StatusBadge status={match.status} />
          {match.matchday && (
            <span className="text-xs text-yc-text-tertiary">{t("match.matchday", { num: match.matchday })}</span>
          )}
        </div>

        {/* Teams + score */}
        <div className="flex items-center justify-center gap-4 sm:gap-8">
          {/* Home */}
          <Link to={`/${comp.id}/team/${match.homeTeam.id}`} className="flex flex-col items-center gap-2 flex-1 hover:opacity-80 transition-opacity">
            <TeamCrest
              tla={match.homeTeam.tla}
              crest={match.homeTeam.crest}
              size="xl"
            />
            <p className="text-sm sm:text-base font-semibold text-yc-text-primary text-center">
              {(() => { const n = tTeam(match.homeTeam.name); return n !== match.homeTeam.name ? n : tTeam(match.homeTeam.tla); })()}
            </p>
          </Link>

          {/* Score */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {hasScore ? (
              <>
                <span
                  className={`font-mono text-3xl sm:text-4xl font-bold ${
                    isLive ? "text-yc-green" : "text-yc-text-primary"
                  }`}
                >
                  {match.score.fullTime.home} - {match.score.fullTime.away}
                </span>
                {match.score.halfTime.home !== null && (isFinished || isLive) && (
                  <span className="text-xs text-yc-text-tertiary font-mono">
                    {t("match.htScore", { home: String(match.score.halfTime.home), away: String(match.score.halfTime.away) })}
                  </span>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-yc-green font-mono text-2xl font-bold">vs</span>
                <div className="flex items-center gap-1 text-yc-text-secondary">
                  <Clock size={12} />
                  <span className="text-sm">{timeStr}</span>
                </div>
              </div>
            )}
          </div>

          {/* Away */}
          <Link to={`/${comp.id}/team/${match.awayTeam.id}`} className="flex flex-col items-center gap-2 flex-1 hover:opacity-80 transition-opacity">
            <TeamCrest
              tla={match.awayTeam.tla}
              crest={match.awayTeam.crest}
              size="xl"
            />
            <p className="text-sm sm:text-base font-semibold text-yc-text-primary text-center">
              {(() => { const n = tTeam(match.awayTeam.name); return n !== match.awayTeam.name ? n : tTeam(match.awayTeam.tla); })()}
            </p>
          </Link>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-yc-text-tertiary">
          <span>{dateStr}</span>
          {match.venue && (
            <span className="flex items-center gap-1">
              <MapPin size={10} />
              {match.venue}
            </span>
          )}
          {mainRef && (
            <span>Ref: {mainRef.name}</span>
          )}
        </div>
      </div>

      {/* Your prediction banner */}
      {myPrediction && (
        <div
          className={`rounded-lg px-4 py-3 mb-4 flex items-center justify-between text-sm ${
            myPrediction.scored_at
              ? myPrediction.points && myPrediction.points >= 5
                ? "bg-yc-green/10 border border-yc-green-muted/30"
                : myPrediction.points && myPrediction.points > 0
                  ? "bg-yc-warning/10 border border-yc-warning/30"
                  : "bg-yc-danger/10 border border-yc-danger/30"
              : "bg-yc-bg-elevated border border-yc-border"
          }`}
        >
          <span className="text-yc-text-primary">
            {t("yourPrediction")}{" "}
            <span className="font-mono font-bold">
              {myPrediction.quick_pick
                ? { H: t("quickPick.home"), D: t("quickPick.draw"), A: t("quickPick.away") }[myPrediction.quick_pick]
                : `${myPrediction.home_score} - ${myPrediction.away_score}`}
            </span>
          </span>
          <span
            className={`font-mono font-bold ${
              myPrediction.scored_at
                ? myPrediction.points && myPrediction.points >= 5
                  ? "text-yc-green"
                  : myPrediction.points && myPrediction.points > 0
                    ? "text-yc-warning"
                    : "text-yc-danger"
                : "text-yc-text-tertiary"
            }`}
          >
            {myPrediction.scored_at
              ? `${myPrediction.points ?? 0} ${t("pts")}`
              : t("pending")}
          </span>
        </div>
      )}

      {/* Tabs */}
      <TabBar active={tab} onChange={setTab} />

      {/* Tab content */}
      {tab === "overview" && (
        <div>
          <EventsTimeline match={match} />
        </div>
      )}

      {tab === "stats" && (
        <StatsTab match={match} />
      )}

      {tab === "lineup" && (() => {
        const afLineups = (match as unknown as Record<string, unknown>).lineups as AFLineup[] | undefined;
        const homeLineup = afLineups?.find((l) => l.team.id === match.homeTeam.id);
        const awayLineup = afLineups?.find((l) => l.team.id === match.awayTeam.id);

        const homeFormation = homeLineup?.formation ?? match.homeTeam.formation;
        const awayFormation = awayLineup?.formation ?? match.awayTeam.formation;
        const homePlayers: FormationPlayer[] = (homeLineup?.startXI?.map((p) => p.player) ?? match.homeTeam.lineup ?? [])
          .map((p) => ({ name: p.name, number: "number" in p ? (p as { number: number }).number : ("shirtNumber" in p ? (p as { shirtNumber: number }).shirtNumber : 0), pos: "pos" in p ? String(p.pos) : ("position" in p ? String(p.position) : "") }));
        const awayPlayers: FormationPlayer[] = (awayLineup?.startXI?.map((p) => p.player) ?? match.awayTeam.lineup ?? [])
          .map((p) => ({ name: p.name, number: "number" in p ? (p as { number: number }).number : ("shirtNumber" in p ? (p as { shirtNumber: number }).shirtNumber : 0), pos: "pos" in p ? String(p.pos) : ("position" in p ? String(p.position) : "") }));

        const showFormation = homeFormation && homePlayers.length >= 11;

        return (
          <div className="space-y-6">
            {/* Formation diagrams */}
            {showFormation && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-yc-text-tertiary text-center mb-2">
                    {tTeam(match.homeTeam.tla)} <span className="text-yc-green font-mono">{homeFormation}</span>
                  </p>
                  <FormationPitch
                    formation={homeFormation}
                    players={homePlayers}
                    teamColor="#00ff88"
                  />
                </div>
                <div>
                  <p className="text-xs text-yc-text-tertiary text-center mb-2">
                    {tTeam(match.awayTeam.tla)} <span className="text-sky-400 font-mono">{awayFormation ?? ""}</span>
                  </p>
                  {awayFormation ? (
                    <FormationPitch
                      formation={awayFormation}
                      players={awayPlayers}
                      teamColor="#38bdf8"
                    />
                  ) : (
                    <p className="text-yc-text-tertiary text-sm text-center py-8">{t("match.lineup.notAvailable")}</p>
                  )}
                </div>
              </div>
            )}

            {/* Text lineup */}
            <div className="flex gap-4 sm:gap-8">
              <TeamLineup team={match.homeTeam} afLineup={homeLineup} side="home" />
              <div className="w-px bg-yc-border shrink-0" />
              <TeamLineup team={match.awayTeam} afLineup={awayLineup} side="away" />
            </div>
          </div>
        );
      })()}

      {tab === "h2h" && id && (
        <H2HTab matchId={id} />
      )}

      {tab === "predictions" && (
        <PredictionsTab
          matchId={match.id}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          competitionId={comp.id}
          hasPrediction={!!myPrediction}
          isLocked={isLive || isFinished}
        />
      )}
    </div>
  );
}
