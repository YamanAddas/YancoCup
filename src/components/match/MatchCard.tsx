import { useNavigate } from "react-router-dom";
import { MapPin, Clock } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import TeamCrest from "./TeamCrest";
import type { Match, Team, Venue } from "../../types";
import type { LocalLiveScore } from "../../hooks/useScores";

/** Displays a team with crest/flag + code. */
function TeamBadge({
  team,
  tla,
  crest,
  side,
}: {
  team: Team | undefined;
  tla: string | null;
  crest?: string | null;
  side: "home" | "away";
}) {
  const align = side === "home" ? "items-end text-right" : "items-start text-left";
  const code = team?.fifaCode ?? tla?.toUpperCase() ?? "?";

  return (
    <div className={`flex flex-col ${align} gap-1 min-w-0 flex-1`}>
      <TeamCrest
        tla={code}
        isoCode={team?.isoCode}
        crest={crest}
        size="lg"
      />
      <span className="text-yc-text-primary text-sm font-semibold truncate w-full block">
        {code}
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
  /** Competition ID for linking to match detail. If provided, card is clickable. */
  competitionId?: string;
}

export default function MatchCard({ match, teamMap, venueMap, liveScore, compact, competitionId }: MatchCardProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const home = match.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  const venue = venueMap.get(match.venueId);

  const isLive = liveScore?.status === "IN_PLAY" || liveScore?.status === "PAUSED";
  const isFinished = liveScore?.status === "FINISHED";
  const hasScore = liveScore && liveScore.homeScore !== null && liveScore.awayScore !== null;

  const tbd = t("match.tbd");

  // For league matches, show matchday instead of round
  const headerLabel = match.group
    ? t("match.group", { id: match.group })
    : match.matchday && match.round === "group"
      ? `MD ${match.matchday}`
      : t(ROUND_KEYS[match.round]);

  const handleClick = competitionId
    ? () => navigate(`/${competitionId}/match/${match.id}`)
    : undefined;

  return (
    <div
      onClick={handleClick}
      role={handleClick ? "link" : undefined}
      className={`bg-yc-bg-surface border rounded-xl p-4 transition-colors ${
        handleClick ? "cursor-pointer" : ""
      } ${
        isLive
          ? "border-yc-green-muted/50 shadow-[0_0_12px_rgba(0,255,136,0.08)]"
          : "border-yc-border hover:border-yc-border-hover"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
          {headerLabel}
        </span>
        {liveScore ? (
          <StatusBadge status={liveScore.status} />
        ) : (
          <span className="text-yc-text-tertiary text-xs">
            {formatMatchDate(match.date)}
          </span>
        )}
      </div>

      {/* Teams + score/time */}
      <div className="flex items-center gap-3">
        {match.homeTeam ? (
          <TeamBadge team={home} tla={match.homeTeam} crest={liveScore?.homeCrest} side="home" />
        ) : (
          <Placeholder label={match.homePlaceholder ?? tbd} side="home" />
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
                  {t("match.ht")} {liveScore.halfTimeHome}-{liveScore.halfTimeAway}
                </span>
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
          <TeamBadge team={away} tla={match.awayTeam} crest={liveScore?.awayCrest} side="away" />
        ) : (
          <Placeholder label={match.awayPlaceholder ?? tbd} side="away" />
        )}
      </div>

      {/* Footer: date + venue */}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-yc-border flex items-center justify-between text-yc-text-tertiary text-xs">
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
  );
}
