import { useState } from "react";
import { ThumbsUp, Reply, MoreHorizontal, Pencil, Trash2, Flag, Clock } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { useI18n } from "../../lib/i18n";
import type { Comment } from "../../hooks/useArticleComments";

interface CommentCardProps {
  comment: Comment;
  onVote: (commentId: string) => void;
  onReply: (commentId: string) => void;
  onEdit: (commentId: string, body: string) => Promise<string | null>;
  onDelete: (commentId: string) => Promise<string | null>;
  onReport: (commentId: string, reason: string) => Promise<string | null>;
  isReply?: boolean;
}

const REPORT_REASONS = ["spam", "abuse", "off-topic", "harassment"] as const;

export default function CommentCard({
  comment,
  onVote,
  onReply,
  onEdit,
  onDelete,
  onReport,
  isReply = false,
}: CommentCardProps) {
  const { user } = useAuth();
  const { t, relTime } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [showReport, setShowReport] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const isOwner = user?.id === comment.user_id;
  const displayName = comment.display_name ?? comment.handle ?? "unknown";

  const handleEdit = async () => {
    const err = await onEdit(comment.id, editBody);
    if (!err) setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(t("comments.confirmDelete"))) return;
    await onDelete(comment.id);
  };

  const handleReport = async (reason: string) => {
    const err = await onReport(comment.id, reason);
    if (!err) {
      setReportSent(true);
      setShowReport(false);
    }
  };

  return (
    <div className={`flex gap-3 ${isReply ? "ms-8 sm:ms-11" : ""}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 pt-0.5">
        {comment.avatar_url ? (
          <img
            src={comment.avatar_url}
            alt=""
            className={`rounded-full border border-yc-border ${isReply ? "w-6 h-6" : "w-8 h-8"}`}
          />
        ) : (
          <div className={`rounded-full bg-yc-bg-elevated flex items-center justify-center text-xs font-bold text-yc-text-secondary border border-yc-border ${isReply ? "w-6 h-6 text-[10px]" : "w-8 h-8"}`}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-medium text-yc-text-primary ${isReply ? "text-xs" : "text-sm"}`}>
            {displayName}
          </span>
          {isOwner && (
            <span className="text-[9px] uppercase tracking-wider text-yc-green bg-yc-green/10 px-1.5 py-0.5 rounded-full">
              {t("comments.you")}
            </span>
          )}
          {comment.is_edited && (
            <span className="text-[10px] text-yc-text-tertiary italic">
              ({t("comments.edited")})
            </span>
          )}
          <span className="flex items-center gap-0.5 text-[10px] text-yc-text-tertiary ml-auto">
            <Clock size={10} />
            {relTime(comment.created_at)}
          </span>
        </div>

        {/* Body */}
        {editing ? (
          <div className="mt-1">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              maxLength={1000}
              rows={2}
              className="w-full bg-yc-bg-elevated border border-yc-border rounded-lg px-3 py-2 text-sm text-yc-text-primary resize-none focus:outline-none focus:border-yc-green-muted"
              autoFocus
            />
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleEdit}
                disabled={!editBody.trim()}
                className="text-xs text-yc-green hover:underline disabled:opacity-30"
              >
                {t("comments.save")}
              </button>
              <button
                onClick={() => { setEditing(false); setEditBody(comment.body); }}
                className="text-xs text-yc-text-secondary hover:underline"
              >
                {t("comments.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <p className={`text-yc-text-secondary leading-relaxed mt-1 whitespace-pre-line break-words ${isReply ? "text-xs" : "text-sm"}`}>
            {comment.body}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          {/* Upvote */}
          <button
            onClick={() => onVote(comment.id)}
            disabled={!user}
            className={`flex items-center gap-1 text-xs transition-colors ${
              comment.voted
                ? "text-yc-green"
                : "text-yc-text-tertiary hover:text-yc-green"
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <ThumbsUp size={12} fill={comment.voted ? "currentColor" : "none"} />
            {comment.upvotes > 0 && <span>{comment.upvotes}</span>}
          </button>

          {/* Reply (only on top-level) */}
          {!isReply && user && (
            <button
              onClick={() => onReply(comment.id)}
              className="flex items-center gap-1 text-xs text-yc-text-tertiary hover:text-yc-text-primary transition-colors"
            >
              <Reply size={12} />
              {t("comments.reply")}
            </button>
          )}

          {/* More menu */}
          {user && (
            <div className="relative ml-auto">
              <button
                onClick={() => { setShowMenu(!showMenu); setShowReport(false); }}
                className="text-yc-text-tertiary hover:text-yc-text-secondary transition-colors p-2 min-h-11 min-w-11 flex items-center justify-center"
              >
                <MoreHorizontal size={14} />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-6 z-20 bg-yc-bg-surface border border-yc-border rounded-lg shadow-xl py-1 min-w-[140px]">
                  {isOwner && (
                    <>
                      <button
                        onClick={() => { setEditing(true); setShowMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-yc-text-secondary hover:text-yc-text-primary hover:bg-white/[0.03] transition-colors"
                      >
                        <Pencil size={12} /> {t("comments.edit")}
                      </button>
                      <button
                        onClick={() => { handleDelete(); setShowMenu(false); }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-yc-danger hover:bg-white/[0.03] transition-colors"
                      >
                        <Trash2 size={12} /> {t("comments.delete")}
                      </button>
                    </>
                  )}
                  {!isOwner && !reportSent && (
                    <button
                      onClick={() => setShowReport(!showReport)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-yc-text-secondary hover:text-yc-danger hover:bg-white/[0.03] transition-colors"
                    >
                      <Flag size={12} /> {t("comments.report")}
                    </button>
                  )}
                  {reportSent && (
                    <span className="px-3 py-1.5 text-xs text-yc-text-tertiary">{t("comments.reported")}</span>
                  )}
                </div>
              )}

              {/* Report reasons dropdown */}
              {showReport && (
                <div className="absolute right-0 top-12 z-20 bg-yc-bg-surface border border-yc-border rounded-lg shadow-xl py-1 min-w-[140px]">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => { handleReport(reason); setShowMenu(false); }}
                      className="block w-full text-start px-3 py-1.5 text-xs text-yc-text-secondary hover:text-yc-text-primary hover:bg-white/[0.03] transition-colors capitalize"
                    >
                      {t(`comments.reason_${reason}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
