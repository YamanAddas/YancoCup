import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import GlobeView from "../components/globe/GlobeView";
import Countdown from "../components/layout/Countdown";
import MatchCard from "../components/match/MatchCard";
import { useSchedule } from "../hooks/useSchedule";
import { useTeamMap } from "../hooks/useTeams";
import { useVenueMap } from "../hooks/useVenues";
import { useScores } from "../hooks/useScores";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useI18n } from "../lib/i18n";
import ActivityFeed from "../components/activity/ActivityFeed";
import { Trophy, ArrowRight, Calendar, BarChart3, Activity } from "lucide-react";

function TodaysMatches() {
  const allMatches = useSchedule();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { scoreMap } = useScores();
  const { t } = useI18n();

  const todaysMatches = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return allMatches.filter((m) => m.date === today);
  }, [allMatches]);

  // If no matches today, show next upcoming matches
  const displayMatches = useMemo(() => {
    if (todaysMatches.length > 0) return { matches: todaysMatches, label: t("home.todaysMatches") };

    const today = new Date().toISOString().slice(0, 10);
    const upcoming = allMatches.filter((m) => m.date > today);
    const first = upcoming[0];
    if (first) {
      const nextDate = first.date;
      const nextMatches = upcoming.filter((m) => m.date === nextDate);
      const dateLabel = new Date(`${nextDate}T00:00:00Z`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
      return { matches: nextMatches, label: `${t("home.nextMatches")} — ${dateLabel}` };
    }

    return { matches: [], label: t("home.noUpcoming") };
  }, [todaysMatches, allMatches, t]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-yc-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-yc-green" />
          <h3 className="font-heading text-xl font-bold">{displayMatches.label}</h3>
        </div>
        <NavLink
          to="/matches"
          className="flex items-center gap-1 text-yc-green text-sm hover:underline"
        >
          {t("home.allMatches")} <ArrowRight size={14} />
        </NavLink>
      </div>

      {displayMatches.matches.length === 0 ? (
        <p className="text-yc-text-tertiary text-sm">
          {t("home.tournamentDates")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayMatches.matches.slice(0, 6).map((m) => (
            <MatchCard key={m.id} match={m} teamMap={teamMap} venueMap={venueMap} liveScore={scoreMap.get(m.id)} compact />
          ))}
        </div>
      )}
    </section>
  );
}

function LeaderboardSnippetInner() {
  const { entries, loading } = useLeaderboard();
  const { t } = useI18n();

  if (loading) {
    return <div className="h-40 bg-yc-bg-elevated rounded-xl animate-pulse" />;
  }

  if (entries.length === 0) {
    return (
      <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-6 text-center">
        <p className="text-yc-text-tertiary text-sm">{t("home.noPlayers")}</p>
      </div>
    );
  }

  const top5 = entries.slice(0, 5);

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl overflow-hidden">
      {top5.map((entry, i) => (
        <div
          key={entry.userId}
          className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-yc-border/50" : ""}`}
        >
          <span className="font-mono text-yc-text-tertiary text-sm w-5 text-right">
            {i + 1}
          </span>
          {entry.avatarUrl ? (
            <img src={entry.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
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
      {/* Hero: globe + countdown side by side on desktop */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-center">
        <GlobeView />

        <div className="flex flex-col items-center lg:items-start gap-6">
          <div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              {t("home.title")} <span className="text-yc-green">{t("home.year")}</span>
            </h2>
            <p className="text-yc-text-secondary text-sm">
              {t("home.subtitle")}
            </p>
          </div>

          <div>
            <p className="text-yc-text-tertiary text-xs uppercase tracking-widest mb-3">
              {t("home.kickoffIn")}
            </p>
            <Countdown />
          </div>

          <a
            href="#/predictions"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Trophy size={18} />
            {t("home.cta")}
          </a>
        </div>
      </section>

      <TodaysMatches />

      {/* Leaderboard + Activity side by side */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-yc-border grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Leaderboard snippet */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-yc-green" />
              <h3 className="font-heading text-xl font-bold">{t("home.leaderboard")}</h3>
            </div>
            <NavLink
              to="/leaderboard"
              className="flex items-center gap-1 text-yc-green text-sm hover:underline"
            >
              {t("home.fullStandings")} <ArrowRight size={14} />
            </NavLink>
          </div>
          <LeaderboardSnippetInner />
        </div>

        {/* Activity feed */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-yc-green" />
            <h3 className="font-heading text-xl font-bold">{t("home.recentActivity")}</h3>
          </div>
          <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-2">
            <ActivityFeed />
          </div>
        </div>
      </section>
    </div>
  );
}
