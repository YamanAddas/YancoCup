import { useMemo, Fragment } from "react";
import { Link } from "react-router-dom";
import { GitBranch } from "lucide-react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useCompetitionSchedule } from "../hooks/useCompetitionSchedule";
import { useTeamMap } from "../hooks/useTeams";
import { useScores } from "../hooks/useScores";
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

type RoundId = "playoff" | "round-of-32" | "round-of-16" | "quarterfinal" | "semifinal" | "final";

const ROUND_LABELS: Record<RoundId, string> = {
  playoff: "Play-offs",
  "round-of-32": "Round of 32",
  "round-of-16": "Round of 16",
  quarterfinal: "Quarterfinals",
  semifinal: "Semifinals",
  final: "Final",
};

// ---------------------------------------------------------------------------
// Bracket match node — hex-styled
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
      className={`hex-sm-wrap block relative ${isLive ? "is-live" : ""}`}
    >
      <div className="hex-sm-border" />
      <div className="yc-hex-card hex-sm overflow-hidden w-full">
        <div className="hex-sm-glass" />
        {/* Home row */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 relative z-2 ${homeWin && isFinished ? "bg-yc-green/[0.06]" : ""}`}>
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
        <div className="h-px bg-white/[0.06] relative z-2" />
        {/* Away row */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 relative z-2 ${awayWin && isFinished ? "bg-yc-green/[0.06]" : ""}`}>
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
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Group matches into pairs
// ---------------------------------------------------------------------------

function groupIntoPairs<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Connector column between two rounds
// Draws bracket lines: ─┐ and ─┘ for each pair, connecting to next round
// ---------------------------------------------------------------------------

function ConnectorColumn({ pairCount }: { pairCount: number }) {
  return (
    <div className="flex flex-col w-6 shrink-0">
      {Array.from({ length: pairCount }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col">
          {/* Top half: right border + top border = ─┐ */}
          <div className="flex-1 border-r-2 border-t-2 rounded-tr-md" style={{ borderColor: "var(--bracket-line)" }} />
          {/* Bottom half: right border + bottom border = ─┘ */}
          <div className="flex-1 border-r-2 border-b-2 rounded-br-md" style={{ borderColor: "var(--bracket-line)" }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry line column (horizontal lines from connector to next-round matches)
// ---------------------------------------------------------------------------

function EntryColumn({ matchCount }: { matchCount: number }) {
  return (
    <div className="flex flex-col justify-around w-4 shrink-0">
      {Array.from({ length: matchCount }).map((_, i) => (
        <div key={i} className="flex-1 flex items-center">
          <div className="w-full h-0.5" style={{ background: "var(--bracket-line)" }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Round column — matches grouped into pairs with flex:1
// ---------------------------------------------------------------------------

function RoundColumn({
  roundId,
  matches,
  teamMap,
  competitionId,
  scoreMap,
}: {
  roundId: RoundId;
  matches: BracketMatch[];
  teamMap: Map<string, Team>;
  competitionId: string;
  scoreMap: Map<number, { status: string; homeScore: number | null; awayScore: number | null }>;
}) {
  const pairs = groupIntoPairs(matches);

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: 165 }}>
      {/* Round header */}
      <h4 className="text-[10px] text-yc-text-tertiary uppercase tracking-wider text-center mb-3 font-medium flex items-center justify-center gap-1.5">
        <span className="w-4 h-px bg-yc-green/20" />
        {ROUND_LABELS[roundId]}
        <span className="w-4 h-px bg-yc-green/20" />
      </h4>

      {/* Matches in pairs, each pair takes equal vertical space */}
      <div className="flex flex-col flex-1">
        {pairs.map((pair, pi) => (
          <div key={pi} className="flex-1 flex flex-col justify-center gap-1.5">
            {pair.map((bm) => (
              <BracketNode
                key={bm.match.id}
                bm={bm}
                teamMap={teamMap}
                competitionId={competitionId}
                liveScore={scoreMap.get(bm.match.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main bracket page
// ---------------------------------------------------------------------------

export default function BracketPage() {
  const comp = useCompetition();
  const { matches } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const { scoreMap } = useScores();

  const roundOrder: RoundId[] = ["playoff", "round-of-32", "round-of-16", "quarterfinal", "semifinal", "final"];

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

  // Calculate min height based on first round match count
  const firstRoundCount = bracketRounds[0]?.matches.length ?? 0;
  const minHeight = Math.max(400, firstRoundCount * 56);

  if (bracketRounds.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
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
      {/* Bracket tree — horizontally scrollable */}
      <div className="yc-card p-6 overflow-x-auto overflow-y-hidden">
        <div className="flex items-stretch min-w-max" style={{ minHeight }}>
          {bracketRounds.map((round, i) => {
            const isFirst = i === 0;
            const isLast = i === bracketRounds.length - 1;
            const pairCount = Math.ceil(round.matches.length / 2);

            return (
              <Fragment key={round.id}>
                {/* Entry lines from previous connector */}
                {!isFirst && (
                  <EntryColumn matchCount={round.matches.length} />
                )}

                {/* Round column */}
                <RoundColumn
                  roundId={round.id}
                  matches={round.matches}
                  teamMap={teamMap}
                  competitionId={comp.id}
                  scoreMap={scoreMap}
                />

                {/* Connector lines to next round */}
                {!isLast && (
                  <ConnectorColumn pairCount={pairCount} />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Third place match */}
      {thirdPlace && (
        <div className="mt-6">
          <h4 className="text-[10px] text-yc-text-tertiary uppercase tracking-wider mb-2 font-medium flex items-center gap-1.5">
            <span className="w-4 h-px bg-yc-green/20" />
            Third Place
            <span className="w-4 h-px bg-yc-green/20" />
          </h4>
          <div className="max-w-[200px]">
            <div className="hex-sm-wrap relative">
              <div className="hex-sm-border" />
              <div className="yc-hex-card hex-sm overflow-hidden">
                <div className="hex-sm-glass" />
                <div className="flex items-center gap-1.5 px-3 py-1.5 relative z-2">
                  <TeamCrest tla={thirdPlace.homeTeam?.toUpperCase() ?? "TBD"} isoCode={teamMap.get(thirdPlace.homeTeam ?? "")?.isoCode} crest={thirdPlace.homeCrest} size="xs" />
                  <span className="text-xs flex-1 truncate text-yc-text-primary">{thirdPlace.homeTeamName ?? thirdPlace.homePlaceholder ?? "TBD"}</span>
                </div>
                <div className="h-px bg-white/[0.06] relative z-2" />
                <div className="flex items-center gap-1.5 px-3 py-1.5 relative z-2">
                  <TeamCrest tla={thirdPlace.awayTeam?.toUpperCase() ?? "TBD"} isoCode={teamMap.get(thirdPlace.awayTeam ?? "")?.isoCode} crest={thirdPlace.awayCrest} size="xs" />
                  <span className="text-xs flex-1 truncate text-yc-text-primary">{thirdPlace.awayTeamName ?? thirdPlace.awayPlaceholder ?? "TBD"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
