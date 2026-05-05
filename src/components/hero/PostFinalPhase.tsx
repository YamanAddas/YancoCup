import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Award, ChevronRight, Crown, Trophy } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useSchedule } from "../../hooks/useSchedule";
import { useScores } from "../../hooks/useScores";
import { useTeamMap } from "../../hooks/useTeams";
import {
  computeGroupStandings,
  computeKnockoutResults,
  resolveBracketPlaceholder,
} from "../../lib/bracketResolver";
import TeamCrest from "../match/TeamCrest";
import type { Match } from "../../types";

/** Resolve a knockout match's two teams (real or via placeholder). */
function useResolvedMatch(match: Match | undefined): {
  homeKey: string | null;
  awayKey: string | null;
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
} {
  const allMatches = useSchedule();
  const { scoreMap } = useScores("WC");
  const slots = useMemo(() => {
    if (!match) return { home: undefined, away: undefined };
    if (match.homeTeam && match.awayTeam) {
      return { home: match.homeTeam, away: match.awayTeam };
    }
    const groupStageMatches = allMatches.filter((m) => m.round === "group");
    const groupStandings = computeGroupStandings(groupStageMatches, scoreMap);
    const koResults = computeKnockoutResults(allMatches, scoreMap);
    const home = match.homePlaceholder
      ? resolveBracketPlaceholder(match.homePlaceholder, groupStandings, koResults)
      : null;
    const away = match.awayPlaceholder
      ? resolveBracketPlaceholder(match.awayPlaceholder, groupStandings, koResults)
      : null;
    return { home: home ?? undefined, away: away ?? undefined };
  }, [allMatches, scoreMap, match]);

  if (!match) {
    return { homeKey: null, awayKey: null, homeScore: null, awayScore: null, finished: false };
  }

  const live = scoreMap.get(match.id);
  return {
    homeKey: match.homeTeam ?? slots.home ?? null,
    awayKey: match.awayTeam ?? slots.away ?? null,
    homeScore: live?.homeScore ?? match.homeScore ?? null,
    awayScore: live?.awayScore ?? match.awayScore ?? null,
    finished: (live?.status ?? match.status) === "FINISHED",
  };
}

function ChampionRow({
  champKey,
  runnerUpKey,
  homeScore,
  awayScore,
  finished,
}: {
  champKey: string | null;
  runnerUpKey: string | null;
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
}) {
  const { t, tTeam } = useI18n();
  const teamMap = useTeamMap();
  const champ = champKey ? teamMap.get(champKey) : undefined;
  const runner = runnerUpKey ? teamMap.get(runnerUpKey) : undefined;

  return (
    <div className="yc-card yc-animated-border rounded-2xl p-6 sm:p-8 text-center">
      <div className="flex items-center justify-center gap-2 mb-3 text-yc-warning">
        <Crown size={20} />
        <span className="text-[10px] uppercase tracking-widest font-semibold">
          {t("home.postFinal.champion")}
        </span>
        <Crown size={20} />
      </div>
      <div className="flex items-center justify-center mb-4">
        {champ ? (
          <TeamCrest
            tla={champ.fifaCode}
            isoCode={champ.isoCode}
            size="xl"
            className="drop-shadow-[0_0_20px_rgba(0,255,136,0.4)]"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-yc-bg-elevated border border-yc-border flex items-center justify-center">
            <Trophy size={24} className="text-yc-text-tertiary" />
          </div>
        )}
      </div>
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-yc-text-primary mb-1">
        {champ ? tTeam(champ.id) : t("home.postFinal.tbd")}
      </h1>
      {finished && homeScore !== null && awayScore !== null && runner && (
        <p className="text-xs text-yc-text-secondary">
          {t("home.postFinal.beat", {
            opponent: tTeam(runner.id),
            score: `${homeScore}-${awayScore}`,
          })}
        </p>
      )}
    </div>
  );
}

