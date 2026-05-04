import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import {
  ANON_USER_ID,
  readAnonPredictions,
  upsertAnonPrediction,
  toPrediction,
} from "../lib/anonPredictions";

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
  /** 1 = Wild Guess, 2 = Risky Call, 3 = Sure Thing. Null = unset. */
  confidence: 1 | 2 | 3 | null;
  created_at: string;
  updated_at: string;
}

/** All predictions for the signed-in user, filtered by competition.
 *  When no user is signed in, returns predictions from local anonymous storage
 *  so the prediction UI still works pre-signup. */
export function useMyPredictions(competitionId = "WC") {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      // Anonymous mode — read from localStorage
      const anon = readAnonPredictions(competitionId).map(toPrediction);
      setPredictions(anon);
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
    if (!user && typeof window !== "undefined") {
      const handler = () => refresh();
      window.addEventListener("yc:anon-predictions", handler);
      return () => window.removeEventListener("yc:anon-predictions", handler);
    }
  }, [refresh, user]);

  return { predictions, loading, refresh };
}

/** Upsert an exact-score prediction.
 *  When userId is the ANON_USER_ID sentinel, writes to localStorage instead. */
export async function upsertPrediction(
  userId: string,
  matchId: number,
  homeScore: number,
  awayScore: number,
  competitionId = "WC",
  isJoker = false,
  kickoffTime?: string,
  confidence: 1 | 2 | 3 | null = null,
): Promise<string | null> {
  if (userId === ANON_USER_ID) {
    upsertAnonPrediction({
      match_id: matchId,
      competition_id: competitionId,
      home_score: homeScore,
      away_score: awayScore,
      quick_pick: null,
      is_joker: isJoker,
      confidence,
    });
    return null;
  }
  const { error } = await supabase.from("yc_predictions").upsert(
    {
      user_id: userId,
      match_id: matchId,
      competition_id: competitionId,
      home_score: homeScore,
      away_score: awayScore,
      quick_pick: null,
      is_joker: isJoker,
      confidence,
      updated_at: new Date().toISOString(),
      ...(kickoffTime ? { kickoff_time: kickoffTime } : {}),
    },
    { onConflict: "user_id,competition_id,match_id" },
  );
  return error?.message ?? null;
}

/** Upsert a quick-predict (1X2) prediction.
 *  When userId is the ANON_USER_ID sentinel, writes to localStorage instead. */
export async function upsertQuickPrediction(
  userId: string,
  matchId: number,
  pick: "H" | "D" | "A",
  competitionId = "WC",
  isJoker = false,
  kickoffTime?: string,
  confidence: 1 | 2 | 3 | null = null,
): Promise<string | null> {
  if (userId === ANON_USER_ID) {
    upsertAnonPrediction({
      match_id: matchId,
      competition_id: competitionId,
      home_score: null,
      away_score: null,
      quick_pick: pick,
      is_joker: isJoker,
      confidence,
    });
    return null;
  }
  const { error } = await supabase.from("yc_predictions").upsert(
    {
      user_id: userId,
      match_id: matchId,
      competition_id: competitionId,
      home_score: null,
      away_score: null,
      quick_pick: pick,
      is_joker: isJoker,
      confidence,
      updated_at: new Date().toISOString(),
      ...(kickoffTime ? { kickoff_time: kickoffTime } : {}),
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

/** Set of match IDs the user has predicted (for checkmark indicators).
 *  Pass competitionId to scope, or omit for all competitions.
 *  Falls back to anonymous storage when no user. */
export function usePredictedMatchIds(competitionId?: string) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!user) {
      const fromAnon = () =>
        new Set(readAnonPredictions(competitionId).map((p) => p.match_id));
      setIds(fromAnon());
      if (typeof window === "undefined") return;
      const handler = () => setIds(fromAnon());
      window.addEventListener("yc:anon-predictions", handler);
      return () => window.removeEventListener("yc:anon-predictions", handler);
    }
    let cancelled = false;
    async function load() {
      let query = supabase
        .from("yc_predictions")
        .select("match_id")
        .eq("user_id", user!.id);
      if (competitionId) query = query.eq("competition_id", competitionId);
      const { data } = await query;
      if (!cancelled) {
        setIds(new Set((data ?? []).map((r: { match_id: number }) => r.match_id)));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user, competitionId]);

  return ids;
}

/** Check if a match can still be predicted (before kickoff) */
export function canPredict(matchDate: string, matchTime: string): boolean {
  const kickoff = new Date(`${matchDate}T${matchTime}:00Z`);
  return Date.now() < kickoff.getTime();
}
