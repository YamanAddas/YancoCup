import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement pure worker utility functions for testing
// ---------------------------------------------------------------------------

// ── safeParse ──

function safeParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// ── KV key helpers ──

function kvScores(comp: string): string {
  return `${comp}:scores`;
}
function kvStandings(comp: string): string {
  return `${comp}:standings`;
}
function kvMatch(id: number): string {
  return `match:${id}`;
}
function kvSchedule(comp: string): string {
  return `${comp}:schedule`;
}

// ── extractTag ──

function extractTag(html: string, tag: string): string | null {
  const openIdx = html.search(new RegExp(`<${tag}[\\s>]`, "i"));
  if (openIdx === -1) return null;
  const afterOpen = html.indexOf(">", openIdx);
  if (afterOpen === -1) return null;
  const closeIdx = html.lastIndexOf(`</${tag}>`) ?? html.lastIndexOf(`</${tag.toUpperCase()}>`);
  if (closeIdx === -1 || closeIdx <= afterOpen) return null;
  const content = html.slice(afterOpen + 1, closeIdx);
  return content.length > 100 ? content : null;
}

// ── applyTranslation ──

interface TranslationEntry {
  title: string;
  summary: string;
  full_content?: string;
}

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  ai_summary: string | null;
  full_content: string | null;
  scrape_failures: number;
  source_name: string;
  source_url: string;
  image_url: string | null;
  language: string;
  competition_id: string | null;
  team_tags: string[];
  is_featured: boolean;
  published_at: string;
  created_at: string;
  translations: Record<string, TranslationEntry> | null;
}

function applyTranslation(article: ArticleRow, targetLang: string): ArticleRow & { translated: boolean; original_language: string; has_full_content: boolean } {
  const original_language = article.language;
  const has_full_content = !!(article.full_content && article.full_content.trim().length > 0);
  if (article.language === targetLang) {
    return { ...article, translated: false, original_language, has_full_content };
  }
  const t = article.translations?.[targetLang];
  if (t) {
    return {
      ...article,
      title: t.title,
      summary: t.summary,
      full_content: t.full_content ?? null,
      translated: true,
      original_language,
      has_full_content,
    };
  }
  return { ...article, translated: false, original_language, has_full_content };
}

// ── sbHeaders ──

