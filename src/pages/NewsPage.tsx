import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Newspaper, Star, Globe, Clock, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { fetchNews, fetchCompetitionNews, type NewsArticle } from "../lib/api";
import { COMPETITIONS } from "../lib/competitions";

const PAGE_SIZE = 20;

const LANG_LABELS: Record<string, string> = {
  all: "All",
  en: "English",
  ar: "العربية",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  fr: "Français",
  pt: "Português",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NewsCard({ article }: { article: NewsArticle }) {
  return (
    <Link
      to={`/news/${article.slug}`}
      className="block group"
    >
      <div className="yc-card p-0 overflow-hidden transition-all hover:border-[var(--yc-border-accent-bright)]">
        {/* Image */}
        {article.image_url ? (
          <div className="h-40 overflow-hidden">
            <img
              src={article.image_url}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="h-40 bg-gradient-to-br from-yc-bg-elevated to-yc-bg-surface flex items-center justify-center">
            <Newspaper size={32} className="text-yc-text-tertiary" />
          </div>
        )}

        <div className="p-4 space-y-2">
          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            {article.is_featured && (
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-yc-green bg-[var(--yc-accent-dim)] px-2 py-0.5 rounded-full">
                <Star size={10} /> AI Summary
              </span>
            )}
            {article.competition_id && (
              <span className="text-[10px] uppercase tracking-wider text-yc-text-tertiary bg-yc-bg-elevated px-2 py-0.5 rounded-full">
                {article.competition_id}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wider text-yc-text-tertiary">
              {LANG_LABELS[article.language] ?? article.language}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-semibold text-yc-text-primary leading-snug line-clamp-2 group-hover:text-yc-green transition-colors">
            {article.title}
          </h3>

          {/* Summary */}
          <p className="text-sm text-yc-text-secondary leading-relaxed line-clamp-3">
            {article.summary}
          </p>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-yc-text-tertiary pt-1">
            <span>{article.source_name}</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {timeAgo(article.published_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function NewsPage() {
  const { competition } = useParams<{ competition?: string }>();
  const { t } = useI18n();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [langFilter, setLangFilter] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        lang: langFilter === "all" ? undefined : langFilter,
        featured: featuredOnly || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };

      const result = competition
        ? await fetchCompetitionNews(competition, filters)
        : await fetchNews(filters);

      setArticles(result.articles);
      setTotal(result.total);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [competition, langFilter, featuredOnly, page]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [langFilter, featuredOnly, competition]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const compName = competition ? COMPETITIONS[competition]?.name : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--yc-accent-dim)] flex items-center justify-center">
          <Newspaper size={20} className="text-yc-green" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-yc-text-primary font-heading">
            {compName ? `${compName} ${t("news.title")}` : t("news.title")}
          </h1>
          <p className="text-sm text-yc-text-secondary">{t("news.subtitle")}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Language filter */}
        <div className="flex items-center gap-1.5">
          <Globe size={14} className="text-yc-text-tertiary" />
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="bg-yc-bg-surface border border-yc-border rounded-lg px-3 py-1.5 text-sm text-yc-text-primary focus:outline-none focus:border-yc-green-muted"
          >
            {Object.entries(LANG_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Featured toggle */}
        <button
          onClick={() => setFeaturedOnly(!featuredOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
            featuredOnly
              ? "border-yc-green text-yc-green bg-[var(--yc-accent-dim)]"
              : "border-yc-border text-yc-text-secondary hover:border-yc-border-hover"
          }`}
        >
          <Star size={14} />
          AI Summaries
        </button>

        {/* Count */}
        <span className="text-xs text-yc-text-tertiary ml-auto">
          {total} {t("news.articles")}
        </span>
      </div>

      {/* Articles grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="yc-card p-0 overflow-hidden animate-pulse">
              <div className="h-40 bg-yc-bg-elevated" />
              <div className="p-4 space-y-3">
                <div className="h-3 bg-yc-bg-elevated rounded w-1/3" />
                <div className="h-4 bg-yc-bg-elevated rounded w-full" />
                <div className="h-4 bg-yc-bg-elevated rounded w-2/3" />
                <div className="h-3 bg-yc-bg-elevated rounded w-full" />
                <div className="h-3 bg-yc-bg-elevated rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper size={40} className="text-yc-text-tertiary mx-auto mb-3" />
          <p className="text-yc-text-secondary">{t("news.noArticles")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-yc-border text-yc-text-secondary hover:border-yc-border-hover disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} /> {t("news.prev")}
          </button>
          <span className="text-sm text-yc-text-tertiary">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-yc-border text-yc-text-secondary hover:border-yc-border-hover disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t("news.next")} <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Source attribution */}
      <div className="flex items-center justify-center gap-1 text-[11px] text-yc-text-tertiary pt-4">
        <ExternalLink size={11} />
        {t("news.attribution")}
      </div>
    </div>
  );
}
