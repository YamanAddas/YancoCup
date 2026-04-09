import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { calculatePoints } from "../lib/scoring";
import { fetchHealth } from "../lib/api";
import { Shield, RefreshCw, Loader2, Check, Activity, AlertTriangle } from "lucide-react";

const ADMIN_IDS = (import.meta.env.VITE_ADMIN_USER_ID ?? "").split(",").filter(Boolean);

type HealthData = NonNullable<Awaited<ReturnType<typeof fetchHealth>>>;

function DiagnosticsPanel() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHealth();
      if (data) setHealth(data);
      else setError("No response from worker");
    } catch {
      setError("Failed to reach worker");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pollAge = health?.lastPoll
    ? Math.round((Date.now() - new Date(health.lastPoll).getTime()) / 1000)
    : null;
  const pollHealthy = pollAge !== null && pollAge < 120;

  return (
    <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading text-base font-bold flex items-center gap-2">
          <Activity size={16} className="text-yc-green" />
          Worker Diagnostics
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="text-yc-text-tertiary hover:text-yc-green transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading && !health && (
        <div className="flex items-center gap-2 text-yc-text-tertiary text-sm py-4">
          <Loader2 size={14} className="animate-spin" />
          Checking worker health...
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm py-2">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {health && (
        <div className="space-y-3">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <span className="text-yc-text-tertiary text-sm">Status</span>
            <span className={`text-sm font-medium ${health.status === "ok" ? "text-yc-green" : "text-red-400"}`}>
              {health.status === "ok" ? "Healthy" : health.status}
            </span>
          </div>

          {/* Cron poll */}
          <div className="flex items-center justify-between">
            <span className="text-yc-text-tertiary text-sm">Last Cron Poll</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${pollHealthy ? "bg-yc-green" : "bg-red-400"}`} />
              <span className={`text-sm font-mono ${pollHealthy ? "text-yc-text-primary" : "text-red-400"}`}>
                {pollAge !== null ? (pollAge < 60 ? `${pollAge}s ago` : `${Math.round(pollAge / 60)}m ago`) : "never"}
              </span>
            </div>
          </div>

          {/* Tick count */}
          <div className="flex items-center justify-between">
            <span className="text-yc-text-tertiary text-sm">Cron Ticks</span>
            <span className="text-sm font-mono text-yc-text-primary">{health.tickCount.toLocaleString()}</span>
          </div>

          {/* Competitions */}
          <div className="flex items-center justify-between">
            <span className="text-yc-text-tertiary text-sm">Competitions</span>
            <span className="text-sm font-mono text-yc-text-primary">{health.competitions.length} active</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {health.competitions.map((comp) => (
              <span
                key={comp}
                className="text-xs font-mono bg-yc-bg-elevated border border-yc-border rounded px-2 py-0.5 text-yc-text-secondary"
              >
                {comp}
              </span>
            ))}
          </div>

          {/* Worker time */}
          <div className="flex items-center justify-between">
            <span className="text-yc-text-tertiary text-sm">Worker Time</span>
            <span className="text-sm font-mono text-yc-text-primary">
              {new Date(health.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Warning if cron is stale */}
          {!pollHealthy && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <span className="text-red-400 text-xs">
                Cron hasn't polled in over 2 minutes. Check Cloudflare Worker logs.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [matchId, setMatchId] = useState("");
  const [homeResult, setHomeResult] = useState("");
  const [awayResult, setAwayResult] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-yc-green border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user || !ADMIN_IDS.includes(user.id)) {
    return <Navigate to="/" replace />;
  }

  const handleRescore = async () => {
    const mid = parseInt(matchId, 10);
    const h = parseInt(homeResult, 10);
    const a = parseInt(awayResult, 10);

    if (isNaN(mid) || isNaN(h) || isNaN(a)) {
      setStatus("Invalid input");
      return;
    }

    setWorking(true);
    setStatus(null);

    // Fetch all predictions for this match
    const { data: predictions, error: fetchErr } = await supabase
      .from("yc_predictions")
      .select("id, user_id, home_score, away_score")
      .eq("match_id", mid);

    if (fetchErr || !predictions) {
      setStatus(`Error: ${fetchErr?.message ?? "No predictions found"}`);
      setWorking(false);
      return;
    }

    let scored = 0;
    for (const pred of predictions) {
      const { points } = calculatePoints({
        predictedHome: pred.home_score,
        predictedAway: pred.away_score,
        actualHome: h,
        actualAway: a,
      });

      const { error } = await supabase
        .from("yc_predictions")
        .update({
          points,
          scored_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", pred.id);

      if (!error) scored++;
    }

    setStatus(`Scored ${scored}/${predictions.length} predictions for match ${mid}`);
    setWorking(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={24} className="text-yc-green" />
        <h2 className="font-heading text-2xl font-bold">Admin</h2>
      </div>

      {/* Worker diagnostics */}
      <DiagnosticsPanel />

      {/* Manual re-score */}
      <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-5 mt-6">
        <h3 className="font-heading text-base font-bold mb-4">Re-score Match</h3>
        <p className="text-yc-text-secondary text-sm mb-4">
          Manually score or re-score all predictions for a specific match.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-yc-text-tertiary text-xs uppercase tracking-widest mb-1.5">
              Match ID
            </label>
            <input
              type="number"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              placeholder="API ID"
              className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted"
            />
          </div>
          <div>
            <label className="block text-yc-text-tertiary text-xs uppercase tracking-widest mb-1.5">
              Home Score
            </label>
            <input
              type="number"
              value={homeResult}
              onChange={(e) => setHomeResult(e.target.value)}
              placeholder="0"
              className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted"
            />
          </div>
          <div>
            <label className="block text-yc-text-tertiary text-xs uppercase tracking-widest mb-1.5">
              Away Score
            </label>
            <input
              type="number"
              value={awayResult}
              onChange={(e) => setAwayResult(e.target.value)}
              placeholder="0"
              className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted"
            />
          </div>
        </div>

        <button
          onClick={handleRescore}
          disabled={working || !matchId || !homeResult || !awayResult}
          className="flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-4 py-2 rounded-lg text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          {working ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Re-score
        </button>

        {status && (
          <p className="mt-3 text-sm flex items-center gap-2">
            <Check size={14} className="text-yc-green" />
            <span className="text-yc-text-secondary">{status}</span>
          </p>
        )}
      </div>
    </div>
  );
}
