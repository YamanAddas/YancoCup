import { useMemo } from "react";
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
import { LogIn, AlertCircle } from "lucide-react";

export default function PredictionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const comp = useCompetition();
  const { matches: allMatches } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { predictions, predsLoading, refresh } = useAutoScore();
  const predictionCounts = usePredictionCounts(comp.id);

  const predictionMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  // Matches that can be predicted (have known teams)
  const predictableMatches = useMemo(
    () => allMatches.filter((m) => m.homeTeam && m.awayTeam),
    [allMatches],
  );

  // Split into open (can still predict) and locked
  const { open, locked } = useMemo(() => {
    const o = predictableMatches.filter((m) => canPredict(m.date, m.time));
    const l = predictableMatches.filter((m) => !canPredict(m.date, m.time));
    return { open: o, locked: l };
  }, [predictableMatches]);

  // Unpredicted matches (engagement nudge)
  const unpredicted = useMemo(
    () => open.filter((m) => !predictionMap.has(m.id)),
    [open, predictionMap],
  );

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-yc-green border-t-transparent animate-spin mx-auto" />
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="max-w-lg mx-auto text-center py-16">
          <LogIn size={48} className="text-yc-text-tertiary mx-auto mb-4" />
          <h2 className="font-heading text-2xl font-bold mb-2">
            {t("predictions.signInTitle")}
          </h2>
          <p className="text-yc-text-secondary text-sm mb-6">
            {t("predictions.signInDesc")}
          </p>
          <NavLink
            to="/sign-in"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all"
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
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="font-heading text-2xl font-bold">{t("predictions.title")}</h2>
          <p className="text-yc-text-tertiary text-sm mt-1">
            {t("predictions.predicted", { count: predictions.length })} &middot; {t("predictions.remaining", { count: unpredicted.length })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Main column: prediction cards */}
        <div className="space-y-6">
          {/* Unpredicted nudge */}
          {unpredicted.length > 0 && !predsLoading && (
            <div className="bg-yc-warning/10 border border-yc-warning/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertCircle size={18} className="text-yc-warning shrink-0" />
              <p className="text-sm text-yc-text-secondary">{nudgeText}</p>
            </div>
          )}

          {/* Open matches */}
          {open.length > 0 && (
            <div>
              <h3 className="text-yc-text-secondary text-sm font-medium mb-3">
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
                    onSaved={refresh}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Locked matches (already kicked off) */}
          {locked.length > 0 && (
            <div>
              <h3 className="text-yc-text-secondary text-sm font-medium mb-3">
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
        </div>

        {/* Sidebar: how to play */}
        <div className="space-y-4">
          <HowToPlay />
        </div>
      </div>
    </div>
  );
}
