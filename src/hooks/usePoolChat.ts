import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

export interface PoolMessage {
  id: string;
  pool_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // Joined from profiles_public
  handle?: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

const PAGE_SIZE = 30;

export function usePoolChat(poolId: string | null) {
  const [messages, setMessages] = useState<PoolMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const profileCache = useRef(new Map<string, { handle: string; display_name: string | null; avatar_url: string | null }>());

  // Fetch profile info for a user ID, using cache
  const enrichMessage = useCallback(
    async (msg: { id: string; pool_id: string; user_id: string; content: string; created_at: string }): Promise<PoolMessage> => {
      let profile = profileCache.current.get(msg.user_id);
      if (!profile) {
        const { data } = await supabase
          .from("profiles_public")
          .select("id, handle, display_name, avatar_url")
          .eq("id", msg.user_id)
          .single();
        profile = {
          handle: data?.handle ?? "unknown",
          display_name: data?.display_name ?? null,
          avatar_url: data?.avatar_url ?? null,
        };
        profileCache.current.set(msg.user_id, profile);
      }
      return { ...msg, ...profile };
    },
    [],
  );

  // Initial load
  useEffect(() => {
    if (!poolId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("yc_pool_messages")
        .select("id, pool_id, user_id, content, created_at")
        .eq("pool_id", poolId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;

      const rows = data ?? [];
      setHasMore(rows.length === PAGE_SIZE);

      // Batch-fetch unique profiles
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles_public")
          .select("id, handle, display_name, avatar_url")
          .in("id", userIds);
        for (const p of profiles ?? []) {
          profileCache.current.set(p.id, {
            handle: p.handle,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
          });
        }
      }

      const enriched = rows.map((r) => {
        const p = profileCache.current.get(r.user_id);
        return { ...r, handle: p?.handle, display_name: p?.display_name, avatar_url: p?.avatar_url };
      });

      if (cancelled) return;
      // Reverse so oldest first (for chat display)
      setMessages(enriched.reverse());
      setLoading(false);
    }

    load();

    // Subscribe to realtime inserts
    const channel = supabase
      .channel(`pool-chat-${poolId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "yc_pool_messages", filter: `pool_id=eq.${poolId}` },
        async (payload) => {
          if (cancelled) return;
          const newMsg = payload.new as { id: string; pool_id: string; user_id: string; content: string; created_at: string };
          const enriched = await enrichMessage(newMsg);
          if (cancelled) return;
          setMessages((prev) => {
            // Deduplicate (optimistic insert may already exist)
            if (prev.some((m) => m.id === enriched.id)) return prev;
            return [...prev, enriched];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [poolId, enrichMessage]);

  // Load older messages
  const loadMore = useCallback(async () => {
    if (!poolId || messages.length === 0 || !hasMore) return;

    const oldest = messages[0]!;
    const { data } = await supabase
      .from("yc_pool_messages")
      .select("id, pool_id, user_id, content, created_at")
      .eq("pool_id", poolId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    const rows = data ?? [];
    setHasMore(rows.length === PAGE_SIZE);

    // Batch-fetch profiles for new users
    const newUserIds = rows.map((r) => r.user_id).filter((id) => !profileCache.current.has(id));
    if (newUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("id, handle, display_name, avatar_url")
        .in("id", [...new Set(newUserIds)]);
      for (const p of profiles ?? []) {
        profileCache.current.set(p.id, {
          handle: p.handle,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        });
      }
    }

    const enriched = rows.map((r) => {
      const p = profileCache.current.get(r.user_id);
      return { ...r, handle: p?.handle, display_name: p?.display_name, avatar_url: p?.avatar_url };
    });

    setMessages((prev) => [...enriched.reverse(), ...prev]);
  }, [poolId, messages, hasMore]);

  // Send a message
  const sendMessage = useCallback(
    async (content: string): Promise<string | null> => {
      if (!poolId) return "No pool selected";
      const trimmed = content.trim();
      if (!trimmed || trimmed.length > 500) return "Message must be 1-500 characters";

      const { error } = await supabase.from("yc_pool_messages").insert({
        pool_id: poolId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        content: trimmed,
      });

      return error?.message ?? null;
    },
    [poolId],
  );

  return { messages, loading, hasMore, loadMore, sendMessage };
}
