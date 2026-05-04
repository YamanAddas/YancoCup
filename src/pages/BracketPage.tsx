import { useMemo, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { GitBranch, Search } from "lucide-react";
import { useCompetition } from "../lib/CompetitionProvider";
import { useCompetitionSchedule } from "../hooks/useCompetitionSchedule";
import { useTeamMap } from "../hooks/useTeams";
import { useScores } from "../hooks/useScores";
import { useMyPredictions, type Prediction } from "../hooks/usePredictions";
import TeamCrest from "../components/match/TeamCrest";
import { useI18n } from "../lib/i18n";
import {
  computeGroupStandings,
  computeKnockoutResults,
  resolveBracketPlaceholder,
} from "../lib/bracketResolver";
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
  /** TLA resolved from group standings or prior knockout result, when m.homeTeam is null. */
  resolvedHomeTla?: string;
  resolvedAwayTla?: string;
}

type RoundId = "playoff" | "round-of-32" | "round-of-16" | "quarterfinal" | "semifinal" | "final";

const ROUND_LABEL_KEYS: Record<RoundId, string> = {
  playoff: "bracket.playoffs",
  "round-of-32": "bracket.roundOf32",
  "round-of-16": "bracket.roundOf16",
  quarterfinal: "bracket.quarterfinals",
  semifinal: "bracket.semifinals",
  final: "bracket.final",
};

// ---------------------------------------------------------------------------
// Bracket match node — hex-styled
// ---------------------------------------------------------------------------

