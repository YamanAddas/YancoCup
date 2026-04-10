import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export interface Pool {
  id: string;
  competition_id: string;
  name: string;
  join_code: string;
  created_by: string;
  scoring_config: Record<string, unknown>;
  created_at: string;
  member_count?: number;
}

export interface PoolMember {
  pool_id: string;
  user_id: string;
  joined_at: string;
  handle?: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

/** Generate a random 6-char alphanumeric join code */
function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for readability
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Fetch all pools the current user is a member of */
export function useMyPools() {
  const { user } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPools([]);
      setLoading(false);
      return;
    }

    // Get pool IDs the user is a member of
    const { data: memberships } = await supabase
      .from("yc_pool_members")
      .select("pool_id")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) {
      setPools([]);
      setLoading(false);
      return;
    }

    const poolIds = memberships.map((m) => m.pool_id);

    // Fetch pool details
    const { data: poolData } = await supabase
      .from("yc_pools")
      .select("*")
      .in("id", poolIds);

    // Get member counts
    const { data: allMembers } = await supabase
      .from("yc_pool_members")
      .select("pool_id")
      .in("pool_id", poolIds);

    const countMap = new Map<string, number>();
    for (const m of allMembers ?? []) {
      countMap.set(m.pool_id, (countMap.get(m.pool_id) ?? 0) + 1);
    }

    const enriched: Pool[] = (poolData ?? []).map((p) => ({
      ...p,
      member_count: countMap.get(p.id) ?? 0,
    }));

    setPools(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { pools, loading, refresh };
}

/** Fetch members of a specific pool with profile info */
export function usePoolMembers(poolId: string | null) {
  const [members, setMembers] = useState<PoolMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!poolId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    async function fetch() {
      const { data: memberData } = await supabase
        .from("yc_pool_members")
        .select("pool_id, user_id, joined_at")
        .eq("pool_id", poolId);

      if (!memberData || memberData.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const userIds = memberData.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("id, handle, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p]),
      );

      const enriched: PoolMember[] = memberData.map((m) => {
        const profile = profileMap.get(m.user_id);
        return {
          ...m,
          handle: profile?.handle ?? "unknown",
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        };
      });

      setMembers(enriched);
      setLoading(false);
    }

    fetch();
  }, [poolId]);

  return { members, loading };
}

/** Create a new pool */
export async function createPool(
  competitionId: string,
  name: string,
  createdBy: string,
): Promise<{ pool: Pool | null; error: string | null }> {
  // Try up to 3 times in case of join code collision
  for (let attempt = 0; attempt < 3; attempt++) {
    const joinCode = generateJoinCode();

    const { data, error } = await supabase
      .from("yc_pools")
      .insert({
        competition_id: competitionId,
        name: name.trim(),
        join_code: joinCode,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation on join_code — retry
      if (error.code === "23505") continue;
      return { pool: null, error: error.message };
    }

    // Auto-join the creator
    const { error: joinErr } = await supabase.from("yc_pool_members").insert({
      pool_id: data.id,
      user_id: createdBy,
    });
    if (joinErr) {
      console.error("Failed to auto-join pool creator:", joinErr.message);
    }

    return { pool: data as Pool, error: null };
  }

  return { pool: null, error: "Failed to generate unique join code. Try again." };
}

/** Join a pool by join code */
export async function joinPoolByCode(
  joinCode: string,
  userId: string,
): Promise<{ pool: Pool | null; error: string | null }> {
  // Find pool by code
  const { data: pool, error: findErr } = await supabase
    .from("yc_pools")
    .select("*")
    .eq("join_code", joinCode.toUpperCase().trim())
    .single();

  if (findErr || !pool) {
    return { pool: null, error: "Pool not found. Check the code and try again." };
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("yc_pool_members")
    .select("pool_id")
    .eq("pool_id", pool.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    return { pool: pool as Pool, error: null }; // Already a member
  }

  // Join
  const { error: joinErr } = await supabase
    .from("yc_pool_members")
    .insert({ pool_id: pool.id, user_id: userId });

  if (joinErr) {
    return { pool: null, error: joinErr.message };
  }

  return { pool: pool as Pool, error: null };
}

/** Leave a pool */
export async function leavePool(
  poolId: string,
  userId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("yc_pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  return error?.message ?? null;
}

/** Rename a pool (creator only) */
export async function renamePool(
  poolId: string,
  newName: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("yc_pools")
    .update({ name: newName.trim() })
    .eq("id", poolId);

  return error?.message ?? null;
}

/** Remove a member from a pool (creator only, cannot remove self) */
export async function removeMember(
  poolId: string,
  memberId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from("yc_pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", memberId);

  return error?.message ?? null;
}
