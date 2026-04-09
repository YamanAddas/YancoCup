import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import TeamCrest from "../components/match/TeamCrest";

const WORKER_URL =
  import.meta.env.VITE_WORKER_URL ??
  "https://yancocup-api.catbyte1985.workers.dev";

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

type TabId = "overview" | "stats" | "lineup" | "h2h";
const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "lineup", label: "Lineup" },
  { id: "h2h", label: "H2H" },
];

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="flex border-b border-yc-border mb-6">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            active === tab.id
              ? "text-yc-green"
              : "text-yc-text-tertiary hover:text-yc-text-secondary"
          }`}
        >
          {tab.label}
          {active === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-yc-green rounded-t" />
          )}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status, minute }: { status: string; minute?: string }) {
  if (status === "IN_PLAY" || status === "PAUSED") {
    return (
      <span className="flex items-center gap-1.5 text-yc-green text-sm font-medium">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yc-green" />
        </span>
        {status === "PAUSED" ? "HT" : minute ?? "LIVE"}
      </span>
    );
  }
  if (status === "FINISHED") {
    return <span className="text-yc-text-tertiary text-sm font-medium">FT</span>;
  }
  if (status === "TIMED" || status === "SCHEDULED") {
    return <span className="text-yc-text-secondary text-sm font-medium">Upcoming</span>;
  }
  return <span className="text-yc-text-tertiary text-sm font-medium">{status}</span>;
}

/** Event icon for the timeline */
function EventIcon({ type }: { type: "goal" | "own_goal" | "penalty" | "yellow" | "yellow_red" | "red" | "sub" }) {
  const icons: Record<string, { bg: string; text: string; label: string }> = {
    goal: { bg: "bg-yc-green/20", text: "text-yc-green", label: "⚽" },
    own_goal: { bg: "bg-red-500/20", text: "text-red-400", label: "⚽" },
    penalty: { bg: "bg-yc-green/20", text: "text-yc-green", label: "P" },
    yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "▮" },
    yellow_red: { bg: "bg-red-500/20", text: "text-red-400", label: "▮▮" },
    red: { bg: "bg-red-500/20", text: "text-red-400", label: "▮" },
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
        secondary: type === "goal" && ev.assist.name ? `Assist: ${ev.assist.name}`
          : type === "own_goal" ? "Own Goal"
          : type === "sub" ? `↓ ${ev.player.name ?? ""}`
          : undefined,
      });
    }
  } else {
    // Fallback to football-data.org data
    for (const g of match.goals ?? []) {
      const side = g.team.id === match.homeTeam.id ? "home" : "away";
      const goalType = g.type === "OWN_GOAL" ? "own_goal" : g.type === "PENALTY" ? "penalty" : "goal";
      events.push({
        minute: g.minute,
        extra: g.injuryTime,
        side,
        type: goalType,
        primary: g.scorer?.name ?? "Unknown",
        secondary: g.type === "OWN_GOAL" ? "Own Goal" : g.assist?.name ? `Assist: ${g.assist.name}` : undefined,
      });
    }
    for (const b of match.bookings ?? []) {
      const side = b.team.id === match.homeTeam.id ? "home" : "away";
      events.push({ minute: b.minute, side, type: b.card === "RED" ? "red" : "yellow", primary: b.player.name });
    }
    for (const s of match.substitutions ?? []) {
      const side = s.team.id === match.homeTeam.id ? "home" : "away";
      events.push({ minute: s.minute, side, type: "sub", primary: s.playerIn.name, secondary: `↓ ${s.playerOut.name}` });
    }
  }

  events.sort((a, b) => a.minute - b.minute);

  if (events.length === 0) {
    return <p className="text-yc-text-tertiary text-sm text-center py-6">No events yet</p>;
  }

  return (
    <div className="space-y-1">
      {events.map((ev, i) => {
        const minuteLabel = ev.extra ? `${ev.minute}+${ev.extra}'` : `${ev.minute}'`;
        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-yc-bg-elevated/30 transition-colors ${
              ev.side === "away" ? "flex-row-reverse text-right" : ""
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
  const afStats = (match as unknown as Record<string, unknown>).statistics as AFStat[] | undefined;

  if (!afStats || afStats.length < 2) {
    return <p className="text-yc-text-tertiary text-sm text-center py-8">Statistics not available for this match</p>;
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
      const label = statType === "expected_goals" ? "xG" : statType;
      statPairs.push({ label, home: hStr, away: aStr, homeNum: hNum, awayNum: aNum });
    }
  }

  if (statPairs.length === 0) {
    return <p className="text-yc-text-tertiary text-sm text-center py-8">Statistics not available</p>;
  }

  return (
    <div className="space-y-3">
      {statPairs.map((stat) => {
        const total = stat.homeNum + stat.awayNum || 1;
        const homePct = (stat.homeNum / total) * 100;
        return (
          <div key={stat.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-mono text-yc-text-primary w-12 text-left">{stat.home}</span>
              <span className="text-xs text-yc-text-tertiary">{stat.label}</span>
              <span className="text-sm font-mono text-yc-text-primary w-12 text-right">{stat.away}</span>
            </div>
            <div className="flex h-1.5 rounded-full overflow-hidden bg-yc-bg-elevated">
              <div className="bg-yc-green rounded-l-full" style={{ width: `${homePct}%` }} />
              <div className="bg-sky-400 rounded-r-full" style={{ width: `${100 - homePct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Lineup display for one team — uses API-Football data if available */
function TeamLineup({ team, afLineup, side }: { team: TeamDetail; afLineup?: AFLineup; side: "home" | "away" }) {
  const align = side === "home" ? "text-left" : "text-right";

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
            Coach: <span className="text-yc-text-secondary">{coachName}</span>
          </p>
        )}
        {formation && (
          <p className="text-xs text-yc-text-tertiary">
            Formation: <span className="text-yc-green font-mono">{formation}</span>
          </p>
        )}
      </div>

      {/* Starting XI */}
      {lineup.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-1.5">Starting XI</p>
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
          <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-1.5">Bench</p>
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
        <p className="text-yc-text-tertiary text-sm">Lineup not available</p>
      )}
    </div>
  );
}

