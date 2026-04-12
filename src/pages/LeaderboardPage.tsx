import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLeaderboard } from "../hooks/useLeaderboard";
import type { LeaderboardPeriod } from "../hooks/useLeaderboard";
import { useMyPools, usePoolMembers } from "../hooks/usePools";
import { useAuth } from "../lib/auth";
import { useAutoScore } from "../hooks/useAutoScore";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import { getRank, getRankStars } from "../lib/ranks";
import { TrendingUp, Target, Award, Star, ArrowUp, ArrowDown, Users } from "lucide-react";

function RankPill({ points }: { points: number }) {
  const { t } = useI18n();
  const rank = getRank(points);
  const stars = getRankStars(points);

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${rank.bgColor} ${rank.color} ${rank.borderColor} border`}
      title={`${t(rank.nameKey)} — ${stars}/5 stars`}
    >
      {t(rank.nameKey).charAt(0)}
      <span className="flex gap-px">
        {Array.from({ length: Math.min(stars, 5) }).map((_, i) => (
          <Star key={i} size={7} fill="currentColor" />
        ))}
      </span>
    </span>
  );
}

export default function LeaderboardPage() {
  const comp = useCompetition();
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);
  const { entries: allEntries, loading } = useLeaderboard(comp.id, period);
  const { user } = useAuth();
  const { t } = useI18n();
  const { pools } = useMyPools();
  const compPools = pools.filter((p) => p.competition_id === comp.id);
  const { members: poolMembers } = usePoolMembers(selectedPoolId);
  useAutoScore(comp.id);

  // Filter entries by pool if selected
  const entries = useMemo(() => {
    if (!selectedPoolId || poolMembers.length === 0) return allEntries;
    const memberIds = new Set(poolMembers.map((m) => m.user_id));
    return allEntries.filter((e) => memberIds.has(e.userId));
  }, [allEntries, selectedPoolId, poolMembers]);

  const playerCount = entries.length !== 1
    ? t("leaderboard.playersPlural", { count: entries.length })
    : t("leaderboard.players", { count: entries.length });

  const periods: { key: LeaderboardPeriod; label: string }[] = [
    { key: "all", label: t("leaderboard.allTime") },
    { key: "weekly", label: t("leaderboard.weekly") },
    { key: "monthly", label: t("leaderboard.monthly") },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Period filter tabs */}
        <div className="flex gap-1 bg-yc-bg-surface rounded-lg p-1">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                period === p.key
                  ? "bg-yc-green text-yc-bg-deep"
                  : "text-yc-text-secondary hover:text-yc-text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Pool filter */}
        {compPools.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Users size={12} className="text-yc-text-tertiary" />
            <select
              value={selectedPoolId ?? ""}
              onChange={(e) => setSelectedPoolId(e.target.value || null)}
              className="bg-yc-bg-surface border border-yc-border rounded-lg px-2 py-1.5 text-xs text-yc-text-primary focus:outline-none focus:border-yc-green-muted"
            >
              <option value="">{t("leaderboard.allPlayers")}</option>
              {compPools.map((pool) => (
                <option key={pool.id} value={pool.id}>{pool.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <p className="text-yc-text-secondary text-sm mb-6">{playerCount}</p>

      {loading ? (
        <div className="yc-card rounded-xl overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-yc-border/30">
              <div className="w-6 h-4 bg-yc-bg-elevated rounded animate-pulse" />
              <div className="w-7 h-7 bg-yc-bg-elevated rounded-full animate-pulse" />
              <div className="flex-1 h-4 bg-yc-bg-elevated rounded animate-pulse max-w-[120px]" />
              <div className="w-10 h-4 bg-yc-bg-elevated rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="yc-card p-12 rounded-xl text-center">
          <Award size={48} className="text-yc-text-tertiary mx-auto mb-4 opacity-40" />
          <p className="text-yc-text-secondary text-sm">
            {t("leaderboard.noPredictions")}
          </p>
        </div>
      ) : (
        <>
          {/* Podium — top 3 with glass cards */}
          {entries.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[entries[1], entries[0], entries[2]].map((entry, i) => {
                if (!entry) return null;
                const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
                const heights = ["h-24", "h-32", "h-20"];
                const glows = [
                  "",
                  "shadow-[0_0_24px_rgba(0,255,136,0.12)]",
                  "",
                ];
                return (
                  <div key={entry.userId} className="flex flex-col items-center">
                    <Link to="/profile" className="flex flex-col items-center">
                      {entry.avatarUrl ? (
                        <img
                          src={entry.avatarUrl}
                          alt={entry.displayName ?? entry.handle}
                          className={`w-12 h-12 rounded-full border-2 mb-2 ${rank === 1 ? "border-yc-green shadow-[0_0_12px_rgba(0,255,136,0.3)]" : "border-yc-border"}`}
                        />
                      ) : (
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-2 ${
                            rank === 1
                              ? "bg-yc-green-dark text-yc-green border-2 border-yc-green shadow-[0_0_12px_rgba(0,255,136,0.3)]"
                              : "bg-yc-bg-elevated text-yc-text-secondary border-2 border-yc-border"
                          }`}
                        >
                          {entry.handle.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <span className="text-yc-text-primary text-sm font-medium truncate max-w-full">
                      {entry.displayName ?? entry.handle}
                    </span>
                    <RankPill points={entry.totalPoints} />
                    <span className="text-yc-green font-mono text-sm font-bold mt-1">
                      {entry.totalPoints} pts
                    </span>
                    <div
                      className={`${heights[i]} w-full mt-2 rounded-t-lg yc-card flex items-start justify-center pt-3 ${glows[i]}`}
                    >
                      <span className={`font-heading text-2xl font-bold ${
                        rank === 1 ? "text-yc-green" : rank === 2 ? "text-gray-400" : "text-amber-600"
                      }`}>
                        #{rank}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full table */}
          <div className="yc-card rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="text-yc-text-tertiary text-xs uppercase tracking-wider border-b border-yc-border">
                  <th className="text-start ps-4 py-3 w-12">{t("leaderboard.rank")}</th>
                  <th className="text-start py-3">{t("leaderboard.player")}</th>
                  <th className="text-center py-3 w-16">
                    <span className="hidden sm:inline">{t("leaderboard.points")}</span>
                    <span className="sm:hidden">{t("leaderboard.pts")}</span>
                  </th>
                  <th className="text-center py-3 w-20 hidden sm:table-cell">{t("leaderboard.correct")}</th>
                  <th className="text-center py-3 w-16 hidden sm:table-cell">{t("leaderboard.accuracy")}</th>
                  <th className="text-center py-3 w-16 pr-4">
                    <span title="Points Per Prediction" className="cursor-help">{t("leaderboard.ppp")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const isMe = user?.id === entry.userId;
                  return (
                    <tr
                      key={entry.userId}
                      className={`border-t border-yc-border/30 transition-colors ${
                        isMe ? "bg-yc-green/[0.05]" : i < 3 ? "bg-white/[0.01]" : ""
                      } hover:bg-white/[0.02]`}
                    >
                      <td className="pl-4 py-3 font-mono text-yc-text-tertiary">
                        <div className="flex items-center gap-1">
                          {i + 1}
                          {period !== "all" && entry.previousRank !== undefined && (() => {
                            const diff = entry.previousRank - (i + 1);
                            if (diff > 0) return (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-yc-green">
                                <ArrowUp size={10} />{diff}
                              </span>
                            );
                            if (diff < 0) return (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-yc-danger">
                                <ArrowDown size={10} />{Math.abs(diff)}
                              </span>
                            );
                            return null;
                          })()}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {entry.avatarUrl ? (
                            <img
                              src={entry.avatarUrl}
                              alt={entry.displayName ?? entry.handle}
                              className="w-7 h-7 rounded-full border border-yc-border"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-yc-bg-elevated flex items-center justify-center text-xs font-bold text-yc-text-secondary">
                              {entry.handle.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`font-medium truncate ${isMe ? "text-yc-green" : "text-yc-text-primary"}`}
                            >
                              {entry.displayName ?? entry.handle}
                              {isMe && <span className="text-yc-text-tertiary text-xs ms-1">{t("leaderboard.you")}</span>}
                            </span>
                            <RankPill points={entry.totalPoints} />
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3 font-mono font-bold text-yc-text-primary">
                        {entry.totalPoints}
                      </td>
                      <td className="text-center py-3 text-yc-text-secondary hidden sm:table-cell">
                        {entry.correctPredictions}/{entry.totalPredictions}
                      </td>
                      <td className="text-center py-3 text-yc-text-secondary hidden sm:table-cell">
                        {entry.accuracy}%
                      </td>
                      <td className="text-center py-3 pr-4 font-mono text-yc-text-secondary">
                        {entry.pointsPerPrediction}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-yc-text-tertiary">
            <span className="flex items-center gap-1">
              <TrendingUp size={12} />
              {t("leaderboard.pppDesc")}
            </span>
            <span className="flex items-center gap-1">
              <Target size={12} />
              {t("leaderboard.accDesc")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
