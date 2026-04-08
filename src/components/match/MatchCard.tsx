import { MapPin, Clock } from "lucide-react";
import type { Match, Team, Venue } from "../../types";

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

interface MatchCardProps {
  match: Match;
  teamMap: Map<string, Team>;
  venueMap: Map<string, Venue>;
  compact?: boolean;
}

export default function MatchCard({ match, teamMap, venueMap, compact }: MatchCardProps) {
  const home = match.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  const venue = venueMap.get(match.venueId);

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4 hover:border-yc-border-hover transition-colors">
      {/* Header: round + group badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
          {match.group ? `Group ${match.group}` : roundLabel(match.round)}
        </span>
        <span className="text-yc-text-tertiary text-xs">
          #{match.id}
        </span>
      </div>

      {/* Teams + time */}
      <div className="flex items-center gap-3">
        {home ? (
          <TeamBadge team={home} side="home" />
        ) : (
          <Placeholder label={match.homePlaceholder ?? "TBD"} side="home" />
        )}

        <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[60px]">
          <span className="text-yc-green font-mono text-lg font-bold">vs</span>
          <div className="flex items-center gap-1 text-yc-text-secondary">
            <Clock size={10} />
            <span className="text-[11px]">{formatMatchTime(match.date, match.time)}</span>
          </div>
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
