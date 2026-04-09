import { useState, useEffect } from "react";
import { Lock, Check, Loader2, Users as UsersIcon, Share2, Sparkles } from "lucide-react";
import { upsertPrediction, canPredict } from "../../hooks/usePredictions";
import { useConsensus } from "../../hooks/useConsensus";
import { buildShareText, sharePrediction } from "../../lib/share";
import { sharePredictionCard } from "../../lib/shareCard";
import { useI18n } from "../../lib/i18n";
import TeamCrest from "../match/TeamCrest";
import type { Match, Team, Venue } from "../../types";
import type { Prediction } from "../../hooks/usePredictions";

interface PredictionCardProps {
  match: Match;
  teamMap: Map<string, Team>;
  venueMap: Map<string, Venue>;
  prediction: Prediction | undefined;
  predictionCount: number;
  userId: string;
  competitionId?: string;
  onSaved: () => void;
}

export default function PredictionCard({
  match,
  teamMap,
  venueMap,
  prediction,
  predictionCount,
  userId,
  competitionId = "WC",
  onSaved,
}: PredictionCardProps) {
  const { t } = useI18n();
  const home = match.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  const venue = venueMap.get(match.venueId);
  const locked = !canPredict(match.date, match.time);

  const [homeScore, setHomeScore] = useState<string>("");
  const [awayScore, setAwayScore] = useState<string>("");
  const [isJoker, setIsJoker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prediction) {
      setHomeScore(String(prediction.home_score));
      setAwayScore(String(prediction.away_score));
      setIsJoker(prediction.is_joker);
    }
  }, [prediction]);
  const [saved, setSaved] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasPrediction = prediction !== undefined;
  const consensus = useConsensus(match.id, hasPrediction, competitionId);
  const hasChanged =
    homeScore !== (prediction ? String(prediction.home_score) : "") ||
    awayScore !== (prediction ? String(prediction.away_score) : "");

  const handleSave = async () => {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || h > 99 || a > 99) {
      setError(t("predictions.validScores"));
      return;
    }
    setSaving(true);
    setError(null);
    const err = await upsertPrediction(userId, match.id, h, a, competitionId, isJoker);
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    }
  };

  const handleShare = async () => {
    if (!match.homeTeam || !match.awayTeam || !prediction) return;

    const homeName = match.homeTeamName ?? home?.name ?? homeCode;
    const awayName = match.awayTeamName ?? away?.name ?? awayCode;

    const cardResult = await sharePredictionCard({
      homeTeam: homeName,
      awayTeam: awayName,
      homeScore: prediction.home_score,
      awayScore: prediction.away_score,
      actualHome: match.homeScore,
      actualAway: match.awayScore,
      points: prediction.points,
      competition: competitionId,
      matchday: match.matchday ? `Matchday ${match.matchday}` : undefined,
    });

    if (cardResult === "shared" || cardResult === "downloaded") {
      setShareStatus(cardResult === "shared" ? "Shared!" : "Saved!");
      setTimeout(() => setShareStatus(null), 2000);
      return;
    }

    const shareHome = home ?? { id: match.homeTeam, name: homeCode, fifaCode: homeCode, isoCode: "", confederation: "", group: "" };
    const shareAway = away ?? { id: match.awayTeam, name: awayCode, fifaCode: awayCode, isoCode: "", confederation: "", group: "" };
    const text = buildShareText(match, shareHome, shareAway, prediction.home_score, prediction.away_score);
    const result = await sharePrediction(text);
    if (result === "copied") {
      setShareStatus(t("predictions.copied"));
      setTimeout(() => setShareStatus(null), 2000);
    } else if (result === "failed") {
      setShareStatus(t("predictions.failed"));
      setTimeout(() => setShareStatus(null), 2000);
    }
  };

  const kickoff = new Date(`${match.date}T${match.time}:00Z`);
  const kickoffLabel = kickoff.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const kickoffTime = kickoff.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const roundLabel = match.group
    ? t("match.group", { id: match.group })
    : t(`round.${match.round === "round-of-32" ? "roundOf32" : match.round === "round-of-16" ? "roundOf16" : match.round === "third-place" ? "thirdPlace" : match.round}`);

  if (!match.homeTeam || !match.awayTeam) {
    return (
      <div className="yc-card p-4 opacity-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
            {roundLabel}
          </span>
          <span className="text-yc-text-tertiary text-xs">{kickoffLabel}</span>
        </div>
        <p className="text-yc-text-tertiary text-sm text-center py-4">
          {t("predictions.teamsTbd")}
        </p>
      </div>
    );
  }

  const homeCode = home?.fifaCode ?? match.homeTeam.toUpperCase();
  const awayCode = away?.fifaCode ?? match.awayTeam.toUpperCase();

  return (
    <div
      className={`yc-card p-4 transition-all duration-300 ${
        locked
          ? "opacity-70"
          : hasPrediction
            ? "border-[var(--yc-border-accent)]"
            : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
          {roundLabel}
        </span>
        <div className="flex items-center gap-2 text-yc-text-tertiary text-xs">
          <span>{kickoffLabel}, {kickoffTime}</span>
          {locked && <Lock size={12} />}
        </div>
      </div>

      {/* Teams + score inputs */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamCrest
            tla={homeCode}
            isoCode={home?.isoCode}
            size="md"
            className="shrink-0"
          />
          <span className="text-yc-text-primary text-sm font-semibold truncate">
            {homeCode}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={0}
            max={99}
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            disabled={locked}
            placeholder="-"
            className="w-12 h-12 sm:w-10 sm:h-10 bg-yc-bg-elevated border border-yc-border rounded-lg text-center text-yc-text-primary font-mono text-lg font-bold focus:outline-none focus:border-yc-green-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-yc-text-tertiary font-mono text-sm">:</span>
          <input
            type="number"
            min={0}
            max={99}
            value={awayScore}
            onChange={(e) => setAwayScore(e.target.value)}
            disabled={locked}
            placeholder="-"
            className="w-12 h-12 sm:w-10 sm:h-10 bg-yc-bg-elevated border border-yc-border rounded-lg text-center text-yc-text-primary font-mono text-lg font-bold focus:outline-none focus:border-yc-green-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-yc-text-primary text-sm font-semibold truncate text-right">
            {awayCode}
          </span>
          <TeamCrest
            tla={awayCode}
            isoCode={away?.isoCode}
            size="md"
            className="shrink-0"
          />
        </div>
      </div>

      {/* Community consensus */}
      {consensus && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-yc-text-tertiary">
          <span>{consensus.home}%</span>
          <div className="flex-1 h-1.5 bg-yc-bg-elevated rounded-full overflow-hidden flex">
            <div className="bg-yc-green/60 h-full transition-all" style={{ width: `${consensus.home}%` }} />
            <div className="bg-yc-text-tertiary/30 h-full transition-all" style={{ width: `${consensus.draw}%` }} />
            <div className="bg-yc-warning/50 h-full transition-all" style={{ width: `${consensus.away}%` }} />
          </div>
          <span>{consensus.away}%</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-yc-border flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-yc-text-tertiary">
          {venue && <span className="truncate max-w-[120px]">{venue.city}</span>}
          {predictionCount > 0 && (
            <span className="flex items-center gap-1">
              <UsersIcon size={10} />
              {t("predictions.predicted_count", { count: predictionCount })}
            </span>
          )}
        </div>

        {!locked && (
          <button
            onClick={() => setIsJoker(!isJoker)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isJoker
                ? "bg-yc-warning/15 text-yc-warning border border-yc-warning/30"
                : "text-yc-text-tertiary hover:text-yc-warning"
            }`}
            title={t("predictions.jokerTip")}
          >
            <Sparkles size={12} />
            {isJoker ? "2x" : t("predictions.joker")}
          </button>
        )}

        {!locked && (
          <button
            onClick={handleSave}
            disabled={saving || (!hasChanged && hasPrediction && isJoker === (prediction?.is_joker ?? false)) || !homeScore || !awayScore}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none bg-yc-green text-yc-bg-deep hover:brightness-110 active:scale-[0.97] shadow-[0_0_12px_rgba(0,255,136,0.15)]"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <Check size={12} />
            ) : null}
            {saved ? t("predictions.saved") : hasPrediction ? t("predictions.update") : t("predictions.save")}
          </button>
        )}

        {hasPrediction && (
          <button
            onClick={handleShare}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-yc-text-tertiary hover:text-yc-text-primary transition-colors"
            title={t("predictions.sharePrediction")}
          >
            <Share2 size={12} />
            {shareStatus ?? t("predictions.share")}
          </button>
        )}

        {locked && hasPrediction && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-yc-text-secondary text-xs">
              <Check size={12} className="text-yc-green" />
              {prediction.home_score} : {prediction.away_score}
            </span>
            {prediction.points !== null && (
              <span
                className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                  prediction.points >= 10
                    ? "text-yc-green bg-yc-green/10"
                    : prediction.points > 0
                      ? "text-yc-warning bg-yc-warning/10"
                      : "text-yc-text-tertiary bg-yc-bg-elevated"
                }`}
              >
                {t("predictions.pts", { count: prediction.points })}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-yc-danger text-xs">{error}</p>
      )}
    </div>
  );
}
