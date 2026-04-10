import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Clock, Star, Languages, Newspaper, Globe } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { fetchArticle, translateArticleOnDemand, type NewsArticle } from "../lib/api";
import CommentsSection from "../components/comments/CommentsSection";

const LANG_NAMES: Record<string, string> = {
  en: "English", ar: "العربية", es: "Español",
  de: "Deutsch", it: "Italiano", fr: "Français", pt: "Português",
};

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang, relTime } = useI18n();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setTranslateError(false);
    fetchArticle(slug, lang)
      .then((a) => setArticle(a))
      .finally(() => setLoading(false));
  }, [slug, lang]);

  // Show translate button when:
  // 1. Article is in a different language from user's language
  // 2. AND either: article has full_content that isn't translated yet, OR article isn't translated at all
  const isDifferentLang = article && article.original_language !== lang;
  const hasUntranslatedBody = isDifferentLang && article.has_full_content && !article.full_content;
  const notTranslatedAtAll = isDifferentLang && !article.translated;
  const showTranslateButton = hasUntranslatedBody || notTranslatedAtAll;

  async function handleTranslate() {
    if (!article || !slug) return;
    setTranslating(true);
    setTranslateError(false);
    try {
      const result = await translateArticleOnDemand(slug, lang);
      if (result) {
        setArticle({
          ...article,
          title: result.title,
          summary: result.summary,
          full_content: result.full_content,
          translated: true,
          // If full_content came back null despite existing, AI quota may be exhausted
          // Mark has_full_content false so button doesn't re-appear in a loop
          has_full_content: !!result.full_content,
        });
      } else {
        setTranslateError(true);
      }
    } catch {
      setTranslateError(true);
    } finally {
      setTranslating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse space-y-6">
        <div className="h-4 bg-yc-bg-elevated rounded w-24" />
        <div className="h-8 bg-yc-bg-elevated rounded w-full" />
        <div className="h-64 bg-yc-bg-elevated rounded-xl" />
        <div className="space-y-3">
          <div className="h-4 bg-yc-bg-elevated rounded w-full" />
          <div className="h-4 bg-yc-bg-elevated rounded w-5/6" />
          <div className="h-4 bg-yc-bg-elevated rounded w-4/6" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Newspaper size={48} className="text-yc-text-tertiary mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-yc-text-primary mb-2">
          {t("news.notFound")}
        </h2>
        <Link
          to="/news"
          className="text-yc-green hover:underline text-sm"
        >
          {t("news.backToNews")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back link */}
      <Link
        to="/news"
        className="inline-flex items-center gap-1.5 text-sm text-yc-text-secondary hover:text-yc-green transition-colors"
      >
        <ArrowLeft size={16} />
        {t("news.backToNews")}
      </Link>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {article.is_featured && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-yc-green bg-[var(--yc-accent-dim)] px-2 py-0.5 rounded-full">
            <Star size={10} /> AI Summary
          </span>
        )}
        {article.translated && (
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-yc-info bg-yc-bg-elevated px-2 py-0.5 rounded-full">
            <Languages size={10} />
            {t("news.translatedFrom")} {LANG_NAMES[article.original_language] ?? article.original_language}
          </span>
        )}
        {article.competition_id && (
          <span className="text-[10px] uppercase tracking-wider text-yc-text-tertiary bg-yc-bg-elevated px-2 py-0.5 rounded-full">
            {article.competition_id}
          </span>
        )}
        {article.team_tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] uppercase tracking-wider text-yc-text-tertiary bg-yc-bg-elevated px-2 py-0.5 rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Title */}
      <h1 className="text-2xl sm:text-3xl font-bold text-yc-text-primary font-heading leading-tight">
        {article.title}
      </h1>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-yc-text-secondary">
        <span>{article.source_name}</span>
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {relTime(article.published_at)}
        </span>
      </div>

      {/* Translate button — shown when article needs translation */}
      {showTranslateButton && (
        <button
          onClick={handleTranslate}
          disabled={translating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--yc-accent-dim)] border border-yc-green-muted text-sm text-yc-green hover:bg-yc-green/10 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          <Globe size={16} className={translating ? "animate-spin" : ""} />
          {translating ? t("news.translating") : t("news.translate")}
        </button>
      )}
      {translateError && (
        <p className="text-sm text-red-400">{t("news.translateError")}</p>
      )}

      {/* Image */}
      {article.image_url && (
        <div className="rounded-xl overflow-hidden">
          <img
            src={article.image_url}
            alt=""
            className="w-full max-h-96 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      {/* Article content */}
      <div className="yc-card p-6">
        {article.full_content ? (
          <div className="space-y-4">
            {/* AI Summary header */}
            {article.summary && (
              <div className="pb-3 mb-3 border-b border-yc-border/30">
                <p className="text-sm text-yc-text-secondary italic leading-relaxed">
                  {article.summary}
                </p>
              </div>
            )}
            {/* Full article text */}
            <div className="text-yc-text-primary leading-relaxed text-base whitespace-pre-line break-words">
              {article.full_content}
            </div>
          </div>
        ) : (
          <p className="text-yc-text-primary leading-relaxed text-base whitespace-pre-line break-words">
            {article.summary}
          </p>
        )}
      </div>

      {/* Source link */}
      <a
        href={article.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yc-bg-elevated border border-yc-border text-sm text-yc-text-primary hover:border-yc-green-muted hover:text-yc-green transition-colors"
      >
        <ExternalLink size={16} />
        {t("news.readOriginal")} — {article.source_name}
      </a>

      {/* Comments */}
      <CommentsSection articleSlug={article.slug} />

      {/* Attribution */}
      <p className="text-[11px] text-yc-text-tertiary">
        {t("news.attribution")}
      </p>
    </div>
  );
}
