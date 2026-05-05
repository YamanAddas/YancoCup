import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Activity, Calendar, ChevronRight, Trophy } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useSchedule } from "../../hooks/useSchedule";
import { useScores } from "../../hooks/useScores";
import { useGroups } from "../../hooks/useGroups";
import { useTeamMap } from "../../hooks/useTeams";
import { useVenueMap } from "../../hooks/useVenues";
import { computeGroupStandings } from "../../lib/bracketResolver";
import { getLocale } from "../../lib/formatDate";
import MatchCard from "../match/MatchCard";
import TeamCrest from "../match/TeamCrest";
import CompactGroupCard from "./CompactGroupCard";
import type { Match } from "../../types";

const WC_GROUP_STAGE_END = new Date("2026-06-28T00:00:00Z");
const WC_KICKOFF = new Date("2026-06-11T16:00:00Z");

/** Today's WC matches in YYYY-MM-DD UTC. */
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Group-stage day label: "Day 4 of 17" — kickoff to last group match (June 11–27). */
function getDayLabel(now: Date): { day: number; total: number } {
  const total = Math.round(
    (WC_GROUP_STAGE_END.getTime() - WC_KICKOFF.getTime()) / 86_400_000,
  );
  const elapsed = Math.max(
    0,
    Math.floor((now.getTime() - WC_KICKOFF.getTime()) / 86_400_000),
  );
  return { day: Math.min(elapsed + 1, total), total };
}

