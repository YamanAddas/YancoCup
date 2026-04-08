import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { LogIn, UserPlus, Loader2 } from "lucide-react";

type Mode = "sign-in" | "sign-up";

export default function SignInPage() {
  const { user, signIn, signUp } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already signed in
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let err: string | null;
    if (mode === "sign-in") {
      err = await signIn(email, password);
    } else {
      if (!handle.trim()) {
        setError(t("auth.handleRequired"));
        setSubmitting(false);
        return;
      }
      err = await signUp(email, password, handle.trim());
    }

    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <h1 className="font-heading text-3xl font-bold mb-2">
          {mode === "sign-in" ? t("auth.welcomeBack") : t("auth.joinTitle")}
        </h1>
        <p className="text-yc-text-secondary text-sm">
          {mode === "sign-in" ? t("auth.signInDesc") : t("auth.signUpDesc")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "sign-up" && (
          <div>
            <label className="block text-yc-text-tertiary text-xs uppercase tracking-widest mb-1.5">
              {t("auth.handle")}
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="your_handle"
              required
              className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-4 py-3 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green-muted transition-colors"
            />
          </div>
        )}

        <div>
          <label className="block text-yc-text-tertiary text-xs uppercase tracking-widest mb-1.5">
            {t("auth.email")}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-4 py-3 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green-muted transition-colors"
          />
        </div>

        <div>
          <label className="block text-yc-text-tertiary text-xs uppercase tracking-widest mb-1.5">
            {t("auth.password")}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-4 py-3 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary focus:outline-none focus:border-yc-green-muted transition-colors"
          />
        </div>

        {error && (
          <p className="text-yc-danger text-sm bg-yc-danger/10 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-yc-green text-yc-bg-deep font-semibold px-6 py-3 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : mode === "sign-in" ? (
            <LogIn size={18} />
          ) : (
            <UserPlus size={18} />
          )}
          {mode === "sign-in" ? t("nav.signIn") : t("auth.createAccount")}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
          }}
          className="text-yc-text-secondary text-sm hover:text-yc-green transition-colors"
        >
          {mode === "sign-in" ? t("auth.noAccount") : t("auth.hasAccount")}
        </button>
      </div>

      <p className="mt-8 text-center text-yc-text-tertiary text-xs">
        {t("auth.unified")}
      </p>
    </div>
  );
}
