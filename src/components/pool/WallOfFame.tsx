import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { useCompetitionSchedule } from "../../hooks/useCompetitionSchedule";
import { useTeamMap } from "../../hooks/useTeams";
import type { PoolMember } from "../../hooks/usePools";
import type { Match, Team } from "../../types";
import { Trophy, Frown, Loader2, Share2, Check, Flame } from "lucide-react";
import ConfidenceBadge from "../predictions/ConfidenceBadge";
import TeamCrest from "../match/TeamCrest";
import {
  shareWallOfFameCard,
  type WallOfFameCardData,
  type WallOfFameEntry,
} from "../../lib/wallOfFameCard";

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
  poolName,
}: {
  competitionId: string;
  members: PoolMember[];
  poolName?: string;
}) {
  const { t, lang } = useI18n();
  const { matches } = useCompetitionSchedule();
  const teamMap = useTeamMap();
  const [best, setBest] = useState<WallEntry | null>(null);
  const [worst, setWorst] = useState<WallEntry | null>(null);
  /** Most "🔥 Sure Thing AND right" picks this week — confidence-as-currency MVP. */
  const [mvp, setMvp] = useState<{ member: PoolMember; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

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

      // MVP — confidence-as-currency:
      // count picks where the user said 🔥 Sure Thing (confidence === 3) AND
      // the pick scored ≥ 3 pts (correct result or better). Leader takes it.
      const confidentRightCounts = new Map<string, number>();
      for (const p of rows) {
        if (p.confidence === 3 && (p.points ?? 0) >= 3) {
          confidentRightCounts.set(p.user_id, (confidentRightCounts.get(p.user_id) ?? 0) + 1);
        }
      }
      let mvpEntry: { member: PoolMember; count: number } | null = null;
      for (const [userId, count] of confidentRightCounts) {
        const member = memberMap.get(userId);
        if (!member) continue;
        if (!mvpEntry || count > mvpEntry.count) {
          mvpEntry = { member, count };
        }
      }

      function toEntry(p: ScoredPrediction | null): WallEntry | null {
        if (!p) return null;
        const member = memberMap.get(p.user_id);
        if (!member) return null;
        return { prediction: p, member, match: matchMap.get(p.match_id) };
      }

      setBest(toEntry(bestPred));
      setWorst(toEntry(worstPred));
      setMvp(mvpEntry);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [members, competitionId, matches]);

  async function handleShare() {
    if (!best && !worst) return;
    setSharing(true);
    const data: WallOfFameCardData = {
      poolName: poolName ?? "YancoCup Pool",
      weekLabel: new Date().toLocaleDateString(
        lang === "en" ? "en-US" : lang,
        { month: "short", day: "numeric" },
      ),
      best: best ? toCardEntry(best, teamMap) : null,
      worst: worst ? toCardEntry(worst, teamMap) : null,
    };
    const result = await shareWallOfFameCard(data, t);
    setSharing(false);
    if (result === "shared") setShareToast(t("shareCard.shared"));
    else if (result === "downloaded") setShareToast(t("shareCard.saved"));
    else setShareToast(t("shareCard.generateFailed"));
    setTimeout(() => setShareToast(null), 2500);
  }

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
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-yc-text-tertiary uppercase tracking-wider font-medium">
          {t("pools.wallTitle")}
        </p>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex items-center gap-1 text-[11px] text-yc-text-tertiary hover:text-yc-green transition-colors disabled:opacity-50 disabled:cursor-wait"
          aria-label={t("shareCard.shareWall")}
        >
          {sharing ? (
            <Loader2 size={11} className="animate-spin" />
          ) : shareToast ? (
            <Check size={11} className="text-yc-green" />
          ) : (
            <Share2 size={11} />
          )}
          {shareToast ?? t("shareCard.shareWall")}
        </button>
      </div>
      {mvp && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-yc-warning/[0.06] border border-yc-warning/20">
          <Flame size={14} className="text-yc-warning shrink-0" />
          <p className="text-xs text-yc-text-secondary flex-1 min-w-0 truncate">
            <span className="text-yc-text-tertiary uppercase tracking-wider me-1.5 text-[10px] font-semibold">
              {t("pools.wallMvp")}
            </span>
            <span className="font-semibold text-yc-text-primary">
              {mvp.member.display_name ?? mvp.member.handle ?? "?"}
            </span>
            <span className="text-yc-text-tertiary ms-1">
              {t("pools.wallMvpDesc", { count: mvp.count })}
            </span>
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {best && <WallCard kind="fame" entry={best} teamMap={teamMap} />}
        {worst && <WallCard kind="shame" entry={worst} teamMap={teamMap} />}
      </div>
    </div>
  );
}

/** Map a WallEntry (DB shape) into the share-card data shape. */
function toCardEntry(
  entry: WallEntry,
  teamMap: Map<string, Team>,
): WallOfFameEntry {
  const { prediction: p, member, match } = entry;
  const home = match?.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match?.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  return {
    handle: member.handle ?? "?",
    displayName: member.display_name ?? null,
    homeTeam: home?.name ?? match?.homeTeam ?? "?",
    homeCode: home?.fifaCode ?? (match?.homeTeam ?? "?").toUpperCase(),
    homeIso: home?.isoCode,
    homeCrest: match?.homeCrest ?? undefined,
    awayTeam: away?.name ?? match?.awayTeam ?? "?",
    awayCode: away?.fifaCode ?? (match?.awayTeam ?? "?").toUpperCase(),
    awayIso: away?.isoCode,
    awayCrest: match?.awayCrest ?? undefined,
    predictedHome: p.home_score,
    predictedAway: p.away_score,
    quickPick: p.quick_pick,
    actualHome: match?.homeScore ?? null,
    actualAway: match?.awayScore ?? null,
    points: p.points,
    confidence: p.confidence,
    isJoker: p.is_joker,
  };
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
