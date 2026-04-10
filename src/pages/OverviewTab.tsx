import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCompetition } from "../lib/CompetitionProvider";
import { useCompetitionSchedule } from "../hooks/useCompetitionSchedule";
import { useTeamMap } from "../hooks/useTeams";
import { useVenueMap } from "../hooks/useVenues";
import { useScores } from "../hooks/useScores";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useAuth } from "../lib/auth";
import { useAutoScore } from "../hooks/useAutoScore";
import { useI18n } from "../lib/i18n";
import { fetchScorers } from "../lib/api";
import type { Scorer } from "../lib/api";
import MatchCard from "../components/match/MatchCard";
import TeamCrest from "../components/match/TeamCrest";
import {
  Calendar,
  Trophy,
  BarChart3,
  Users,
  ArrowRight,
  LogIn,
  Target,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
}) {
  return (
    <div className="yc-card p-3 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <Icon
          size={14}
          className={accent ? "text-yc-green" : "text-yc-text-tertiary"}
        />
        <span className="text-[11px] text-yc-text-tertiary uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span
        className={`font-heading text-xl font-bold ${
          accent ? "text-yc-green" : "text-yc-text-primary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function OverviewTab() {
  const comp = useCompetition();
  const { t } = useI18n();
  const { user } = useAuth();
  const { matches, loading } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const venueMap = useVenueMap();
  const { scoreMap } = useScores();
  const { entries: leaderboard } = useLeaderboard(comp.id);
  const { predictions } = useAutoScore(comp.id);
  const [scorers, setScorers] = useState<Scorer[]>([]);

  useEffect(() => {
    fetchScorers(comp.id).then((s) => setScorers(s));
  }, [comp.id]);

  const predictedIds = useMemo(
    () => new Set(predictions.map((p) => p.match_id)),
    [predictions],
  );

  // Matches with teams assigned
  const confirmedMatches = useMemo(
    () => matches.filter((m) => m.homeTeam && m.awayTeam),
    [matches],
  );

  // Live matches
  const liveMatches = useMemo(
    () =>
      matches.filter((m) => {
        const status = scoreMap.get(m.id)?.status ?? m.status;
        return status === "IN_PLAY" || status === "PAUSED";
      }),
    [matches, scoreMap],
  );

  // Upcoming matches (next 6)
  const upcoming = useMemo(() => {
    const now = new Date().toISOString().slice(0, 16);
    return matches
      .filter(
        (m) =>
          `${m.date}T${m.time}` >= now &&
          m.status !== "FINISHED" &&
          (scoreMap.get(m.id)?.status ?? m.status) !== "FINISHED",
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
      )
      .slice(0, 6);
  }, [matches, scoreMap]);

  // Recent results (last 4 finished)
  const recentResults = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.status === "FINISHED" ||
            scoreMap.get(m.id)?.status === "FINISHED",
        )
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
        )
        .slice(0, 4),
    [matches, scoreMap],
  );

  // Prediction stats
  const predictedCount = predictions.length;
  const totalConfirmed = confirmedMatches.length;
  const predictedPercent =
    totalConfirmed > 0
      ? Math.round((predictedCount / totalConfirmed) * 100)
      : 0;

  // User rank
  const userRank = user
    ? leaderboard.findIndex((e) => e.userId === user.id) + 1
    : 0;

  // Display matches: live > upcoming > recent
  const displayMatches =
    liveMatches.length > 0
      ? liveMatches
      : upcoming.length > 0
        ? upcoming
        : recentResults;
  const matchSectionLabel =
    liveMatches.length > 0
      ? t("home.liveNow")
      : upcoming.length > 0
        ? t("home.nextMatches")
        : t("overview.recentResults");

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-yc-green border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={t("nav.matches")} value={matches.length} icon={Calendar} />
        <StatCard
          label={t("predictions.title")}
          value={user ? `${predictedCount}/${totalConfirmed}` : "—"}
          icon={Trophy}
          accent
        />
        <StatCard
          label={t("leaderboard.rank")}
          value={userRank > 0 ? `#${userRank}` : "—"}
          icon={BarChart3}
        />
        <StatCard
          label={t("leaderboard.player")}
          value={leaderboard.length}
          icon={Users}
        />
      </div>

      {/* Prediction progress */}
      {user && totalConfirmed > 0 && (
        <div className="yc-card p-4 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-yc-text-secondary">
              {t("predictions.title")}
            </span>
            <span className="text-sm font-mono text-yc-green font-bold">
              {predictedPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-yc-bg-elevated overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yc-green/80 to-yc-green transition-all duration-500"
              style={{ width: `${predictedPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-yc-text-tertiary">
              {t("predictions.predicted", { count: predictedCount })} &middot;{" "}
              {t("predictions.remaining", {
                count: totalConfirmed - predictedCount,
              })}
            </span>
            <Link
              to="predictions"
              className="text-yc-green hover:underline flex items-center gap-1"
            >
              {t("predictions.title")} <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* Sign in prompt */}
      {!user && (
        <div className="yc-card p-6 rounded-xl text-center">
          <LogIn
            size={32}
            className="text-yc-text-tertiary mx-auto mb-3 opacity-50"
          />
          <h3 className="font-heading text-lg font-bold mb-1">
            {t("predictions.signInTitle")}
          </h3>
          <p className="text-yc-text-secondary text-sm mb-4">
            {t("predictions.signInDesc")}
          </p>
          <Link
            to="/sign-in"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-5 py-2.5 rounded-lg text-sm hover:brightness-110 transition-all"
          >
            <LogIn size={16} />
            {t("nav.signIn")}
          </Link>
        </div>
      )}

      {/* Matches section */}
      {displayMatches.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-yc-text-secondary text-sm font-medium flex items-center gap-2">
              {liveMatches.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-yc-green animate-pulse" />
              )}
              {matchSectionLabel}
            </h3>
            <Link
              to="matches"
              className="text-xs text-yc-green hover:underline flex items-center gap-1"
            >
              {t("home.allMatches")} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                teamMap={teamMap}
                venueMap={venueMap}
                liveScore={scoreMap.get(m.id)}
                competitionId={comp.id}
                predicted={predictedIds.has(m.id)}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Top Scorers teaser */}
      {scorers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-yc-text-secondary text-sm font-medium flex items-center gap-2">
              <Target size={14} className="text-yc-green" />
              {t("stats.topScorers")}
            </h3>
            <Link
              to="standings"
              className="text-xs text-yc-green hover:underline flex items-center gap-1"
            >
              {t("overview.fullTable")} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="yc-card rounded-xl overflow-hidden">
            {scorers.slice(0, 3).map((s, i) => (
              <div
                key={s.player.id}
                className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-yc-border/30" : ""} ${i === 0 ? "bg-yc-green/[0.02]" : ""}`}
              >
                <span className={`font-mono text-xs w-5 text-right ${i === 0 ? "text-yc-green font-bold" : "text-yc-text-tertiary"}`}>
                  {i + 1}
                </span>
                <TeamCrest tla={s.team.tla} crest={s.team.crest} size="xs" />
                <span className="text-sm text-yc-text-primary font-medium flex-1 truncate">
                  {s.player.name}
                </span>
                <span className="text-yc-green font-mono text-sm font-bold">
                  {s.goals ?? 0}
                </span>
                <span className="text-yc-text-tertiary text-xs">{t("overview.goals")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard teaser */}
      {leaderboard.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-yc-text-secondary text-sm font-medium">
              {t("home.leaderboard")}
            </h3>
            <Link
              to="leaderboard"
              className="text-xs text-yc-green hover:underline flex items-center gap-1"
            >
              {t("home.fullStandings")} <ArrowRight size={12} />
            </Link>
          </div>
          <div className="yc-card rounded-xl overflow-hidden">
            {leaderboard.slice(0, 5).map((entry, i) => (
              <div
                key={entry.userId}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  i > 0 ? "border-t border-yc-border/30" : ""
                } ${
                  entry.userId === user?.id
                    ? "bg-yc-green/[0.04]"
                    : i === 0
                      ? "bg-yc-green/[0.02]"
                      : ""
                }`}
              >
                <span
                  className={`font-mono text-xs w-5 text-right ${
                    i === 0
                      ? "text-yc-green font-bold"
                      : "text-yc-text-tertiary"
                  }`}
                >
                  {i + 1}
                </span>
                {entry.avatarUrl ? (
                  <img
                    src={entry.avatarUrl}
                    alt=""
                    className="w-6 h-6 rounded-full border border-yc-border"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-yc-bg-elevated flex items-center justify-center text-[10px] font-bold text-yc-text-secondary">
                    {entry.handle.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-yc-text-primary font-medium flex-1 truncate">
                  {entry.displayName ?? entry.handle}
                  {entry.userId === user?.id && (
                    <span className="text-yc-text-tertiary text-xs ml-1">
                      {t("leaderboard.you")}
                    </span>
                  )}
                </span>
                <span className="text-yc-green font-mono text-sm font-bold">
                  {entry.totalPoints}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
