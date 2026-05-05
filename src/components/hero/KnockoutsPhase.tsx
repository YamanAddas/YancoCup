import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Calendar,
  ChevronRight,
  GitBranch,
  Trophy,
  Lock,
  Check,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useSchedule } from "../../hooks/useSchedule";
import { useScores } from "../../hooks/useScores";
import { useTeamMap } from "../../hooks/useTeams";
import { useVenueMap } from "../../hooks/useVenues";
import { useMyPredictions, canPredict } from "../../hooks/usePredictions";
import {
  computeGroupStandings,
  computeKnockoutResults,
  resolveBracketPlaceholder,
} from "../../lib/bracketResolver";
import { getLocale, formatTimeWithTZ } from "../../lib/formatDate";
import MatchCard from "../match/MatchCard";
import TeamCrest from "../match/TeamCrest";
import type { Match } from "../../types";
import type { Prediction } from "../../hooks/usePredictions";

const WC_KO_START = new Date("2026-06-28T00:00:00Z");
const WC_FINAL = new Date("2026-07-19T20:00:00Z");

type KnockoutRound =
  | "round-of-32"
  | "round-of-16"
  | "quarterfinal"
  | "semifinal"
  | "third-place"
  | "final";

const ROUND_ORDER: KnockoutRound[] = [
  "round-of-32",
  "round-of-16",
  "quarterfinal",
  "semifinal",
  "third-place",
  "final",
];

const ROUND_LABEL_KEYS: Record<KnockoutRound, string> = {
  "round-of-32": "round.roundOf32",
  "round-of-16": "round.roundOf16",
  quarterfinal: "round.quarterfinal",
  semifinal: "round.semifinal",
  "third-place": "round.thirdPlace",
  final: "round.final",
};

/** Today's WC matches in YYYY-MM-DD UTC. */
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Knockout day label: "Day 4 of 22" — June 28 → July 19. */
function getDayLabel(now: Date): { day: number; total: number } {
  const total = Math.round(
    (WC_FINAL.getTime() - WC_KO_START.getTime()) / 86_400_000,
  );
  const elapsed = Math.max(
    0,
    Math.floor((now.getTime() - WC_KO_START.getTime()) / 86_400_000),
  );
  return { day: Math.min(elapsed + 1, total), total };
}

/** Earliest round with at least one unfinished match — that's the "current" round. */
function getCurrentRound(
  matches: Match[],
  scoreMap: Map<number, { status?: string }>,
): KnockoutRound {
  for (const r of ROUND_ORDER) {
    const rMatches = matches.filter((m) => m.round === r);
    if (rMatches.length === 0) continue;
    const allFinished = rMatches.every((m) => {
      const status = scoreMap.get(m.id)?.status ?? m.status;
      return status === "FINISHED";
    });
    if (!allFinished) return r;
  }
  return "final";
}

