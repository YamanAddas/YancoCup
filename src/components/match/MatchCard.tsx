import { Link } from "react-router-dom";
import { MapPin, Clock } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import TeamCrest from "./TeamCrest";
import type { Match, Team, Venue } from "../../types";
import type { LocalLiveScore } from "../../hooks/useScores";

function TeamBadge({
  team,
  tla,
  crest,
  displayName,
  side,
}: {
  team: Team | undefined;
  tla: string | null;
  crest?: string | null;
  displayName?: string | null;
  side: "home" | "away";
}) {
  const align = side === "home" ? "items-end text-right" : "items-start text-left";
  const code = team?.fifaCode ?? tla?.toUpperCase() ?? "?";
  const label = displayName ?? team?.name ?? code;

  return (
    <div className={`flex flex-col ${align} gap-1 min-w-0 flex-1`}>
      <TeamCrest tla={code} isoCode={team?.isoCode} crest={crest} size="lg" />
      <span className="text-yc-text-primary text-sm font-semibold truncate w-full block">
        {label}
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

const ROUND_KEYS: Record<Match["round"], string> = {
  group: "round.group",
  playoff: "round.playoff",
  "round-of-32": "round.roundOf32",
  "round-of-16": "round.roundOf16",
  quarterfinal: "round.quarterfinal",
  semifinal: "round.semifinal",
  "third-place": "round.thirdPlace",
  final: "round.final",
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  if (status === "IN_PLAY" || status === "PAUSED") {
    return (
      <span className="flex items-center gap-1.5 text-yc-green text-xs font-medium">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yc-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yc-green" />
        </span>
        {status === "PAUSED" ? t("match.ht") : t("match.live")}
      </span>
    );
  }
  if (status === "FINISHED") {
    return <span className="text-yc-text-tertiary text-xs font-medium">{t("match.ft")}</span>;
  }
  return null;
}

interface MatchCardProps {
  match: Match;
  teamMap: Map<string, Team>;
  venueMap: Map<string, Venue>;
  liveScore?: LocalLiveScore;
  compact?: boolean;
  competitionId?: string;
}

export default function MatchCard({ match, teamMap, venueMap, liveScore, compact, competitionId }: MatchCardProps) {
  const { t } = useI18n();
  const home = match.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  const venue = venueMap.get(match.venueId);

  const effectiveStatus = liveScore?.status ?? match.status;
  const isLive = effectiveStatus === "IN_PLAY" || effectiveStatus === "PAUSED";
  const isFinished = effectiveStatus === "FINISHED";
  const scoreHome = liveScore?.homeScore ?? match.homeScore ?? null;
  const scoreAway = liveScore?.awayScore ?? match.awayScore ?? null;
  const hasScore = scoreHome !== null && scoreAway !== null;

  const tbd = t("match.tbd");

  const headerLabel = match.group
    ? t("match.group", { id: match.group })
    : match.matchday && match.round === "group"
      ? `Matchday ${match.matchday}`
      : t(ROUND_KEYS[match.round]);

  const detailUrl = competitionId ? `/${competitionId}/match/${match.id}` : undefined;

  const card = (
    <div className={`yc-hex-wrap ${isLive ? "is-live" : ""}`}>
      <div className="yc-hex-card p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 relative z-2">
          <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
            {headerLabel}
          </span>
          {effectiveStatus && (effectiveStatus === "IN_PLAY" || effectiveStatus === "PAUSED" || effectiveStatus === "FINISHED") ? (
            <StatusBadge status={effectiveStatus} />
          ) : (
            <span className="text-yc-text-tertiary text-xs">
              {formatMatchDate(match.date)}
            </span>
          )}
        </div>

        {/* Teams + score/time */}
        <div className="flex items-center gap-3 relative z-2">
          {match.homeTeam ? (
            <TeamBadge
              team={home}
              tla={match.homeTeam}
              crest={match.homeCrest ?? liveScore?.homeCrest}
              displayName={match.homeTeamName ?? liveScore?.homeTeamName}
              side="home"
            />
          ) : (
            <Placeholder label={match.homePlaceholder ?? tbd} side="home" />
          )}

          <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[60px]">
            {hasScore ? (
              <>
                <span
                  className={`font-mono text-xl font-bold tracking-wider ${
                    isLive ? "text-yc-green drop-shadow-[0_0_8px_rgba(0,255,136,0.4)]" : isFinished ? "text-yc-text-primary" : "text-yc-text-secondary"
                  }`}
                >
                  {scoreHome} - {scoreAway}
                </span>
                {isFinished && (
                  <span className="text-yc-text-tertiary text-[10px] font-medium">FT</span>
                )}
              </>
            ) : (
              <>
                <span className="text-yc-green font-mono text-lg font-bold">{t("match.vs")}</span>
                <div className="flex items-center gap-1 text-yc-text-secondary">
                  <Clock size={10} />
                  <span className="text-[11px]">{formatMatchTime(match.date, match.time)}</span>
                </div>
              </>
            )}
          </div>

          {match.awayTeam ? (
            <TeamBadge
              team={away}
              tla={match.awayTeam}
              crest={match.awayCrest ?? liveScore?.awayCrest}
              displayName={match.awayTeamName ?? liveScore?.awayTeamName}
              side="away"
            />
          ) : (
            <Placeholder label={match.awayPlaceholder ?? tbd} side="away" />
          )}
        </div>

        {/* Footer: date + venue */}
        {!compact && (
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-yc-text-tertiary text-xs relative z-2">
            <span>{formatMatchTime(match.date, match.time)}</span>
            {venue && (
              <span className="flex items-center gap-1 truncate ml-2">
                <MapPin size={10} className="shrink-0" />
                {venue.name}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (detailUrl) {
    return (
      <Link to={detailUrl} className="block no-underline text-inherit">
        {card}
      </Link>
    );
  }

  return card;
}
