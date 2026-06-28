import { NavLink } from "react-router-dom";
import { AlertCircle, CheckCircle, Clock, GitBranch } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import TeamCrest from "../match/TeamCrest";
import type { Prediction } from "../../hooks/usePredictions";
import type { Match, Team } from "../../types";
import type { WorldCupResolutionSummary } from "../../lib/worldCupResolution";

interface EndgameCommandStripProps {
  matches: Match[];
  predictionMap: Map<number, Prediction>;
  teamMap: Map<string, Team>;
  summary: WorldCupResolutionSummary;
}

const ROUND_ORDER: Match["round"][] = [
  "round-of-32",
  "round-of-16",
  "quarterfinal",
  "semifinal",
  "third-place",
  "final",
];

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

function kickoffMs(match: Match): number {
  return new Date(`${match.date}T${match.time}:00Z`).getTime();
}

function canStillPredict(match: Match): boolean {
  return Date.now() < kickoffMs(match);
}

function hasBothTeams(match: Match): boolean {
  return Boolean(match.homeTeam && match.awayTeam);
}

function formatDateOnly(match: Match, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${match.date}T${match.time}:00Z`));
}

export default function EndgameCommandStrip({
  matches,
  predictionMap,
  teamMap,
  summary,
}: EndgameCommandStripProps) {
  const { t, tTeam, lang, relTime } = useI18n();

  const futureKnockouts = matches
    .filter((match) => match.round !== "group" && canStillPredict(match))
    .sort((a, b) => kickoffMs(a) - kickoffMs(b));
  const openKnockouts = futureKnockouts.filter(hasBothTeams);
  const unresolvedKnockouts = futureKnockouts.filter((match) => !hasBothTeams(match));
  const unpredicted = openKnockouts.filter((match) => !predictionMap.has(match.id));
  const nextOpen = openKnockouts[0] ?? null;
  const nextAny = nextOpen ?? futureKnockouts[0] ?? null;
  const finalMatch = matches.find((match) => match.round === "final") ?? null;
  const currentRound = nextAny?.round ?? "final";

  const statusText = openKnockouts.length === 0
    ? t("predictions.endgameWaiting")
    : unpredicted.length === 0
      ? t("predictions.endgameAllCaughtUp")
      : t("predictions.endgameNeedsPicks", { count: unpredicted.length });

  const resolverText = summary.standingsSource === "api"
    ? t("predictions.resolverApi")
    : summary.standingsSource === "static"
      ? t("predictions.resolverStatic")
    : summary.standingsSource === "scores"
      ? t("predictions.resolverScores")
      : t("predictions.resolverNone");

  const roundSummaries = ROUND_ORDER.map((round) => {
    const roundMatches = matches.filter((match) => match.round === round);
    const open = roundMatches.filter((match) => canStillPredict(match) && hasBothTeams(match));
    const predicted = open.filter((match) => predictionMap.has(match.id)).length;
    return {
      round,
      total: roundMatches.length,
      open: open.length,
      predicted,
      isCurrent: round === currentRound,
    };
  }).filter((round) => round.total > 0);

  const nextHome = nextOpen?.homeTeam ? teamMap.get(nextOpen.homeTeam) : undefined;
  const nextAway = nextOpen?.awayTeam ? teamMap.get(nextOpen.awayTeam) : undefined;

  return (
    <section className="yc-card p-4 sm:p-5 mb-5 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yc-green animate-pulse" />
            <p className="text-[10px] uppercase tracking-wider text-yc-text-tertiary font-medium">
              {t("predictions.endgameEyebrow")}
            </p>
          </div>
          <h2 className="font-heading text-xl sm:text-2xl font-semibold text-yc-text-primary">
            {t(ROUND_KEYS[currentRound])}
          </h2>
          <p className="text-sm text-yc-text-secondary mt-1">
            {statusText}
          </p>
        </div>

        <NavLink
          to="/WC/bracket"
          className="inline-flex items-center justify-center gap-2 min-h-11 px-3 rounded-lg border border-yc-border text-sm font-medium text-yc-text-secondary hover:text-yc-green hover:border-yc-green-muted transition-colors"
        >
          <GitBranch size={16} />
          {t("predictions.viewBracket")}
        </NavLink>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
        <div className="rounded-lg bg-yc-bg-elevated/50 border border-yc-border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-yc-text-tertiary">{t("predictions.openNowMetric")}</p>
          <p className="font-mono text-lg font-bold text-yc-green">{openKnockouts.length}</p>
        </div>
        <div className="rounded-lg bg-yc-bg-elevated/50 border border-yc-border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-yc-text-tertiary">{t("predictions.needPicksMetric")}</p>
          <p className="font-mono text-lg font-bold text-yc-warning">{unpredicted.length}</p>
        </div>
        <div className="rounded-lg bg-yc-bg-elevated/50 border border-yc-border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-yc-text-tertiary">{t("predictions.tbdMetric")}</p>
          <p className="font-mono text-lg font-bold text-yc-text-secondary">{unresolvedKnockouts.length}</p>
        </div>
        <div className="rounded-lg bg-yc-bg-elevated/50 border border-yc-border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-yc-text-tertiary">{t("predictions.finalMetric")}</p>
          <p className="font-mono text-lg font-bold text-yc-text-primary">
            {finalMatch ? formatDateOnly(finalMatch, lang) : "-"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {nextOpen ? (
            <>
              <Clock size={15} className="text-yc-warning shrink-0" />
              <div className="flex items-center gap-1.5 min-w-0">
                <TeamCrest
                  tla={nextHome?.fifaCode ?? nextOpen.homeTeam?.toUpperCase() ?? "TBD"}
                  isoCode={nextHome?.isoCode}
                  crest={nextOpen.homeCrest}
                  size="xs"
                />
                <span className="text-sm text-yc-text-primary font-medium truncate">
                  {tTeam(nextOpen.homeTeam ?? "")}
                </span>
                <span className="text-yc-text-tertiary text-xs">{t("match.vs")}</span>
                <span className="text-sm text-yc-text-primary font-medium truncate">
                  {tTeam(nextOpen.awayTeam ?? "")}
                </span>
                <TeamCrest
                  tla={nextAway?.fifaCode ?? nextOpen.awayTeam?.toUpperCase() ?? "TBD"}
                  isoCode={nextAway?.isoCode}
                  crest={nextOpen.awayCrest}
                  size="xs"
                />
              </div>
              <span className="text-xs text-yc-text-tertiary shrink-0">
                {t("predictions.nextLock", { time: relTime(new Date(`${nextOpen.date}T${nextOpen.time}:00Z`)) })}
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={15} className="text-yc-text-tertiary shrink-0" />
              <span className="text-sm text-yc-text-secondary">{resolverText}</span>
            </>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {roundSummaries.map((round) => (
            <div
              key={round.round}
              className={`shrink-0 min-w-[92px] rounded-lg border px-2.5 py-2 ${
                round.isCurrent
                  ? "bg-yc-green/10 border-[var(--yc-border-accent-bright)]"
                  : "bg-yc-bg-elevated/30 border-yc-border"
              }`}
            >
              <p className={`text-[10px] font-medium truncate ${
                round.isCurrent ? "text-yc-green" : "text-yc-text-tertiary"
              }`}>
                {t(ROUND_KEYS[round.round])}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {round.open > 0 && round.predicted === round.open ? (
                  <CheckCircle size={11} className="text-yc-green" />
                ) : (
                  <Clock size={11} className="text-yc-text-tertiary" />
                )}
                <span className="font-mono text-[11px] text-yc-text-secondary">
                  {round.predicted}/{round.open}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
