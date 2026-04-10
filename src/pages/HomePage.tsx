import { useMemo, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import GlobeView from "../components/globe/GlobeView";
import Countdown from "../components/layout/Countdown";
import MatchCard from "../components/match/MatchCard";
import { useSchedule } from "../hooks/useSchedule";
import { useTeamMap } from "../hooks/useTeams";
import { useVenueMap } from "../hooks/useVenues";
import { useScores } from "../hooks/useScores";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { usePredictedMatchIds } from "../hooks/usePredictions";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { COMPETITION_LIST } from "../lib/competitions";
import { getRank, getRankStars } from "../lib/ranks";
import ActivityFeed from "../components/activity/ActivityFeed";
import type { Match } from "../types";
import {
  Trophy,
  ArrowRight,
  Calendar,
  BarChart3,
  Activity,
  ChevronRight,
  Target,
  Star,
} from "lucide-react";

const WORKER_URL =
  import.meta.env.VITE_WORKER_URL ??
  "https://yancocup-api.catbyte1985.workers.dev";

function PersonalizedGreeting() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const { entries } = useLeaderboard("WC");

  if (!user || !profile) return null;

  const myEntry = entries.find((e) => e.userId === user.id);
  const points = myEntry?.totalPoints ?? 0;
  const rank = getRank(points);
  const stars = getRankStars(points);
  const displayName = profile.display_name ?? profile.handle;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-yc-text-secondary">
          {t("home.greeting", { name: displayName })}
        </p>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${rank.bgColor} ${rank.color} ${rank.borderColor} border`}
        >
          {rank.name}
          <span className="flex gap-px">
            {Array.from({ length: Math.min(stars, 5) }).map((_, i) => (
              <Star key={i} size={8} fill="currentColor" />
            ))}
          </span>
        </span>
        <span className="text-xs font-mono text-yc-text-tertiary">{points} pts</span>
      </div>
    </section>
  );
}

function CompetitionCards() {
  const { t, tComp } = useI18n();

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 mb-5">
        <Trophy size={18} className="text-yc-green" />
        <h3 className="font-heading text-xl font-bold">
          {t("home.competitions")}
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {COMPETITION_LIST.map((comp) => (
          <NavLink
            key={comp.id}
            to={`/${comp.id}/overview`}
            className="group yc-card p-4 rounded-xl transition-all duration-300 hover:border-[var(--yc-border-accent)] hover:shadow-[0_0_20px_rgba(0,255,136,0.06)]"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center p-1.5"
                style={{ backgroundColor: comp.emblemBg }}
              >
                <img
                  src={comp.emblem}
                  alt={comp.shortName}
                  className="h-7 w-7 object-contain"
                  loading="lazy"
                />
              </div>
              <ChevronRight
                size={14}
                className="text-yc-text-tertiary group-hover:text-yc-green transition-colors"
              />
            </div>
            <p className="text-yc-text-primary text-sm font-semibold leading-tight">
              {tComp(comp.id).shortName}
            </p>
            <p className="text-yc-text-tertiary text-xs mt-0.5">
              {comp.seasonLabel}
            </p>
          </NavLink>
        ))}
      </div>
    </section>
  );
}

const LEAGUE_COMPS = ["PL", "PD", "BL1", "SA", "FL1"];

interface WorkerMatch {
  apiId: number;
  competitionCode: string;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  group: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeCrest: string | null;
  awayCrest: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
}

function convertWorkerMatch(m: WorkerMatch): Match {
  const d = new Date(m.utcDate);
  return {
    id: m.apiId,
    date: d.toISOString().slice(0, 10),
    time: d.toISOString().slice(11, 16),
    homeTeam: m.homeTeam?.toLowerCase() ?? null,
    awayTeam: m.awayTeam?.toLowerCase() ?? null,
    homeCrest: m.homeCrest ?? null,
    awayCrest: m.awayCrest ?? null,
    homeTeamName: m.homeTeamName ?? null,
    awayTeamName: m.awayTeamName ?? null,
    venueId: "",
    group: m.group,
    round: "group" as const,
    matchday: m.matchday,
  };
}

function TodaysMatches() {
  const wcMatches = useSchedule();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { scoreMap } = useScores();
  const predictedIds = usePredictedMatchIds();
  const { t } = useI18n();
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [upcomingLeague, setUpcomingLeague] = useState<Match[]>([]);
  // Track per-match competition code for detail page linking
  const [matchCompMap, setMatchCompMap] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    async function fetchLive() {
      const compMap = new Map<number, string>();

      // Fetch live matches across all competitions
      try {
        const res = await fetch(`${WORKER_URL}/api/live`);
        if (res.ok) {
          const data = (await res.json()) as { matches: WorkerMatch[] };
          if (data.matches.length > 0) {
            for (const m of data.matches) compMap.set(m.apiId, m.competitionCode);
            setLiveMatches(data.matches.map(convertWorkerMatch));
          }
        }
      } catch { /* */ }

      // Fetch upcoming from ALL league competitions in parallel
      try {
        const results = await Promise.allSettled(
          LEAGUE_COMPS.map(async (comp) => {
            const res = await fetch(`${WORKER_URL}/api/${comp}/scores`);
            if (!res.ok) return [];
            const data = (await res.json()) as { matches: WorkerMatch[] };
            return data.matches ?? [];
          }),
        );

        const now = new Date().toISOString();
        const allUpcoming: WorkerMatch[] = [];

        for (const result of results) {
          if (result.status === "fulfilled") {
            for (const m of result.value) {
              if (m.status === "TIMED" && m.utcDate > now) {
                allUpcoming.push(m);
              }
            }
          }
        }

        // Sort by date, take nearest 6
        allUpcoming.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
        const nearest = allUpcoming.slice(0, 6);

        if (nearest.length > 0) {
          for (const m of nearest) compMap.set(m.apiId, m.competitionCode);
          setUpcomingLeague(nearest.map(convertWorkerMatch));
        }
      } catch { /* */ }

      setMatchCompMap(compMap);
    }
    fetchLive();
  }, []);

  const displayMatches = useMemo(() => {
    if (liveMatches.length > 0) {
      return { matches: liveMatches, label: t("home.liveNow"), comp: "" };
    }

    const today = new Date().toISOString().slice(0, 10);
    const todaysWc = wcMatches.filter((m) => m.date === today);
    if (todaysWc.length > 0) {
      return { matches: todaysWc, label: t("home.todaysMatches"), comp: "WC" };
    }

    if (upcomingLeague.length > 0) {
      const firstDate = upcomingLeague[0]!.date;
      const dateLabel = new Date(`${firstDate}T00:00:00Z`).toLocaleDateString(
        undefined,
        { weekday: "long", month: "short", day: "numeric" },
      );
      return {
        matches: upcomingLeague,
        label: `${t("home.nextMatches")} — ${dateLabel}`,
        comp: "",
      };
    }

    const upcoming = wcMatches.filter((m) => m.date > new Date().toISOString().slice(0, 10));
    const first = upcoming[0];
    if (first) {
      const nextDate = first.date;
      const nextMatches = upcoming.filter((m) => m.date === nextDate);
      const dateLabel = new Date(`${nextDate}T00:00:00Z`).toLocaleDateString(
        undefined,
        { weekday: "long", month: "short", day: "numeric" },
      );
      return {
        matches: nextMatches,
        label: `${t("home.nextMatches")} — ${dateLabel}`,
        comp: "WC",
      };
    }

    return { matches: [], label: t("home.noUpcoming"), comp: "" };
  }, [liveMatches, upcomingLeague, wcMatches, t]);

  // Resolve the competition for each match: use per-match map, then fallback to section comp, then WC
  const getMatchComp = (matchId: number) =>
    matchCompMap.get(matchId) || displayMatches.comp || "WC";

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-yc-green" />
          <h3 className="font-heading text-xl font-bold">
            {displayMatches.label}
          </h3>
        </div>
        {displayMatches.comp ? (
          <NavLink
            to={`/${displayMatches.comp}/matches`}
            className="flex items-center gap-1 text-yc-green text-sm hover:underline"
          >
            {t("home.allMatches")} <ArrowRight size={14} />
          </NavLink>
        ) : (
          <span />
        )}
      </div>

      {displayMatches.matches.length === 0 ? (
        <p className="text-yc-text-tertiary text-sm">
          {t("home.tournamentDates")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayMatches.matches.slice(0, 6).map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              teamMap={teamMap}
              venueMap={venueMap}
              liveScore={scoreMap.get(m.id)}
              competitionId={getMatchComp(m.id)}
              predicted={predictedIds.has(m.id)}
              compact
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MyPredictionsToday() {
  const { user } = useAuth();
  const { t } = useI18n();
  const wcMatches = useSchedule();
  const predictedIds = usePredictedMatchIds();

  const today = new Date().toISOString().slice(0, 10);
  const todaysMatches = useMemo(
    () => wcMatches.filter((m) => m.date === today && m.homeTeam && m.awayTeam),
    [wcMatches, today],
  );

  if (!user || todaysMatches.length === 0) return null;

  const predicted = todaysMatches.filter((m) => predictedIds.has(m.id)).length;
  const total = todaysMatches.length;
  const allDone = predicted === total;
  const pct = total > 0 ? Math.round((predicted / total) * 100) : 0;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
      <div className={`yc-card rounded-xl p-4 flex items-center gap-4 ${allDone ? "border-yc-green-muted/30" : ""}`}>
        <div className="relative w-12 h-12 shrink-0">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-yc-bg-elevated)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={allDone ? "var(--color-yc-green)" : "var(--color-yc-green-muted)"}
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-bold text-yc-text-primary">
            {predicted}/{total}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yc-text-primary">
            {allDone ? t("home.allPredicted") : t("home.predictionsToday")}
          </p>
          <p className="text-xs text-yc-text-tertiary">
            {allDone
              ? t("home.allPredictedDesc")
              : t("home.predictionsRemaining", { count: total - predicted })}
          </p>
        </div>
        {!allDone && (
          <NavLink
            to="/WC/predictions"
            className="flex items-center gap-1 px-3 py-2 bg-yc-green text-yc-bg-deep text-xs font-semibold rounded-lg hover:brightness-110 active:scale-[0.97] transition-all shrink-0"
          >
            <Target size={14} />
            {t("common.predict")}
          </NavLink>
        )}
      </div>
    </section>
  );
}

function LeaderboardSnippetInner() {
  const { entries, loading } = useLeaderboard();
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="yc-card rounded-xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-yc-border/30 last:border-0">
            <div className="w-5 h-4 bg-yc-bg-elevated rounded animate-pulse" />
            <div className="w-7 h-7 bg-yc-bg-elevated rounded-full animate-pulse" />
            <div className="flex-1 h-4 bg-yc-bg-elevated rounded animate-pulse max-w-[100px]" />
            <div className="w-12 h-4 bg-yc-bg-elevated rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="yc-card rounded-xl p-6 text-center">
        <p className="text-yc-text-tertiary text-sm">{t("home.noPlayers")}</p>
      </div>
    );
  }

  const top5 = entries.slice(0, 5);

  return (
    <div className="yc-card rounded-xl overflow-hidden">
      {top5.map((entry, i) => (
        <div
          key={entry.userId}
          className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-yc-border/50" : ""} ${i === 0 ? "bg-yc-green/[0.03]" : ""}`}
        >
          <span className={`font-mono text-sm w-5 text-right ${i === 0 ? "text-yc-green font-bold" : "text-yc-text-tertiary"}`}>
            {i + 1}
          </span>
          {entry.avatarUrl ? (
            <img
              src={entry.avatarUrl}
              alt=""
              className="w-7 h-7 rounded-full border border-yc-border"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-yc-bg-elevated flex items-center justify-center text-xs font-bold text-yc-text-secondary">
              {entry.handle.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-yc-text-primary text-sm font-medium flex-1 truncate">
            {entry.displayName ?? entry.handle}
          </span>
          <span className="text-yc-green font-mono text-sm font-bold">
            {entry.totalPoints} pts
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { t } = useI18n();

  return (
    <div>
      {/* Hero: globe + countdown */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-center">
        <GlobeView />

        <div className="flex flex-col items-center lg:items-start gap-6">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              {t("home.title")}{" "}
              <span className="text-yc-green drop-shadow-[0_0_12px_rgba(0,255,136,0.3)]">{t("home.year")}</span>
            </h2>
            <p className="text-yc-text-secondary text-sm">
              {t("home.subtitle")}
            </p>
          </div>

          <div className="yc-card p-4 rounded-xl w-full">
            <p className="text-yc-text-tertiary text-xs uppercase tracking-widest mb-3">
              {t("home.kickoffIn")}
            </p>
            <Countdown />
          </div>

          <a
            href="#/WC/predictions"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]"
          >
            <Trophy size={18} />
            {t("home.cta")}
          </a>
        </div>
      </section>

      <PersonalizedGreeting />

      {/* Competition cards */}
      <CompetitionCards />

      {/* Divider with glow */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-yc-green/20 to-transparent" />
      </div>

      <TodaysMatches />

      <MyPredictionsToday />

      {/* Divider */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-yc-green/20 to-transparent" />
      </div>

      {/* Leaderboard + Activity side by side */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-yc-green" />
              <h3 className="font-heading text-xl font-bold">
                {t("home.leaderboard")}
              </h3>
            </div>
            <NavLink
              to="/WC/leaderboard"
              className="flex items-center gap-1 text-yc-green text-sm hover:underline"
            >
              {t("home.fullStandings")} <ArrowRight size={14} />
            </NavLink>
          </div>
          <LeaderboardSnippetInner />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-5">
            <Activity size={18} className="text-yc-green" />
            <h3 className="font-heading text-xl font-bold">
              {t("home.recentActivity")}
            </h3>
          </div>
          <div className="yc-card rounded-xl p-3">
            <ActivityFeed />
          </div>
        </div>
      </section>
    </div>
  );
}
