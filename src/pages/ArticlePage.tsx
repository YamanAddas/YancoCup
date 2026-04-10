import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ExternalLink, Clock, Star, Languages, Newspaper } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { fetchArticle, translateArticleOnDemand, type NewsArticle } from "../lib/api";

const LANG_NAMES: Record<string, string> = {
  en: "English", ar: "العربية", es: "Español",
  de: "Deutsch", it: "Italiano", fr: "Français", pt: "Português",
};

// timeAgo removed — use relTime from useI18n() instead

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang, relTime } = useI18n();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchArticle(slug, lang)
      .then((a) => setArticle(a))
      .finally(() => setLoading(false));
  }, [slug, lang]);

  const handleTranslate = async () => {
    if (!article || !slug) return;
    setTranslating(true);
    const result = await translateArticleOnDemand(slug, lang);
    if (result) {
      setArticle({ ...article, title: result.title, summary: result.summary, translated: true });
    }
    setTranslating(false);
  };

  const needsTranslation = article && !article.translated && article.original_language !== lang;

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

      {/* Translate button */}
      {needsTranslation && (
        <button
          onClick={handleTranslate}
          disabled={translating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yc-bg-elevated border border-yc-border text-sm text-yc-info hover:border-yc-green-muted hover:text-yc-green transition-colors disabled:opacity-50"
        >
          <Languages size={16} />
          {translating ? t("news.translating") : t("news.translate")}
        </button>
      )}

      {/* Summary */}
      <div className="yc-card p-6">
        <p className="text-yc-text-primary leading-relaxed text-base whitespace-pre-line">
          {article.summary}
        </p>
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

      {/* Attribution */}
      <p className="text-[11px] text-yc-text-tertiary">
        {t("news.attribution")}
      </p>
    </div>
  );
}
