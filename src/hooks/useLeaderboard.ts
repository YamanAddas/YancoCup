import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export type LeaderboardPeriod = "all" | "matchday" | "weekly" | "monthly";

export interface LeaderboardEntry {
  userId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
  accuracy: number;
  pointsPerPrediction: number;
  previousRank?: number;
}

function buildLeaderboard(
  predictions: Array<{ user_id: string; points: number | null; scored_at: string | null; match_id?: number }>,
  profileMap: Map<string, { id: string; handle: string; display_name: string | null; avatar_url: string | null }>,
): LeaderboardEntry[] {
  const userIds = [...new Set(predictions.map((p) => p.user_id))];

  const statsMap = new Map<
    string,
    { points: number; correct: number; scored: number; total: number }
  >();
  for (const p of predictions) {
    const existing = statsMap.get(p.user_id) ?? {
      points: 0,
      correct: 0,
      scored: 0,
      total: 0,
    };
    existing.total++;
    if (p.scored_at !== null) {
      existing.points += p.points ?? 0;
      if ((p.points ?? 0) > 0) existing.correct++;
      existing.scored++;
    }
    statsMap.set(p.user_id, existing);
  }

  const board: LeaderboardEntry[] = userIds.map((uid) => {
    const profile = profileMap.get(uid);
    const stats = statsMap.get(uid) ?? { points: 0, correct: 0, scored: 0, total: 0 };
    return {
      userId: uid,
      handle: profile?.handle ?? "unknown",
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      totalPoints: stats.points,
      correctPredictions: stats.correct,
      totalPredictions: stats.total,
      accuracy: stats.scored > 0 ? Math.round((stats.correct / stats.scored) * 100) : 0,
      pointsPerPrediction: stats.total > 0 ? Math.round((stats.points / stats.total) * 100) / 100 : 0,
    };
  });

  board.sort((a, b) => b.totalPoints - a.totalPoints || b.pointsPerPrediction - a.pointsPerPrediction);
  return board;
}

export function useLeaderboard(
  competitionId = "WC",
  period: LeaderboardPeriod = "all",
  matchdayMatchIds?: number[],
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Serialize matchday IDs for dependency tracking
  const matchdayKey = matchdayMatchIds?.join(",") ?? "";

  useEffect(() => {
    async function fetch() {
      setError(null);
      // Fetch all scored predictions for this competition
      const { data: allPredictions, error: predErr } = await supabase
        .from("yc_predictions")
        .select("user_id, points, scored_at, match_id")
        .eq("competition_id", competitionId);

      if (predErr) {
        setError(predErr.message);
        setEntries([]);
        setLoading(false);
        return;
      }

      if (!allPredictions || allPredictions.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set(allPredictions.map((p) => p.user_id))];

      const { data: profiles, error: profErr } = await supabase
        .from("profiles_public")
        .select("id, handle, display_name, avatar_url")
        .in("id", userIds);
      if (profErr) console.error("Failed to fetch profiles:", profErr.message);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      // Build all-time board (also used as previous rank reference)
      const allTimeBoard = buildLeaderboard(allPredictions, profileMap);
      const allTimeRankMap = new Map(allTimeBoard.map((e, i) => [e.userId, i + 1]));

      if (period === "all") {
        setEntries(allTimeBoard);
        setLoading(false);
        return;
      }

      // Filter by period
      let filtered: typeof allPredictions;
      if (period === "matchday" && matchdayMatchIds && matchdayMatchIds.length > 0) {
        const mdSet = new Set(matchdayMatchIds);
        filtered = allPredictions.filter((p) => mdSet.has(p.match_id));
      } else {
        const now = Date.now();
        const cutoff = period === "weekly" ? now - 7 * 86400000 : now - 30 * 86400000;
        filtered = allPredictions.filter(
          (p) => p.scored_at && new Date(p.scored_at).getTime() >= cutoff,
        );
      }

      if (filtered.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const periodBoard = buildLeaderboard(filtered, profileMap);

      // Attach previous (all-time) rank for movement arrows
      for (const entry of periodBoard) {
        entry.previousRank = allTimeRankMap.get(entry.userId);
      }

      setEntries(periodBoard);
      setLoading(false);
    }

    fetch();
  }, [competitionId, period, matchdayKey]);

  return { entries, loading, error };
}
