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
 * Only fetches after the user has submitted their own prediction.
 */
export function useConsensus(
  matchId: number,
  hasPrediction: boolean,
  competitionId = "WC",
): Consensus | null {
  const [consensus, setConsensus] = useState<Consensus | null>(null);

  useEffect(() => {
    if (!hasPrediction) {
      setConsensus(null);
      return;
    }

    async function fetch() {
      const { data } = await supabase
        .from("yc_predictions")
        .select("home_score, away_score")
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
        if (p.home_score > p.away_score) home++;
        else if (p.home_score === p.away_score) draw++;
        else away++;
      }

      const total = data.length;
      setConsensus({
        home: Math.round((home / total) * 100),
        draw: Math.round((draw / total) * 100),
        away: Math.round((away / total) * 100),
        total,
      });
    }

    fetch();
  }, [matchId, hasPrediction, competitionId]);

  return consensus;
}
