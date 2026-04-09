import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { calculatePoints } from "../lib/scoring";
import { Shield, RefreshCw, Loader2, Check } from "lucide-react";

const ADMIN_IDS = (import.meta.env.VITE_ADMIN_USER_ID ?? "").split(",").filter(Boolean);

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

      {/* Manual re-score */}
      <div className="bg-yc-bg-surface border border-yc-border rounded-xl p-5">
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
              placeholder="1-104"
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
