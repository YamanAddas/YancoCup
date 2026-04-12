import { useState, useCallback } from "react";
import { Check, Loader2, Zap, AlertCircle } from "lucide-react";
import { upsertPrediction, upsertQuickPrediction, canPredict } from "../../hooks/usePredictions";
import { useI18n } from "../../lib/i18n";
import TeamCrest from "../match/TeamCrest";
import type { Match, Team } from "../../types";
import type { Prediction } from "../../hooks/usePredictions";

interface BatchEntry {
  matchId: number;
  homeScore: string;
  awayScore: string;
  quickPick: "H" | "D" | "A" | null;
  isJoker: boolean;
}

interface BatchPredictFormProps {
  matches: Match[];
  teamMap: Map<string, Team>;
  predictions: Map<number, Prediction>;
  userId: string;
  competitionId: string;
  quickMode: boolean;
  onSaved: () => void;
}

export default function BatchPredictForm({
  matches,
  teamMap,
  predictions,
  userId,
  competitionId,
  quickMode,
  onSaved,
}: BatchPredictFormProps) {
  const { t } = useI18n();

  // Initialize entries from existing predictions or empty
  const [entries, setEntries] = useState<Map<number, BatchEntry>>(() => {
    const map = new Map<number, BatchEntry>();
    for (const m of matches) {
      const pred = predictions.get(m.id);
      map.set(m.id, {
        matchId: m.id,
        homeScore: pred?.home_score != null ? String(pred.home_score) : "",
        awayScore: pred?.away_score != null ? String(pred.away_score) : "",
        quickPick: pred?.quick_pick ?? null,
        isJoker: pred?.is_joker ?? false,
      });
    }
    return map;
  });

  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [totalToSave, setTotalToSave] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const updateEntry = useCallback((matchId: number, patch: Partial<BatchEntry>) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const entry = next.get(matchId);
      if (entry) next.set(matchId, { ...entry, ...patch });
      return next;
    });
  }, []);

  const toggleJoker = useCallback((matchId: number) => {
    setEntries((prev) => {
      const next = new Map(prev);
      const wasJoker = next.get(matchId)?.isJoker;
      // Only one joker allowed — clear others first
      for (const [id, entry] of next) {
        if (entry.isJoker && id !== matchId) {
          next.set(id, { ...entry, isJoker: false });
        }
      }
      const entry = next.get(matchId);
      if (entry) next.set(matchId, { ...entry, isJoker: !wasJoker });
      return next;
    });
  }, []);

  // Count how many have valid input
  const filledCount = Array.from(entries.values()).filter((e) => {
    if (quickMode) return e.quickPick !== null;
    const h = parseInt(e.homeScore, 10);
    const a = parseInt(e.awayScore, 10);
    return !isNaN(h) && !isNaN(a) && h >= 0 && a >= 0;
  }).length;

  const handleSaveAll = async () => {
    setSaving(true);
    setError(null);
    setSavedCount(0);
    setDone(false);

    const toSave: { match: Match; entry: BatchEntry }[] = [];
    for (const m of matches) {
      if (!canPredict(m.date, m.time)) continue;
      const entry = entries.get(m.id);
      if (!entry) continue;

      if (quickMode) {
        if (entry.quickPick !== null) toSave.push({ match: m, entry });
      } else {
        const h = parseInt(entry.homeScore, 10);
        const a = parseInt(entry.awayScore, 10);
        if (!isNaN(h) && !isNaN(a) && h >= 0 && a >= 0 && h <= 99 && a <= 99) {
          toSave.push({ match: m, entry });
        }
      }
    }

    if (toSave.length === 0) {
      setError(t("predictions.batchEmpty"));
      setSaving(false);
      return;
    }

    setTotalToSave(toSave.length);
    let errors = 0;

    for (const { match: m, entry } of toSave) {
      const kickoffIso = new Date(`${m.date}T${m.time}:00Z`).toISOString();
      let err: string | null;

      if (quickMode && entry.quickPick) {
        err = await upsertQuickPrediction(userId, m.id, entry.quickPick, competitionId, entry.isJoker, kickoffIso);
      } else {
        const h = parseInt(entry.homeScore, 10);
        const a = parseInt(entry.awayScore, 10);
        err = await upsertPrediction(userId, m.id, h, a, competitionId, entry.isJoker, kickoffIso);
      }

      if (err) errors++;
      setSavedCount((c) => c + 1);
    }

    setSaving(false);
    if (errors > 0) {
      setError(t("predictions.batchErrors", { count: errors }));
    } else {
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    }
    onSaved();
  };

  return (
    <div className="yc-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-yc-border bg-yc-bg-elevated/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-yc-text-primary">
            {t("predictions.batchTitle")}
          </h3>
          <span className="text-xs text-yc-text-secondary font-mono">
            {filledCount}/{matches.length}
          </span>
        </div>
      </div>

      {/* Match rows */}
      <div className="divide-y divide-yc-border/30">
        {matches.map((m) => {
          const home = m.homeTeam ? teamMap.get(m.homeTeam) : undefined;
          const away = m.awayTeam ? teamMap.get(m.awayTeam) : undefined;
          const entry = entries.get(m.id)!;
          const pred = predictions.get(m.id);
          const isLocked = !canPredict(m.date, m.time);

          return (
            <div
              key={m.id}
              className={`px-3 py-2.5 flex items-center gap-2 transition-colors ${
                isLocked ? "opacity-40" : pred ? "bg-yc-green/[0.03]" : ""
              }`}
            >
              {/* Home team */}
              <div className="flex items-center gap-1.5 w-[30%] min-w-0 justify-end">
                <span className="text-xs text-yc-text-primary truncate text-end">
                  {m.homeTeamName ?? home?.name ?? m.homeTeam ?? "TBD"}
                </span>
                <TeamCrest
                  tla={home?.fifaCode ?? m.homeTeam ?? "???"}
                  isoCode={home?.isoCode}
                  crest={m.homeCrest}
                  size="sm"
                />
              </div>

              {/* Score inputs / quick pick */}
              <div className="flex items-center gap-1 shrink-0">
                {quickMode ? (
                  <div className="flex gap-0.5">
                    {(["H", "D", "A"] as const).map((pick) => (
                      <button
                        key={pick}
                        disabled={isLocked}
                        onClick={() => updateEntry(m.id, { quickPick: pick })}
                        className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                          entry.quickPick === pick
                            ? pick === "H"
                              ? "bg-yc-info/20 text-yc-info border border-yc-info/40"
                              : pick === "D"
                                ? "bg-yc-warning/20 text-yc-warning border border-yc-warning/40"
                                : "bg-yc-danger/20 text-yc-danger border border-yc-danger/40"
                            : "bg-yc-bg-elevated text-yc-text-tertiary border border-transparent hover:text-yc-text-secondary"
                        }`}
                      >
                        {pick === "H" ? "1" : pick === "D" ? "X" : "2"}
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      disabled={isLocked}
                      value={entry.homeScore}
                      onChange={(e) => updateEntry(m.id, { homeScore: e.target.value })}
                      className="w-10 h-8 text-center bg-yc-bg-elevated border border-yc-border rounded text-sm font-mono text-yc-text-primary focus:outline-none focus:border-yc-green-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="-"
                    />
                    <span className="text-yc-text-tertiary text-xs">:</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      disabled={isLocked}
                      value={entry.awayScore}
                      onChange={(e) => updateEntry(m.id, { awayScore: e.target.value })}
                      className="w-10 h-8 text-center bg-yc-bg-elevated border border-yc-border rounded text-sm font-mono text-yc-text-primary focus:outline-none focus:border-yc-green-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="-"
                    />
                  </>
                )}
              </div>

              {/* Away team */}
              <div className="flex items-center gap-1.5 w-[30%] min-w-0">
                <TeamCrest
                  tla={away?.fifaCode ?? m.awayTeam ?? "???"}
                  isoCode={away?.isoCode}
                  crest={m.awayCrest}
                  size="sm"
                />
                <span className="text-xs text-yc-text-primary truncate text-start">
                  {m.awayTeamName ?? away?.name ?? m.awayTeam ?? "TBD"}
                </span>
              </div>

              {/* Joker toggle */}
              <button
                disabled={isLocked}
                onClick={() => toggleJoker(m.id)}
                className={`shrink-0 w-7 h-7 rounded flex items-center justify-center transition-all ${
                  entry.isJoker
                    ? "bg-yc-warning/20 text-yc-warning border border-yc-warning/40"
                    : "text-yc-text-tertiary hover:text-yc-text-secondary"
                }`}
                title={t("predictions.jokerTip")}
              >
                <Zap size={12} />
              </button>

              {/* Predicted indicator */}
              {pred && (
                <Check size={14} className="text-yc-green shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: save all button */}
      <div className="px-4 py-3 border-t border-yc-border bg-yc-bg-elevated/30">
        {error && (
          <div className="flex items-center gap-2 text-xs text-yc-danger mb-2">
            <AlertCircle size={12} />
            {error}
          </div>
        )}

        <button
          onClick={handleSaveAll}
          disabled={saving || filledCount === 0}
          className="w-full flex items-center justify-center gap-2 bg-yc-green text-yc-bg-deep font-semibold py-2.5 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {t("predictions.batchSaving", { saved: savedCount, total: totalToSave })}
            </>
          ) : done ? (
            <>
              <Check size={16} />
              {t("predictions.batchDone")}
            </>
          ) : (
            t("predictions.batchSave", { count: filledCount })
          )}
        </button>
      </div>
    </div>
  );
}
