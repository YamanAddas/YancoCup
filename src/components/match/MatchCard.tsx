import { MapPin, Clock } from "lucide-react";
import type { Match, Team, Venue } from "../../types";
import type { LocalLiveScore } from "../../hooks/useScores";

const FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags";

function TeamBadge({ team, side }: { team: Team | undefined; side: "home" | "away" }) {
  if (!team) return null;
  const align = side === "home" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={`flex flex-col ${align} gap-1 min-w-0 flex-1`}>
      <img
        src={`${FLAG_BASE}/${team.isoCode}.svg`}
        alt={team.name}
        className="w-10 h-10 rounded-full"
      />
      <span className="text-yc-text-primary text-sm font-semibold truncate w-full block">
        {team.fifaCode}
      </span>
    </div>
  );
}

function Placeholder({ label, side }: { label: string; side: "home" | "away" }) {
  const align = side === "home" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={`flex flex-col ${align} gap-1 min-w-0 flex-1`}>
      <div className="w-10 h-10 rounded-full bg-yc-bg-elevated border border-yc-border flex items-center justify-center">
        <span className="text-yc-text-tertiary text-[10px] font-mono">?</span>
      </div>
      <span className="text-yc-text-tertiary text-xs font-mono truncate w-full block">
        {label}
      </span>
    </div>
  );
}

function formatMatchTime(date: string, time: string): string {
  const dt = new Date(`${date}T${time}:00Z`);
  return dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatMatchDate(date: string): string {
  const dt = new Date(`${date}T00:00:00Z`);
  return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function roundLabel(round: Match["round"]): string {
  const labels: Record<Match["round"], string> = {
    group: "Group Stage",
    "round-of-32": "Round of 32",
    "round-of-16": "Round of 16",
    quarterfinal: "Quarterfinal",
    semifinal: "Semifinal",
    "third-place": "3rd Place",
    final: "Final",
  };
  return labels[round];
}

/** Status badge for match state */
function StatusBadge({ status }: { status: string }) {
  if (status === "IN_PLAY" || status === "PAUSED") {
    return (
      <span className="flex items-center gap-1.5 text-yc-green text-xs font-medium">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yc-green" />
        </span>
        {status === "PAUSED" ? "HT" : "LIVE"}
      </span>
    );
  }
  if (status === "FINISHED") {
    return <span className="text-yc-text-tertiary text-xs font-medium">FT</span>;
  }
  return null;
}

interface MatchCardProps {
  match: Match;
  teamMap: Map<string, Team>;
  venueMap: Map<string, Venue>;
  liveScore?: LocalLiveScore;
  compact?: boolean;
}

export default function MatchCard({ match, teamMap, venueMap, liveScore, compact }: MatchCardProps) {
  const home = match.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  const venue = venueMap.get(match.venueId);

  const isLive = liveScore?.status === "IN_PLAY" || liveScore?.status === "PAUSED";
  const isFinished = liveScore?.status === "FINISHED";
  const hasScore = liveScore && liveScore.homeScore !== null && liveScore.awayScore !== null;

  return (
    <div
      className={`bg-yc-bg-surface border rounded-xl p-4 transition-colors ${
        isLive
          ? "border-yc-green-muted/50 shadow-[0_0_12px_rgba(0,255,136,0.08)]"
          : "border-yc-border hover:border-yc-border-hover"
      }`}
    >
      {/* Header: round + group badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
          {match.group ? `Group ${match.group}` : roundLabel(match.round)}
        </span>
        {liveScore ? (
          <StatusBadge status={liveScore.status} />
        ) : (
          <span className="text-yc-text-tertiary text-xs">#{match.id}</span>
        )}
      </div>

      {/* Teams + score/time */}
      <div className="flex items-center gap-3">
        {home ? (
          <TeamBadge team={home} side="home" />
        ) : (
          <Placeholder label={match.homePlaceholder ?? "TBD"} side="home" />
        )}

        <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[60px]">
          {hasScore ? (
            <>
              <span
                className={`font-mono text-xl font-bold ${
                  isLive ? "text-yc-green" : isFinished ? "text-yc-text-primary" : "text-yc-text-secondary"
                }`}
              >
                {liveScore.homeScore} - {liveScore.awayScore}
              </span>
              {liveScore.halfTimeHome !== null && liveScore.halfTimeAway !== null && isFinished && (
                <span className="text-yc-text-tertiary text-[10px] font-mono">
                  HT {liveScore.halfTimeHome}-{liveScore.halfTimeAway}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="text-yc-green font-mono text-lg font-bold">vs</span>
              <div className="flex items-center gap-1 text-yc-text-secondary">
                <Clock size={10} />
                <span className="text-[11px]">{formatMatchTime(match.date, match.time)}</span>
              </div>
            </>
          )}
        </div>

        {away ? (
          <TeamBadge team={away} side="away" />
        ) : (
          <Placeholder label={match.awayPlaceholder ?? "TBD"} side="away" />
        )}
      </div>

      {/* Footer: date + venue */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-yc-border flex items-center justify-between text-yc-text-tertiary text-xs">
          <span>{formatMatchDate(match.date)}</span>
          {venue && (
            <span className="flex items-center gap-1 truncate ml-2">
              <MapPin size={10} className="shrink-0" />
              {venue.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
