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
  renamePool,
  removeMember,
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
  MessageCircle,
  Pencil,
  UserMinus,
  UserPlus,
  Target,
  Trophy,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import PoolChat from "../components/pool/PoolChat";
import PoolRecap from "../components/pool/PoolRecap";
import { CornerAccent } from "../components/ui/ArabesquePatterns";

function PoolExplainer({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(!compact);

  const steps = [
    { icon: UserPlus, title: t("pools.step1Title"), desc: t("pools.step1Desc") },
    { icon: Target, title: t("pools.step2Title"), desc: t("pools.step2Desc") },
    { icon: Trophy, title: t("pools.step3Title"), desc: t("pools.step3Desc") },
  ];

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <div
        className={`px-5 pt-5 ${compact ? "pb-0" : "pb-5"}`}
        onClick={compact ? () => setOpen(!open) : undefined}
        role={compact ? "button" : undefined}
        style={compact ? { cursor: "pointer" } : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-lg font-bold text-yc-text-primary mb-1">
              {t("pools.heroTitle")}
            </h3>
            <p className="text-yc-text-secondary text-sm leading-relaxed">
              {t("pools.heroDesc")}
            </p>
          </div>
          {compact && (
            <ChevronDown
              size={18}
              className={`text-yc-text-tertiary shrink-0 mt-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </div>

      {/* Steps — collapsible in compact mode */}
      {open && (
        <div className="px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex sm:flex-col items-start gap-3 sm:items-center sm:text-center bg-yc-bg-elevated/50 rounded-lg p-3 sm:p-4"
              >
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-yc-green-dark/30 flex items-center justify-center">
                    <step.icon size={18} className="text-yc-green" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yc-bg-surface border border-yc-border flex items-center justify-center text-[10px] font-bold text-yc-text-secondary">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <p className="text-yc-text-primary text-sm font-semibold mb-0.5">{step.title}</p>
                  <p className="text-yc-text-tertiary text-xs leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PoolActionCard({
  competitionId,
  userId,
  onCreated,
  onJoined,
}: {
  competitionId: string;
  userId: string;
  onCreated: () => void;
  onJoined: () => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"create" | "join">("create");

  // Create state
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdPool, setCreatedPool] = useState<Pool | null>(null);
  const [copied, setCopied] = useState(false);

  // Join state
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setCreateError(null);
    const { pool, error: err } = await createPool(competitionId, name, userId);
    setCreating(false);
    if (err) {
      setCreateError(err);
    } else if (pool) {
      setCreatedPool(pool);
      onCreated();
    }
  };

  const handleCopy = async (joinCode: string) => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}#/pool/${joinCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async () => {
    if (!code.trim()) return;
    setJoining(true);
    setJoinError(null);
    const { error: err } = await joinPoolByCode(code, userId);
    setJoining(false);
    if (err) {
      setJoinError(err);
    } else {
      setCode("");
      onJoined();
    }
  };

  // Success state after creating
  if (createdPool) {
    return (
      <div className="relative bg-yc-bg-surface border border-yc-green-muted/30 rounded-xl overflow-hidden">
        <CornerAccent position="top-right" className="text-yc-green/20" />
        <CornerAccent position="bottom-left" className="text-yc-green/20" />
        <div className="p-4 sm:p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-yc-green-dark/30 flex items-center justify-center mx-auto mb-3">
            <Check size={24} className="text-yc-green" />
          </div>
          <h4 className="font-heading text-lg font-bold mb-1">{createdPool.name}</h4>
          <p className="text-yc-text-secondary text-sm mb-4">{t("pools.shareCode")}</p>
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="font-mono text-2xl font-bold text-yc-green tracking-[0.2em]">
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
            onClick={() => { setCreatedPool(null); setName(""); }}
            className="text-yc-text-tertiary text-sm hover:text-yc-text-primary transition-colors"
          >
            {t("pools.done")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-yc-bg-surface border border-yc-border rounded-xl overflow-hidden">
      <CornerAccent position="top-right" className="text-yc-green/10" />

      {/* Toggle tabs */}
      <div className="flex border-b border-yc-border">
        <button
          onClick={() => setMode("create")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            mode === "create"
              ? "text-yc-green border-b-2 border-yc-green bg-yc-green-glow/30"
              : "text-yc-text-tertiary hover:text-yc-text-secondary"
          }`}
        >
          <Plus size={15} />
          {t("pools.create")}
        </button>
        <button
          onClick={() => setMode("join")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            mode === "join"
              ? "text-yc-green border-b-2 border-yc-green bg-yc-green-glow/30"
              : "text-yc-text-tertiary hover:text-yc-text-secondary"
          }`}
        >
          <JoinIcon size={15} />
          {t("pools.join")}
        </button>
      </div>

      {/* Content */}
      <div className="p-5">
        {mode === "create" ? (
          <div className="space-y-3">
            <label className="block text-xs text-yc-text-secondary font-medium uppercase tracking-wider">
              {t("pools.namePlaceholder")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="World Cup Squad"
              maxLength={50}
              className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-4 py-3 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green-muted/60 focus:ring-1 focus:ring-yc-green-muted/20 transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="w-full flex items-center justify-center gap-2 bg-yc-green text-yc-bg-deep font-semibold py-3 rounded-lg text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {t("pools.createBtn")}
            </button>
            {createError && <p className="text-yc-danger text-xs text-center">{createError}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs text-yc-text-secondary font-medium uppercase tracking-wider">
              {t("pools.codePlaceholder")}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-4 py-3 text-center text-lg text-yc-text-primary font-mono uppercase tracking-[0.3em] placeholder:text-yc-text-tertiary placeholder:tracking-[0.3em] focus:outline-none focus:border-yc-green-muted/60 focus:ring-1 focus:ring-yc-green-muted/20 transition-colors"
            />
            <button
              onClick={handleJoin}
              disabled={joining || code.trim().length !== 6}
              className="w-full flex items-center justify-center gap-2 border border-yc-green text-yc-green font-semibold py-3 rounded-lg text-sm hover:bg-yc-green hover:text-yc-bg-deep active:scale-[0.98] transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-yc-green"
            >
              {joining ? <Loader2 size={16} className="animate-spin" /> : <JoinIcon size={16} />}
              {t("pools.joinBtn")}
            </button>
            {joinError && <p className="text-yc-danger text-xs text-center">{joinError}</p>}
          </div>
        )}
      </div>
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
  const { t } = useI18n();
  const [predictions, setPredictions] = useState<PoolPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (members.length === 0) { setLoading(false); return; }
      try {
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
      } catch {
        setError("Could not load activity");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [members, competitionId]);

  if (loading) return <div className="h-12 bg-yc-bg-elevated rounded animate-pulse" />;
  if (error) return <p className="text-center text-sm text-yc-danger py-4">{error}</p>;
  if (predictions.length === 0) return <p className="text-xs text-yc-text-tertiary">{t("pools.noPredictions")}</p>;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-yc-text-tertiary mb-1">
        <Activity size={10} />
        {t("pools.recentActivity")}
      </div>
      {predictions.map((p, i) => {
        const ago = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
        const timeLabel = ago < 60 ? `${ago}m` : ago < 1440 ? `${Math.floor(ago / 60)}h` : `${Math.floor(ago / 1440)}d`;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-yc-text-primary font-medium truncate max-w-[80px]">
              {p.display_name ?? p.handle}
            </span>
            <span className="text-yc-text-tertiary">{t("pools.predicted")}</span>
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
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(pool.name);
  const [removingId, setRemovingId] = useState<string | null>(null);
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

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === pool.name) {
      setRenaming(false);
      return;
    }
    await renamePool(pool.id, newName);
    pool.name = newName.trim();
    setRenaming(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    await removeMember(pool.id, memberId);
    setRemovingId(null);
    onLeft(); // refresh pools to update member count
  };

  const isCreator = pool.created_by === userId;

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-start hover:bg-yc-bg-elevated/30 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-yc-green-dark/30 flex items-center justify-center shrink-0">
            <Users size={18} className="text-yc-green" />
          </div>
          <div className="min-w-0">
            <p className="text-yc-text-primary font-medium text-sm truncate">
              {pool.name}
              {isCreator && <Crown size={12} className="inline ms-1.5 text-yc-warning" />}
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
            {isCreator && (
              <button
                onClick={() => setRenaming(!renaming)}
                className="flex items-center gap-1.5 text-xs text-yc-text-secondary hover:text-yc-text-primary transition-colors"
              >
                <Pencil size={12} />
                {t("pools.rename")}
              </button>
            )}
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

          {/* Rename form (creator only) */}
          {renaming && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={50}
                className="flex-1 bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-1.5 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted"
              />
              <button
                onClick={handleRename}
                disabled={!newName.trim()}
                className="px-3 py-1.5 rounded-lg bg-yc-green text-yc-bg-deep text-xs font-semibold hover:brightness-110 disabled:opacity-40"
              >
                {t("pools.save")}
              </button>
            </div>
          )}

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
                    <span className="text-yc-text-secondary text-sm flex-1">
                      {m.display_name ?? m.handle}
                    </span>
                    {m.user_id === pool.created_by && (
                      <Crown size={10} className="text-yc-warning" />
                    )}
                    {isCreator && m.user_id !== userId && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        disabled={removingId === m.user_id}
                        className="text-yc-text-tertiary hover:text-yc-danger transition-colors p-0.5"
                        title={t("pools.removeMember")}
                      >
                        {removingId === m.user_id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserMinus size={12} />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {/* Pool activity feed */}
              <div className="pt-2 border-t border-yc-border/50">
                <PoolActivityFeed members={members} competitionId={pool.competition_id} />
              </div>

              {/* Pool chat */}
              <div className="pt-2 border-t border-yc-border/50">
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="flex items-center gap-1.5 text-xs text-yc-text-secondary hover:text-yc-green transition-colors mb-2"
                >
                  <MessageCircle size={12} />
                  {t("chat.title")}
                </button>
                {chatOpen && <PoolChat poolId={pool.id} />}
              </div>

              {/* Pool matchday recap */}
              <div className="pt-2 border-t border-yc-border/50">
                <PoolRecap poolId={pool.id} competitionId={pool.competition_id} members={members} />
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
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <PoolExplainer />
        <div className="text-center">
          <p className="text-yc-text-secondary text-sm mb-4">{t("pools.signInDesc")}</p>
          <NavLink
            to="/sign-in"
            className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 transition-all"
          >
            {t("nav.signIn")}
          </NavLink>
        </div>
      </div>
    );
  }

  const hasPools = !loading && compPools.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="space-y-4">
        {/* Explainer — full when no pools, compact/collapsible when user has pools */}
        <PoolExplainer compact={hasPools} />

        {/* Create / Join */}
        <PoolActionCard
          competitionId={comp.id}
          userId={user.id}
          onCreated={refresh}
          onJoined={refresh}
        />

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
