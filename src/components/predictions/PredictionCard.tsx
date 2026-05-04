import { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Lock, Check, Loader2, Users as UsersIcon, Share2, Sparkles, Zap, Star } from "lucide-react";
import { upsertPrediction, upsertQuickPrediction, canPredict } from "../../hooks/usePredictions";
import { useConsensus } from "../../hooks/useConsensus";
import { ANON_USER_ID } from "../../lib/anonPredictions";
import { checkActivityBadges } from "../../lib/badges";
import { useI18n } from "../../lib/i18n";
import { formatTimeWithTZ, getLocale } from "../../lib/formatDate";
import TeamCrest from "../match/TeamCrest";
import ShareCardModal from "./ShareCardModal";
import PredictionHeatmap from "./PredictionHeatmap";
import type { Match, Team, Venue } from "../../types";
import type { Prediction } from "../../hooks/usePredictions";
import type { ShareCardData } from "../../lib/shareCard";

interface PredictionCardProps {
  match: Match;
  teamMap: Map<string, Team>;
  venueMap: Map<string, Venue>;
  prediction: Prediction | undefined;
  predictionCount: number;
  userId: string;
  competitionId?: string;
  userPredictionCount?: number;
  jokerUsedThisMatchday?: boolean;
  quickMode?: boolean;
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
  userPredictionCount = 0,
  jokerUsedThisMatchday = false,
  quickMode = false,
  onSaved,
}: PredictionCardProps) {
  const { t, lang, tVenue } = useI18n();
  const home = match.homeTeam ? teamMap.get(match.homeTeam) : undefined;
  const away = match.awayTeam ? teamMap.get(match.awayTeam) : undefined;
  const venue = venueMap.get(match.venueId);
  const locked = !canPredict(match.date, match.time);

  const [homeScore, setHomeScore] = useState<string>("");
  const [awayScore, setAwayScore] = useState<string>("");
  const [quickPick, setQuickPick] = useState<"H" | "D" | "A" | null>(null);
  const [isJoker, setIsJoker] = useState(false);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prediction) {
      setHomeScore(prediction.home_score != null ? String(prediction.home_score) : "");
      setAwayScore(prediction.away_score != null ? String(prediction.away_score) : "");
      setQuickPick(prediction.quick_pick);
      setIsJoker(prediction.is_joker);
      setConfidence(prediction.confidence ?? null);
    }
  }, [prediction]);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up saved timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const hasPrediction = prediction !== undefined;
  const prevScoredRef = useRef(prediction?.scored_at);
  const [justScored, setJustScored] = useState(false);

  useEffect(() => {
    if (prevScoredRef.current === null && prediction?.scored_at) {
      setJustScored(true);
      // Fire confetti on exact score (10+ pts)
      if (prediction.points !== null && prediction.points >= 10) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.7 },
          colors: (() => { const s = getComputedStyle(document.documentElement); return [s.getPropertyValue("--color-yc-green").trim() || "#00ff88", s.getPropertyValue("--color-yc-warning").trim() || "#ffc800", s.getPropertyValue("--color-yc-info").trim() || "#4488ff"]; })(),
          disableForReducedMotion: true,
        });
      }
      const timer = setTimeout(() => setJustScored(false), 1500);
      return () => clearTimeout(timer);
    }
    prevScoredRef.current = prediction?.scored_at ?? null;
  }, [prediction?.scored_at, prediction?.points]);

  const consensus = useConsensus(match.id, hasPrediction, competitionId, locked);
  const hasChanged =
    homeScore !== (prediction?.home_score != null ? String(prediction.home_score) : "") ||
    awayScore !== (prediction?.away_score != null ? String(prediction.away_score) : "");

  const afterSave = () => {
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
    const newCount = hasPrediction ? userPredictionCount : userPredictionCount + 1;
    // Skip badge check for anonymous users — badges live in Supabase under a
    // real user_id and will get awarded retroactively after sign-up migration.
    if (userId === ANON_USER_ID) {
      onSaved();
      return;
    }
    checkActivityBadges(userId, newCount).catch((err) =>
      console.error("Badge check failed:", err),
    );
    onSaved();
  };

  const handleSave = async () => {
    const h = parseInt(homeScore, 10);
    const a = parseInt(awayScore, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0 || h > 99 || a > 99) {
      setError(t("predictions.validScores"));
      return;
    }
    setSaving(true);
    setError(null);
    const kickoffIso = new Date(`${match.date}T${match.time}:00Z`).toISOString();
    const err = await upsertPrediction(userId, match.id, h, a, competitionId, isJoker, kickoffIso, confidence);
    setSaving(false);
    if (err) { setError(err); } else { afterSave(); }
  };

  const handleQuickPick = async (pick: "H" | "D" | "A") => {
    if (locked) return;
    // If same pick tapped again with same confidence, do nothing
    if (pick === quickPick && hasPrediction && confidence === (prediction?.confidence ?? null)) return;
    setQuickPick(pick);
    setSaving(true);
    setError(null);
    const kickoffIso = new Date(`${match.date}T${match.time}:00Z`).toISOString();
    const err = await upsertQuickPrediction(userId, match.id, pick, competitionId, isJoker, kickoffIso, confidence);
    setSaving(false);
    if (err) { setError(err); } else { afterSave(); }
  };

  const buildShareCardData = (): ShareCardData | null => {
    if (!match.homeTeam || !match.awayTeam || !prediction) return null;
    if (!prediction.quick_pick && prediction.home_score == null) return null;

    const hCode = home?.fifaCode ?? match.homeTeam.toUpperCase();
    const aCode = away?.fifaCode ?? match.awayTeam.toUpperCase();
    const homeName = match.homeTeamName ?? home?.name ?? hCode;
    const awayName = match.awayTeamName ?? away?.name ?? aCode;

    return {
      homeTeam: homeName,
      awayTeam: awayName,
      homeCode: hCode,
      awayCode: aCode,
      homeIso: home?.isoCode || undefined,
      awayIso: away?.isoCode || undefined,
      homeCrest: match.homeCrest,
      awayCrest: match.awayCrest,
      homeScore: prediction.home_score ?? 0,
      awayScore: prediction.away_score ?? 0,
      quickPick: prediction.quick_pick,
      actualHome: match.homeScore,
      actualAway: match.awayScore,
      points: prediction.points,
      competition: competitionId,
      matchday: match.matchday ? t("match.matchday", { num: match.matchday }) : undefined,
      round: match.round,
      isJoker: prediction.is_joker,
    };
  };

  const kickoff = new Date(`${match.date}T${match.time}:00Z`);
  const kickoffLabel = kickoff.toLocaleDateString(getLocale(lang), {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const kickoffTime = formatTimeWithTZ(kickoff, lang);

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

  // Bold prediction: user picked away win (upset pick)
  const isBold = hasPrediction && (
    (prediction.quick_pick === "A") ||
    (prediction.home_score !== null && prediction.away_score !== null && prediction.away_score > prediction.home_score)
  );

  // Upset Radar: highlight knockout matches where upset bonus is available
  const isKnockout = match.round !== "group" && match.round !== "playoff";
  const showUpsetRadar = isKnockout && !locked && match.homeTeam && match.awayTeam;

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
        <div className="flex items-center gap-1.5">
          <span className="text-yc-text-tertiary text-xs uppercase tracking-wider">
            {roundLabel}
          </span>
          {isBold && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-yc-warning/15 text-yc-warning border border-yc-warning/20">
              <Zap size={8} />
              {t("predictions.bold")}
            </span>
          )}
          {showUpsetRadar && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-yc-danger/10 text-yc-danger/80 border border-yc-danger/15"
              title={t("predictions.upsetRadarTip") ?? "Pick the underdog to earn +3 bonus points!"}
            >
              <Zap size={8} />
              +3 {t("predictions.upsetBonus") ?? "upset"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-yc-text-tertiary text-xs">
          <span>{kickoffLabel}, {kickoffTime}</span>
          {locked && <Lock size={12} />}
        </div>
      </div>

      {/* Teams + score inputs / quick-pick buttons */}
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

        {quickMode ? (
          <div className="flex items-center gap-1 shrink-0">
            {(["H", "D", "A"] as const).map((pick) => (
              <button
                key={pick}
                onClick={() => handleQuickPick(pick)}
                disabled={locked || saving}
                className={`w-11 h-11 rounded-lg font-mono text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  quickPick === pick
                    ? "bg-yc-green text-yc-bg-deep shadow-[0_0_12px_rgba(0,255,136,0.2)]"
                    : "bg-yc-bg-elevated border border-yc-border text-yc-text-secondary hover:border-yc-green-muted hover:text-yc-text-primary"
                }`}
              >
                {pick === "H" ? "1" : pick === "D" ? "X" : "2"}
              </button>
            ))}
          </div>
        ) : (
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
        )}

        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-yc-text-primary text-sm font-semibold truncate text-end">
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
          <span className="text-yc-green/70">H {consensus.home}%</span>
          <div className="flex-1 h-1.5 bg-yc-bg-elevated rounded-full overflow-hidden flex">
            <div className="bg-yc-green/60 h-full transition-all" style={{ width: `${consensus.home}%` }} />
            <div className="bg-yc-text-tertiary/30 h-full transition-all" style={{ width: `${consensus.draw}%` }} />
            <div className="bg-yc-warning/50 h-full transition-all" style={{ width: `${consensus.away}%` }} />
          </div>
          <span className="text-yc-warning/70">A {consensus.away}%</span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-yc-border flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-yc-text-tertiary">
          {venue && <span className="truncate max-w-[120px]">{tVenue(venue.id).city}</span>}
          {predictionCount > 0 && (
            <span className="flex items-center gap-1">
              <UsersIcon size={10} />
              {t("predictions.predicted_count", { count: predictionCount })}
            </span>
          )}
        </div>

        {!locked && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => !jokerUsedThisMatchday && setIsJoker(!isJoker)}
              disabled={jokerUsedThisMatchday && !isJoker}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isJoker
                  ? "bg-yc-warning/15 text-yc-warning border border-yc-warning/30"
                  : jokerUsedThisMatchday
                    ? "text-yc-text-tertiary opacity-40 cursor-not-allowed"
                    : "text-yc-text-tertiary hover:text-yc-warning"
              }`}
              title={jokerUsedThisMatchday && !isJoker ? t("predictions.jokerUsed") : t("predictions.jokerTip")}
            >
              <Sparkles size={12} />
              {isJoker ? "2x" : jokerUsedThisMatchday ? t("predictions.jokerUsed") : t("predictions.joker")}
            </button>
            {/* Confidence stars */}
            <div className="flex items-center gap-0.5" title={t("predictions.confidenceTip") ?? "How confident are you?"}>
              {([1, 2, 3] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setConfidence(confidence === level ? null : level)}
                  className="p-2 min-h-11 min-w-11 flex items-center justify-center transition-colors"
                >
                  <Star
                    size={12}
                    className={`transition-colors ${
                      confidence !== null && level <= confidence
                        ? "text-yc-warning fill-yc-warning"
                        : "text-yc-text-tertiary hover:text-yc-warning/50"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {!locked && !quickMode && (
          <button
            onClick={handleSave}
            disabled={saving || (!hasChanged && hasPrediction && isJoker === (prediction?.is_joker ?? false) && confidence === (prediction?.confidence ?? null)) || !homeScore || !awayScore}
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
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-yc-text-tertiary hover:text-yc-green hover:bg-yc-green/5 transition-all"
            title={t("predictions.sharePrediction")}
          >
            <Share2 size={12} />
            {t("predictions.share")}
          </button>
        )}

        {locked && hasPrediction && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-yc-text-secondary text-xs">
              <Check size={12} className="text-yc-green" />
              {prediction.quick_pick
                ? { H: `1 (${t("quickPick.home")})`, D: `X (${t("quickPick.draw")})`, A: `2 (${t("quickPick.away")})` }[prediction.quick_pick]
                : `${prediction.home_score} : ${prediction.away_score}`}
            </span>
            {prediction.points !== null ? (
              <div className="yc-flip-container">
                <span
                  className={`yc-flip-inner inline-block font-mono text-xs font-bold px-1.5 py-0.5 rounded transition-all duration-500 ${
                    justScored ? "flipped animate-points-reveal" : ""
                  } ${
                    prediction.points >= 10
                      ? "text-yc-green bg-yc-green/10"
                      : prediction.points > 0
                        ? "text-yc-warning bg-yc-warning/10"
                        : "text-yc-text-tertiary bg-yc-bg-elevated"
                  }`}
                >
                  {t("predictions.pts", { count: prediction.points })}
                </span>
              </div>
            ) : (
              <span className="text-yc-text-tertiary text-xs flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" />
                {t("predictions.scoring")}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-yc-danger text-xs">{error}</p>
      )}

      {/* Score distribution heatmap — shown after match finishes */}
      {locked && hasPrediction && prediction.points !== null && !prediction.quick_pick && (
        <PredictionHeatmap
          matchId={match.id}
          competitionId={competitionId}
          actualHome={match.homeScore}
          actualAway={match.awayScore}
          userHome={prediction.home_score}
          userAway={prediction.away_score}
        />
      )}

      {/* Share card modal */}
      {hasPrediction && (() => {
        const cardData = buildShareCardData();
        return cardData ? (
          <ShareCardModal
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            data={cardData}
          />
        ) : null;
      })()}
    </div>
  );
}
