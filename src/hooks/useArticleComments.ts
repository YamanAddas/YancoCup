import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

export interface Comment {
  id: string;
  article_slug: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  upvotes: number;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Joined from profiles_public
  handle?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  // Client-side state
  voted?: boolean;
  replies?: Comment[];
}

type SortMode = "top" | "newest" | "oldest";

const PAGE_SIZE = 20;
const REPLY_PREVIEW = 3;

export function useArticleComments(articleSlug: string | undefined) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<SortMode>("newest");
  const profileCache = useRef(
    new Map<string, { handle: string; display_name: string | null; avatar_url: string | null }>(),
  );

  // Batch-fetch profiles for a set of user IDs
  const fetchProfiles = useCallback(async (userIds: string[]) => {
    const missing = userIds.filter((id) => !profileCache.current.has(id));
    if (missing.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("id, handle, display_name, avatar_url")
        .in("id", [...new Set(missing)]);
      for (const p of profiles ?? []) {
        profileCache.current.set(p.id, {
          handle: p.handle,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
        });
      }
    }
  }, []);

  // Enrich a raw comment row with profile data
  const enrich = useCallback(
    (row: Record<string, unknown>, voted: boolean = false): Comment => {
      const p = profileCache.current.get(row.user_id as string);
      return {
        ...(row as unknown as Comment),
        handle: p?.handle ?? "unknown",
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        voted,
        replies: [],
      };
    },
    [],
  );

  // Load comments
  const load = useCallback(async () => {
    if (!articleSlug) return;
    setLoading(true);

    // Fetch top-level comments
    const order = sort === "top" ? "upvotes" : "created_at";
    const ascending = sort === "oldest";
    const { data: topLevel } = await supabase
      .from("yc_comments")
      .select("*")
      .eq("article_slug", articleSlug)
      .is("parent_id", null)
      .eq("is_deleted", false)
      .order(order, { ascending: sort === "top" ? false : ascending })
      .range(0, PAGE_SIZE - 1);

    const rows = topLevel ?? [];

    // Fetch all replies for this article
    const { data: allReplies } = await supabase
      .from("yc_comments")
      .select("*")
      .eq("article_slug", articleSlug)
      .not("parent_id", "is", null)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true });

    const replies = allReplies ?? [];

    // Get total count
    const { count } = await supabase
      .from("yc_comments")
      .select("*", { count: "exact", head: true })
      .eq("article_slug", articleSlug)
      .eq("is_deleted", false);

    setTotal(count ?? 0);
    setHasMore(rows.length === PAGE_SIZE);

    // Batch-fetch profiles
    const allUserIds = [
      ...rows.map((r) => r.user_id),
      ...replies.map((r) => r.user_id),
    ];
    await fetchProfiles(allUserIds);

    // Fetch user's votes
    const myVotes = new Set<string>();
    if (user) {
      const commentIds = [...rows.map((r) => r.id), ...replies.map((r) => r.id)];
      if (commentIds.length > 0) {
        const { data: votes } = await supabase
          .from("yc_comment_votes")
          .select("comment_id")
          .eq("user_id", user.id)
          .in("comment_id", commentIds);
        for (const v of votes ?? []) myVotes.add(v.comment_id);
      }
    }

    // Build reply map
    const replyMap = new Map<string, Comment[]>();
    for (const r of replies) {
      const enriched = enrich(r, myVotes.has(r.id));
      const list = replyMap.get(r.parent_id!) ?? [];
      list.push(enriched);
      replyMap.set(r.parent_id!, list);
    }

    // Assemble top-level comments with replies
    const result = rows.map((r) => {
      const c = enrich(r, myVotes.has(r.id));
      c.replies = replyMap.get(r.id) ?? [];
      return c;
    });

    setComments(result);
    setLoading(false);
  }, [articleSlug, sort, user?.id, fetchProfiles, enrich]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!articleSlug) return;

    const channel = supabase
      .channel(`comments:${articleSlug}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "yc_comments",
          filter: `article_slug=eq.${articleSlug}`,
        },
        async (payload) => {
          const row = payload.new as Record<string, unknown>;
          await fetchProfiles([row.user_id as string]);
          const enriched = enrich(row, false);

          setComments((prev) => {
            // Deduplicate
            const allIds = new Set(prev.map((c) => c.id));
            for (const c of prev) {
              for (const r of c.replies ?? []) allIds.add(r.id);
            }
            if (allIds.has(enriched.id)) return prev;

            if (enriched.parent_id) {
              // It's a reply — attach to parent
              return prev.map((c) =>
                c.id === enriched.parent_id
                  ? { ...c, replies: [...(c.replies ?? []), enriched] }
                  : c,
              );
            }
            // Top-level comment — prepend
            return [enriched, ...prev];
          });
          setTotal((t) => t + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [articleSlug, fetchProfiles, enrich]);

  // Post a comment
  const postComment = useCallback(
    async (body: string, parentId: string | null = null): Promise<string | null> => {
      if (!user) return "You must be signed in to comment.";
      const trimmed = body.trim();
      if (!trimmed || trimmed.length > 1000) return "Comment must be 1-1000 characters.";

      const { error } = await supabase.rpc("post_comment", {
        p_article_slug: articleSlug,
        p_body: trimmed,
        p_parent_id: parentId,
      });

      return error?.message ?? null;
    },
    [user, articleSlug],
  );

  // Toggle upvote
  const toggleVote = useCallback(
    async (commentId: string) => {
      if (!user) return;

      // Optimistic update
      const updateComment = (c: Comment): Comment => {
        if (c.id === commentId) {
          return {
            ...c,
            voted: !c.voted,
            upvotes: c.upvotes + (c.voted ? -1 : 1),
          };
        }
        if (c.replies?.length) {
          return { ...c, replies: c.replies.map(updateComment) };
        }
        return c;
      };
      setComments((prev) => prev.map(updateComment));

      await supabase.rpc("toggle_comment_vote", { p_comment_id: commentId });
    },
    [user],
  );

  // Edit a comment
  const editComment = useCallback(
    async (commentId: string, newBody: string): Promise<string | null> => {
      if (!user) return "Not signed in.";
      const trimmed = newBody.trim();
      if (!trimmed || trimmed.length > 1000) return "Comment must be 1-1000 characters.";

      const { error } = await supabase
        .from("yc_comments")
        .update({ body: trimmed, is_edited: true, updated_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("user_id", user.id);

      if (!error) {
        const updateComment = (c: Comment): Comment => {
          if (c.id === commentId) return { ...c, body: trimmed, is_edited: true };
          if (c.replies?.length) return { ...c, replies: c.replies.map(updateComment) };
          return c;
        };
        setComments((prev) => prev.map(updateComment));
      }

      return error?.message ?? null;
    },
    [user],
  );

  // Soft-delete a comment
  const deleteComment = useCallback(
    async (commentId: string): Promise<string | null> => {
      if (!user) return "Not signed in.";

      const { error } = await supabase
        .from("yc_comments")
        .update({ is_deleted: true })
        .eq("id", commentId)
        .eq("user_id", user.id);

      if (!error) {
        setComments((prev) =>
          prev
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: (c.replies ?? []).filter((r) => r.id !== commentId),
            })),
        );
        setTotal((t) => Math.max(0, t - 1));
      }

      return error?.message ?? null;
    },
    [user],
  );

  // Report a comment
  const reportComment = useCallback(
    async (commentId: string, reason: string): Promise<string | null> => {
      if (!user) return "Not signed in.";

      const { error } = await supabase.from("yc_comment_reports").insert({
        comment_id: commentId,
        reporter_id: user.id,
        reason,
      });

      if (error?.message?.includes("duplicate")) return "You already reported this comment.";
      return error?.message ?? null;
    },
    [user],
  );

  // Load more top-level comments
  const loadMore = useCallback(async () => {
    if (!articleSlug || !hasMore || comments.length === 0) return;

    const lastComment = comments[comments.length - 1]!;
    const order = sort === "top" ? "upvotes" : "created_at";
    const ascending = sort === "oldest";

    let query = supabase
      .from("yc_comments")
      .select("*")
      .eq("article_slug", articleSlug)
      .is("parent_id", null)
      .eq("is_deleted", false)
      .order(order, { ascending: sort === "top" ? false : ascending })
      .range(0, PAGE_SIZE - 1);

    if (sort === "top") {
      query = query.lte("upvotes", lastComment.upvotes);
    } else if (sort === "oldest") {
      query = query.gt("created_at", lastComment.created_at);
    } else {
      query = query.lt("created_at", lastComment.created_at);
    }

    const { data } = await query;
    const rows = data ?? [];
    setHasMore(rows.length === PAGE_SIZE);

    await fetchProfiles(rows.map((r) => r.user_id));

    // Fetch votes for new comments
    const myVotes = new Set<string>();
    if (user && rows.length > 0) {
      const { data: votes } = await supabase
        .from("yc_comment_votes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in("comment_id", rows.map((r) => r.id));
      for (const v of votes ?? []) myVotes.add(v.comment_id);
    }

    const newComments = rows.map((r) => enrich(r, myVotes.has(r.id)));
    setComments((prev) => {
      const existing = new Set(prev.map((c) => c.id));
      const unique = newComments.filter((c) => !existing.has(c.id));
      return [...prev, ...unique];
    });
  }, [articleSlug, hasMore, comments, sort, user?.id, fetchProfiles, enrich]);

  return {
    comments,
    loading,
    total,
    hasMore,
    sort,
    setSort,
    postComment,
    toggleVote,
    editComment,
    deleteComment,
    reportComment,
    loadMore,
    replyPreviewCount: REPLY_PREVIEW,
  };
}
