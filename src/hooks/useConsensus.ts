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
 * Gated by the user having submitted their OWN prediction first — this
 * preserves anti-copy (you can't peek before committing) while still
 * surfacing pre-kickoff tension ("60% of your pool predicts Brazil").
 *
 * `locked` is accepted for API compatibility with existing callers but
 * no longer gates the fetch.
 */
export function useConsensus(
  matchId: number,
  hasPrediction: boolean,
  competitionId = "WC",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _locked = false,
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
      // Largest-remainder method to guarantee sum = 100%
      const rawHome = (home / total) * 100;
      const rawDraw = (draw / total) * 100;
      const rawAway = (away / total) * 100;
      const floorHome = Math.floor(rawHome);
      const floorDraw = Math.floor(rawDraw);
      const floorAway = Math.floor(rawAway);
      let remainder = 100 - floorHome - floorDraw - floorAway;
      const parts = [
        { key: "home" as const, floor: floorHome, frac: rawHome - floorHome },
        { key: "draw" as const, floor: floorDraw, frac: rawDraw - floorDraw },
        { key: "away" as const, floor: floorAway, frac: rawAway - floorAway },
      ].sort((a, b) => b.frac - a.frac);
      const result = { home: floorHome, draw: floorDraw, away: floorAway };
      for (const p of parts) {
        if (remainder <= 0) break;
        result[p.key]++;
        remainder--;
      }
      setConsensus({ ...result, total });
    }

    fetch();
  }, [matchId, hasPrediction, competitionId]);

  return consensus;
}
