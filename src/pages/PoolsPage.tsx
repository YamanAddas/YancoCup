import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { useCompetition } from "../lib/CompetitionProvider";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import {
  useMyPools,
  usePoolMembers,
  createPool,
  joinPoolByCode,
  leavePool,
} from "../hooks/usePools";
import type { Pool, PoolMember } from "../hooks/usePools";
import {
  Users,
  Plus,
  LogIn as JoinIcon,
  Copy,
  Check,
  Crown,
  LogOut,
  Loader2,
  Activity,
} from "lucide-react";
import { NavLink } from "react-router-dom";

function CreatePoolForm({
  competitionId,
  userId,
  onCreated,
}: {
  competitionId: string;
  userId: string;
  onCreated: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPool, setCreatedPool] = useState<Pool | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const { pool, error: err } = await createPool(competitionId, name, userId);
    setCreating(false);
    if (err) {
      setError(err);
    } else if (pool) {
      setCreatedPool(pool);
      onCreated();
    }
  };

  const handleCopy = async (code: string) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}#/pool/${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (createdPool) {
    return (
      <div className="bg-yc-bg-surface border border-yc-green-muted/30 rounded-xl p-5 text-center">
        <Check size={32} className="text-yc-green mx-auto mb-3" />
        <h4 className="font-heading text-lg font-bold mb-1">{createdPool.name}</h4>
        <p className="text-yc-text-secondary text-sm mb-4">{t("pools.shareCode")}</p>
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="font-mono text-2xl font-bold text-yc-green tracking-widest">
            {createdPool.join_code}
          </span>
          <button
            onClick={() => handleCopy(createdPool.join_code)}
            className="p-2 rounded-lg hover:bg-yc-bg-elevated transition-colors"
          >
            {copied ? <Check size={16} className="text-yc-green" /> : <Copy size={16} className="text-yc-text-tertiary" />}
          </button>
        </div>
        <button
          onClick={() => setCreatedPool(null)}
          className="text-yc-text-tertiary text-sm hover:text-yc-text-primary"
        >
          {t("pools.done")}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-5">
      <h4 className="font-heading text-base font-bold mb-3">{t("pools.create")}</h4>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("pools.namePlaceholder")}
          maxLength={50}
          className="flex-1 bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="flex items-center gap-1.5 bg-yc-green text-yc-bg-deep font-semibold px-4 py-2 rounded-lg text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {t("pools.createBtn")}
        </button>
      </div>
      {error && <p className="mt-2 text-yc-danger text-xs">{error}</p>}
    </div>
  );
}

function JoinPoolForm({
  userId,
  onJoined,
}: {
  userId: string;
  onJoined: () => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) return;
    setJoining(true);
    setError(null);
    const { error: err } = await joinPoolByCode(code, userId);
    setJoining(false);
    if (err) {
      setError(err);
    } else {
      setCode("");
      onJoined();
    }
  };

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-5">
      <h4 className="font-heading text-base font-bold mb-3">{t("pools.join")}</h4>
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("pools.codePlaceholder")}
          maxLength={6}
          className="flex-1 bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary font-mono uppercase tracking-widest focus:outline-none focus:border-yc-green-muted"
        />
        <button
          onClick={handleJoin}
          disabled={joining || code.trim().length !== 6}
          className="flex items-center gap-1.5 bg-yc-bg-elevated border border-yc-border text-yc-text-primary font-medium px-4 py-2 rounded-lg text-sm hover:border-yc-green-muted transition-colors disabled:opacity-40"
        >
          {joining ? <Loader2 size={14} className="animate-spin" /> : <JoinIcon size={14} />}
          {t("pools.joinBtn")}
        </button>
      </div>
      {error && <p className="mt-2 text-yc-danger text-xs">{error}</p>}
    </div>
  );
}

interface PoolPrediction {
  handle: string;
  display_name: string | null;
  match_id: number;
  home_score: number;
  away_score: number;
  created_at: string;
}