function BracketNode({
  bm,
  teamMap,
  competitionId,
  liveScore,
  prediction,
  highlighted,
}: {
  bm: BracketMatch;
  teamMap: Map<string, Team>;
  competitionId: string;
  liveScore?: { status: string; homeScore: number | null; awayScore: number | null };
  prediction?: Prediction;
  highlighted?: boolean;
}) {
  const { t, tTeam } = useI18n();
  const m = bm.match;
  const effectiveStatus = liveScore?.status ?? m.status;
  const isLive = effectiveStatus === "IN_PLAY" || effectiveStatus === "PAUSED";
  const isFinished = effectiveStatus === "FINISHED";
  const homeScore = liveScore?.homeScore ?? m.homeScore;
  const awayScore = liveScore?.awayScore ?? m.awayScore;
  const hasScore = homeScore !== null && awayScore !== null;

  // Prefer the live homeTeam from the schedule (set once football-data.org confirms).
  // If absent, use the placeholder we resolved from standings / prior KO results.
  const homeKey = m.homeTeam ?? bm.resolvedHomeTla ?? null;
  const awayKey = m.awayTeam ?? bm.resolvedAwayTla ?? null;
  const homeTeam = homeKey ? teamMap.get(homeKey) : undefined;
  const awayTeam = awayKey ? teamMap.get(awayKey) : undefined;
  const homeName = homeKey ? tTeam(homeKey) : (m.homeTeamName ?? bm.homeLabel);
  const awayName = awayKey ? tTeam(awayKey) : (m.awayTeamName ?? bm.awayLabel);
  const homeCrest = m.homeCrest ?? bm.homeCrest;
  const awayCrest = m.awayCrest ?? bm.awayCrest;
  const homeTla = homeKey?.toUpperCase() ?? "TBD";
  const awayTla = awayKey?.toUpperCase() ?? "TBD";
  const homeWin = hasScore && (homeScore ?? 0) > (awayScore ?? 0);
  const awayWin = hasScore && (awayScore ?? 0) > (homeScore ?? 0);

  return (
    <Link
      to={`/${competitionId}/match/${m.id}`}
      className={`hex-sm-wrap block relative ${isLive ? "is-live" : ""} ${highlighted ? "ring-2 ring-yc-green/50 rounded-lg" : ""}`}
    >
      <div className="hex-sm-border" />
      <div className="yc-hex-card hex-sm overflow-hidden w-full">
        <div className="hex-sm-glass" />
        {/* Home row */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 relative z-2 ${homeWin && isFinished ? "bg-yc-green/[0.06]" : ""}`}>
          <TeamCrest tla={homeTla} isoCode={homeTeam?.isoCode} crest={homeCrest} size="xs" />
          <span className={`text-xs flex-1 truncate ${homeKey ? "text-yc-text-primary" : "text-yc-text-tertiary"} ${homeWin && isFinished ? "font-semibold" : ""}`}>
            {homeName}
          </span>
          {hasScore && (
            <span className={`text-xs font-mono font-bold min-w-[14px] text-end ${
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
          <span className={`text-xs flex-1 truncate ${awayKey ? "text-yc-text-primary" : "text-yc-text-tertiary"} ${awayWin && isFinished ? "font-semibold" : ""}`}>
            {awayName}
          </span>
          {hasScore && (
            <span className={`text-xs font-mono font-bold min-w-[14px] text-end ${
              isLive ? "text-yc-green" : awayWin ? "text-yc-green" : "text-yc-text-secondary"
            }`}>
              {awayScore}
            </span>
          )}
        </div>
        {/* User prediction overlay */}
        {prediction && prediction.home_score !== null && prediction.away_score !== null && (
          <div className="relative z-2 flex items-center justify-center gap-1 py-0.5 bg-yc-green/[0.06] border-t border-yc-green/10">
            <span className="text-[9px] text-yc-text-tertiary">{t("bracket.you")}</span>
            <span className="text-[10px] font-mono font-bold text-yc-green">
              {prediction.home_score}-{prediction.away_score}
            </span>
            {prediction.points !== null && prediction.points !== undefined && (
              <span className={`text-[9px] font-mono font-bold ${
                prediction.points >= 10 ? "text-yc-green" :
                prediction.points > 0 ? "text-yc-warning" :
                "text-yc-text-tertiary"
              }`}>
                +{prediction.points}
              </span>
            )}
          </div>
        )}
        {prediction && prediction.quick_pick && prediction.home_score === null && (
          <div className="relative z-2 flex items-center justify-center gap-1 py-0.5 bg-yc-green/[0.06] border-t border-yc-green/10">
            <span className="text-[9px] text-yc-text-tertiary">{t("bracket.you")}</span>
            <span className="text-[10px] font-mono font-bold text-yc-green">
              {prediction.quick_pick === "H" ? t("quickPick.home") : prediction.quick_pick === "A" ? t("quickPick.away") : t("quickPick.draw")}
            </span>
          </div>
        )}
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
  predMap,
  highlightTeam,
}: {
  roundId: RoundId;
  matches: BracketMatch[];
  teamMap: Map<string, Team>;
  competitionId: string;
  scoreMap: Map<number, { status: string; homeScore: number | null; awayScore: number | null }>;
  predMap: Map<number, Prediction>;
  highlightTeam: string | null;
}) {
  const { t } = useI18n();
  const pairs = groupIntoPairs(matches);

  return (
    <div className="flex flex-col shrink-0" style={{ minWidth: 165 }}>
      {/* Round header */}
      <h4 className="text-[10px] text-yc-text-tertiary uppercase tracking-wider text-center mb-3 font-medium flex items-center justify-center gap-1.5">
        <span className="w-4 h-px bg-yc-green/20" />
        {t(ROUND_LABEL_KEYS[roundId])}
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
                prediction={predMap.get(bm.match.id)}
                highlighted={!!highlightTeam && (bm.match.homeTeam === highlightTeam || bm.match.awayTeam === highlightTeam)}
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
  const { t, tTeam } = useI18n();
  const { matches } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const { scoreMap } = useScores(comp.id);
  const { predictions } = useMyPredictions(comp.id);

  const predMap = useMemo(
    () => new Map(predictions.map((p) => [p.match_id, p])),
    [predictions],
  );

  const [highlightTeam, setHighlightTeam] = useState<string | null>(null);

  // Collect all teams that appear in knockout matches
  const bracketTeams = useMemo(() => {
    const tlas = new Set<string>();
    for (const m of matches) {
      if (m.round !== "group" && m.homeTeam) tlas.add(m.homeTeam);
      if (m.round !== "group" && m.awayTeam) tlas.add(m.awayTeam);
    }
    return [...tlas].sort();
  }, [matches]);

  const roundOrder: RoundId[] = ["playoff", "round-of-32", "round-of-16", "quarterfinal", "semifinal", "final"];

  const standings = useMemo(
    () => computeGroupStandings(matches, scoreMap),
    [matches, scoreMap],
  );
  const koResults = useMemo(
    () => computeKnockoutResults(matches, scoreMap),
    [matches, scoreMap],
  );

  const bracketRounds = useMemo(() => {
    const rounds: Array<{ id: RoundId; matches: BracketMatch[] }> = [];

    for (const roundId of roundOrder) {
      const roundMatches = matches
        .filter((m) => m.round === roundId)
        .sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date);
          return dateCompare !== 0 ? dateCompare : a.id - b.id;
        })
        .map((m): BracketMatch => {
          const resolvedHomeTla =
            m.homeTeam == null
              ? (resolveBracketPlaceholder(m.homePlaceholder, standings, koResults) ?? undefined)
              : undefined;
          const resolvedAwayTla =
            m.awayTeam == null
              ? (resolveBracketPlaceholder(m.awayPlaceholder, standings, koResults) ?? undefined)
              : undefined;
          return {
            match: m,
            homeLabel: m.homePlaceholder ?? m.homeTeamName ?? m.homeTeam?.toUpperCase() ?? "TBD",
            awayLabel: m.awayPlaceholder ?? m.awayTeamName ?? m.awayTeam?.toUpperCase() ?? "TBD",
            homeCrest: m.homeCrest,
            awayCrest: m.awayCrest,
            resolvedHomeTla,
            resolvedAwayTla,
          };
        });

      if (roundMatches.length > 0) {
        rounds.push({ id: roundId, matches: roundMatches });
      }
    }

    return rounds;
  }, [matches, standings, koResults]);

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
            {t("bracket.noMatches")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Path to the final selector */}
      {bracketTeams.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Search size={14} className="text-yc-text-tertiary" />
          <select
            value={highlightTeam ?? ""}
            onChange={(e) => setHighlightTeam(e.target.value || null)}
            className="bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-1.5 text-xs text-yc-text-secondary"
          >
            <option value="">{t("bracket.pathToFinal")}</option>
            {bracketTeams.map((tla) => (
                <option key={tla} value={tla}>
                  {tTeam(tla)}
                </option>
            ))}
          </select>
          {highlightTeam && (
            <button
              onClick={() => setHighlightTeam(null)}
              className="text-xs text-yc-text-tertiary hover:text-yc-text-primary"
            >
              {t("bracket.clear")}
            </button>
          )}
        </div>
      )}

      {/* Bracket tree — horizontally scrollable */}
      <div className="yc-card p-4 sm:p-5 overflow-x-auto overflow-y-hidden">
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
                  predMap={predMap}
                  highlightTeam={highlightTeam}
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
            {t("bracket.thirdPlace")}
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
