import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { getRank, getRankStars } from "../lib/ranks";
import { fetchBadges, fetchUserBadges, checkLoyaltyBadges, type Badge, type UserBadge } from "../lib/badges";
import { shareProfileCard } from "../lib/shareCard";
import RivalsSection from "../components/predictions/RivalsSection";
import StateError from "../components/shared/StateError";
import { requestNotificationPermission, notificationsEnabled } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { COMPETITIONS } from "../lib/competitions";
import {
  Trophy, Target, TrendingUp, Flame, Award, Shield, Globe, Medal,
  Eye, Zap, Crosshair, CheckCircle, Shuffle, Star, Bell, History, ChevronDown, Share2, Heart, X,
} from "lucide-react";
import { useFollowedTeams } from "../hooks/useFollowedTeams";
import { useTeamMap } from "../hooks/useTeams";
import TeamCrest from "../components/match/TeamCrest";
import type { LucideIcon } from "lucide-react";

// Map badge icon names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  "trending-up": TrendingUp,
  flame: Flame,
  award: Award,
  "check-circle": CheckCircle,
  crosshair: Crosshair,
  zap: Zap,
  eye: Eye,
  shuffle: Shuffle,
  trophy: Trophy,
  shield: Shield,
  globe: Globe,
  medal: Medal,
};

interface UserStats {
  totalPredictions: number;
  scoredPredictions: number;
  exactScores: number;
  correctGD: number;
  correctResult: number;
  wrong: number;
  correctResults: number;
  totalPoints: number;
  competitions: number;
}

interface CompStats {
  id: string;
  name: string;
  predictions: number;
  scored: number;
  points: number;
  exact: number;
  accuracy: number;
}

