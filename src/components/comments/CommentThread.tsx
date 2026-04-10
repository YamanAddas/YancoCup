import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import CommentCard from "./CommentCard";
import CommentComposer from "./CommentComposer";
import type { Comment } from "../../hooks/useArticleComments";

interface CommentThreadProps {
  comment: Comment;
  onVote: (commentId: string) => void;
  onPost: (body: string, parentId: string | null) => Promise<string | null>;
  onEdit: (commentId: string, body: string) => Promise<string | null>;
  onDelete: (commentId: string) => Promise<string | null>;
  onReport: (commentId: string, reason: string) => Promise<string | null>;
  replyPreviewCount: number;
}

export default function CommentThread({
  comment,
  onVote,
  onPost,
  onEdit,
  onDelete,
  onReport,
  replyPreviewCount,
}: CommentThreadProps) {
  const { t } = useI18n();
  const [replyOpen, setReplyOpen] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);

  const replies = comment.replies ?? [];
  const hiddenCount = replies.length - replyPreviewCount;
  const visibleReplies = showAllReplies ? replies : replies.slice(0, replyPreviewCount);

  const handleReply = async (body: string) => {
    const err = await onPost(body, comment.id);
    if (!err) setReplyOpen(false);
    return err;
  };

  return (
    <div className="space-y-3">
      {/* Main comment */}
      <CommentCard
        comment={comment}
        onVote={onVote}
        onReply={() => setReplyOpen(!replyOpen)}
        onEdit={onEdit}
        onDelete={onDelete}
        onReport={onReport}
      />

      {/* Reply composer */}
      {replyOpen && (
        <div className="ml-8 sm:ml-11">
          <CommentComposer
            onSubmit={handleReply}
            placeholder={t("comments.replyPlaceholder")}
            compact
            autoFocus
            onCancel={() => setReplyOpen(false)}
          />
        </div>
      )}

      {/* Show more replies button */}
      {!showAllReplies && hiddenCount > 0 && (
        <button
          onClick={() => setShowAllReplies(true)}
          className="ml-8 sm:ml-11 flex items-center gap-1 text-xs text-yc-green hover:underline"
        >
          <ChevronDown size={12} />
          {t("comments.showReplies", { count: String(hiddenCount) })}
        </button>
      )}

      {/* Replies */}
      {visibleReplies.map((reply) => (
        <CommentCard
          key={reply.id}
          comment={reply}
          onVote={onVote}
          onReply={() => {}}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          isReply
        />
      ))}
    </div>
  );
}
