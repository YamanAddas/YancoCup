import { useMemo, Fragment } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, GitBranch } from "lucide-react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useCompetitionSchedule } from "../hooks/useCompetitionSchedule";
import { useTeamMap } from "../hooks/useTeams";
import { useScores } from "../hooks/useScores";
import { useI18n } from "../lib/i18n";
import TeamCrest from "../components/match/TeamCrest";
import type { Match, Team } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BracketMatch {
  match: Match;
  homeLabel: string;
  awayLabel: string;
  homeCrest?: string | null;
  awayCrest?: string | null;
}

type RoundId = "round-of-32" | "round-of-16" | "quarterfinal" | "semifinal" | "final";

const ROUND_LABELS: Record<RoundId, string> = {
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
};

// ---------------------------------------------------------------------------
// Match node — glass-styled
// ---------------------------------------------------------------------------

function BracketNode({
  bm,
  teamMap,
  competitionId,
  liveScore,
}: {
  bm: BracketMatch;
  teamMap: Map<string, Team>;
  competitionId: string;
  liveScore?: { status: string; homeScore: number | null; awayScore: number | null };
}) {
  const m = bm.match;
  const effectiveStatus = liveScore?.status ?? m.status;
  const isLive = effectiveStatus === "IN_PLAY" || effectiveStatus === "PAUSED";
  const isFinished = effectiveStatus === "FINISHED";
  const homeScore = liveScore?.homeScore ?? m.homeScore;
  const awayScore = liveScore?.awayScore ?? m.awayScore;
  const hasScore = homeScore !== null && awayScore !== null;

  const homeTeam = m.homeTeam ? teamMap.get(m.homeTeam) : undefined;
  const awayTeam = m.awayTeam ? teamMap.get(m.awayTeam) : undefined;

  const homeName = m.homeTeamName ?? homeTeam?.name ?? bm.homeLabel;
  const awayName = m.awayTeamName ?? awayTeam?.name ?? bm.awayLabel;
  const homeCrest = m.homeCrest ?? bm.homeCrest;
  const awayCrest = m.awayCrest ?? bm.awayCrest;
  const homeTla = m.homeTeam?.toUpperCase() ?? "TBD";
  const awayTla = m.awayTeam?.toUpperCase() ?? "TBD";

  const homeWin = hasScore && (homeScore ?? 0) > (awayScore ?? 0);
  const awayWin = hasScore && (awayScore ?? 0) > (homeScore ?? 0);

  return (
    <Link
      to={`/${competitionId}/match/${m.id}`}
      className={`block rounded-lg overflow-hidden transition-all duration-300 w-full ${
        isLive
          ? "yc-card-glow animate-breathe"
          : "yc-card"
      }`}
    >
      {/* Home team row */}
      <div className={`flex items-center gap-1.5 px-2.5 py-2 ${homeWin && isFinished ? "bg-yc-green/5" : ""}`}>
        <TeamCrest tla={homeTla} isoCode={homeTeam?.isoCode} crest={homeCrest} size="xs" />
        <span className={`text-xs flex-1 truncate ${m.homeTeam ? "text-yc-text-primary" : "text-yc-text-tertiary"} ${homeWin && isFinished ? "font-semibold" : ""}`}>
          {homeName}
        </span>
        {hasScore && (
          <span className={`text-xs font-mono font-bold min-w-[14px] text-right ${
            isLive ? "text-yc-green" : homeWin ? "text-yc-green" : "text-yc-text-secondary"
          }`}>
            {homeScore}
          </span>
        )}
      </div>
      {/* Divider */}
      <div className="h-px bg-yc-border" />
      {/* Away team row */}
      <div className={`flex items-center gap-1.5 px-2.5 py-2 ${awayWin && isFinished ? "bg-yc-green/5" : ""}`}>
        <TeamCrest tla={awayTla} isoCode={awayTeam?.isoCode} crest={awayCrest} size="xs" />
        <span className={`text-xs flex-1 truncate ${m.awayTeam ? "text-yc-text-primary" : "text-yc-text-tertiary"} ${awayWin && isFinished ? "font-semibold" : ""}`}>
          {awayName}
        </span>
        {hasScore && (
          <span className={`text-xs font-mono font-bold min-w-[14px] text-right ${
            isLive ? "text-yc-green" : awayWin ? "text-yc-green" : "text-yc-text-secondary"
          }`}>
            {awayScore}
          </span>
        )}
      </div>
      {/* Live indicator */}
      {isLive && (
        <div className="h-0.5 bg-gradient-to-r from-transparent via-yc-green to-transparent" />
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Bracket connector lines between rounds
// ---------------------------------------------------------------------------

function BracketConnectors({ matchCount }: { matchCount: number }) {
  const pairs = Math.ceil(matchCount / 2);
  return (
    <div className="flex flex-col justify-around w-8 shrink-0">
      {Array.from({ length: pairs }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col">
          <div className="flex-1 bracket-connector-top" />
          <div className="flex-1 bracket-connector-bottom" />
        </div>
      ))}
    </div>
  );
}

// Entry connector (horizontal line into each match in rounds 2+)
function EntryConnector() {
  return <div className="w-4 shrink-0 bracket-connector-entry self-center" />;
}

// ---------------------------------------------------------------------------
// Bracket column
// ---------------------------------------------------------------------------

function BracketColumn({
  roundId,
  matches,
  teamMap,
  competitionId,
  roundIndex,
  scoreMap,
}: {
  roundId: RoundId;
  matches: BracketMatch[];
  teamMap: Map<string, Team>;
  competitionId: string;
  roundIndex: number;
  scoreMap: Map<number, { status: string; homeScore: number | null; awayScore: number | null }>;
}) {
  // Gap increases per round to align with bracket tree
  const gapPx = roundIndex === 0 ? 8 : roundIndex === 1 ? 24 : roundIndex === 2 ? 56 : roundIndex === 3 ? 120 : 180;

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: 170 }}>
      <h4 className="text-[10px] text-yc-text-tertiary uppercase tracking-wider text-center mb-4 font-medium flex items-center justify-center gap-1.5">
        <span className="w-3 h-px bg-yc-text-tertiary/30" />
        {ROUND_LABELS[roundId]}
        <span className="w-3 h-px bg-yc-text-tertiary/30" />
      </h4>
      <div className="flex flex-col justify-center flex-1" style={{ gap: gapPx }}>
        {matches.map((bm) => (
          <div key={bm.match.id} className="flex items-center">
            {roundIndex > 0 && <EntryConnector />}
            <div className="flex-1">
              <BracketNode
                bm={bm}
                teamMap={teamMap}
                competitionId={competitionId}
                liveScore={scoreMap.get(bm.match.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BracketPage() {
  const comp = useCompetition();
  const { matches } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const { scoreMap } = useScores();
  const { t } = useI18n();

  const roundOrder: RoundId[] = ["round-of-32", "round-of-16", "quarterfinal", "semifinal", "final"];

  const bracketRounds = useMemo(() => {
    const rounds: Array<{ id: RoundId; matches: BracketMatch[] }> = [];

    for (const roundId of roundOrder) {
      const roundMatches = matches
        .filter((m) => m.round === roundId)
        .sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date);
          return dateCompare !== 0 ? dateCompare : a.id - b.id;
        })
        .map((m): BracketMatch => ({
          match: m,
          homeLabel: m.homePlaceholder ?? m.homeTeamName ?? m.homeTeam?.toUpperCase() ?? "TBD",
          awayLabel: m.awayPlaceholder ?? m.awayTeamName ?? m.awayTeam?.toUpperCase() ?? "TBD",
          homeCrest: m.homeCrest,
          awayCrest: m.awayCrest,
        }));

      if (roundMatches.length > 0) {
        rounds.push({ id: roundId, matches: roundMatches });
      }
    }

    return rounds;
  }, [matches]);

  const thirdPlace = matches.find((m) => m.round === "third-place");

  if (bracketRounds.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Link
          to={`/${comp.id}/matches`}
          className="flex items-center gap-1.5 text-yc-text-tertiary hover:text-yc-text-primary text-sm mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          {comp.shortName} — {t("nav.matches")}
        </Link>
        <div className="yc-card p-12 text-center">
          <GitBranch size={48} className="text-yc-text-tertiary mx-auto mb-4 opacity-40" />
          <p className="text-yc-text-tertiary text-sm">
            No knockout matches available yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Link
        to={`/${comp.id}/matches`}
        className="flex items-center gap-1.5 text-yc-text-tertiary hover:text-yc-text-primary text-sm mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        {comp.shortName} — {t("nav.matches")}
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-yc-green/10 flex items-center justify-center">
          <GitBranch size={20} className="text-yc-green" />
        </div>
        <h2 className="font-heading text-2xl font-bold">
          Knockout Bracket
        </h2>
      </div>

      {/* Horizontally scrollable bracket with connector lines */}
      <div className="yc-card p-6 overflow-x-auto">
        <div className="flex items-stretch min-w-max">
          {bracketRounds.map((round, i) => (
            <Fragment key={round.id}>
              <BracketColumn
                roundId={round.id}
                matches={round.matches}
                teamMap={teamMap}
                competitionId={comp.id}
                roundIndex={i}
                scoreMap={scoreMap}
              />
              {/* Connector lines between rounds */}
              {i < bracketRounds.length - 1 && (
                <BracketConnectors matchCount={round.matches.length} />
              )}
            </Fragment>
          ))}
        </div>
      </div>

      {/* Third place match */}
      {thirdPlace && (
        <div className="mt-6">
          <h4 className="text-[10px] text-yc-text-tertiary uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
            <span className="w-3 h-px bg-yc-text-tertiary/30" />
            Third Place
            <span className="w-3 h-px bg-yc-text-tertiary/30" />
          </h4>
          <div className="max-w-[200px]">
            <BracketNode
              bm={{
                match: thirdPlace,
                homeLabel: thirdPlace.homePlaceholder ?? thirdPlace.homeTeamName ?? "TBD",
                awayLabel: thirdPlace.awayPlaceholder ?? thirdPlace.awayTeamName ?? "TBD",
                homeCrest: thirdPlace.homeCrest,
                awayCrest: thirdPlace.awayCrest,
              }}
              teamMap={teamMap}
              competitionId={comp.id}
              liveScore={scoreMap.get(thirdPlace.id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