function RankBadge({ points }: { points: number }) {
  const { t } = useI18n();
  const rank = getRank(points);
  const stars = getRankStars(points);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${rank.bgColor} ${rank.borderColor}`}>
      <span className={`font-heading text-sm font-bold ${rank.color}`}>{t(rank.nameKey)}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={10}
            className={i < stars ? rank.color : "text-yc-text-tertiary/30"}
            fill={i < stars ? "currentColor" : "none"}
          />
        ))}
      </div>
    </div>
  );
}

function BadgeCard({
  badge,
  earned,
}: {
  badge: Badge;
  earned: UserBadge | undefined;
}) {
  const Icon = ICON_MAP[badge.icon] ?? Award;
  const isEarned = !!earned;

  return (
    <div
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
        isEarned
          ? "bg-yc-bg-surface border-yc-green-muted/30"
          : "bg-yc-bg-surface/50 border-yc-border opacity-40"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isEarned ? "bg-yc-green/15" : "bg-yc-bg-elevated"
        }`}
      >
        <Icon size={20} className={isEarned ? "text-yc-green" : "text-yc-text-tertiary"} />
      </div>
      <p className="text-xs font-medium text-yc-text-primary text-center leading-tight">
        {badge.name}
      </p>
      <p className="text-[10px] text-yc-text-tertiary text-center leading-tight">
        {badge.description}
      </p>
      {isEarned && earned && (
        <span className="text-[9px] text-yc-green mt-auto">
          {new Date(earned.earned_at).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4 flex flex-col items-center gap-1">
      <Icon size={18} className="text-yc-green" />
      <span className="text-xl font-bold font-mono text-yc-text-primary">{value}</span>
      <span className="text-xs text-yc-text-tertiary">{label}</span>
    </div>
  );
}

interface HistoryRow {
  id: string;
  match_id: number;
  competition_id: string;
  home_score: number | null;
  away_score: number | null;
  quick_pick: string | null;
  points: number | null;
  scored_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 15;

function AccuracyBar({ stats }: { stats: UserStats }) {
  const { t } = useI18n();
  const total = stats.scoredPredictions;
  if (total === 0) return null;

  const segments = [
    { label: t("howToPlay.exactScore"), count: stats.exactScores, color: "bg-yc-green" },
    { label: t("howToPlay.correctGD"), count: stats.correctGD, color: "bg-emerald-500" },
    { label: t("howToPlay.correctWinner"), count: stats.correctResult, color: "bg-yc-warning" },
    { label: t("howToPlay.wrong"), count: stats.wrong, color: "bg-red-500/70" },
  ];

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4 mb-8">
      <h3 className="text-sm font-medium text-yc-text-tertiary uppercase tracking-wider mb-3">
        {t("profile.accuracy")}
      </h3>
      {/* Bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-3">
        {segments.map((s) =>
          s.count > 0 ? (
            <div
              key={s.label}
              className={`${s.color} transition-all`}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null,
        )}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
            <span className="text-yc-text-secondary">{s.label}</span>
            <span className="text-yc-text-tertiary font-mono">
              {s.count} ({total > 0 ? Math.round((s.count / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowedTeamsSection() {
  const { follows, unfollowTeam, loading } = useFollowedTeams();
  const teamMap = useTeamMap();
  const { t } = useI18n();

  if (loading) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Heart size={16} className="text-yc-green" fill="currentColor" />
        <h3 className="text-sm font-medium text-yc-text-tertiary uppercase tracking-wider">
          {t("profile.followedTeams")}
        </h3>
      </div>
      {follows.length === 0 ? (
        <p className="text-yc-text-tertiary text-sm">{t("profile.noFollowedTeams")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {follows.map((f) => {
            const wcTeam = teamMap.get(f.team_id);
            return (
              <a
                key={f.team_id}
                href={`#/WC/team/${f.team_id}`}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-yc-bg-elevated border border-yc-border hover:border-yc-green/30 transition-colors"
              >
                <TeamCrest
                  tla={wcTeam?.fifaCode ?? f.team_id.toUpperCase()}
                  isoCode={wcTeam?.isoCode}
                  size="sm"
                />
                <span className="text-sm text-yc-text-primary font-medium">
                  {wcTeam?.fifaCode ?? f.team_id.toUpperCase()}
                </span>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); unfollowTeam(f.team_id); }}
                  className="p-0.5 rounded text-yc-text-tertiary opacity-0 group-hover:opacity-100 hover:text-yc-danger transition-all"
                  title={t("team.unfollow")}
                >
                  <X size={12} />
                </button>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PredictionHistory({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [compFilter, setCompFilter] = useState<string>("all");
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (offset: number, comp: string) => {
    let query = supabase
      .from("yc_predictions")
      .select("id, match_id, competition_id, home_score, away_score, quick_pick, points, scored_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE);

    if (comp !== "all") query = query.eq("competition_id", comp);

    const { data } = await query;
    return (data as HistoryRow[] | null) ?? [];
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    setRows([]);
    fetchPage(0, compFilter).then((data) => {
      setRows(data);
      setHasMore(data.length > PAGE_SIZE);
      setLoading(false);
    });
  }, [fetchPage, compFilter]);

  const loadMore = useCallback(async () => {
    const data = await fetchPage(rows.length, compFilter);
    setRows((prev) => [...prev, ...data]);
    setHasMore(data.length > PAGE_SIZE);
  }, [rows.length, compFilter, fetchPage]);

  const display = rows.slice(0, rows.length > PAGE_SIZE ? rows.length - 1 : rows.length);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History size={18} className="text-yc-green" />
          <h3 className="font-heading text-lg font-bold">{t("profile.history")}</h3>
        </div>
        <select
          value={compFilter}
          onChange={(e) => setCompFilter(e.target.value)}
          className="bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-1.5 text-xs text-yc-text-secondary"
        >
          <option value="all">{t("leaderboard.allPlayers")}</option>
          {Object.values(COMPETITIONS).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-yc-bg-elevated rounded-lg animate-pulse" />
          ))}
        </div>
      ) : display.length === 0 ? (
        <p className="text-yc-text-tertiary text-sm text-center py-6">{t("activity.noPredictions")}</p>
      ) : (
        <>
          <div className="space-y-1">
            {display.map((row) => {
              const isScored = row.scored_at !== null;
              const pts = row.points ?? 0;
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-yc-bg-surface/50 border border-yc-border/30"
                >
                  <span className="text-[10px] font-mono text-yc-text-tertiary w-8 shrink-0">
                    {row.competition_id}
                  </span>
                  <span className="text-xs text-yc-text-tertiary shrink-0">
                    #{row.match_id}
                  </span>
                  <div className="flex-1 min-w-0">
                    {row.home_score !== null && row.away_score !== null ? (
                      <span className="text-sm font-mono font-bold text-yc-text-primary">
                        {row.home_score}-{row.away_score}
                      </span>
                    ) : row.quick_pick ? (
                      <span className="text-sm font-mono font-bold text-yc-text-primary">
                        {row.quick_pick === "H" ? t("quickPick.home") : row.quick_pick === "A" ? t("quickPick.away") : t("quickPick.draw")}
                      </span>
                    ) : (
                      <span className="text-sm text-yc-text-tertiary">—</span>
                    )}
                  </div>
                  {isScored && (
                    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                      pts >= 10 ? "text-yc-green bg-yc-green/10" :
                      pts > 0 ? "text-yc-warning bg-yc-warning/10" :
                      "text-yc-text-tertiary bg-yc-bg-elevated"
                    }`}>
                      +{pts}
                    </span>
                  )}
                  <span className="text-[10px] text-yc-text-tertiary shrink-0">
                    {new Date(row.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full mt-3 py-2 text-xs text-yc-text-secondary hover:text-yc-green transition-colors flex items-center justify-center gap-1"
            >
              <ChevronDown size={14} />
              {t("chat.loadMore")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [compStats, setCompStats] = useState<CompStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) { setLoading(false); return; }

      try {
      const [allBadges, predictionData] = await Promise.all([
        fetchBadges(),
        supabase
          .from("yc_predictions")
          .select("points, scored_at, competition_id")
          .eq("user_id", user.id),
      ]);

      setBadges(allBadges);
      // Check & award loyalty badges on profile visit, then fetch earned
      await checkLoyaltyBadges(user.id);
      const earned = await fetchUserBadges(user.id);
      setUserBadges(earned);

      const predictions = predictionData.data ?? [];
      const competitions = new Set(predictions.map((p) => p.competition_id));
      let totalPoints = 0;
      let exactScores = 0;
      let correctGD = 0;
      let correctResult = 0;
      let wrong = 0;
      let correctResults = 0;
      let scoredPredictions = 0;

      for (const p of predictions) {
        if (p.scored_at !== null) {
          scoredPredictions++;
          const pts = p.points ?? 0;
          totalPoints += pts;
          if (pts >= 10) exactScores++;
          else if (pts >= 5) correctGD++;
          else if (pts > 0) { correctResult++; }
          else wrong++;
          if (pts > 0) correctResults++;
        }
      }

      setStats({
        totalPredictions: predictions.length,
        scoredPredictions,
        exactScores,
        correctGD,
        correctResult,
        wrong,
        correctResults,
        totalPoints,
        competitions: competitions.size,
      });

      // Per-competition stats
      const compAgg = new Map<string, { predictions: number; scored: number; points: number; exact: number; correct: number }>();
      for (const p of predictions) {
        const agg = compAgg.get(p.competition_id) ?? { predictions: 0, scored: 0, points: 0, exact: 0, correct: 0 };
        agg.predictions++;
        if (p.scored_at !== null) {
          agg.scored++;
          const pts = p.points ?? 0;
          agg.points += pts;
          if (pts >= 10) agg.exact++;
          if (pts > 0) agg.correct++;
        }
        compAgg.set(p.competition_id, agg);
      }
      const csList: CompStats[] = [];
      for (const [cid, agg] of compAgg) {
        const config = COMPETITIONS[cid];
        csList.push({
          id: cid,
          name: config?.name ?? cid,
          predictions: agg.predictions,
          scored: agg.scored,
          points: agg.points,
          exact: agg.exact,
          accuracy: agg.scored > 0 ? Math.round((agg.correct / agg.scored) * 100) : 0,
        });
      }
      csList.sort((a, b) => b.points - a.points);
      setCompStats(csList);
      } catch {
        setError("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="space-y-4">
          <div className="h-20 bg-yc-bg-elevated rounded-xl animate-pulse" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-yc-bg-elevated rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-40 bg-yc-bg-elevated rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Shield size={48} className="text-yc-text-tertiary mx-auto mb-4" />
        <p className="text-yc-text-secondary text-sm">{t("predictions.signInTitle")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <StateError onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const earnedMap = new Map(userBadges.map((b) => [b.badge_id, b]));
  const earnedCount = userBadges.length;
  const totalBadges = badges.length;
  const accuracy = stats && stats.scoredPredictions > 0
    ? Math.round((stats.correctResults / stats.scoredPredictions) * 100)
    : 0;

  const badgesByCategory = {
    activity: badges.filter((b) => b.category === "activity"),
    skill: badges.filter((b) => b.category === "skill"),
    loyalty: badges.filter((b) => b.category === "loyalty"),
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8">
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="w-16 h-16 rounded-full border-2 border-yc-green"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-yc-green-dark flex items-center justify-center text-yc-green text-2xl font-bold border-2 border-yc-green">
            {(profile?.handle ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h2 className="font-heading text-2xl font-bold">
            {profile?.display_name ?? profile?.handle ?? t("profile.player")}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <RankBadge points={stats?.totalPoints ?? 0} />
            <span className="text-xs text-yc-text-tertiary">
              {t("profile.badgesCount", { earned: earnedCount, total: totalBadges })}
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            if (!stats || !profile) return;
            const rank = getRank(stats.totalPoints);
            shareProfileCard({
              handle: profile.handle,
              displayName: profile.display_name,
              rank: rank.name,
              totalPoints: stats.totalPoints,
              predictions: stats.totalPredictions,
              exactScores: stats.exactScores,
              accuracy,
            });
          }}
          className="shrink-0 p-2 rounded-lg bg-yc-bg-elevated border border-yc-border hover:border-yc-green-muted/40 transition-colors"
          title={t("share.title")}
        >
          <Share2 size={18} className="text-yc-text-secondary" />
        </button>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatBox label={t("profile.totalPoints")} value={stats.totalPoints} icon={Trophy} />
          <StatBox label={t("profile.predictions")} value={stats.totalPredictions} icon={Target} />
          <StatBox label={t("profile.exactScores")} value={stats.exactScores} icon={Crosshair} />
          <StatBox label={t("profile.accuracy")} value={`${accuracy}%`} icon={TrendingUp} />
        </div>
      )}

      {/* Accuracy breakdown */}
      {stats && <AccuracyBar stats={stats} />}

      {/* Competition stats */}
      {compStats.length > 1 && (
        <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4 mb-8">
          <h3 className="text-sm font-medium text-yc-text-tertiary uppercase tracking-wider mb-3">
            {t("profile.compStats")}
          </h3>
          <div className="space-y-2">
            {compStats.map((cs) => (
              <div key={cs.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-yc-bg-elevated/50">
                <span className="text-xs font-mono font-bold text-yc-green w-8">{cs.id}</span>
                <span className="text-sm text-yc-text-primary flex-1 truncate">{cs.name}</span>
                <span className="text-xs text-yc-text-secondary font-mono">{cs.predictions} {t("profile.pred")}</span>
                <span className="text-xs text-yc-text-secondary font-mono">{cs.exact} {t("profile.exact")}</span>
                <span className="text-xs text-yc-text-secondary font-mono">{cs.accuracy}%</span>
                <span className="text-xs font-bold font-mono text-yc-green">{cs.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rivals */}
      <RivalsSection />

      {/* Notifications toggle */}
      {"Notification" in window && (
        <div className="mb-8 bg-yc-bg-surface border border-yc-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-yc-green" />
            <div>
              <p className="text-sm font-medium text-yc-text-primary">{t("profile.matchNotifications")}</p>
              <p className="text-xs text-yc-text-tertiary">{t("profile.matchNotificationsDesc")}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              const granted = await requestNotificationPermission();
              // Force re-render by updating a dummy state
              if (granted) window.location.reload();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              notificationsEnabled()
                ? "bg-yc-green/15 text-yc-green border border-yc-green/30"
                : "bg-yc-bg-elevated text-yc-text-secondary hover:text-yc-text-primary border border-yc-border"
            }`}
          >
            {notificationsEnabled() ? t("profile.enabled") : t("profile.enable")}
          </button>
        </div>
      )}

      {/* Followed teams */}
      <FollowedTeamsSection />

      {/* Badge collection */}
      <div className="space-y-6 mb-8">
        {(["activity", "skill", "loyalty"] as const).map((category) => {
          const categoryBadges = badgesByCategory[category];
          if (categoryBadges.length === 0) return null;
          const categoryKeys = { activity: "profile.activityBadges", skill: "profile.skillBadges", loyalty: "profile.loyaltyBadges" };
          return (
            <div key={category}>
              <h3 className="text-sm font-medium text-yc-text-tertiary uppercase tracking-wider mb-3">
                {t(categoryKeys[category])} {t("profile.badges")}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {categoryBadges.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    earned={earnedMap.get(badge.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Prediction history */}
      <PredictionHistory userId={user.id} />
    </div>
  );
}
