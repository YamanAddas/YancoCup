import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { getRank, getRankStars } from "../lib/ranks";
import { fetchBadges, fetchUserBadges, type Badge, type UserBadge } from "../lib/badges";
import { requestNotificationPermission, notificationsEnabled } from "../lib/notifications";
import { supabase } from "../lib/supabase";
import {
  Trophy, Target, TrendingUp, Flame, Award, Shield, Globe, Medal,
  Eye, Zap, Crosshair, CheckCircle, Shuffle, Star, Bell,
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
      <div className="space-y-6">
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
    </div>
  );
}
