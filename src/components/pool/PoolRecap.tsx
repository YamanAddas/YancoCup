import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { getLocale } from "../../lib/formatDate";
import type { PoolMember } from "../../hooks/usePools";
import { Trophy, Share2, Loader2 } from "lucide-react";

interface MemberRecap {
  userId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  points: number;
  predicted: number;
  exact: number;
}

export default function PoolRecap({
  poolId,
  competitionId,
  members,
}: {
  poolId: string;
  competitionId: string;
  members: PoolMember[];
}) {
  const { t, lang } = useI18n();
  const [recaps, setRecaps] = useState<MemberRecap[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchdayLabel, setMatchdayLabel] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      if (members.length === 0) {
        setLoading(false);
        return;
      }

      const memberIds = members.map((m) => m.user_id);

      // Get the most recent scored predictions for these members in this competition
      const { data: predictions } = await supabase
        .from("yc_predictions")
        .select("user_id, match_id, points, home_score, away_score, scored_at, quick_pick")
        .eq("competition_id", competitionId)
        .in("user_id", memberIds)
        .not("scored_at", "is", null)
        .order("scored_at", { ascending: false });

      if (!predictions || predictions.length === 0) {
        setLoading(false);
        return;
      }

      // Find the most recent matchday by grouping by scored_at date
      const scoredDates = predictions.map((p) => p.scored_at!.slice(0, 10));
      const latestDate = scoredDates.sort().reverse()[0];
      setMatchdayLabel(
        new Date(latestDate + "T12:00:00Z").toLocaleDateString(getLocale(lang), {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }),
      );

      // Filter to that date's predictions
      const dayPredictions = predictions.filter(
        (p) => p.scored_at!.slice(0, 10) === latestDate,
      );

      // Aggregate per member
      const memberMap = new Map(members.map((m) => [m.user_id, m]));
      const statsMap = new Map<string, { points: number; predicted: number; exact: number }>();

      for (const p of dayPredictions) {
        const s = statsMap.get(p.user_id) ?? { points: 0, predicted: 0, exact: 0 };
        s.points += p.points ?? 0;
        s.predicted++;
        if ((p.points ?? 0) === 10) s.exact++;
        statsMap.set(p.user_id, s);
      }

      const result: MemberRecap[] = memberIds
        .map((uid) => {
          const m = memberMap.get(uid);
          const s = statsMap.get(uid) ?? { points: 0, predicted: 0, exact: 0 };
          return {
            userId: uid,
            handle: m?.handle ?? "unknown",
            displayName: m?.display_name ?? null,
            avatarUrl: m?.avatar_url ?? null,
            ...s,
          };
        })
        .filter((r) => r.predicted > 0)
        .sort((a, b) => b.points - a.points);

      setRecaps(result);
      setLoading(false);
    }

    load();
  }, [members, competitionId, poolId]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;

    // Text-based share fallback
    const mvp = recaps[0];
    const lines = recaps.map(
      (r, i) =>
        `${i + 1}. ${r.displayName ?? r.handle}: ${r.points} pts (${r.predicted} ${t("recap.predicted")}${r.exact ? `, ${r.exact} ${t("recap.exact")}` : ""})`,
    );
    const text = [
      `Pool Recap - ${matchdayLabel}`,
      `MVP: ${mvp?.displayName ?? mvp?.handle ?? "—"}`,
      "",
      ...lines,
      "",
      "YancoCup",
    ].join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Pool Recap", text });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }, [recaps, matchdayLabel]);

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 size={14} className="animate-spin text-yc-text-tertiary" />
      </div>
    );
  }

  if (recaps.length === 0) {
    return (
      <p className="text-xs text-yc-text-tertiary text-center py-2">
        {t("recap.noData")}
      </p>
    );
  }

  const mvp = recaps[0]!;

  return (
    <div ref={cardRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-yc-text-tertiary">{matchdayLabel}</p>
          <p className="text-sm font-heading font-bold text-yc-text-primary">
            {t("recap.title")}
          </p>
        </div>
        <button
          onClick={handleShare}
          className="p-1.5 rounded-lg hover:bg-yc-bg-elevated transition-colors text-yc-text-tertiary hover:text-yc-text-secondary"
        >
          <Share2 size={14} />
        </button>
      </div>

      {/* MVP */}
      <div className="flex items-center gap-2 bg-yc-green-dark/20 rounded-lg px-3 py-2 mb-3">
        <Trophy size={14} className="text-yc-warning shrink-0" />
        <span className="text-xs text-yc-text-secondary">{t("recap.mvp")}</span>
        <span className="text-xs font-bold text-yc-green ml-auto">
          {mvp.displayName ?? mvp.handle}
        </span>
        <span className="text-xs font-mono text-yc-green-muted">{mvp.points} pts</span>
      </div>

      {/* Member results */}
      <div className="space-y-1.5">
        {recaps.map((r, i) => (
          <div key={r.userId} className="flex items-center gap-2 text-xs">
            <span className="w-4 text-yc-text-tertiary text-right">{i + 1}.</span>
            {r.avatarUrl ? (
              <img src={r.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-yc-bg-elevated flex items-center justify-center text-[9px] font-bold text-yc-text-secondary">
                {(r.handle).charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-yc-text-primary truncate flex-1">
              {r.displayName ?? r.handle}
            </span>
            {r.exact > 0 && (
              <span className="text-[9px] bg-yc-green-dark/30 text-yc-green px-1.5 py-0.5 rounded">
                {r.exact} {t("recap.exact")}
              </span>
            )}
            <span className="font-mono font-bold text-yc-text-primary">{r.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
