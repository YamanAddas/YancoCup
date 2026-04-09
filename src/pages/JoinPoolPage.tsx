import { useState, useEffect } from "react";
import { useParams, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { joinPoolByCode } from "../hooks/usePools";
import { Users, Check, AlertCircle, Loader2 } from "lucide-react";

export default function JoinPoolPage() {
  const { joinCode } = useParams<{ joinCode: string }>();
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [poolName, setPoolName] = useState("");
  const [poolCompetition, setPoolCompetition] = useState("WC");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || !joinCode) {
      setStatus("error");
      setErrorMsg("Sign in to join a pool.");
      return;
    }

    joinPoolByCode(joinCode, user.id).then(({ pool, error }) => {
      if (error || !pool) {
        setStatus("error");
        setErrorMsg(error ?? "Pool not found.");
      } else {
        setStatus("success");
        setPoolName(pool.name);
        setPoolCompetition(pool.competition_id);
      }
    });
  }, [user, joinCode, authLoading]);

  if (authLoading || status === "loading") {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <Loader2 size={32} className="text-yc-green animate-spin mx-auto mb-4" />
        <p className="text-yc-text-secondary text-sm">{t("pools.joining")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Users size={48} className="text-yc-text-tertiary mx-auto mb-4" />
        <h2 className="font-heading text-xl font-bold mb-2">{t("pools.signInTitle")}</h2>
        <p className="text-yc-text-secondary text-sm mb-6">{t("pools.signInToJoin")}</p>
        <NavLink
          to="/sign-in"
          className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 transition-all"
        >
          {t("nav.signIn")}
        </NavLink>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle size={48} className="text-yc-danger mx-auto mb-4" />
        <h2 className="font-heading text-xl font-bold mb-2">{t("pools.joinError")}</h2>
        <p className="text-yc-text-secondary text-sm mb-6">{errorMsg}</p>
        <NavLink
          to="/"
          className="text-yc-green text-sm hover:underline"
        >
          {t("notFound.goHome")}
        </NavLink>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <Check size={48} className="text-yc-green mx-auto mb-4" />
      <h2 className="font-heading text-xl font-bold mb-2">{t("pools.joined")}</h2>
      <p className="text-yc-text-secondary text-sm mb-6">
        {poolName}
      </p>
      <button
        onClick={() => navigate(`/${poolCompetition}/predictions`)}
        className="inline-flex items-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 transition-all"
      >
        {t("pools.startPredicting")}
      </button>
    </div>
  );
}
