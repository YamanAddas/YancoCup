import { useState, useEffect } from "react";
import { Lock, Check, Loader2, Users as UsersIcon, Share2 } from "lucide-react";
import { upsertPrediction, canPredict } from "../../hooks/usePredictions";
import { buildShareText, sharePrediction } from "../../lib/share";
import type { Match, Team, Venue } from "../../types";
import type { Prediction } from "../../hooks/usePredictions";

const FLAG_BASE = "https://hatscripts.github.io/circle-flags/flags";

interface PredictionCardProps {
  match: Match;
  teamMap: Map<string, Team>;
  venueMap: Map<string, Venue>;
  prediction: Prediction | undefined;
  predictionCount: number;
  userId: string;
  onSaved: () => void;
}

export default function PredictionCard({
  match,
  teamMap,
  venueMap,
  prediction,
  predictionCount,
  userId,
  onSaved,
}: PredictionCardProps) {
  const home = match.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  const venue = venueMap.get(match.venueId);
  const locked = !canPredict(match.date, match.time);

  const [homeScore, setHomeScore] = useState<string>("");
  const [awayScore, setAwayScore] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Sync local state when prediction data loads from Supabase
  useEffect(() => {
    if (prediction) {
      setHomeScore(String(prediction.home_score));
      setAwayScore(String(prediction.away_score));
    }
  }, [prediction]);
  const [saved, setSaved] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasPrediction = prediction !== undefined;
  const hasChanged =
    homeScore !== (prediction ? String(prediction.home_score) : "") ||
    awayScore !== (prediction ? String(prediction.away_score) : "");

  const handleSave = async () => {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || h > 99 || a > 99) {
      setError("Enter valid scores (0-99)");
      return;
    }
    setSaving(true);
    setError(null);
    const err = await upsertPrediction(userId, match.id, h, a);
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
    if (!home || !away || !prediction) return;
    const text = buildShareText(match, home, away, prediction.home_score, prediction.away_score);
    const result = await sharePrediction(text);
    if (result === "copied") {
      setShareStatus("Copied!");
      setTimeout(() => setShareStatus(null), 2000);
    } else if (result === "failed") {
      setShareStatus("Failed");
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

  // Can't predict knockout matches with TBD teams
  if (!home || !away) {
    return (
      <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4 opacity-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
            {match.group ? `Group ${match.group}` : match.round}
          </span>
          <span className="text-yc-text-tertiary text-xs">{kickoffLabel}</span>
        </div>
        <p className="text-yc-text-tertiary text-sm text-center py-4">
          Teams TBD — predictions open once teams are confirmed
        </p>
      </div>
    );
  }

  return (
    <div
      className={`bg-yc-bg-surface border rounded-xl p-4 transition-colors ${
        locked ? "border-yc-border opacity-75" : hasPrediction ? "border-yc-green-muted/30" : "border-yc-border hover:border-yc-border-hover"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
          {match.group ? `Group ${match.group}` : match.round}
        </span>
        <div className="flex items-center gap-2 text-yc-text-tertiary text-xs">
          <span>{kickoffLabel}, {kickoffTime}</span>
          {locked && <Lock size={12} />}
        </div>
      </div>

      {/* Teams + score inputs */}
      <div className="flex items-center gap-2">
        {/* Home team */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img
            src={`${FLAG_BASE}/${home.isoCode}.svg`}
            alt={home.name}
            className="w-8 h-8 rounded-full shrink-0"
          />
          <span className="text-yc-text-primary text-sm font-semibold truncate">
            {home.fifaCode}
          </span>
        </div>

        {/* Score inputs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={0}
            max={99}
            value={homeScore}
            onChange={(e) => setHomeScore(e.target.value)}
            disabled={locked}
            placeholder="-"
            className="w-10 h-10 bg-yc-bg-elevated border border-yc-border rounded-lg text-center text-yc-text-primary font-mono text-lg font-bold focus:outline-none focus:border-yc-green-muted disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
            className="w-10 h-10 bg-yc-bg-elevated border border-yc-border rounded-lg text-center text-yc-text-primary font-mono text-lg font-bold focus:outline-none focus:border-yc-green-muted disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        {/* Away team */}
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-yc-text-primary text-sm font-semibold truncate text-right">
            {away.fifaCode}
          </span>
          <img
            src={`${FLAG_BASE}/${away.isoCode}.svg`}
            alt={away.name}
            className="w-8 h-8 rounded-full shrink-0"
          />
        </div>
      </div>

      {/* Footer: venue + save button + count */}
      <div className="mt-3 pt-3 border-t border-yc-border flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-yc-text-tertiary">
          {venue && <span className="truncate max-w-[120px]">{venue.city}</span>}
          {predictionCount > 0 && (
            <span className="flex items-center gap-1">
              <UsersIcon size={10} />
              {predictionCount} predicted
            </span>
          )}
        </div>

        {!locked && (
          <button
            onClick={handleSave}
            disabled={saving || (!hasChanged && hasPrediction) || !homeScore || !awayScore}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:pointer-events-none bg-yc-green text-yc-bg-deep hover:brightness-110 active:scale-[0.97]"
          >
            {saving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : saved ? (
              <Check size={12} />
            ) : null}
            {saved ? "Saved" : hasPrediction ? "Update" : "Save"}
          </button>
        )}

        {hasPrediction && (
          <button
            onClick={handleShare}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-yc-text-tertiary hover:text-yc-text-primary transition-colors"
            title="Share prediction"
          >
            <Share2 size={12} />
            {shareStatus ?? "Share"}
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
                    ? "text-yc-green bg-yc-green-dark/30"
                    : prediction.points > 0
                      ? "text-yc-warning bg-yc-warning/10"
                      : "text-yc-text-tertiary bg-yc-bg-elevated"
                }`}
              >
                {prediction.points} pts
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
