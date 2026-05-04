import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { useCompetitionSchedule } from "../../hooks/useCompetitionSchedule";
import { useTeamMap } from "../../hooks/useTeams";
import type { PoolMember } from "../../hooks/usePools";
import type { Match } from "../../types";
import { Trophy, Frown, Loader2 } from "lucide-react";
import ConfidenceBadge from "../predictions/ConfidenceBadge";
import TeamCrest from "../match/TeamCrest";

interface ScoredPrediction {
  user_id: string;
  match_id: number;
  home_score: number | null;
  away_score: number | null;
  quick_pick: "H" | "D" | "A" | null;
  confidence: 1 | 2 | 3 | null;
  is_joker: boolean;
  points: number;
  scored_at: string;
}

interface WallEntry {
  prediction: ScoredPrediction;
  member: PoolMember;
  match: Match | undefined;
}

/**
 * Weekly Wall of Fame / Shame for a pool. Best pick (highest points, with
 * confidence-3 as the tiebreaker) and worst pick (most-confident wrong pick
 * — "🔥 Sure Thing on Spain, lost 0-2"). Pulls from the last 7 days of
 * scored predictions in the pool's competition.
 */
export default function WallOfFame({
  competitionId,
  members,
}: {
  competitionId: string;
  members: PoolMember[];
}) {
  const { t } = useI18n();
  const { matches } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const [best, setBest] = useState<WallEntry | null>(null);
  const [worst, setWorst] = useState<WallEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (members.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const memberIds = members.map((m) => m.user_id);
      const memberMap = new Map(members.map((m) => [m.user_id, m]));
      const matchMap = new Map(matches.map((m) => [m.id, m]));

      const { data } = await supabase
        .from("yc_predictions")
        .select(
          "user_id, match_id, home_score, away_score, quick_pick, confidence, is_joker, points, scored_at",
        )
        .eq("competition_id", competitionId)
        .in("user_id", memberIds)
        .not("scored_at", "is", null)
        .gte("scored_at", sevenDaysAgo);

      if (cancelled) return;
      if (!data || data.length === 0) {
        setLoading(false);
        return;
      }

      const rows = data as ScoredPrediction[];

      // Best: highest points; ties broken by higher confidence (3 = "Sure Thing").
      const bestSorted = [...rows].sort((a, b) => {
        if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      });
      const bestPred = bestSorted[0] ?? null;

      // Worst: prefer 0-pt picks where confidence was high (most-confident wrong
      // = the comedy moment). If none, fall back to the lowest-points row.
      const wrongPicks = rows.filter((p) => (p.points ?? 0) === 0);
      let worstPred: ScoredPrediction | null;
      if (wrongPicks.length > 0) {
        worstPred = [...wrongPicks].sort(
          (a, b) => (b.confidence ?? 0) - (a.confidence ?? 0),
        )[0]!;
      } else {
        worstPred = [...rows].sort((a, b) => (a.points ?? 0) - (b.points ?? 0))[0] ?? null;
      }

      // Don't double-feature the same prediction.
      if (
        bestPred &&
        worstPred &&
        bestPred.match_id === worstPred.match_id &&
        bestPred.user_id === worstPred.user_id
      ) {
        worstPred = null;
      }

      function toEntry(p: ScoredPrediction | null): WallEntry | null {
        if (!p) return null;
        const member = memberMap.get(p.user_id);
        if (!member) return null;
        return { prediction: p, member, match: matchMap.get(p.match_id) };
      }

      setBest(toEntry(bestPred));
      setWorst(toEntry(worstPred));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [members, competitionId, matches]);

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 size={14} className="animate-spin text-yc-text-tertiary" />
      </div>
    );
  }

  if (!best && !worst) return null;

  return (
    <div>
      <p className="text-xs text-yc-text-tertiary uppercase tracking-wider mb-3 font-medium">
        {t("pools.wallTitle")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {best && <WallCard kind="fame" entry={best} teamMap={teamMap} />}
        {worst && <WallCard kind="shame" entry={worst} teamMap={teamMap} />}
      </div>
    </div>
  );
}

function WallCard({
  kind,
  entry,
  teamMap,
}: {
  kind: "fame" | "shame";
  entry: WallEntry;
  teamMap: Map<string, { fifaCode: string; isoCode: string; name: string }>;
}) {
  const { t, tTeam } = useI18n();
  const { prediction: p, member, match } = entry;
  const Icon = kind === "fame" ? Trophy : Frown;
  const tone = kind === "fame"
    ? "border-yc-green-muted/30 bg-yc-green/[0.04]"
    : "border-yc-danger/30 bg-yc-danger/[0.04]";
  const iconTone = kind === "fame" ? "text-yc-warning" : "text-yc-danger";
  const titleKey = kind === "fame" ? "pools.wallFame" : "pools.wallShame";

  const home = match?.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match?.awayTeam ? teamMap.get(match.awayTeam) : undefined;

  const yourScore = p.quick_pick
    ? { H: "1", D: "X", A: "2" }[p.quick_pick]
    : `${p.home_score}-${p.away_score}`;
  const actualScore =
    match?.homeScore != null && match?.awayScore != null
      ? `${match.homeScore}-${match.awayScore}`
      : null;

  return (
    <div className={`yc-card rounded-xl p-4 border ${tone}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className={iconTone} />
        <span className="text-xs uppercase tracking-wider font-semibold text-yc-text-secondary">
          {t(titleKey)}
        </span>
        <span className="ms-auto font-mono text-sm font-bold">
          <span className={kind === "fame" ? "text-yc-green" : "text-yc-text-tertiary"}>
            {p.points}
          </span>
          <span className="text-yc-text-tertiary text-[10px] ms-0.5">
            {t("recap.points").toLowerCase()}
          </span>
        </span>
      </div>

      <p className="text-sm font-semibold text-yc-text-primary mb-2 truncate">
        {member.display_name ?? member.handle}
      </p>

      {match && home && away && (
        <div className="flex items-center gap-2 text-xs text-yc-text-secondary mb-2">
          <TeamCrest tla={home.fifaCode} isoCode={home.isoCode} size="xs" />
          <span className="truncate">{tTeam(home.fifaCode)}</span>
          <span className="text-yc-text-tertiary">vs</span>
          <TeamCrest tla={away.fifaCode} isoCode={away.isoCode} size="xs" />
          <span className="truncate">{tTeam(away.fifaCode)}</span>
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-yc-text-tertiary">{t("recap.bestPick")}:</span>
        <span className="font-mono font-bold text-yc-text-primary">{yourScore}</span>
        <ConfidenceBadge level={p.confidence} size={9} />
        {actualScore && (
          <>
            <span className="text-yc-text-tertiary ms-1">→</span>
            <span className="font-mono text-yc-text-secondary">{actualScore}</span>
          </>
        )}
        {p.is_joker && (
          <span className="ms-auto font-mono text-[9px] font-bold text-yc-warning bg-yc-warning/10 px-1.5 py-0.5 rounded">
            2x
          </span>
        )}
      </div>
    </div>
  );
}