function sbHeaders(key: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("safeParse", () => {
  it("parses valid JSON", () => {
    expect(safeParse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON array", () => {
    expect(safeParse<number[]>("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("parses JSON string", () => {
    expect(safeParse<string>('"hello"')).toBe("hello");
  });

  it("returns null for invalid JSON", () => {
    expect(safeParse("{broken")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(safeParse("")).toBeNull();
  });

  it("returns null for undefined-like strings", () => {
    expect(safeParse("undefined")).toBeNull();
  });

  it("parses null literal", () => {
    expect(safeParse("null")).toBeNull();
  });

  it("parses numeric literal", () => {
    expect(safeParse<number>("42")).toBe(42);
  });
});

describe("KV key helpers", () => {
  it("kvScores formats correctly", () => {
    expect(kvScores("WC")).toBe("WC:scores");
    expect(kvScores("PL")).toBe("PL:scores");
  });

  it("kvStandings formats correctly", () => {
    expect(kvStandings("PD")).toBe("PD:standings");
  });

  it("kvMatch formats with numeric ID", () => {
    expect(kvMatch(12345)).toBe("match:12345");
    expect(kvMatch(0)).toBe("match:0");
  });

  it("kvSchedule formats correctly", () => {
    expect(kvSchedule("BL1")).toBe("BL1:schedule");
  });
});

describe("extractTag", () => {
  it("extracts content from an article tag", () => {
    const longContent = "A".repeat(150);
    const html = `<article>${longContent}</article>`;
    expect(extractTag(html, "article")).toBe(longContent);
  });

  it("returns null for missing tag", () => {
    expect(extractTag("<div>hello</div>", "article")).toBeNull();
  });

  it("returns null for content shorter than 100 chars", () => {
    expect(extractTag("<article>short</article>", "article")).toBeNull();
  });

  it("returns null for unclosed tag", () => {
    const longContent = "A".repeat(150);
    expect(extractTag(`<article>${longContent}`, "article")).toBeNull();
  });

  it("handles tags with attributes", () => {
    const longContent = "B".repeat(150);
    const html = `<article class="main" id="content">${longContent}</article>`;
    expect(extractTag(html, "article")).toBe(longContent);
  });

  it("is case-insensitive for opening tag", () => {
    const longContent = "C".repeat(150);
    const html = `<ARTICLE>${longContent}</article>`;
    expect(extractTag(html, "article")).toBe(longContent);
  });

  it("extracts from div tag", () => {
    const longContent = "D".repeat(150);
    const html = `<div class="body">${longContent}</div>`;
    expect(extractTag(html, "div")).toBe(longContent);
  });

  it("returns null when close tag comes before open tag content", () => {
    expect(extractTag("</article><article>short</article>", "article")).toBeNull();
  });
});

const baseArticle: ArticleRow = {
  id: "abc-123",
  slug: "test-article",
  title: "Original Title",
  summary: "Original summary",
  ai_summary: "AI generated summary",
  full_content: "Full article content here",
  scrape_failures: 0,
  source_name: "BBC Sport",
  source_url: "https://bbc.co.uk/sport/football/123",
  image_url: "https://example.com/img.jpg",
  language: "en",
  competition_id: "PL",
  team_tags: ["ARS", "CHE"],
  is_featured: false,
  published_at: "2026-04-10T12:00:00Z",
  created_at: "2026-04-10T12:05:00Z",
  translations: {
    ar: { title: "العنوان بالعربية", summary: "الملخص بالعربية", full_content: "المحتوى الكامل" },
    es: { title: "Título en español", summary: "Resumen en español" },
  },
};

describe("applyTranslation", () => {
  it("returns untranslated when target matches article language", () => {
    const result = applyTranslation(baseArticle, "en");
    expect(result.translated).toBe(false);
    expect(result.original_language).toBe("en");
    expect(result.title).toBe("Original Title");
    expect(result.summary).toBe("Original summary");
  });

  it("applies Arabic translation when available", () => {
    const result = applyTranslation(baseArticle, "ar");
    expect(result.translated).toBe(true);
    expect(result.original_language).toBe("en");
    expect(result.title).toBe("العنوان بالعربية");
    expect(result.summary).toBe("الملخص بالعربية");
    expect(result.full_content).toBe("المحتوى الكامل");
  });

  it("applies Spanish translation, null full_content when not in translation", () => {
    const result = applyTranslation(baseArticle, "es");
    expect(result.translated).toBe(true);
    expect(result.title).toBe("Título en español");
    expect(result.summary).toBe("Resumen en español");
    expect(result.full_content).toBeNull(); // Spanish translation has no full_content
  });

  it("returns untranslated when target language not available", () => {
    const result = applyTranslation(baseArticle, "de");
    expect(result.translated).toBe(false);
    expect(result.title).toBe("Original Title");
    expect(result.summary).toBe("Original summary");
  });

  it("handles null translations object", () => {
    const article = { ...baseArticle, translations: null };
    const result = applyTranslation(article, "ar");
    expect(result.translated).toBe(false);
    expect(result.title).toBe("Original Title");
  });

  it("sets has_full_content based on original article", () => {
    const result = applyTranslation(baseArticle, "en");
    expect(result.has_full_content).toBe(true);

    const noContent = { ...baseArticle, full_content: null };
    expect(applyTranslation(noContent, "en").has_full_content).toBe(false);

    const emptyContent = { ...baseArticle, full_content: "   " };
    expect(applyTranslation(emptyContent, "en").has_full_content).toBe(false);
  });

  it("preserves other fields when translating", () => {
    const result = applyTranslation(baseArticle, "ar");
    expect(result.id).toBe("abc-123");
    expect(result.slug).toBe("test-article");
    expect(result.source_name).toBe("BBC Sport");
    expect(result.team_tags).toEqual(["ARS", "CHE"]);
    expect(result.competition_id).toBe("PL");
  });
});

describe("sbHeaders", () => {
  it("returns correct headers with given key", () => {
    const headers = sbHeaders("my-api-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.apikey).toBe("my-api-key");
    expect(headers.Authorization).toBe("Bearer my-api-key");
  });

  it("handles empty key", () => {
    const headers = sbHeaders("");
    expect(headers.apikey).toBe("");
    expect(headers.Authorization).toBe("Bearer ");
  });
});
