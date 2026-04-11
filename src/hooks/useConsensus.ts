import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface Consensus {
  home: number; // percentage predicting home win
  draw: number;
  away: number;
  total: number;
}

/**
 * Fetch community consensus for a match — what % predict H/D/A.
 * Only fetches after the user has submitted their own prediction AND
 * the match is locked (past kickoff). This prevents users from copying
 * the crowd before submitting.
 */
export function useConsensus(
  matchId: number,
  hasPrediction: boolean,
  competitionId = "WC",
  locked = false,
): Consensus | null {
  const [consensus, setConsensus] = useState<Consensus | null>(null);

  useEffect(() => {
    if (!hasPrediction || !locked) {
      setConsensus(null);
      return;
    }

    async function fetch() {
      const { data } = await supabase
        .from("yc_predictions")
        .select("home_score, away_score, quick_pick")
        .eq("match_id", matchId)
        .eq("competition_id", competitionId);

      if (!data || data.length < 2) {
        setConsensus(null);
        return;
      }

      let home = 0;
      let draw = 0;
      let away = 0;

      for (const p of data) {
        // Quick-pick predictions: H/D/A directly
        if (p.quick_pick) {
          if (p.quick_pick === "H") home++;
          else if (p.quick_pick === "D") draw++;
          else if (p.quick_pick === "A") away++;
          continue;
        }
        // Score-based predictions
        if (p.home_score != null && p.away_score != null) {
          if (p.home_score > p.away_score) home++;
          else if (p.home_score === p.away_score) draw++;
          else away++;
        }
      }

      const total = home + draw + away;
      if (total < 2) {
        setConsensus(null);
        return;
      }
      setConsensus({
        home: Math.round((home / total) * 100),
        draw: Math.round((draw / total) * 100),
        away: Math.round((away / total) * 100),
        total,
      });
    }

    fetch();
  }, [matchId, hasPrediction, competitionId, locked]);

  return consensus;
}
