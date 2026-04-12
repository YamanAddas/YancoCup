import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface ActivityItem {
  id: string;
  userId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  matchId: number;
  competitionId: string;
  homeScore: number;
  awayScore: number;
  points: number | null;
  createdAt: string;
}

export function useActivityFeed(limit = 10, competitionId?: string) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      let query = supabase
        .from("yc_predictions")
        .select("id, user_id, match_id, competition_id, home_score, away_score, points, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (competitionId) {
        query = query.eq("competition_id", competitionId);
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) {
        setError(fetchErr.message);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = [...new Set(data.map((d) => d.user_id))];
      const { data: profiles, error: profErr } = await supabase
        .from("profiles_public")
        .select("id, handle, display_name, avatar_url")
        .in("id", userIds);
      if (profErr) console.error("Failed to fetch profiles:", profErr.message);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      const feed: ActivityItem[] = data.map((d) => {
        const profile = profileMap.get(d.user_id);
        return {
          id: d.id,
          userId: d.user_id,
          handle: profile?.handle ?? "unknown",
          displayName: profile?.display_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
          matchId: d.match_id,
          competitionId: d.competition_id,
          homeScore: d.home_score,
          awayScore: d.away_score,
          points: d.points ?? null,
          createdAt: d.created_at,
        };
      });

      setItems(feed);
      setLoading(false);
    }

    fetch();

    // Real-time subscription for new predictions (filtered by competition if provided)
    const channel = supabase
      .channel(`yc_predictions_feed_${competitionId ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "yc_predictions",
          ...(competitionId ? { filter: `competition_id=eq.${competitionId}` } : {}),
        },
        () => {
          fetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [limit, competitionId]);

  return { items, loading, error };
}