function KnockoutMatchRow({
  match,
  prediction,
  liveScore,
  resolvedHome,
  resolvedAway,
  teamMap,
}: {
  match: Match;
  prediction?: Prediction;
  liveScore?: { status: string; homeScore: number | null; awayScore: number | null };
  resolvedHome?: string;
  resolvedAway?: string;
  teamMap: Map<string, { fifaCode: string; isoCode: string; name: string; id: string }>;
}) {
  const { t, lang, tTeam } = useI18n();
  const status = liveScore?.status ?? match.status;
  const isLive = status === "IN_PLAY" || status === "PAUSED";
  const isFinished = status === "FINISHED";
  const homeScore = liveScore?.homeScore ?? match.homeScore;
  const awayScore = liveScore?.awayScore ?? match.awayScore;
  const hasScore = homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined;
  const locked = !canPredict(match.date, match.time);

  const homeKey = match.homeTeam ?? resolvedHome ?? null;
  const awayKey = match.awayTeam ?? resolvedAway ?? null;
  const home = homeKey ? teamMap.get(homeKey) : undefined;
  const away = awayKey ? teamMap.get(awayKey) : undefined;
  const homeLabel = home ? tTeam(home.id) : (match.homePlaceholder ?? t("match.tbd"));
  const awayLabel = away ? tTeam(away.id) : (match.awayPlaceholder ?? t("match.tbd"));
  const homeWin = isFinished && hasScore && (homeScore ?? 0) > (awayScore ?? 0);
  const awayWin = isFinished && hasScore && (awayScore ?? 0) > (homeScore ?? 0);

  const userPick =
    prediction?.home_score != null && prediction?.away_score != null
      ? `${prediction.home_score}-${prediction.away_score}`
      : prediction?.quick_pick
        ? { H: t("quickPick.home"), D: t("quickPick.draw"), A: t("quickPick.away") }[prediction.quick_pick]
        : null;
  const correct =
    isFinished && prediction?.points != null && prediction.points > 0;

  return (
    <Link
      to={`/WC/match/${match.id}`}
      className={`yc-card rounded-xl p-3 block transition-all hover:border-yc-border-hover ${
        isLive ? "border-yc-green-muted/40" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TeamCrest tla={home?.fifaCode ?? "?"} isoCode={home?.isoCode} size="xs" />
          <span
            className={`text-xs truncate ${
              homeKey ? "text-yc-text-primary" : "text-yc-text-tertiary italic"
            } ${homeWin ? "font-bold" : ""}`}
          >
            {homeLabel}
          </span>
        </div>
        <span
          className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
            isLive ? "text-yc-green" : isFinished ? "text-yc-text-primary" : "text-yc-text-tertiary"
          }`}
        >
          {hasScore ? homeScore : "—"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TeamCrest tla={away?.fifaCode ?? "?"} isoCode={away?.isoCode} size="xs" />
          <span
            className={`text-xs truncate ${
              awayKey ? "text-yc-text-primary" : "text-yc-text-tertiary italic"
            } ${awayWin ? "font-bold" : ""}`}
          >
            {awayLabel}
          </span>
        </div>
        <span
          className={`font-mono text-sm font-bold tabular-nums shrink-0 ${
            isLive ? "text-yc-green" : isFinished ? "text-yc-text-primary" : "text-yc-text-tertiary"
          }`}
        >
          {hasScore ? awayScore : "—"}
        </span>
      </div>

      {/* Footer: status + your pick */}
      <div className="mt-2 pt-2 border-t border-yc-border/30 flex items-center justify-between gap-2 text-[10px]">
        {isLive ? (
          <span className="text-yc-green font-semibold flex items-center gap-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-green opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yc-green" />
            </span>
            {t("match.live")}
          </span>
        ) : isFinished ? (
          <span className="text-yc-text-tertiary">{t("match.ft")}</span>
        ) : locked ? (
          <span className="text-yc-text-tertiary flex items-center gap-1">
            <Lock size={9} />
            {formatTimeWithTZ(new Date(`${match.date}T${match.time}:00Z`), lang)}
          </span>
        ) : (
          <span className="text-yc-text-tertiary">
            {formatTimeWithTZ(new Date(`${match.date}T${match.time}:00Z`), lang)}
          </span>
        )}
        {userPick ? (
          <span
            className={`flex items-center gap-1 font-mono font-bold ${
              correct ? "text-yc-green" : "text-yc-text-secondary"
            }`}
          >
            {correct && <Check size={10} />}
            {t("bracket.you")} {userPick}
          </span>
        ) : !locked ? (
          <span className="text-yc-warning text-[10px] font-semibold uppercase tracking-wider">
            {t("match.predictNow")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function RoundProgressBreadcrumbs({ current }: { current: KnockoutRound }) {
  const { t } = useI18n();
  const currentIdx = ROUND_ORDER.indexOf(current);
  // Skip third-place in the visual flow — it's a side match, not the path to the final
  const flow: KnockoutRound[] = [
    "round-of-32",
    "round-of-16",
    "quarterfinal",
    "semifinal",
    "final",
  ];
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      {flow.map((r, i) => {
        const flowIdx = ROUND_ORDER.indexOf(r);
        const isPast = flowIdx < currentIdx;
        const isCurrent = r === current || (r === "final" && current === "third-place");
        const tone = isCurrent
          ? "bg-yc-green/15 text-yc-green border-yc-green-muted/40"
          : isPast
            ? "bg-yc-bg-elevated text-yc-text-secondary border-yc-border"
            : "bg-yc-bg-deep text-yc-text-tertiary border-yc-border/50";
        return (
          <span key={r} className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${tone}`}
            >
              {t(ROUND_LABEL_KEYS[r])}
            </span>
            {i < flow.length - 1 && (
              <ChevronRight
                size={12}
                className={isPast ? "text-yc-text-secondary" : "text-yc-text-tertiary/50"}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

export default function KnockoutsPhase() {
  const { t, lang, tTeam } = useI18n();
  const allMatches = useSchedule();
  const { scoreMap, hasLive, fetchedAt } = useScores("WC");
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { predictions } = useMyPredictions("WC");

  const predictionMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  const knockoutMatches = useMemo(
    () => allMatches.filter((m) => m.round !== "group"),
    [allMatches],
  );

  // Resolve placeholders so far-future rounds can show real teams as soon as
  // earlier rounds finish (group standings → R32, R32 winners → R16, etc.).
  const resolvedSlots = useMemo(() => {
    const groupStageMatches = allMatches.filter((m) => m.round === "group");
    const groupStandings = computeGroupStandings(groupStageMatches, scoreMap);
    const knockoutResults = computeKnockoutResults(allMatches, scoreMap);
    const out = new Map<number, { home?: string; away?: string }>();
    for (const m of knockoutMatches) {
      if (m.homeTeam && m.awayTeam) continue;
      const home = m.homePlaceholder
        ? resolveBracketPlaceholder(m.homePlaceholder, groupStandings, knockoutResults)
        : undefined;
      const away = m.awayPlaceholder
        ? resolveBracketPlaceholder(m.awayPlaceholder, groupStandings, knockoutResults)
        : undefined;
      out.set(m.id, { home: home ?? undefined, away: away ?? undefined });
    }
    return out;
  }, [allMatches, knockoutMatches, scoreMap]);

  const liveMatches = useMemo(() => {
    return knockoutMatches.filter((m) => {
      const live = scoreMap.get(m.id);
      const status = live?.status ?? m.status;
      return status === "IN_PLAY" || status === "PAUSED";
    });
  }, [knockoutMatches, scoreMap]);

  const today = todayUtcDate();
  const todayMatches = useMemo(() => {
    return knockoutMatches
      .filter((m) => m.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [knockoutMatches, today]);

  const currentRound = getCurrentRound(knockoutMatches, scoreMap);
  const currentRoundMatches = useMemo(
    () =>
      knockoutMatches
        .filter((m) => m.round === currentRound)
        .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
    [knockoutMatches, currentRound],
  );

  const { day, total } = getDayLabel(new Date());
  const todayLabel = new Date().toLocaleDateString(getLocale(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10 space-y-7">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Trophy size={24} className="text-yc-green" />
          <div>
            <p className="text-yc-text-tertiary text-[10px] uppercase tracking-widest">
              {t("home.knockouts.eyebrow")} · {t("home.dayOf", { day, total })}
            </p>
            <h1 className="font-heading text-xl sm:text-2xl font-bold text-yc-text-primary">
              {t(ROUND_LABEL_KEYS[currentRound])}
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

      {/* Round progress */}
      <RoundProgressBreadcrumbs current={currentRound} />

      {/* Live ticker */}
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
              const slots = resolvedSlots.get(m.id);
              const homeKey = m.homeTeam ?? slots?.home;
              const awayKey = m.awayTeam ?? slots?.away;
              const home = homeKey ? teamMap.get(homeKey) : undefined;
              const away = awayKey ? teamMap.get(awayKey) : undefined;
              const hs = live?.homeScore ?? m.homeScore ?? 0;
              const as = live?.awayScore ?? m.awayScore ?? 0;
              return (
                <Link
                  key={m.id}
                  to={`/WC/match/${m.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yc-bg-elevated border border-yc-green-muted/30 hover:border-yc-green-muted shrink-0 transition-colors"
                >
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-green opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yc-green" />
                  </span>
                  <TeamCrest tla={home?.fifaCode ?? "?"} isoCode={home?.isoCode} size="xs" />
                  <span className="text-xs font-semibold text-yc-text-primary truncate max-w-[80px]">
                    {home ? tTeam(home.id) : (homeKey ?? "?")}
                  </span>
                  <span className="font-mono text-sm font-bold text-yc-green tabular-nums">
                    {hs}-{as}
                  </span>
                  <span className="text-xs font-semibold text-yc-text-primary truncate max-w-[80px]">
                    {away ? tTeam(away.id) : (awayKey ?? "?")}
                  </span>
                  <TeamCrest tla={away?.fifaCode ?? "?"} isoCode={away?.isoCode} size="xs" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's matches */}
      {todayMatches.length > 0 && (
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
        </div>
      )}

      {/* Current round panel */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-yc-green" />
            <h2 className="font-heading text-base font-bold text-yc-text-primary">
              {t(ROUND_LABEL_KEYS[currentRound])}
            </h2>
            <span className="text-yc-text-tertiary text-xs">
              {currentRoundMatches.length} {t("home.knockouts.matches")}
            </span>
          </div>
          <Link
            to="/WC/bracket"
            className="text-xs text-yc-green hover:underline flex items-center gap-0.5"
          >
            {t("home.knockouts.fullBracket")}
            <ChevronRight size={12} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {currentRoundMatches.map((m) => (
            <KnockoutMatchRow
              key={m.id}
              match={m}
              prediction={predictionMap.get(m.id)}
              liveScore={scoreMap.get(m.id)}
              resolvedHome={resolvedSlots.get(m.id)?.home}
              resolvedAway={resolvedSlots.get(m.id)?.away}
              teamMap={teamMap}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
