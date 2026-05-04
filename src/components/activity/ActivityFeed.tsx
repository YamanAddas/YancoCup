import { useMemo } from "react";
import { useActivityFeed } from "../../hooks/useActivityFeed";
import { useTeamMap } from "../../hooks/useTeams";
import { useSchedule } from "../../hooks/useSchedule";
import { canPredict } from "../../hooks/usePredictions";
import { useReactions, type ReactionType } from "../../hooks/useReactions";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import TeamCrest from "../match/TeamCrest";
import ConfidenceBadge from "../predictions/ConfidenceBadge";
import type { Match } from "../../types";

const REACTION_EMOJI: Record<ReactionType, string> = {
  fire: "🔥",
  laugh: "😂",
  clown: "🤡",
};

function useTimeAgo() {
  const { t } = useI18n();
  return (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("activity.justNow");
    if (mins < 60) return t("activity.minsAgo", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("activity.hoursAgo", { count: hours });
    const days = Math.floor(hours / 24);
    return t("activity.daysAgo", { count: days });
  };
}

export default function ActivityFeed() {
  const { items, loading } = useActivityFeed(8);
  const teamMap = useTeamMap();
  const allMatches = useSchedule();
  const { t } = useI18n();
  const timeAgo = useTimeAgo();

  const { user } = useAuth();
  const predictionIds = useMemo(() => items.map((i) => i.id), [items]);
  const { counts, mine, toggle } = useReactions(predictionIds);

  const matchMap = new Map<number, Match>(allMatches.map((m) => [m.id, m]));

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-yc-bg-elevated rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-yc-text-tertiary text-sm text-center py-6">
        {t("activity.noPredictions")}
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const match = matchMap.get(item.matchId);
        const home = match?.homeTeam ? teamMap.get(match.homeTeam) : undefined;
        const away = match?.awayTeam ? teamMap.get(match.awayTeam) : undefined;
        // Hide scores for matches that haven't kicked off yet (prevent copying)
        const matchStarted = match ? !canPredict(match.date, match.time) : false;

        return (
          <div
            key={item.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-yc-bg-elevated/50 transition-colors"
          >
            {/* Avatar */}
            {item.avatarUrl ? (
              <img
                src={item.avatarUrl}
                alt=""
                className="w-7 h-7 rounded-full shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-yc-bg-elevated flex items-center justify-center text-xs font-bold text-yc-text-secondary shrink-0">
                {item.handle.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                <span className="text-yc-text-primary font-medium">
                  {item.displayName ?? item.handle}
                </span>
                <span className="text-yc-text-tertiary"> {t("activity.predicted")} </span>
                {home && away ? (
                  <span className="text-yc-text-secondary">
                    {home.fifaCode}{" "}
                    {matchStarted ? (
                      <span className="text-yc-green font-mono font-bold">
                        {item.homeScore}-{item.awayScore}
                      </span>
                    ) : (
                      <span className="text-yc-text-tertiary font-mono">?-?</span>
                    )}{" "}
                    {away.fifaCode}
                  </span>
                ) : (
                  <span className="text-yc-text-secondary">
                    {t("activity.matchNum", { id: item.matchId })}
                  </span>
                )}
              </p>
            </div>

            {/* Result + Flags + time */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Post-match actual result */}
              {match && match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null && (
                <span className="text-[10px] font-mono text-yc-text-tertiary bg-yc-bg-elevated px-1.5 py-0.5 rounded">
                  {match.homeScore}-{match.awayScore}
                </span>
              )}
              {/* Points earned */}
              {matchStarted && item.points !== undefined && item.points !== null && (
                <span className={`text-[10px] font-mono font-bold px-1 py-0.5 rounded ${
                  item.points >= 10 ? "text-yc-green bg-yc-green/10" :
                  item.points > 0 ? "text-yc-warning bg-yc-warning/10" :
                  "text-yc-text-tertiary bg-yc-bg-elevated"
                }`}>
                  +{item.points}
                </span>
              )}
              {/* Confidence stars */}
              <ConfidenceBadge level={item.confidence} />
              {home && (
                <TeamCrest tla={home.fifaCode} isoCode={home.isoCode} size="xs" />
              )}
              {away && (
                <TeamCrest tla={away.fifaCode} isoCode={away.isoCode} size="xs" />
              )}
              <span className="text-yc-text-tertiary text-[10px] ms-1">
                {timeAgo(item.createdAt)}
              </span>
            </div>

            {/* Reactions */}
            {user && (
              <div className="flex items-center gap-0.5 shrink-0 ms-1">
                {(["fire", "laugh", "clown"] as ReactionType[]).map((r) => {
                  const c = counts.get(item.id)?.[r] ?? 0;
                  const active = mine.get(item.id)?.[r] ?? false;
                  return (
                    <button
                      key={r}
                      onClick={() => toggle(item.id, r)}
                      className={`text-[11px] px-1 py-0.5 rounded transition-colors ${
                        active
                          ? "bg-yc-bg-elevated ring-1 ring-yc-green/30"
                          : "hover:bg-yc-bg-elevated/50"
                      }`}
                      title={r}
                    >
                      {REACTION_EMOJI[r]}
                      {c > 0 && (
                        <span className="text-[9px] ml-0.5 text-yc-text-secondary">
                          {c}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
