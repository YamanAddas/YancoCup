import { useState, useRef } from "react";
import { Send } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";

interface CommentComposerProps {
  onSubmit: (body: string) => Promise<string | null>;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  compact?: boolean;
  onCancel?: () => void;
}

export default function CommentComposer({
  onSubmit,
  placeholder,
  maxLength = 1000,
  autoFocus = false,
  compact = false,
  onCancel,
}: CommentComposerProps) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    const err = await onSubmit(body);
    if (err) {
      setError(err);
    } else {
      setBody("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
    setSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && onCancel) {
      onCancel();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  if (!user) {
    return (
      <div className="yc-card p-4 text-center">
        <p className="text-sm text-yc-text-secondary">
          {t("comments.signInToComment")}
        </p>
      </div>
    );
  }

  return (
    <div className={`${compact ? "" : "yc-card p-4"}`}>
      <div className="flex gap-3">
        {!compact && (
          <div className="flex-shrink-0">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full border border-yc-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-yc-bg-elevated flex items-center justify-center text-xs font-bold text-yc-text-secondary border border-yc-border">
                {(profile?.handle ?? "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? t("comments.placeholder")}
            autoFocus={autoFocus}
            maxLength={maxLength}
            rows={compact ? 1 : 2}
            className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary placeholder:text-yc-text-tertiary resize-none focus:outline-none focus:border-yc-green-muted transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-[10px] ${body.length > maxLength * 0.9 ? "text-yc-danger" : "text-yc-text-tertiary"}`}>
              {body.length}/{maxLength}
            </span>
            <div className="flex items-center gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="text-xs text-yc-text-secondary hover:text-yc-text-primary transition-colors px-2 py-1"
                >
                  {t("comments.cancel")}
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!body.trim() || submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yc-green/10 text-yc-green border border-yc-green/20 hover:bg-yc-green/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={12} />
                {submitting ? t("comments.posting") : t("comments.post")}
              </button>
            </div>
          </div>
          {error && (
            <p className="text-xs text-yc-danger mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
