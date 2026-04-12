import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export interface TeamFollow {
  id: string;
  team_id: string;
  team_type: "national" | "club";
  competition_id: string | null;
  team_name: string | null;
  team_crest: string | null;
  created_at: string;
}

/**
 * Manage followed teams for the signed-in user.
 * Follows the same pattern as useMyPredictions — fetch on mount, optimistic mutations.
 */
export function useFollowedTeams() {
  const { user } = useAuth();
  const [follows, setFollows] = useState<TeamFollow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setFollows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("yc_team_follows")
      .select("id, team_id, team_type, competition_id, team_name, team_crest, created_at")
      .eq("user_id", user.id)
      .order("created_at");
    if (error) {
      console.error("Failed to fetch followed teams:", error.message);
    }
    setFollows((data as TeamFollow[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Set of followed team IDs for O(1) lookups */
  const followedIds = useMemo(() => new Set(follows.map((f) => f.team_id)), [follows]);

  const isFollowing = useCallback(
    (teamId: string) => followedIds.has(teamId),
    [followedIds],
  );

  const followTeam = useCallback(
    async (teamId: string, teamType: "national" | "club", meta?: { competitionId?: string; teamName?: string; teamCrest?: string }) => {
      if (!user) return;
      // Optimistic insert
      const optimistic: TeamFollow = {
        id: crypto.randomUUID(),
        team_id: teamId,
        team_type: teamType,
        competition_id: meta?.competitionId ?? null,
        team_name: meta?.teamName ?? null,
        team_crest: meta?.teamCrest ?? null,
        created_at: new Date().toISOString(),
      };
      setFollows((prev) => [...prev, optimistic]);

      const { error } = await supabase.from("yc_team_follows").insert({
        user_id: user.id,
        team_id: teamId,
        team_type: teamType,
        competition_id: meta?.competitionId ?? null,
        team_name: meta?.teamName ?? null,
        team_crest: meta?.teamCrest ?? null,
      });

      if (error) {
        // Revert on failure (ignore duplicate errors — already following)
        if (error.code !== "23505") {
          console.error("Failed to follow team:", error.message);
          setFollows((prev) => prev.filter((f) => f.id !== optimistic.id));
        }
      }
    },
    [user],
  );

  const unfollowTeam = useCallback(
    async (teamId: string) => {
      if (!user) return;
      // Optimistic remove
      const removed = follows.find((f) => f.team_id === teamId);
      setFollows((prev) => prev.filter((f) => f.team_id !== teamId));

      const { error } = await supabase
        .from("yc_team_follows")
        .delete()
        .eq("user_id", user.id)
        .eq("team_id", teamId);

      if (error) {
        console.error("Failed to unfollow team:", error.message);
        // Revert
        if (removed) setFollows((prev) => [...prev, removed]);
      }
    },
    [user, follows],
  );

  return { follows, loading, followedIds, isFollowing, followTeam, unfollowTeam, refresh };
}
