import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useCompetitionSchedule } from "../hooks/useCompetitionSchedule";
import { useTeamMap } from "../hooks/useTeams";
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
// Match node component
// ---------------------------------------------------------------------------

function BracketNode({
  bm,
  teamMap,
  competitionId,
}: {
  bm: BracketMatch;
  teamMap: Map<string, Team>;
  competitionId: string;
}) {
  const m = bm.match;
  const hasScore = m.homeScore !== null && m.awayScore !== null;
  const isFinished = m.status === "FINISHED";

  const homeTeam = m.homeTeam ? teamMap.get(m.homeTeam) : undefined;
  const awayTeam = m.awayTeam ? teamMap.get(m.awayTeam) : undefined;

  const homeName = m.homeTeamName ?? homeTeam?.name ?? bm.homeLabel;
  const awayName = m.awayTeamName ?? awayTeam?.name ?? bm.awayLabel;
  const homeCrest = m.homeCrest ?? bm.homeCrest;
  const awayCrest = m.awayCrest ?? bm.awayCrest;
  const homeTla = m.homeTeam?.toUpperCase() ?? "TBD";
  const awayTla = m.awayTeam?.toUpperCase() ?? "TBD";

  // Determine winner for highlighting
  const homeWin = hasScore && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWin = hasScore && (m.awayScore ?? 0) > (m.homeScore ?? 0);

  return (
    <Link
      to={`/${competitionId}/match/${m.id}`}
      className="block bg-yc-bg-surface border border-yc-border rounded-lg overflow-hidden hover:border-yc-border-hover transition-colors w-full"
    >
      {/* Home team row */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 ${homeWin && isFinished ? "bg-yc-green-dark/10" : ""}`}>
        <TeamCrest tla={homeTla} isoCode={homeTeam?.isoCode} crest={homeCrest} size="xs" />
        <span className={`text-xs flex-1 truncate ${m.homeTeam ? "text-yc-text-primary" : "text-yc-text-tertiary"}`}>
          {homeName}
        </span>
        {hasScore && (
          <span className={`text-xs font-mono font-bold ${homeWin ? "text-yc-green" : "text-yc-text-secondary"}`}>
            {m.homeScore}
          </span>
        )}
      </div>
      {/* Divider */}
      <div className="h-px bg-yc-border" />
      {/* Away team row */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 ${awayWin && isFinished ? "bg-yc-green-dark/10" : ""}`}>
        <TeamCrest tla={awayTla} isoCode={awayTeam?.isoCode} crest={awayCrest} size="xs" />
        <span className={`text-xs flex-1 truncate ${m.awayTeam ? "text-yc-text-primary" : "text-yc-text-tertiary"}`}>
          {awayName}
        </span>
        {hasScore && (
          <span className={`text-xs font-mono font-bold ${awayWin ? "text-yc-green" : "text-yc-text-secondary"}`}>
            {m.awayScore}
          </span>
        )}
      </div>
    </Link>
  );
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
}: {
  roundId: RoundId;
  matches: BracketMatch[];
  teamMap: Map<string, Team>;
  competitionId: string;
  roundIndex: number;
}) {
  // Spacing increases per round to align with the bracket tree structure
  const gap = roundIndex === 0 ? "gap-2" : roundIndex === 1 ? "gap-6" : roundIndex === 2 ? "gap-14" : "gap-24";

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: 160 }}>
      <h4 className="text-[10px] text-yc-text-tertiary uppercase tracking-wider text-center mb-3 font-medium">
        {ROUND_LABELS[roundId]}
      </h4>
      <div className={`flex flex-col ${gap} justify-center flex-1`}>
        {matches.map((bm) => (
          <BracketNode
            key={bm.match.id}
            bm={bm}
            teamMap={teamMap}
            competitionId={competitionId}
          />
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
  const { t } = useI18n();

  // Determine which rounds exist in this competition's knockout
  const roundOrder: RoundId[] = ["round-of-32", "round-of-16", "quarterfinal", "semifinal", "final"];

  const bracketRounds = useMemo(() => {
    const rounds: Array<{ id: RoundId; matches: BracketMatch[] }> = [];

    for (const roundId of roundOrder) {
      const roundMatches = matches
        .filter((m) => m.round === roundId)
        .sort((a, b) => {
          // Sort by date first, then by ID for same-date matches
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

  // Also check for third-place match
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
        <p className="text-yc-text-tertiary text-sm text-center py-16">
          No knockout matches available yet.
        </p>
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

      <h2 className="font-heading text-2xl font-bold mb-6">
        {comp.shortName} — Knockout Bracket
      </h2>

      {/* Horizontally scrollable bracket */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 items-stretch min-w-max">
          {bracketRounds.map((round, i) => (
            <BracketColumn
              key={round.id}
              roundId={round.id}
              matches={round.matches}
              teamMap={teamMap}
              competitionId={comp.id}
              roundIndex={i}
            />
          ))}
        </div>
      </div>

      {/* Third place match */}
      {thirdPlace && (
        <div className="mt-8 max-w-[200px]">
          <h4 className="text-[10px] text-yc-text-tertiary uppercase tracking-wider mb-2 font-medium">
            Third Place
          </h4>
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
          />
        </div>
      )}
    </div>
  );
}
