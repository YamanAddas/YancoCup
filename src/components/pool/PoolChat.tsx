import { useState, useRef, useEffect } from "react";
import { usePoolChat } from "../../hooks/usePoolChat";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import { Send, Loader2, ChevronUp } from "lucide-react";

export default function PoolChat({ poolId }: { poolId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { messages, loading, hasMore, loadMore, sendMessage } = usePoolChat(poolId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLenRef.current = messages.length;
  }, [messages.length]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;
    const text = draft;
    setDraft("");
    setSending(true);
    await sendMessage(text);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col">
      {/* Message area */}
      <div
        ref={containerRef}
        className="max-h-64 overflow-y-auto space-y-2 mb-3 scrollbar-thin"
      >
        {hasMore && (
          <button
            onClick={loadMore}
            className="flex items-center gap-1 text-xs text-yc-text-tertiary hover:text-yc-text-secondary mx-auto py-1"
          >
            <ChevronUp size={12} />
            {t("chat.loadMore")}
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin text-yc-text-tertiary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-yc-text-tertiary text-center py-4">
            {t("chat.empty")}
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.user_id === user.id;
            const time = new Date(msg.created_at).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                {!isOwn && (
                  msg.avatar_url ? (
                    <img
                      src={msg.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full shrink-0 mt-0.5"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-yc-bg-elevated flex items-center justify-center text-[10px] font-bold text-yc-text-secondary shrink-0 mt-0.5">
                      {(msg.handle ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )
                )}

                {/* Bubble */}
                <div
                  className={`max-w-[75%] rounded-xl px-3 py-1.5 text-sm ${
                    isOwn
                      ? "bg-yc-green-dark/40 text-yc-text-primary"
                      : "bg-yc-bg-elevated text-yc-text-primary"
                  }`}
                >
                  {!isOwn && (
                    <p className="text-[10px] font-medium text-yc-green-muted mb-0.5">
                      {msg.display_name ?? msg.handle}
                    </p>
                  )}
                  <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={`text-[9px] mt-0.5 ${
                      isOwn ? "text-yc-green-muted/60 text-right" : "text-yc-text-tertiary"
                    }`}
                  >
                    {time}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          maxLength={500}
          className="flex-1 bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted placeholder:text-yc-text-tertiary"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="p-2 rounded-lg bg-yc-green text-yc-bg-deep hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:hover:brightness-100"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
