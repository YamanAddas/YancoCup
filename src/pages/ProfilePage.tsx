import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { getRank, getRankStars } from "../lib/ranks";
import { fetchBadges, fetchUserBadges, type Badge, type UserBadge } from "../lib/badges";
import { requestNotificationPermission, notificationsEnabled } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import { COMPETITIONS } from "../lib/competitions";
import {
  Trophy, Target, TrendingUp, Flame, Award, Shield, Globe, Medal,
  Eye, Zap, Crosshair, CheckCircle, Shuffle, Star, Bell, History, ChevronDown,
} from "lucide-react";
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
  correctResults: number;
  totalPoints: number;
  competitions: number;
}

function RankBadge({ points }: { points: number }) {
  const rank = getRank(points);
  const stars = getRankStars(points);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${rank.bgColor} ${rank.borderColor}`}>
      <span className={`font-heading text-sm font-bold ${rank.color}`}>{rank.name}</span>
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
                        {row.quick_pick === "H" ? "Home" : row.quick_pick === "A" ? "Away" : "Draw"}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) { setLoading(false); return; }

      const [allBadges, earned, predictionData] = await Promise.all([
        fetchBadges(),
        fetchUserBadges(user.id),
        supabase
          .from("yc_predictions")
          .select("points, scored_at, competition_id")
          .eq("user_id", user.id),
      ]);

      setBadges(allBadges);
      setUserBadges(earned);

      const predictions = predictionData.data ?? [];
      const competitions = new Set(predictions.map((p) => p.competition_id));
      let totalPoints = 0;
      let exactScores = 0;
      let correctResults = 0;
      let scoredPredictions = 0;

      for (const p of predictions) {
        if (p.scored_at !== null) {
          scoredPredictions++;
          const pts = p.points ?? 0;
          totalPoints += pts;
          if (pts >= 10) exactScores++;
          if (pts > 0) correctResults++;
        }
      }

      setStats({
        totalPredictions: predictions.length,
        scoredPredictions,
        exactScores,
        correctResults,
        totalPoints,
        competitions: competitions.size,
      });

      setLoading(false);
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
        <div>
          <h2 className="font-heading text-2xl font-bold">
            {profile?.display_name ?? profile?.handle ?? "Player"}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <RankBadge points={stats?.totalPoints ?? 0} />
            <span className="text-xs text-yc-text-tertiary">
              {earnedCount}/{totalBadges} badges
            </span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatBox label="Total Points" value={stats.totalPoints} icon={Trophy} />
          <StatBox label="Predictions" value={stats.totalPredictions} icon={Target} />
          <StatBox label="Exact Scores" value={stats.exactScores} icon={Crosshair} />
          <StatBox label="Accuracy" value={`${accuracy}%`} icon={TrendingUp} />
        </div>
      )}

      {/* Notifications toggle */}
      {"Notification" in window && (
        <div className="mb-8 bg-yc-bg-surface border border-yc-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-yc-green" />
            <div>
              <p className="text-sm font-medium text-yc-text-primary">Match Notifications</p>
              <p className="text-xs text-yc-text-tertiary">Get reminded before prediction deadlines</p>
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
            {notificationsEnabled() ? "Enabled" : "Enable"}
          </button>
        </div>
      )}

      {/* Badge collection */}
      <div className="space-y-6 mb-8">
        {(["activity", "skill", "loyalty"] as const).map((category) => {
          const categoryBadges = badgesByCategory[category];
          if (categoryBadges.length === 0) return null;
          const categoryLabels = { activity: "Activity", skill: "Skill", loyalty: "Loyalty" };
          return (
            <div key={category}>
              <h3 className="text-sm font-medium text-yc-text-tertiary uppercase tracking-wider mb-3">
                {categoryLabels[category]} Badges
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
