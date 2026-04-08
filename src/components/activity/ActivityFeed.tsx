import { useActivityFeed } from "../../hooks/useActivityFeed";
import { useTeamMap } from "../../hooks/useTeams";
import { useSchedule } from "../../hooks/useSchedule";
import type { Match } from "../../types";

const FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeed() {
  const { items, loading } = useActivityFeed(8);
  const teamMap = useTeamMap();
  const allMatches = useSchedule();

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
        No predictions yet. Be the first!
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const match = matchMap.get(item.matchId);
        const home = match?.homeTeam ? teamMap.get(match.homeTeam) : undefined;
        const away = match?.awayTeam ? teamMap.get(match.awayTeam) : undefined;

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
                <span className="text-yc-text-tertiary"> predicted </span>
                {home && away ? (
                  <span className="text-yc-text-secondary">
                    {home.fifaCode}{" "}
                    <span className="text-yc-green font-mono font-bold">
                      {item.homeScore}-{item.awayScore}
                    </span>{" "}
                    {away.fifaCode}
                  </span>
                ) : (
                  <span className="text-yc-text-secondary">
                    Match #{item.matchId}
                  </span>
                )}
              </p>
            </div>

            {/* Flags + time */}
            <div className="flex items-center gap-1.5 shrink-0">
              {home && (
                <img
                  src={`${FLAG_BASE}/${home.isoCode}.svg`}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              )}
              {away && (
                <img
                  src={`${FLAG_BASE}/${away.isoCode}.svg`}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
              )}
              <span className="text-yc-text-tertiary text-[10px] ml-1">
                {timeAgo(item.createdAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