/** Compact live chip — used inside the live ticker bar. */
function LiveChip({
  match,
  homeName,
  awayName,
  homeIso,
  awayIso,
  homeScore,
  awayScore,
}: {
  match: Match;
  homeName: string;
  awayName: string;
  homeIso?: string;
  awayIso?: string;
  homeScore: number;
  awayScore: number;
}) {
  return (
    <Link
      to={`/WC/match/${match.id}`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yc-bg-elevated border border-yc-green-muted/30 hover:border-yc-green-muted shrink-0 transition-colors"
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-green opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yc-green" />
      </span>
      <TeamCrest tla={match.homeTeam ?? "?"} isoCode={homeIso} size="xs" />
      <span className="text-xs font-semibold text-yc-text-primary truncate max-w-[80px]">
        {homeName}
      </span>
      <span className="font-mono text-sm font-bold text-yc-green tabular-nums">
        {homeScore}-{awayScore}
      </span>
      <span className="text-xs font-semibold text-yc-text-primary truncate max-w-[80px]">
        {awayName}
      </span>
      <TeamCrest tla={match.awayTeam ?? "?"} isoCode={awayIso} size="xs" />
    </Link>
  );
}

export default function GroupStagePhase() {
  const { t, lang, tTeam } = useI18n();
  const allMatches = useSchedule();
  const { scoreMap, hasLive, fetchedAt } = useScores("WC");
  const groups = useGroups();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();

  // WC group-stage matches (filter once, reuse for standings + today)
  const groupStageMatches = useMemo(
    () => allMatches.filter((m) => m.round === "group"),
    [allMatches],
  );

  // Live matches across the WC group stage (typically 0-4 concurrent)
  const liveMatches = useMemo(() => {
    return groupStageMatches.filter((m) => {
      const live = scoreMap.get(m.id);
      const status = live?.status ?? m.status;
      return status === "IN_PLAY" || status === "PAUSED";
    });
  }, [groupStageMatches, scoreMap]);

  // Today's matches (UTC date match)
  const today = todayUtcDate();
  const todayMatches = useMemo(() => {
    return groupStageMatches
      .filter((m) => m.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [groupStageMatches, today]);

  // Standings from finished/live matches — empty pre-tournament
  const standings = useMemo(
    () => computeGroupStandings(groupStageMatches, scoreMap),
    [groupStageMatches, scoreMap],
  );

  const { day, total } = getDayLabel(new Date());

  // Friendly today label, e.g. "Sat, Jun 13"
  const todayLabel = new Date().toLocaleDateString(getLocale(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Trophy size={24} className="text-yc-green" />
          <div>
            <p className="text-yc-text-tertiary text-[10px] uppercase tracking-widest">
              {t("home.title")}
            </p>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-yc-text-primary">
              {t("home.groupStage.dayOf", { day, total })}
            </h1>
          </div>
        </div>
        {hasLive && (
          <span className="flex items-center gap-1.5 text-yc-green text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yc-green" />
            </span>
            {t("home.liveNow")} · {liveMatches.length}
          </span>
        )}
      </div>

      {/* Live ticker — only when matches in play */}
      {liveMatches.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-widest text-yc-text-tertiary">
            <Activity size={10} className="text-yc-green" />
            {t("home.groupStage.liveTicker")}
            {fetchedAt && (
              <span className="text-yc-text-tertiary/70 normal-case tracking-normal ms-1 font-mono">
                ↻ {Math.max(1, Math.round((Date.now() - new Date(fetchedAt).getTime()) / 1000))}s
              </span>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {liveMatches.map((m) => {
              const live = scoreMap.get(m.id);
              const home = m.homeTeam ? teamMap.get(m.homeTeam) : undefined;
              const away = m.awayTeam ? teamMap.get(m.awayTeam) : undefined;
              const hs = live?.homeScore ?? m.homeScore ?? 0;
              const as = live?.awayScore ?? m.awayScore ?? 0;
              return (
                <LiveChip
                  key={m.id}
                  match={m}
                  homeName={home ? tTeam(home.id) : (m.homeTeam ?? "?")}
                  awayName={away ? tTeam(away.id) : (m.awayTeam ?? "?")}
                  homeIso={home?.isoCode}
                  awayIso={away?.isoCode}
                  homeScore={hs}
                  awayScore={as}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Today's matches */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-yc-green" />
            <h2 className="font-heading text-base font-bold text-yc-text-primary">
              {t("home.todaysMatches")}
            </h2>
            <span className="text-yc-text-tertiary text-xs">{todayLabel}</span>
          </div>
          <Link
            to="/WC/matches"
            className="text-xs text-yc-green hover:underline flex items-center gap-0.5"
          >
            {t("home.allMatches")}
            <ChevronRight size={12} />
          </Link>
        </div>
        {todayMatches.length === 0 ? (
          <div className="yc-card rounded-xl p-6 text-center">
            <p className="text-sm text-yc-text-secondary mb-1">
              {t("home.groupStage.restDay")}
            </p>
            <p className="text-xs text-yc-text-tertiary">
              {t("home.groupStage.checkSchedule")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {todayMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                teamMap={teamMap}
                venueMap={venueMap}
                liveScore={scoreMap.get(m.id)}
                competitionId="WC"
                fetchedAt={fetchedAt}
                kickoffUtc={`${m.date}T${m.time}:00Z`}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {/* All 12 groups */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-heading text-base font-bold text-yc-text-primary">
            {t("home.fullStandings")}
          </h2>
          <Link
            to="/WC/groups"
            className="text-xs text-yc-green hover:underline flex items-center gap-0.5"
          >
            {t("home.groupStage.fullTables")}
            <ChevronRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {groups.map((g) => {
            const teamsInGroup = g.teams
              .map((id) => teamMap.get(id))
              .filter((t): t is NonNullable<typeof t> => Boolean(t));
            return (
              <CompactGroupCard
                key={g.id}
                groupId={g.id}
                teams={teamsInGroup}
                standings={standings.get(g.id)}
              />
            );
          })}
        </div>
        <p className="mt-3 text-[10px] text-yc-text-tertiary flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-0.5 h-3 rounded-full bg-yc-green" />
            {t("home.groupStage.legendQualify")}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-0.5 h-3 rounded-full bg-yc-warning/60" />
            {t("home.groupStage.legendThird")}
          </span>
        </p>
      </div>
    </section>
  );
}
