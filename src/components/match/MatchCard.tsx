import { useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { MapPin, Clock, Check } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import TeamCrest from "./TeamCrest";
import { formatTimeWithTZ, formatMatchDate as fmtDate } from "../../lib/formatDate";
import type { Match, Team, Venue } from "../../types";
import type { LocalLiveScore } from "../../hooks/useScores";

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function TeamBadge({
  team,
  tla,
  crest,
  displayName,
  side,
  teamUrl,
}: {
  team: Team | undefined;
  tla: string | null;
  crest?: string | null;
  displayName?: string | null;
  side: "home" | "away";
  teamUrl?: string | null;
}) {
  const align = side === "home" ? "items-end text-right" : "items-start text-left";
  const code = team?.fifaCode ?? tla?.toUpperCase() ?? "?";
  const label = displayName ?? team?.name ?? code;

  const content = (
    <div className={`flex flex-col ${align} gap-1 min-w-0 flex-1`}>
      <TeamCrest tla={code} isoCode={team?.isoCode} crest={crest} size="lg" />
      <span className={`text-sm font-semibold truncate w-full block ${teamUrl ? "group-hover/team:text-yc-green transition-colors" : ""} text-yc-text-primary`}>
        {label}
      </span>
    </div>
  );

  if (teamUrl) {
    return (
      <Link
        to={teamUrl}
        className="flex-1 min-w-0 group/team"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </Link>
    );
  }

  return content;
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

function formatMatchTime(date: string, time: string, lang?: string): string {
  return formatTimeWithTZ(new Date(`${date}T${time}:00Z`), lang);
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
  predicted?: boolean;
}

export default function MatchCard({ match, teamMap, venueMap, liveScore, compact, competitionId, predicted }: MatchCardProps) {
  const { t, lang, tTeam, tVenue } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const specRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  const home = match.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  const venue = venueMap.get(match.venueId);

  // Compute team page URLs using numeric IDs (from match data or live score)
  const homeTeamId = match.homeTeamId ?? liveScore?.homeTeamId;
  const awayTeamId = match.awayTeamId ?? liveScore?.awayTeamId;
  const homeTeamUrl = competitionId && homeTeamId ? `/${competitionId}/team/${homeTeamId}` : null;
  const awayTeamUrl = competitionId && awayTeamId ? `/${competitionId}/team/${awayTeamId}` : null;

  const rawStatus = liveScore?.status ?? match.status;
  // Client-side fallback: if kickoff was >4h ago but status is still TIMED,
  // the Worker couldn't update KV (e.g., write limit). Treat as finished.
  const kickoffMs = new Date(`${match.date}T${match.time}:00Z`).getTime();
  const effectiveStatus =
    rawStatus !== "FINISHED" && rawStatus !== "IN_PLAY" && rawStatus !== "PAUSED"
    && Date.now() - kickoffMs > 4 * 60 * 60 * 1000
      ? "FINISHED"
      : rawStatus;
  const isLive = effectiveStatus === "IN_PLAY" || effectiveStatus === "PAUSED";
  const isFinished = effectiveStatus === "FINISHED";
  const scoreHome = liveScore?.homeScore ?? match.homeScore ?? null;
  const scoreAway = liveScore?.awayScore ?? match.awayScore ?? null;
  const hasScore = scoreHome !== null && scoreAway !== null;

  const tbd = t("match.tbd");

  const headerLabel = match.group
    ? t("match.group", { id: match.group })
    : match.matchday && match.round === "group"
      ? t("match.matchday", { num: match.matchday })
      : t(ROUND_KEYS[match.round]);

  const detailUrl = competitionId ? `/${competitionId}/match/${match.id}` : undefined;

  /* ── 3D mouse-tracking tilt (from YancoHub gaming grid) ── */
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (REDUCED_MOTION || rafRef.current) return;
    const cx = e.clientX;
    const cy = e.clientY;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const wrap = wrapRef.current;
      const spec = specRef.current;
      if (!wrap) return;

      const rect = wrap.getBoundingClientRect();
      const x = (cx - rect.left) / rect.width;
      const y = (cy - rect.top) / rect.height;

      const rotY = (x - 0.5) * 14;   // ±7° horizontal
      const rotX = (0.5 - y) * 10;   // ±5° vertical

      // Remove transition during active tracking for instant response
      wrap.style.transition = "filter 0.3s ease";
      wrap.style.transform = `rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;

      if (spec) {
        spec.style.setProperty("--spec-x", `${(x * 100).toFixed(1)}%`);
        spec.style.setProperty("--spec-y", `${(y * 100).toFixed(1)}%`);
      }
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const wrap = wrapRef.current;
    if (wrap) {
      // Restore smooth spring transition for settle-back
      wrap.style.transition =
        "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease";
      wrap.style.transform = "";
    }
  }, []);

  const card = (
    <div className="yc-hex-3d">
      <div
        ref={wrapRef}
        className={`yc-hex-wrap yc-hex-enter ${isLive ? "is-live" : ""}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* Crystal layers outside the clip */}
        <div className="yc-hex-border" />
        <div className="yc-hex-glow" />

        {/* Main hex body (clipped) */}
        <div className="yc-hex-card py-4 px-7">
          {/* Crystal layers inside the clip */}
          <div className="yc-hex-glass" />
          <div className="yc-hex-depth" />
          <div ref={specRef} className="yc-hex-specular" />
          <div className="yc-hex-reflect" />

          {/* Content — above all crystal layers */}
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-1.5 text-yc-text-tertiary text-xs uppercase tracking-wider">
                {headerLabel}
                {predicted && (
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yc-green/15 text-yc-green" title="Predicted">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
              </span>
              {effectiveStatus && (effectiveStatus === "IN_PLAY" || effectiveStatus === "PAUSED" || effectiveStatus === "FINISHED") ? (
                <StatusBadge status={effectiveStatus} />
              ) : (
                <span className="text-yc-text-tertiary text-xs">
                  {fmtDate(match.date, lang)}
                </span>
              )}
            </div>

            {/* Teams + score/time */}
            <div className="flex items-center gap-3">
              {match.homeTeam ? (
                <TeamBadge
                  team={home}
                  tla={match.homeTeam}
                  crest={match.homeCrest ?? liveScore?.homeCrest}
                  displayName={match.homeTeamName ? tTeam(match.homeTeamName) : home ? tTeam(home.id) : liveScore?.homeTeamName}
                  side="home"
                  teamUrl={homeTeamUrl}
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
                      <span className="text-yc-text-tertiary text-[10px] font-medium">{t("match.ft")}</span>
                    )}
                  </>
                ) : isFinished ? (
                  <span className="text-yc-text-tertiary font-mono text-sm font-medium">{t("match.ft")}</span>
                ) : (
                  <>
                    <span className="text-yc-green font-mono text-lg font-bold">{t("match.vs")}</span>
                    <div className="flex items-center gap-1 text-yc-text-secondary">
                      <Clock size={10} />
                      <span className="text-[11px]">{formatMatchTime(match.date, match.time, lang)}</span>
                    </div>
                  </>
                )}
              </div>

              {match.awayTeam ? (
                <TeamBadge
                  team={away}
                  tla={match.awayTeam}
                  crest={match.awayCrest ?? liveScore?.awayCrest}
                  displayName={match.awayTeamName ? tTeam(match.awayTeamName) : away ? tTeam(away.id) : liveScore?.awayTeamName}
                  side="away"
                  teamUrl={awayTeamUrl}
                />
              ) : (
                <Placeholder label={match.awayPlaceholder ?? tbd} side="away" />
              )}
            </div>

            {/* Footer: date + venue */}
            {!compact && (
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-yc-text-tertiary text-xs">
                <span>{formatMatchTime(match.date, match.time, lang)}</span>
                {venue && (
                  <span className="flex items-center gap-1 truncate ml-2">
                    <MapPin size={10} className="shrink-0" />
                    {tVenue(venue.id).name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
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
