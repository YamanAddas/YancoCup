import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { Swords, Plus, X, Trophy, Target, Crosshair, TrendingUp } from "lucide-react";

interface RivalProfile {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface RivalStats {
  profile: RivalProfile;
  totalPoints: number;
  predictions: number;
  exactScores: number;
  accuracy: number;
}

const MAX_RIVALS = 3;

export default function RivalsSection() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [rivals, setRivals] = useState<RivalStats[]>([]);
  const [myStats, setMyStats] = useState<RivalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RivalProfile[]>([]);

  const [rivalIds, setRivalIds] = useState<string[]>([]);

  // Load rival IDs from profiles_public
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles_public")
      .select("rivals")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setRivalIds((data?.rivals as string[] | null) ?? []);
      });
  }, [user]);

  const loadStats = useCallback(async (userId: string): Promise<Omit<RivalStats, "profile">> => {
    const { data } = await supabase
      .from("yc_predictions")
      .select("points, scored_at")
      .eq("user_id", userId);

    const preds = data ?? [];
    let totalPoints = 0;
    let exactScores = 0;
    let correct = 0;
    let scored = 0;

    for (const p of preds) {
      if (p.scored_at !== null) {
        scored++;
        const pts = p.points ?? 0;
        totalPoints += pts;
        if (pts >= 10) exactScores++;
        if (pts > 0) correct++;
      }
    }

    return {
      totalPoints,
      predictions: preds.length,
      exactScores,
      accuracy: scored > 0 ? Math.round((correct / scored) * 100) : 0,
    };
  }, []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    async function load() {
      // Load my stats
      const myS = await loadStats(user!.id);
      setMyStats({
        profile: {
          id: user!.id,
          handle: profile?.handle ?? "you",
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        },
        ...myS,
      });

      // Load rival stats
      if (rivalIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles_public")
          .select("id, handle, display_name, avatar_url")
          .in("id", rivalIds);

        const rivalStats: RivalStats[] = [];
        for (const p of profiles ?? []) {
          const s = await loadStats(p.id);
          rivalStats.push({ profile: p, ...s });
        }
        setRivals(rivalStats);
      }

      setLoading(false);
    }
    load();
  }, [user, rivalIds.join(","), loadStats]);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from("profiles_public")
      .select("id, handle, display_name, avatar_url")
      .ilike("handle", `%${query}%`)
      .neq("id", user?.id ?? "")
      .limit(5);
    setSearchResults((data ?? []).filter((p) => !rivalIds.includes(p.id)));
  }, [user?.id, rivalIds]);

  const addRival = useCallback(async (rivalId: string) => {
    if (!user || rivalIds.length >= MAX_RIVALS) return;
    const newRivals = [...rivalIds, rivalId];
    await supabase
      .from("profiles_public")
      .update({ rivals: newRivals })
      .eq("id", user.id);
    setRivalIds(newRivals);
    setAdding(false);
    setSearchQuery("");
    setSearchResults([]);
  }, [user, rivalIds]);

  const removeRival = useCallback(async (rivalId: string) => {
    if (!user) return;
    const newRivals = rivalIds.filter((id) => id !== rivalId);
    await supabase
      .from("profiles_public")
      .update({ rivals: newRivals })
      .eq("id", user.id);
    setRivalIds(newRivals);
    setRivals((prev) => prev.filter((r) => r.profile.id !== rivalId));
  }, [user, rivalIds]);

  if (!user || loading) return null;

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-4 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Swords size={18} className="text-yc-green" />
          <h3 className="font-heading text-lg font-bold">{t("profile.rivals")}</h3>
        </div>
        {rivalIds.length < MAX_RIVALS && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-yc-text-secondary hover:text-yc-green transition-colors"
          >
            <Plus size={14} />
            {t("profile.addRival")}
          </button>
        )}
      </div>

      {/* Add rival search */}
      {adding && (
        <div className="mb-4">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                searchUsers(e.target.value);
              }}
              placeholder={t("profile.searchRival")}
              className="flex-1 bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green-muted"
              autoFocus
            />
            <button
              onClick={() => { setAdding(false); setSearchQuery(""); setSearchResults([]); }}
              className="text-yc-text-tertiary hover:text-yc-text-primary"
            >
              <X size={18} />
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-1">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addRival(p.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-yc-bg-elevated/50 hover:bg-yc-bg-elevated transition-colors text-left"
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-yc-bg-elevated flex items-center justify-center text-[10px] font-bold text-yc-text-secondary">
                      {p.handle.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-yc-text-primary">{p.display_name ?? p.handle}</span>
                  <span className="text-xs text-yc-text-tertiary">@{p.handle}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Comparison table */}
      {rivals.length === 0 && !adding ? (
        <p className="text-yc-text-tertiary text-sm text-center py-4">{t("profile.noRivals")}</p>
      ) : rivals.length > 0 && myStats && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-yc-text-tertiary text-xs border-b border-yc-border">
                <th className="text-left py-2 px-2">{t("groupTable.team")}</th>
                <th className="text-center py-2 px-2"><Trophy size={12} className="inline" /></th>
                <th className="text-center py-2 px-2"><Target size={12} className="inline" /></th>
                <th className="text-center py-2 px-2"><Crosshair size={12} className="inline" /></th>
                <th className="text-center py-2 px-2"><TrendingUp size={12} className="inline" /></th>
              </tr>
            </thead>
            <tbody>
              {[myStats, ...rivals].map((entry) => {
                const isMe = entry.profile.id === user.id;
                return (
                  <tr
                    key={entry.profile.id}
                    className={`border-b border-yc-border/30 ${isMe ? "bg-yc-green/[0.04]" : ""}`}
                  >
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        {entry.profile.avatar_url ? (
                          <img src={entry.profile.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-yc-bg-elevated flex items-center justify-center text-[9px] font-bold text-yc-text-secondary">
                            {entry.profile.handle.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`truncate ${isMe ? "text-yc-green font-medium" : "text-yc-text-primary"}`}>
                          {entry.profile.display_name ?? entry.profile.handle}
                          {isMe && <span className="text-yc-text-tertiary ml-1 text-xs">{t("leaderboard.you")}</span>}
                        </span>
                        {!isMe && (
                          <button
                            onClick={() => removeRival(entry.profile.id)}
                            className="text-yc-text-tertiary hover:text-red-400 ml-auto shrink-0"
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-bold text-yc-green">{entry.totalPoints}</td>
                    <td className="py-2 px-2 text-center font-mono text-yc-text-secondary">{entry.predictions}</td>
                    <td className="py-2 px-2 text-center font-mono text-yc-text-secondary">{entry.exactScores}</td>
                    <td className="py-2 px-2 text-center font-mono text-yc-text-secondary">{entry.accuracy}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
