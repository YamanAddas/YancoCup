import { MessageCircle, ArrowUpDown } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useArticleComments } from "../../hooks/useArticleComments";
import CommentComposer from "./CommentComposer";
import CommentThread from "./CommentThread";

interface CommentsSectionProps {
  articleSlug: string;
}

export default function CommentsSection({ articleSlug }: CommentsSectionProps) {
  const { t } = useI18n();
  const {
    comments,
    loading,
    total,
    hasMore,
    sort,
    setSort,
    postComment,
    toggleVote,
    editComment,
    deleteComment,
    reportComment,
    loadMore,
    replyPreviewCount,
  } = useArticleComments(articleSlug);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-yc-green" />
          <h3 className="font-heading font-bold text-yc-text-primary">
            {t("comments.title")}
          </h3>
          {total > 0 && (
            <span className="text-xs text-yc-text-tertiary bg-yc-bg-elevated px-2 py-0.5 rounded-full">
              {total}
            </span>
          )}
        </div>

        {/* Sort */}
        {comments.length > 1 && (
          <div className="flex items-center gap-1">
            <ArrowUpDown size={12} className="text-yc-text-tertiary" />
            {(["newest", "top", "oldest"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded transition-colors ${
                  sort === s
                    ? "text-yc-green bg-yc-green/10"
                    : "text-yc-text-tertiary hover:text-yc-text-secondary"
                }`}
              >
                {t(`comments.sort_${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <CommentComposer
        onSubmit={(body) => postComment(body, null)}
      />

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-yc-bg-elevated flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-yc-bg-elevated rounded w-24" />
                <div className="h-3 bg-yc-bg-elevated rounded w-full" />
                <div className="h-3 bg-yc-bg-elevated rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageCircle size={28} className="text-yc-text-tertiary mx-auto mb-2" />
          <p className="text-sm text-yc-text-secondary">{t("comments.empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="yc-card p-4"
            >
              <CommentThread
                comment={comment}
                onVote={toggleVote}
                onPost={postComment}
                onEdit={editComment}
                onDelete={deleteComment}
                onReport={reportComment}
                replyPreviewCount={replyPreviewCount}
              />
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="text-sm text-yc-green hover:underline"
          >
            {t("comments.loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
