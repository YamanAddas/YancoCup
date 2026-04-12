import { useMemo } from "react";
import { Trophy, Target, TrendingUp, Share2 } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import type { Match } from "../../types";
import type { Prediction } from "../../hooks/usePredictions";

interface MatchdayRecapProps {
  matches: Match[];
  predictions: Map<number, Prediction>;
  matchday: number | undefined;
}

export default function MatchdayRecap({ matches, predictions, matchday }: MatchdayRecapProps) {
  const { t } = useI18n();

  const stats = useMemo(() => {
    let totalPoints = 0;
    let predicted = 0;
    let correct = 0;
    let exactScores = 0;
    let bestMatch: { home: string; away: string; points: number } | null = null;

    for (const m of matches) {
      const pred = predictions.get(m.id);
      if (!pred || pred.scored_at === null) continue;
      predicted++;
      const pts = pred.points ?? 0;
      totalPoints += pts;
      if (pts > 0) correct++;
      if (pts >= 10) exactScores++;
      if (!bestMatch || pts > bestMatch.points) {
        bestMatch = {
          home: m.homeTeamName ?? m.homeTeam ?? "???",
          away: m.awayTeamName ?? m.awayTeam ?? "???",
          points: pts,
        };
      }
    }

    const accuracy = predicted > 0 ? Math.round((correct / predicted) * 100) : 0;

    return { totalPoints, predicted, correct, exactScores, accuracy, bestMatch, total: matches.length };
  }, [matches, predictions]);

  // Don't show if no scored predictions
  if (stats.predicted === 0) return null;

  // Only show if all matches are finished
  const allFinished = matches.every(
    (m) => m.status === "FINISHED" || m.status === "AWARDED" || m.status === "CANCELLED",
  );
  if (!allFinished) return null;

  const handleShare = async () => {
    const mdLabel = matchday ? `${t("common.matchday")} ${matchday}` : "";
    const lines = [
      `${mdLabel} ${t("recap.results")}`,
      `${t("recap.points")}: ${stats.totalPoints}`,
      `${t("recap.accuracy")}: ${stats.accuracy}%`,
      `${t("recap.correct")}: ${stats.correct}/${stats.predicted}`,
      stats.exactScores > 0 ? `${t("recap.exactScores")}: ${stats.exactScores}` : "",
      "",
      "yancocup.com",
    ].filter(Boolean).join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ text: lines });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(lines);
    }
  };

  return (
    <div className="yc-card rounded-xl overflow-hidden border-yc-green/20">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-yc-green/10 to-transparent border-b border-yc-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-yc-text-primary flex items-center gap-2">
            <Trophy size={14} className="text-yc-green" />
            {matchday
              ? t("recap.title", { matchday: String(matchday) })
              : t("recap.titleGeneric")}
          </h3>
          <button
            onClick={handleShare}
            className="p-1.5 rounded-lg text-yc-text-tertiary hover:text-yc-green transition-colors"
            title={t("predictions.share")}
          >
            <Share2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x divide-yc-border/30">
        <div className="px-4 py-4 text-center">
          <div className="text-2xl font-mono font-bold text-yc-green">{stats.totalPoints}</div>
          <div className="text-[11px] text-yc-text-tertiary uppercase tracking-wider mt-1">{t("recap.points")}</div>
        </div>
        <div className="px-4 py-4 text-center">
          <div className="text-2xl font-mono font-bold text-yc-text-primary flex items-center justify-center gap-1">
            {stats.accuracy}
            <span className="text-sm text-yc-text-tertiary">%</span>
          </div>
          <div className="text-[11px] text-yc-text-tertiary uppercase tracking-wider mt-1">{t("recap.accuracy")}</div>
        </div>
        <div className="px-4 py-4 text-center">
          <div className="text-2xl font-mono font-bold text-yc-text-primary">
            {stats.correct}
            <span className="text-sm text-yc-text-tertiary">/{stats.predicted}</span>
          </div>
          <div className="text-[11px] text-yc-text-tertiary uppercase tracking-wider mt-1">{t("recap.correct")}</div>
        </div>
      </div>

      {/* Highlights */}
      <div className="px-4 py-3 border-t border-yc-border/30 flex flex-wrap gap-3 text-xs text-yc-text-secondary">
        {stats.exactScores > 0 && (
          <span className="flex items-center gap-1 text-yc-warning">
            <Target size={12} />
            {t("recap.exactScores")}: {stats.exactScores}
          </span>
        )}
        {stats.bestMatch && stats.bestMatch.points > 0 && (
          <span className="flex items-center gap-1">
            <TrendingUp size={12} className="text-yc-green" />
            {t("recap.bestPick")}: {stats.bestMatch.home} vs {stats.bestMatch.away} (+{stats.bestMatch.points})
          </span>
        )}
      </div>
    </div>
  );
}