function PoolActivityFeed({ members, competitionId }: { members: PoolMember[]; competitionId: string }) {
  const [predictions, setPredictions] = useState<PoolPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (members.length === 0) { setLoading(false); return; }
      const memberIds = members.map((m) => m.user_id);
      const { data } = await supabase
        .from("yc_predictions")
        .select("user_id, match_id, home_score, away_score, created_at")
        .eq("competition_id", competitionId)
        .in("user_id", memberIds)
        .order("created_at", { ascending: false })
        .limit(8);

      if (data) {
        const memberMap = new Map(members.map((m) => [m.user_id, m]));
        setPredictions(data.map((p) => ({
          handle: memberMap.get(p.user_id)?.handle ?? "?",
          display_name: memberMap.get(p.user_id)?.display_name ?? null,
          match_id: p.match_id,
          home_score: p.home_score,
          away_score: p.away_score,
          created_at: p.created_at,
        })));
      }
      setLoading(false);
    }
    load();
  }, [members, competitionId]);

  if (loading) return <div className="h-12 bg-yc-bg-elevated rounded animate-pulse" />;
  if (predictions.length === 0) return <p className="text-xs text-yc-text-tertiary">No predictions yet</p>;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-yc-text-tertiary mb-1">
        <Activity size={10} />
        Recent Activity
      </div>
      {predictions.map((p, i) => {
        const ago = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
        const timeLabel = ago < 60 ? `${ago}m` : ago < 1440 ? `${Math.floor(ago / 60)}h` : `${Math.floor(ago / 1440)}d`;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-yc-text-primary font-medium truncate max-w-[80px]">
              {p.display_name ?? p.handle}
            </span>
            <span className="text-yc-text-tertiary">predicted</span>
            <span className="text-yc-green font-mono font-bold">{p.home_score}-{p.away_score}</span>
            <span className="text-yc-text-tertiary ml-auto">{timeLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function PoolCard({
  pool,
  userId,
  onLeft,
}: {
  pool: Pool;
  userId: string;
  onLeft: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { members, loading: membersLoading } = usePoolMembers(
    expanded ? pool.id : null,
  );

  const handleCopy = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}#/pool/${pool.join_code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = async () => {
    setLeaving(true);
    await leavePool(pool.id, userId);
    setLeaving(false);
    onLeft();
  };

  const isCreator = pool.created_by === userId;

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-yc-bg-elevated/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-yc-green-dark/30 flex items-center justify-center shrink-0">
            <Users size={18} className="text-yc-green" />
          </div>
          <div className="min-w-0">
            <p className="text-yc-text-primary font-medium text-sm truncate">
              {pool.name}
              {isCreator && <Crown size={12} className="inline ml-1.5 text-yc-warning" />}
            </p>
            <p className="text-yc-text-tertiary text-xs">
              {pool.competition_id} · {pool.member_count ?? 0} {t("pools.members")}
            </p>
          </div>
        </div>
        <span className="font-mono text-xs text-yc-text-tertiary">{pool.join_code}</span>
      </button>

      {expanded && (
        <div className="border-t border-yc-border p-4 space-y-3">
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-yc-text-secondary hover:text-yc-text-primary transition-colors"
            >
              {copied ? <Check size={12} className="text-yc-green" /> : <Copy size={12} />}
              {copied ? t("predictions.copied") : t("pools.copyLink")}
            </button>
            <NavLink
              to={`/${pool.competition_id}/leaderboard`}
              className="flex items-center gap-1.5 text-xs text-yc-green hover:underline"
            >
              {t("pools.viewLeaderboard")}
            </NavLink>
            {!isCreator && (
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex items-center gap-1.5 text-xs text-yc-danger hover:underline ml-auto"
              >
                {leaving ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                {t("pools.leave")}
              </button>
            )}
          </div>

          {/* Members */}
          {membersLoading ? (
            <div className="h-8 bg-yc-bg-elevated rounded animate-pulse" />
          ) : (
            <>
              <div className="space-y-1">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-2 py-1">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-yc-bg-elevated flex items-center justify-center text-[10px] font-bold text-yc-text-secondary">
                        {(m.handle ?? "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-yc-text-secondary text-sm">
                      {m.display_name ?? m.handle}
                    </span>
                    {m.user_id === pool.created_by && (
                      <Crown size={10} className="text-yc-warning" />
                    )}
                  </div>
                ))}
              </div>
              {/* Pool activity feed */}
              <div className="pt-2 border-t border-yc-border/50">
                <PoolActivityFeed members={members} competitionId={pool.competition_id} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function PoolsPage() {
  const { user, loading: authLoading } = useAuth();
  const comp = useCompetition();
  const { t } = useI18n();
  const { pools, loading, refresh } = useMyPools();

  // Filter pools by current competition
  const compPools = pools.filter((p) => p.competition_id === comp.id);

  if (authLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-yc-green border-t-transparent animate-spin mx-auto" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <Users size={48} className="text-yc-text-tertiary mx-auto mb-4" />
        <h2 className="font-heading text-2xl font-bold mb-2">{t("pools.signInTitle")}</h2>
        <p className="text-yc-text-secondary text-sm mb-6">{t("pools.signInDesc")}</p>
        <NavLink
          to="/sign-in"
          className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 transition-all"
        >
          {t("nav.signIn")}
        </NavLink>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <p className="text-yc-text-secondary text-sm mb-4">{t("pools.subtitle")}</p>

      <div className="space-y-4">
        {/* Create + Join forms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CreatePoolForm
            competitionId={comp.id}
            userId={user.id}
            onCreated={refresh}
          />
          <JoinPoolForm userId={user.id} onJoined={refresh} />
        </div>

        {/* My pools */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-16 bg-yc-bg-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : compPools.length === 0 ? (
          <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-8 text-center">
            <Users size={36} className="text-yc-text-tertiary mx-auto mb-3" />
            <p className="text-yc-text-secondary text-sm">{t("pools.empty")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-yc-text-secondary text-sm font-medium">
              {t("pools.myPools")} ({compPools.length})
            </h3>
            {compPools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} userId={user.id} onLeft={refresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
