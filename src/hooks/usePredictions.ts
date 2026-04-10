import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export interface Prediction {
  id: string;
  user_id: string;
  match_id: number;
  competition_id: string;
  home_score: number | null;
  away_score: number | null;
  quick_pick: "H" | "D" | "A" | null;
  points: number | null;
  scored_at: string | null;
  is_joker: boolean;
  created_at: string;
  updated_at: string;
}

/** All predictions for the signed-in user, filtered by competition */
export function useMyPredictions(competitionId = "WC") {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("yc_predictions")
      .select("*")
      .eq("user_id", user.id)
      .eq("competition_id", competitionId)
      .order("match_id");
    if (error) {
      console.error("Failed to fetch predictions:", error.message);
    }
    setPredictions((data as Prediction[]) ?? []);
    setLoading(false);
  }, [user, competitionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { predictions, loading, refresh };
}

/** Upsert an exact-score prediction */
export async function upsertPrediction(
  userId: string,
  matchId: number,
  homeScore: number,
  awayScore: number,
  competitionId = "WC",
  isJoker = false,
): Promise<string | null> {
  const { error } = await supabase.from("yc_predictions").upsert(
    {
      user_id: userId,
      match_id: matchId,
      competition_id: competitionId,
      home_score: homeScore,
      away_score: awayScore,
      quick_pick: null,
      is_joker: isJoker,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,competition_id,match_id" },
  );
  return error?.message ?? null;
}

/** Upsert a quick-predict (1X2) prediction */
export async function upsertQuickPrediction(
  userId: string,
  matchId: number,
  pick: "H" | "D" | "A",
  competitionId = "WC",
  isJoker = false,
): Promise<string | null> {
  const { error } = await supabase.from("yc_predictions").upsert(
    {
      user_id: userId,
      match_id: matchId,
      competition_id: competitionId,
      home_score: null,
      away_score: null,
      quick_pick: pick,
      is_joker: isJoker,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,competition_id,match_id" },
  );
  return error?.message ?? null;
}

/** Count of predictions per match (all users), filtered by competition */
export function usePredictionCounts(competitionId = "WC") {
  const [counts, setCounts] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from("yc_predictions")
        .select("match_id")
        .eq("competition_id", competitionId);
      if (error || !data) return;
      const map = new Map<number, number>();
      for (const row of data as { match_id: number }[]) {
        map.set(row.match_id, (map.get(row.match_id) ?? 0) + 1);
      }
      setCounts(map);
    }
    fetch();
  }, [competitionId]);

  return counts;
}

/** Set of match IDs the signed-in user has predicted (for checkmark indicators).
 *  Pass competitionId to scope, or omit for all competitions. */
export function usePredictedMatchIds(competitionId?: string) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    let query = supabase
      .from("yc_predictions")
      .select("match_id")
      .eq("user_id", user.id);
    if (competitionId) query = query.eq("competition_id", competitionId);
    query.then(({ data }) => {
      setIds(new Set((data ?? []).map((r: { match_id: number }) => r.match_id)));
    });
  }, [user, competitionId]);

  return ids;
}

/** Check if a match can still be predicted (before kickoff) */
export function canPredict(matchDate: string, matchTime: string): boolean {
  const kickoff = new Date(`${matchDate}T${matchTime}:00Z`);
  return Date.now() < kickoff.getTime();
}