/** H2H tab */
function H2HTab({ matchId }: { matchId: string }) {
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
    return <p className="text-yc-text-tertiary text-sm text-center py-8">Head-to-head data not available</p>;
  }

  const total = data.homeTeam.wins + data.homeTeam.draws + data.homeTeam.losses;

  return (
    <div className="space-y-6">
      {/* Aggregate */}
      <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4">
        <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-3">
          {total} Previous Meetings
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-yc-green font-mono">{data.homeTeam.wins}</p>
            <p className="text-xs text-yc-text-tertiary mt-0.5">{data.homeTeam.name}</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-yc-text-secondary font-mono">{data.homeTeam.draws}</p>
            <p className="text-xs text-yc-text-tertiary mt-0.5">Draws</p>
          </div>
          <div className="flex-1 text-center">
            <p className="text-2xl font-bold text-yc-green font-mono">{data.awayTeam.wins}</p>
            <p className="text-xs text-yc-text-tertiary mt-0.5">{data.awayTeam.name}</p>
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
          <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-2">Recent Matches</p>
          <div className="space-y-1">
            {data.matches.map((m) => {
              const date = new Date(m.utcDate);
              const dateStr = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2.5 bg-yc-bg-surface border border-yc-border/50 rounded-lg"
                >
                  <span className="text-xs text-yc-text-tertiary w-24 shrink-0">{dateStr}</span>
                  <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="text-sm text-yc-text-primary truncate">{m.homeTeam.shortName}</span>
                    <TeamCrest tla={m.homeTeam.tla} crest={m.homeTeam.crest} size="xs" />
                  </div>
                  <span className="font-mono text-sm font-bold text-yc-text-primary shrink-0 w-12 text-center">
                    {m.score.fullTime.home ?? "-"} - {m.score.fullTime.away ?? "-"}
                  </span>
                  <div className="flex items-center gap-2 flex-1">
                    <TeamCrest tla={m.awayTeam.tla} crest={m.awayTeam.crest} size="xs" />
                    <span className="text-sm text-yc-text-primary truncate">{m.awayTeam.shortName}</span>
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
  const { t } = useI18n();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("overview");

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

  // Auto-refresh for live matches
  useEffect(() => {
    if (!match || (match.status !== "IN_PLAY" && match.status !== "PAUSED")) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/match/${id}/detail`);
        if (res.ok) {
          const data = (await res.json()) as MatchData;
          setMatch(data);
        }
      } catch { /* silent */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, [match?.status, id]);

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
  const dateStr = kickoff.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = kickoff.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
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
        className={`bg-yc-bg-surface border rounded-xl p-6 mb-6 ${
          isLive ? "border-yc-green-muted/50 shadow-[0_0_16px_rgba(0,255,136,0.1)]" : "border-yc-border"
        }`}
      >
        {/* Status + meta */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <StatusBadge status={match.status} />
          {match.matchday && (
            <span className="text-xs text-yc-text-tertiary">Matchday {match.matchday}</span>
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
              {match.homeTeam.shortName}
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
                    HT {match.score.halfTime.home} - {match.score.halfTime.away}
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
              {match.awayTeam.shortName}
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
        return (
          <div className="flex gap-4 sm:gap-8">
            <TeamLineup team={match.homeTeam} afLineup={homeLineup} side="home" />
            <div className="w-px bg-yc-border shrink-0" />
            <TeamLineup team={match.awayTeam} afLineup={awayLineup} side="away" />
          </div>
        );
      })()}

      {tab === "h2h" && id && (
        <H2HTab matchId={id} />
      )}
    </div>
  );
}
