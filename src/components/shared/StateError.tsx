import { RefreshCw, WifiOff } from "lucide-react";
import { useI18n } from "../../lib/i18n";

/**
 * Reusable error state: friendly message + retry button.
 * Drop into any data-fetching component when an API call fails.
 */
export default function StateError({
  onRetry,
  message,
  className = "",
}: {
  onRetry?: () => void;
  message?: string;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-12 h-12 rounded-full bg-yc-bg-elevated flex items-center justify-center mb-4">
        <WifiOff size={22} className="text-yc-text-tertiary" />
      </div>
      <p className="text-yc-text-secondary text-sm mb-1">
        {message ?? t("state.errorMessage")}
      </p>
      <p className="text-yc-text-tertiary text-xs mb-5">
        {t("state.errorHint")}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yc-bg-elevated border border-yc-border text-sm text-yc-text-primary hover:border-yc-green-muted/40 hover:text-yc-green transition-colors active:scale-[0.97]"
        >
          <RefreshCw size={14} />
          {t("state.retry")}
        </button>
      )}
    </div>
  );
}
