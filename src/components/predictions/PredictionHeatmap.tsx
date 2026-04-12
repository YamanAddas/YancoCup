import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";

interface Props {
  matchId: number;
  competitionId: string;
  /** Actual result — if available, highlight the cell */
  actualHome?: number | null;
  actualAway?: number | null;
  /** User's own prediction — highlight with ring */
  userHome?: number | null;
  userAway?: number | null;
}

/**
 * 6x6 grid showing how many users predicted each scoreline.
 * Only rendered when the match is locked (past kickoff).
 * Cells: rows = away goals (0-5), cols = home goals (0-5).
 */
export default function PredictionHeatmap({
  matchId,
  competitionId,
  actualHome,
  actualAway,
  userHome,
  userAway,
}: Props) {
  const { t } = useI18n();
  const [grid, setGrid] = useState<number[][] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("yc_predictions")
        .select("home_score, away_score")
        .eq("match_id", matchId)
        .eq("competition_id", competitionId)
        .not("home_score", "is", null)
        .not("away_score", "is", null);

      if (!data || data.length < 3) { setGrid(null); return; }

      // Build 6x6 grid (home 0-5 x away 0-5)
      const g = Array.from({ length: 6 }, () => Array(6).fill(0) as number[]);
      let count = 0;
      for (const p of data) {
        const h = Math.min(p.home_score ?? 0, 5);
        const a = Math.min(p.away_score ?? 0, 5);
        g[a]![h]!++;
        count++;
      }
      setGrid(g);
      setTotal(count);
    }
    fetch();
  }, [matchId, competitionId]);

  const maxCount = useMemo(() => {
    if (!grid) return 1;
    return Math.max(1, ...grid.flat());
  }, [grid]);

  if (!grid) return null;

  return (
    <div className="mt-3 pt-3 border-t border-yc-border/30">
      <p className="text-[10px] text-yc-text-tertiary uppercase tracking-wider mb-2">
        {t("predictions.heatmapTitle") ?? "Score Distribution"} ({total})
      </p>
      <div className="grid gap-px" style={{ gridTemplateColumns: "auto repeat(6, 1fr)" }}>
        {/* Column headers (home goals) */}
        <span />
        {[0, 1, 2, 3, 4, 5].map((h) => (
          <span key={h} className="text-[9px] text-yc-text-tertiary text-center font-mono">{h}</span>
        ))}

        {/* Rows (away goals) */}
        {grid.map((row, a) => (
          <div key={a} className="contents">
            <span className="text-[9px] text-yc-text-tertiary font-mono flex items-center justify-end pr-1">{a}</span>
            {row.map((count, h) => {
              const intensity = count / maxCount;
              const isActual = actualHome === h && actualAway === a;
              const isUser = userHome === h && userAway === a;
              return (
                <div
                  key={h}
                  className={`aspect-square rounded flex items-center justify-center text-[8px] font-mono transition-all ${
                    isActual
                      ? "ring-1 ring-yc-warning"
                      : isUser
                        ? "ring-1 ring-yc-green/60"
                        : ""
                  }`}
                  style={{
                    backgroundColor: count > 0
                      ? `rgba(0, 255, 136, ${0.05 + intensity * 0.35})`
                      : "rgba(255,255,255,0.02)",
                  }}
                  title={`${h}-${a}: ${count} ${count === 1 ? "prediction" : "predictions"}`}
                >
                  {count > 0 && (
                    <span className={`${isActual ? "text-yc-warning font-bold" : "text-yc-text-secondary"}`}>
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-1.5 text-[9px] text-yc-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full ring-1 ring-yc-warning" /> {t("predictions.heatmapActual") ?? "Actual"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full ring-1 ring-yc-green/60" /> {t("predictions.heatmapYours") ?? "Yours"}
        </span>
      </div>
    </div>
  );
}
