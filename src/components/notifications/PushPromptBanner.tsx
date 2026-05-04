import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useMyPredictions } from "../../hooks/usePredictions";
import { useI18n } from "../../lib/i18n";
import { requestNotificationPermission, subscribeToPush } from "../../lib/notifications";
import { WORKER_URL } from "../../lib/api";

const ASKED_KEY = "yc_push_asked";

/**
 * Contextual push-permission prompt. Stays hidden until the user has had at
 * least one prediction get scored — i.e. they've already lived through
 * a full match cycle. Never asks more than once: dismissal/grant/denial all
 * persist via localStorage so we don't nag.
 */
export default function PushPromptBanner() {
  const { user, session } = useAuth();
  const { predictions } = useMyPredictions("WC");
  const { t } = useI18n();
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Re-evaluate eligibility whenever predictions change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (window.localStorage.getItem(ASKED_KEY)) return;
    if (!user) return;
    setEligible(predictions.some((p) => p.scored_at !== null));
  }, [predictions, user]);

  if (!eligible || dismissed) return null;

  async function enable() {
    const granted = await requestNotificationPermission();
    if (granted && session?.access_token) {
      await subscribeToPush(WORKER_URL, session.access_token);
    }
    window.localStorage.setItem(ASKED_KEY, granted ? "granted" : "denied");
    setDismissed(true);
  }

  function dismiss() {
    window.localStorage.setItem(ASKED_KEY, "dismissed");
    setDismissed(true);
  }

  return (
    <div
      role="dialog"
      aria-label={t("push.promptTitle")}
      className="fixed bottom-20 sm:bottom-4 start-4 end-4 sm:start-auto sm:end-4 sm:max-w-sm z-40 yc-card p-4 rounded-xl border border-yc-green-muted/30 bg-yc-bg-surface/95 backdrop-blur shadow-2xl flex items-start gap-3"
    >
      <div className="w-10 h-10 rounded-full bg-yc-green/15 flex items-center justify-center shrink-0">
        <Bell size={18} className="text-yc-green" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-yc-text-primary mb-1">
          {t("push.promptTitle")}
        </p>
        <p className="text-xs text-yc-text-secondary mb-3">
          {t("push.promptDesc")}
        </p>
        <div className="flex gap-2">
          <button
            onClick={enable}
            className="px-3 py-1.5 bg-yc-green text-yc-bg-deep text-xs font-semibold rounded-lg hover:brightness-110 active:scale-[0.97] transition-all"
          >
            {t("push.enable")}
          </button>
          <button
            onClick={dismiss}
            className="px-3 py-1.5 text-xs text-yc-text-secondary hover:text-yc-text-primary transition-colors"
          >
            {t("push.notNow")}
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-yc-text-tertiary hover:text-yc-text-primary p-1 shrink-0"
        aria-label={t("push.notNow")}
      >
        <X size={14} />
      </button>
    </div>
  );
}
