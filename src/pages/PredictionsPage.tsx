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
  upsertPrediction,
  upsertQuickPrediction,
} from "../hooks/usePredictions";
import { supabase } from "../lib/supabase";
import { useAutoScore } from "../hooks/useAutoScore";
import PredictionCard from "../components/predictions/PredictionCard";
import HowToPlay from "../components/predictions/HowToPlay";
import { LogIn, AlertCircle, ChevronLeft, ChevronRight, CheckCircle, Clock, Flame, Copy } from "lucide-react";
import { fetchStreak } from "../lib/badges";

export default function PredictionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const comp = useCompetition();
  const { matches: allMatches, matchdays } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { predictions, predsLoading, refresh } = useAutoScore(comp.id);
  const predictionCounts = usePredictionCounts(comp.id);

  const predictionMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  // For leagues: matchday-based navigation + quick mode toggle
  const isLeague = comp.type === "league";
  const [quickMode, setQuickMode] = useState(false);
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
    const container = scrollRef.current;
    const el = activeMdRef.current;
    if (!container || !el) return;
    const cr = container.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    container.scrollBy({ left: er.left - cr.left - cr.width / 2 + er.width / 2, behavior: "smooth" });
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

  // Check if joker is already used on another match in the current matchday
  const jokerMatchId = useMemo(() => {
    const matchIds = new Set(filteredMatches.map((m) => m.id));
    for (const pred of predictions) {
      if (pred.is_joker && matchIds.has(pred.match_id)) return pred.match_id;
    }
    return null;
  }, [filteredMatches, predictions]);

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

  // Streak counter
  const [streak, setStreak] = useState<{ current_streak: number; best_streak: number } | null>(null);
  useEffect(() => {
    if (!user) return;
    fetchStreak(user.id, comp.id).then((s) => setStreak(s));
  }, [user, comp.id]);

  // Copy last matchday
  const [copying, setCopying] = useState(false);
  const handleCopyLastMd = useCallback(async () => {
    if (!user || !isLeague || selectedMatchday === undefined || copying) return;
    const prevMd = matchdays[matchdays.indexOf(selectedMatchday) - 1];
    if (prevMd === undefined) return;

    setCopying(true);
    const prevMatches = allMatches.filter((m) => m.matchday === prevMd && m.homeTeam && m.awayTeam);
    const prevIds = prevMatches.map((m) => m.id);

    const { data: prevPreds } = await supabase
      .from("yc_predictions")
      .select("match_id, home_score, away_score, quick_pick")
      .eq("user_id", user.id)
      .eq("competition_id", comp.id)
      .in("match_id", prevIds);

    if (!prevPreds || prevPreds.length === 0) { setCopying(false); return; }

    const currentMatches = allMatches.filter(
      (m) => m.matchday === selectedMatchday && m.homeTeam && m.awayTeam && canPredict(m.date, m.time),
    );

    let copied = 0;
    for (const currMatch of currentMatches) {
      if (predictionMap.has(currMatch.id)) continue;
      const prevMatch = prevMatches.find(
        (pm) => pm.homeTeam === currMatch.homeTeam && pm.awayTeam === currMatch.awayTeam,
      );
      if (!prevMatch) continue;
      const pred = prevPreds.find((p) => p.match_id === prevMatch.id);
      if (!pred) continue;

      if (pred.quick_pick) {
        await upsertQuickPrediction(user.id, currMatch.id, pred.quick_pick as "H" | "D" | "A", comp.id);
      } else if (pred.home_score !== null && pred.away_score !== null) {
        await upsertPrediction(user.id, currMatch.id, pred.home_score, pred.away_score, comp.id);
      }
      copied++;
    }

    if (copied > 0) refresh();
    setCopying(false);
  }, [user, isLeague, selectedMatchday, matchdays, allMatches, comp.id, predictionMap, refresh, copying]);

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
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]"
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
      {/* Prediction stats + mode toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-yc-text-secondary">{t("predictions.predicted", { count: predictions.length })}</span>
          <span className="text-yc-text-tertiary">&middot;</span>
          <span className="text-yc-text-secondary">{t("predictions.remaining", { count: unpredicted.length })}</span>
          {streak && streak.current_streak > 0 && (
            <>
              <span className="text-yc-text-tertiary">&middot;</span>
              <span className="flex items-center gap-1 text-yc-warning" title={t("predictions.bestStreak", { count: streak.best_streak })}>
                <Flame size={14} />
                {streak.current_streak}
              </span>
            </>
          )}
        </div>

        {isLeague && (
          <div className="flex items-center bg-yc-bg-surface border border-yc-border rounded-lg p-0.5">
            <button
              onClick={() => setQuickMode(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                !quickMode
                  ? "bg-yc-green text-yc-bg-deep"
                  : "text-yc-text-tertiary hover:text-yc-text-secondary"
              }`}
            >
              {t("predictions.full")}
            </button>
            <button
              onClick={() => setQuickMode(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                quickMode
                  ? "bg-yc-green text-yc-bg-deep"
                  : "text-yc-text-tertiary hover:text-yc-text-secondary"
              }`}
            >
              {t("predictions.quickPickMode")}
            </button>
          </div>
        )}
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
                      ? "bg-yc-green/15 text-yc-green border-[var(--yc-border-accent-bright)] shadow-[0_0_16px_rgba(0,255,136,0.1)]"
                      : status === "done"
                        ? "bg-yc-bg-surface text-yc-green/60 border-yc-border"
                        : status === "locked"
                          ? "bg-yc-bg-surface text-yc-text-tertiary border-yc-border"
                          : "bg-yc-bg-surface text-yc-text-secondary border-yc-border hover:text-yc-text-primary hover:border-yc-border-hover"
                  }`}
                >
                  {status === "done" && <CheckCircle size={12} />}
                  {status === "locked" && <Clock size={12} />}
                  <span className="font-mono">{t("common.matchday")} {md}</span>
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

      {/* Copy last matchday button */}
      {isLeague && selectedMatchday !== undefined && matchdays.indexOf(selectedMatchday) > 0 && unpredicted.length > 0 && (
        <div className="mb-4">
          <button
            onClick={handleCopyLastMd}
            disabled={copying}
            className="flex items-center gap-1.5 text-xs text-yc-text-secondary hover:text-yc-green transition-colors disabled:opacity-40"
          >
            <Copy size={12} />
            {copying ? t("predictions.copying") : t("predictions.copyLastMd")}
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
                    userPredictionCount={predictions.length}
                    jokerUsedThisMatchday={jokerMatchId !== null && jokerMatchId !== m.id}
                    quickMode={quickMode}
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
              <p className="text-yc-text-tertiary text-sm">{t("predictions.noMatches")}</p>
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
