import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export interface Prediction {
  id: string;
  user_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
  points: number | null;
  scored_at: string | null;
  created_at: string;
  updated_at: string;
}

/** All predictions for the signed-in user */
export function useMyPredictions() {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("yc_predictions")
      .select("*")
      .eq("user_id", user.id)
      .order("match_id");
    setPredictions((data as Prediction[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { predictions, loading, refresh };
}

/** Upsert a prediction (insert or update) */
export async function upsertPrediction(
  userId: string,
  matchId: number,
  homeScore: number,
  awayScore: number,
): Promise<string | null> {
  const { error } = await supabase.from("yc_predictions").upsert(
    {
      user_id: userId,
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" },
  );
  return error?.message ?? null;
}

/** Count of predictions per match (all users) */
export function usePredictionCounts() {
  const [counts, setCounts] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("yc_predictions")
        .select("match_id");
      if (!data) return;
      const map = new Map<number, number>();
      for (const row of data as { match_id: number }[]) {
        map.set(row.match_id, (map.get(row.match_id) ?? 0) + 1);
      }
      setCounts(map);
    }
    fetch();
  }, []);

  return counts;
}

/** Check if a match can still be predicted (before kickoff) */
export function canPredict(matchDate: string, matchTime: string): boolean {
  const kickoff = new Date(`${matchDate}T${matchTime}:00Z`);
  return Date.now() < kickoff.getTime();
}