export default function PostFinalPhase() {
  const { t, tTeam } = useI18n();
  const allMatches = useSchedule();
  const teamMap = useTeamMap();

  const finalMatch = useMemo(
    () => allMatches.find((m) => m.round === "final"),
    [allMatches],
  );
  const thirdMatch = useMemo(
    () => allMatches.find((m) => m.round === "third-place"),
    [allMatches],
  );

  const finalResolved = useResolvedMatch(finalMatch);
  const thirdResolved = useResolvedMatch(thirdMatch);

  // Champion = winning side of the final
  const finalWinner =
    finalResolved.finished &&
    finalResolved.homeScore !== null &&
    finalResolved.awayScore !== null
      ? finalResolved.homeScore > finalResolved.awayScore
        ? finalResolved.homeKey
        : finalResolved.awayKey
      : null;
  const finalRunner =
    finalWinner === finalResolved.homeKey
      ? finalResolved.awayKey
      : finalResolved.homeKey;
  const finalWinnerScore =
    finalWinner === finalResolved.homeKey
      ? finalResolved.homeScore
      : finalResolved.awayScore;
  const finalLoserScore =
    finalWinner === finalResolved.homeKey
      ? finalResolved.awayScore
      : finalResolved.homeScore;

  const thirdWinner =
    thirdResolved.finished &&
    thirdResolved.homeScore !== null &&
    thirdResolved.awayScore !== null
      ? thirdResolved.homeScore > thirdResolved.awayScore
        ? thirdResolved.homeKey
        : thirdResolved.awayKey
      : null;
  const thirdTeam = thirdWinner ? teamMap.get(thirdWinner) : undefined;
  const finalRunnerTeam = finalRunner ? teamMap.get(finalRunner) : undefined;

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 pb-12 space-y-6">
      <ChampionRow
        champKey={finalWinner ?? finalResolved.homeKey ?? finalResolved.awayKey}
        runnerUpKey={finalRunner}
        homeScore={finalWinnerScore}
        awayScore={finalLoserScore}
        finished={finalResolved.finished}
      />

      {/* Runner-up + third place — only show when known */}
      {(finalRunnerTeam || thirdTeam) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {finalRunnerTeam && (
            <div className="yc-card rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yc-text-tertiary/10 flex items-center justify-center shrink-0">
                <Award size={18} className="text-yc-text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-yc-text-tertiary mb-0.5">
                  {t("home.postFinal.runnerUp")}
                </p>
                <p className="text-sm font-semibold text-yc-text-primary truncate">
                  {tTeam(finalRunnerTeam.id)}
                </p>
              </div>
              <TeamCrest
                tla={finalRunnerTeam.fifaCode}
                isoCode={finalRunnerTeam.isoCode}
                size="md"
              />
            </div>
          )}

          {thirdTeam && (
            <div className="yc-card rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yc-warning/10 flex items-center justify-center shrink-0">
                <Trophy size={18} className="text-yc-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-yc-text-tertiary mb-0.5">
                  {t("home.postFinal.thirdPlace")}
                </p>
                <p className="text-sm font-semibold text-yc-text-primary truncate">
                  {tTeam(thirdTeam.id)}
                </p>
              </div>
              <TeamCrest
                tla={thirdTeam.fifaCode}
                isoCode={thirdTeam.isoCode}
                size="md"
              />
            </div>
          )}
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Link
          to="/leaderboard"
          className="yc-animated-border inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]"
        >
          <Trophy size={18} />
          {t("home.postFinal.finalLeaderboard")}
        </Link>
        <Link
          to="/WC/bracket"
          className="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg border border-yc-border text-yc-text-primary text-sm font-medium hover:border-yc-green-muted hover:text-yc-green transition-colors"
        >
          {t("home.knockouts.fullBracket")}
          <ChevronRight size={14} />
        </Link>
      </div>

      {!finalResolved.finished && (
        <p className="text-center text-xs text-yc-text-tertiary mt-4">
          {t("home.postFinal.placeholderNote")}
        </p>
      )}
    </section>
  );
}
