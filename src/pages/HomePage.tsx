import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
import { useFollowedTeams } from "../hooks/useFollowedTeams";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { getLocale } from "../lib/formatDate";
import { COMPETITION_LIST } from "../lib/competitions";
import { getRank, getRankStars } from "../lib/ranks";
import ActivityFeed from "../components/activity/ActivityFeed";
import type { Match } from "../types";
import { WORKER_URL } from "../lib/api";
import {
  Trophy,
  ArrowRight,
  Calendar,
  BarChart3,
  Activity,
  ChevronRight,
  Target,
  Star,
  Heart,
} from "lucide-react";

/** Wraps a section in a scroll-triggered reveal */
function RevealSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useScrollReveal();
  return (
    <section ref={ref} className={`yc-reveal ${visible ? "visible" : ""} ${className ?? ""}`}>
      {children}
    </section>
  );
}

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
          {t(rank.nameKey)}
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
  const { ref, visible } = useScrollReveal();

  return (
    <section ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-2 mb-5">
        <Trophy size={18} className="text-yc-green" />
        <h3 className="font-heading text-xl font-bold">
          {t("home.competitions")}
        </h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {COMPETITION_LIST.map((comp, i) => (
          <NavLink
            key={comp.id}
            to={`/${comp.id}/overview`}
            className={`group yc-card yc-tilt p-4 rounded-xl transition-all duration-300 hover:border-[var(--yc-border-accent)] hover:shadow-[0_0_20px_rgba(0,255,136,0.06)] yc-reveal yc-reveal-stagger ${visible ? "visible" : ""}`}
            style={{ "--i": i } as React.CSSProperties}
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

function MyTeamsMatches() {
  const { user } = useAuth();
  const { follows, loading: followsLoading, followedIds } = useFollowedTeams();
  const wcMatches = useSchedule();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { scoreMap } = useScores();
  const predictedIds = usePredictedMatchIds();
  const { t } = useI18n();
  const { ref, visible } = useScrollReveal();

  const myMatches = useMemo(() => {
    if (followedIds.size === 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    return wcMatches
      .filter(
        (m) =>
          m.date >= today &&
          ((m.homeTeam && followedIds.has(m.homeTeam)) ||
            (m.awayTeam && followedIds.has(m.awayTeam))),
      )
      .slice(0, 4);
  }, [wcMatches, followedIds]);

  if (!user || followsLoading || follows.length === 0 || myMatches.length === 0) return null;

  return (
    <section ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-2 mb-4">
        <Heart size={18} className="text-yc-green" fill="currentColor" />
        <h3 className="font-heading text-xl font-bold">{t("home.myTeams")}</h3>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 yc-reveal ${visible ? "visible" : ""}`}>
        {myMatches.map((m) => (
          <MatchCard
            key={m.id}
            match={m}
            teamMap={teamMap}
            venueMap={venueMap}
            liveScore={scoreMap.get(m.id)}
            competitionId="WC"
            predicted={predictedIds.has(m.id)}
            compact
          />
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
  const { t, lang } = useI18n();
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [upcomingLeague, setUpcomingLeague] = useState<Match[]>([]);
  // Track per-match competition code for detail page linking
  const [matchCompMap, setMatchCompMap] = useState<Map<number, string>>(new Map());
  // Track kickoff times for minute computation
  const [kickoffMap, setKickoffMap] = useState<Map<number, string>>(new Map());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLive = liveMatches.length > 0;

  const fetchLive = useCallback(async () => {
    const compMap = new Map<number, string>();
    const koMap = new Map<number, string>();

    // Fetch live matches across all competitions
    try {
      const res = await fetch(`${WORKER_URL}/api/live`);
      if (res.ok) {
        const data = (await res.json()) as { matches: WorkerMatch[] };
        if (data.matches.length > 0) {
          for (const m of data.matches) {
            compMap.set(m.apiId, m.competitionCode);
            koMap.set(m.apiId, m.utcDate);
          }
          setLiveMatches(data.matches.map(convertWorkerMatch));
        } else {
          setLiveMatches([]);
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
    setKickoffMap(koMap);
  }, []);

  // Initial fetch + polling: 30s when live, 5min otherwise
  useEffect(() => {
    fetchLive();

    function startPoll() {
      if (pollRef.current) clearInterval(pollRef.current);
      const ms = isLive ? 30_000 : 300_000;
      pollRef.current = setInterval(fetchLive, ms);
    }
    startPoll();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLive, isLive]);

  const displayMatches = useMemo(() => {
    if (liveMatches.length > 0) {
      return { matches: liveMatches, label: t("home.liveNow"), comp: "", isLive: true };
    }

    const today = new Date().toISOString().slice(0, 10);
    const todaysWc = wcMatches.filter((m) => m.date === today);
    if (todaysWc.length > 0) {
      return { matches: todaysWc, label: t("home.todaysMatches"), comp: "WC", isLive: false };
    }

    if (upcomingLeague.length > 0) {
      const firstDate = upcomingLeague[0]!.date;
      const dateLabel = new Date(`${firstDate}T00:00:00Z`).toLocaleDateString(
        getLocale(lang),
        { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" },
      );
      return {
        matches: upcomingLeague,
        label: `${t("home.nextMatches")} — ${dateLabel}`,
        comp: "",
        isLive: false,
      };
    }

    const upcoming = wcMatches.filter((m) => m.date > new Date().toISOString().slice(0, 10));
    const first = upcoming[0];
    if (first) {
      const nextDate = first.date;
      const nextMatches = upcoming.filter((m) => m.date === nextDate);
      const dateLabel = new Date(`${nextDate}T00:00:00Z`).toLocaleDateString(
        undefined,
        { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" },
      );
      return {
        matches: nextMatches,
        label: `${t("home.nextMatches")} — ${dateLabel}`,
        comp: "WC",
        isLive: false,
      };
    }

    return { matches: [], label: t("home.noUpcoming"), comp: "", isLive: false };
  }, [liveMatches, upcomingLeague, wcMatches, t]);

  // Resolve the competition for each match: use per-match map, then fallback to section comp, then WC
  const getMatchComp = (matchId: number) =>
    matchCompMap.get(matchId) || displayMatches.comp || "WC";

  const { ref: matchesRef, visible: matchesVisible } = useScrollReveal();

  return (
    <section ref={matchesRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {displayMatches.isLive ? (
            <>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-live opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yc-live" />
              </span>
              <h3 className="font-heading text-xl font-bold text-yc-live">
                {displayMatches.label}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-yc-live/15 text-yc-live text-xs font-mono font-bold">
                {t("home.liveCount", { count: String(displayMatches.matches.length) })}
              </span>
            </>
          ) : (
            <>
              <Calendar size={18} className="text-yc-green" />
              <h3 className="font-heading text-xl font-bold">
                {displayMatches.label}
              </h3>
            </>
          )}
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
          {displayMatches.matches.slice(0, 6).map((m, i) => (
            <div
              key={m.id}
              className={`yc-reveal yc-reveal-stagger yc-float ${matchesVisible ? "visible" : ""}`}
              style={{ "--i": i, "--float-delay": `${i * 0.7}s`, "--float-duration": `${5 + i * 0.4}s` } as React.CSSProperties}
            >
              <MatchCard
                match={m}
                teamMap={teamMap}
                venueMap={venueMap}
                liveScore={scoreMap.get(m.id)}
                competitionId={getMatchComp(m.id)}
                predicted={predictedIds.has(m.id)}
                kickoffUtc={kickoffMap.get(m.id)}
                compact
              />
            </div>
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
          <span className={`font-mono text-sm w-5 text-end ${i === 0 ? "text-yc-green font-bold" : "text-yc-text-tertiary"}`}>
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
          <div className="flex flex-col items-center lg:items-start gap-2">
            <img
              src="https://crests.football-data.org/wm26.png"
              alt="FIFA World Cup 2026"
              className="h-24 sm:h-28 w-auto drop-shadow-[0_0_20px_rgba(0,255,136,0.25)]"
            />
            <p className="text-yc-text-secondary text-sm">
              {t("home.subtitle")}
            </p>
          </div>

          <div className="yc-card yc-animated-border p-4 rounded-xl w-full">
            <p className="text-yc-text-tertiary text-xs uppercase tracking-widest mb-3">
              {t("home.kickoffIn")}
            </p>
            <Countdown />
          </div>

          <a
            href="#/WC/predictions"
            className="yc-animated-border inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]"
          >
            <Trophy size={18} />
            {t("home.cta")}
          </a>
        </div>
      </section>

      <PersonalizedGreeting />

      <MyTeamsMatches />

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
      <RevealSection className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
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
      </RevealSection>
    </div>
  );
}
