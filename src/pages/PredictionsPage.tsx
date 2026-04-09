import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { useCompetition } from "../lib/CompetitionProvider";
import { useCompetitionSchedule } from "../hooks/useCompetitionSchedule";
import { useTeamMap } from "../hooks/useTeams";
import { useVenueMap } from "../hooks/useVenues";
import {
  usePredictionCounts,
  canPredict,
} from "../hooks/usePredictions";
import { useAutoScore } from "../hooks/useAutoScore";
import PredictionCard from "../components/predictions/PredictionCard";
import HowToPlay from "../components/predictions/HowToPlay";
import { LogIn, AlertCircle, Trophy, ChevronLeft, ChevronRight, CheckCircle, Clock } from "lucide-react";

export default function PredictionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const comp = useCompetition();
  const { matches: allMatches, matchdays } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { predictions, predsLoading, refresh } = useAutoScore();
  const predictionCounts = usePredictionCounts(comp.id);

  const predictionMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  // For leagues: matchday-based navigation
  const isLeague = comp.type === "league";
  const [selectedMatchday, setSelectedMatchday] = useState<number | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeMdRef = useRef<HTMLButtonElement>(null);

  // Find the nearest matchday with open predictions
  const findNearestMatchday = useCallback(() => {
    if (matchdays.length === 0 || allMatches.length === 0) return undefined;
    for (const md of matchdays) {
      const mdMatches = allMatches.filter((m) => m.matchday === md && m.homeTeam && m.awayTeam);
      const hasOpen = mdMatches.some((m) => canPredict(m.date, m.time));
      if (hasOpen) return md;
    }
    return matchdays[matchdays.length - 1];
  }, [matchdays, allMatches]);

  useEffect(() => {
    if (!isLeague || selectedMatchday !== undefined) return;
    const nearest = findNearestMatchday();
    if (nearest !== undefined) setSelectedMatchday(nearest);
  }, [findNearestMatchday, selectedMatchday, isLeague]);

  useEffect(() => {
    if (activeMdRef.current) {
      activeMdRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [selectedMatchday]);

  // Filter matches by matchday for leagues, or show all for tournaments
  const filteredMatches = useMemo(() => {
    let matches = allMatches.filter((m) => m.homeTeam && m.awayTeam);
    if (isLeague && selectedMatchday !== undefined) {
      matches = matches.filter((m) => m.matchday === selectedMatchday);
    }
    return matches;
  }, [allMatches, isLeague, selectedMatchday]);

  // Split into open and locked
  const { open, locked } = useMemo(() => {
    const o = filteredMatches.filter((m) => canPredict(m.date, m.time));
    const l = filteredMatches.filter((m) => !canPredict(m.date, m.time));
    return { open: o, locked: l };
  }, [filteredMatches]);

  const unpredicted = useMemo(
    () => open.filter((m) => !predictionMap.has(m.id)),
    [open, predictionMap],
  );

  // Matchday status for pill styling
  const mdStatus = useCallback(
    (md: number) => {
      const mdMatches = allMatches.filter((m) => m.matchday === md && m.homeTeam && m.awayTeam);
      const allPredicted = mdMatches.every((m) => predictionMap.has(m.id) || !canPredict(m.date, m.time));
      const hasOpen = mdMatches.some((m) => canPredict(m.date, m.time));
      if (!hasOpen) return "locked";
      if (allPredicted) return "done";
      return "open";
    },
    [allMatches, predictionMap],
  );

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-yc-green border-t-transparent animate-spin mx-auto" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="max-w-lg mx-auto text-center py-16">
          <LogIn size={48} className="text-yc-text-tertiary mx-auto mb-4 opacity-40" />
          <h2 className="font-heading text-2xl font-bold mb-2">
            {t("predictions.signInTitle")}
          </h2>
          <p className="text-yc-text-secondary text-sm mb-6">
            {t("predictions.signInDesc")}
          </p>
          <NavLink
            to="/sign-in"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,229,193,0.2)]"
          >
            <LogIn size={18} />
            {t("nav.signIn")}
          </NavLink>
        </div>

        <div className="max-w-lg mx-auto mt-8">
          <HowToPlay />
        </div>
      </div>
    );
  }

  const nudgeText = unpredicted.length !== 1
    ? t("predictions.nudgePlural", { count: unpredicted.length })
    : t("predictions.nudge", { count: unpredicted.length });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-yc-green/10 flex items-center justify-center">
          <Trophy size={20} className="text-yc-green" />
        </div>
        <div>
          <h2 className="font-heading text-2xl font-bold">{t("predictions.title")}</h2>
          <p className="text-yc-text-tertiary text-sm mt-0.5">
            {t("predictions.predicted", { count: predictions.length })} &middot; {t("predictions.remaining", { count: unpredicted.length })}
          </p>
        </div>
      </div>

      {/* Matchday navigation for leagues */}
      {isLeague && matchdays.length > 0 && (
        <div className="relative flex items-center gap-1 mb-6">
          <button
            onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: "smooth" })}
            className="shrink-0 p-1.5 rounded-lg text-yc-text-tertiary hover:text-yc-text-primary hover:bg-yc-bg-elevated transition-colors"
          >
            <ChevronLeft size={18} />
          </button>

          <div ref={scrollRef} className="flex gap-1 overflow-x-auto scrollbar-none flex-1 py-1">
            {matchdays.map((md) => {
              const status = mdStatus(md);
              return (
                <button
                  key={md}
                  ref={selectedMatchday === md ? activeMdRef : undefined}
                  onClick={() => setSelectedMatchday(md)}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 border ${
                    selectedMatchday === md
                      ? "bg-yc-green/15 text-yc-green border-[var(--yc-border-accent-bright)] shadow-[0_0_16px_rgba(0,229,193,0.1)]"
                      : status === "done"
                        ? "bg-yc-bg-surface text-yc-green/60 border-yc-border"
                        : status === "locked"
                          ? "bg-yc-bg-surface text-yc-text-tertiary border-yc-border"
                          : "bg-yc-bg-surface text-yc-text-secondary border-yc-border hover:text-yc-text-primary hover:border-yc-border-hover"
                  }`}
                >
                  {status === "done" && <CheckCircle size={12} />}
                  {status === "locked" && <Clock size={12} />}
                  <span className="font-mono">MD {md}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: "smooth" })}
            className="shrink-0 p-1.5 rounded-lg text-yc-text-tertiary hover:text-yc-text-primary hover:bg-yc-bg-elevated transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Main column: prediction cards */}
        <div className="space-y-6">
          {/* Unpredicted nudge */}
          {unpredicted.length > 0 && !predsLoading && (
            <div className="yc-card p-4 border-yc-warning/20 bg-yc-warning/[0.03] flex items-center gap-3">
              <AlertCircle size={18} className="text-yc-warning shrink-0" />
              <p className="text-sm text-yc-text-secondary">{nudgeText}</p>
            </div>
          )}

          {/* Open matches */}
          {open.length > 0 && (
            <div>
              <h3 className="text-yc-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-yc-green" />
                {t("predictions.openSection", { count: open.length })}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {open.map((m) => (
                  <PredictionCard
                    key={m.id}
                    match={m}
                    teamMap={teamMap}
                    venueMap={venueMap}
                    prediction={predictionMap.get(m.id)}
                    predictionCount={predictionCounts.get(m.id) ?? 0}
                    userId={user.id}
                    competitionId={comp.id}
                    onSaved={refresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Locked matches */}
          {locked.length > 0 && (
            <div>
              <h3 className="text-yc-text-secondary text-sm font-medium mb-3 flex items-center gap-2">
                <Clock size={12} className="text-yc-text-tertiary" />
                {t("predictions.lockedSection", { count: locked.length })}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {locked.map((m) => (
                  <PredictionCard
                    key={m.id}
                    match={m}
                    teamMap={teamMap}
                    venueMap={venueMap}
                    prediction={predictionMap.get(m.id)}
                    predictionCount={predictionCounts.get(m.id) ?? 0}
                    userId={user.id}
                    competitionId={comp.id}
                    onSaved={refresh}
                  />
                ))}
              </div>
            </div>
          )}

          {predsLoading && (
            <div className="text-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-yc-green border-t-transparent animate-spin mx-auto" />
            </div>
          )}

          {!predsLoading && open.length === 0 && locked.length === 0 && (
            <div className="yc-card p-8 rounded-xl text-center">
              <p className="text-yc-text-tertiary text-sm">No matches available for prediction.</p>
            </div>
          )}
        </div>

        {/* Sidebar: how to play */}
        <div className="space-y-4">
          <HowToPlay />
        </div>
      </div>
    </div>
  );
}
