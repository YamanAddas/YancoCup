import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

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
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      // Fetch all scored predictions
      const { data: predictions } = await supabase
        .from("yc_predictions")
        .select("user_id, points, scored_at");

      // Fetch all profiles that have predictions
      const { data: allPredictions } = await supabase
        .from("yc_predictions")
        .select("user_id");

      if (!predictions || !allPredictions) {
        setLoading(false);
        return;
      }

      // Get unique user IDs who have any predictions
      const userIds = [...new Set(allPredictions.map((p) => p.user_id))];
      if (userIds.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("id, handle, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      // Count total predictions per user
      const totalMap = new Map<string, number>();
      for (const p of allPredictions) {
        totalMap.set(p.user_id, (totalMap.get(p.user_id) ?? 0) + 1);
      }

      // Aggregate scored predictions
      const statsMap = new Map<
        string,
        { points: number; correct: number; scored: number }
      >();
      for (const p of predictions) {
        if (p.scored_at === null) continue;
        const existing = statsMap.get(p.user_id) ?? {
          points: 0,
          correct: 0,
          scored: 0,
        };
        existing.points += p.points ?? 0;
        if ((p.points ?? 0) > 0) existing.correct++;
        existing.scored++;
        statsMap.set(p.user_id, existing);
      }

      // Build leaderboard
      const board: LeaderboardEntry[] = userIds.map((uid) => {
        const profile = profileMap.get(uid);
        const stats = statsMap.get(uid) ?? { points: 0, correct: 0, scored: 0 };
        const total = totalMap.get(uid) ?? 0;
        return {
          userId: uid,
          handle: profile?.handle ?? "unknown",
          displayName: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          totalPoints: stats.points,
          correctPredictions: stats.correct,
          totalPredictions: total,
          accuracy: stats.scored > 0 ? Math.round((stats.correct / stats.scored) * 100) : 0,
          pointsPerPrediction: total > 0 ? Math.round((stats.points / total) * 100) / 100 : 0,
        };
      });

      // Sort by total points desc, then PPP desc
      board.sort((a, b) => b.totalPoints - a.totalPoints || b.pointsPerPrediction - a.pointsPerPrediction);

      setEntries(board);
      setLoading(false);
    }

    fetch();
  }, []);

  return { entries, loading };
}
