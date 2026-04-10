import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export type ReactionType = "fire" | "laugh" | "clown";

export interface ReactionCounts {
  fire: number;
  laugh: number;
  clown: number;
}

export interface UserReactions {
  fire: boolean;
  laugh: boolean;
  clown: boolean;
}

export function useReactions(predictionIds: string[]) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Map<string, ReactionCounts>>(new Map());
  const [mine, setMine] = useState<Map<string, UserReactions>>(new Map());

  useEffect(() => {
    if (predictionIds.length === 0) return;

    async function fetch() {
      const { data, error } = await supabase
        .from("yc_reactions")
        .select("prediction_id, user_id, reaction")
        .in("prediction_id", predictionIds);

      if (error || !data) return;

      const newCounts = new Map<string, ReactionCounts>();
      const newMine = new Map<string, UserReactions>();

      for (const pid of predictionIds) {
        newCounts.set(pid, { fire: 0, laugh: 0, clown: 0 });
        newMine.set(pid, { fire: false, laugh: false, clown: false });
      }

      for (const r of data) {
        const c = newCounts.get(r.prediction_id);
        if (c) c[r.reaction as ReactionType]++;
        if (user && r.user_id === user.id) {
          const m = newMine.get(r.prediction_id);
          if (m) m[r.reaction as ReactionType] = true;
        }
      }

      setCounts(newCounts);
      setMine(newMine);
    }

    fetch();
  }, [predictionIds.join(","), user?.id]);

  const toggle = useCallback(
    async (predictionId: string, reaction: ReactionType) => {
      if (!user) return;

      const myReactions = mine.get(predictionId);
      const isActive = myReactions?.[reaction] ?? false;

      // Optimistic update
      setCounts((prev) => {
        const next = new Map(prev);
        const c = { ...(next.get(predictionId) ?? { fire: 0, laugh: 0, clown: 0 }) };
        c[reaction] += isActive ? -1 : 1;
        next.set(predictionId, c);
        return next;
      });
      setMine((prev) => {
        const next = new Map(prev);
        const m = { ...(next.get(predictionId) ?? { fire: false, laugh: false, clown: false }) };
        m[reaction] = !isActive;
        next.set(predictionId, m);
        return next;
      });

      if (isActive) {
        await supabase
          .from("yc_reactions")
          .delete()
          .eq("prediction_id", predictionId)
          .eq("user_id", user.id)
          .eq("reaction", reaction);
      } else {
        await supabase
          .from("yc_reactions")
          .insert({ prediction_id: predictionId, user_id: user.id, reaction });
      }
    },
    [user, mine],
  );

  return { counts, mine, toggle };
}
