import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Re-implement pure functions from worker/src/index.ts for isolated testing.
// Same pattern as transformMatch.test.ts — worker isn't modular yet.
// ---------------------------------------------------------------------------

// ── slugify ──

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/^-|-$/g, "");
}

// ── detectCompetition ──

function detectCompetition(text: string): string | null {
  const lower = text.toLowerCase();
  if (/world cup|copa del mundo|كأس العالم|coupe du monde|wm 2026|mondiale 2026|mundial 2026|copa do mundo|fifa 2026|host cit(y|ies).*2026|2026 world|world cup 2026|mondial 2026|weltmeisterschaft/.test(lower)) return "WC";
  if (/champions league|uefa cl|ligue des champions|liga de campeones|دوري أبطال|champions-league|ucl|\bchampions\b.*\bfinal\b/.test(lower)) return "CL";
  if (/premier league|epl|\bprem\b|الدوري الإنجليزي|プレミアリーグ|english top.?flight|top.?four race/.test(lower)) return "PL";
  if (/la\s?liga|liga española|الدوري الإسباني|laliga|primera divisi[oó]n|liga santander|liga ea sports/.test(lower)) return "PD";
  if (/bundesliga|الدوري الألماني|german league/.test(lower)) return "BL1";
  if (/\bserie a\b|الدوري الإيطالي|italian league|calcio serie/.test(lower)) return "SA";
  if (/ligue 1|الدوري الفرنسي|french league|ligue1/.test(lower)) return "FL1";
  if (/europa league|الدوري الأوروبي|ligue europa|uel\b/.test(lower)) return "EL";
  return null;
}

// ── SOURCE_COMPETITION_HINT ──

const SOURCE_COMPETITION_HINT: Record<string, string> = {
  "The Guardian PL": "PL",
  "The Guardian CL": "CL",
  "The Guardian EL": "EL",
  "The Guardian PD": "PD",
  "The Guardian BL1": "BL1",
  "The Guardian SA": "SA",
  "The Guardian FL1": "FL1",
  "The Guardian WC": "WC",
  "Marca": "PD",
  "AS": "PD",
  "Kicker": "BL1",
  "Gazzetta dello Sport": "SA",
  "L'Equipe": "FL1",
};

// ── detectTeamTags ──

const TEAM_NAMES: Array<{ tla: string; patterns: RegExp }> = [
  { tla: "RMA", patterns: /real madrid|ريال مدريد|los blancos|madridista|الملكي|مدريد/ },
  { tla: "BAR", patterns: /barcelona|برشلونة|barça|barca|blaugrana|البرسا|cules/ },
  { tla: "ATM", patterns: /atlético|atletico madrid|أتلتيكو|atleti|colchoneros/ },
  { tla: "LIV", patterns: /liverpool|ليفربول|the reds|أنفيلد|anfield/ },
  { tla: "MCI", patterns: /man(chester)? city|مان(شستر)? سيتي|citizens|السيتيزنز|etihad/ },
  { tla: "MUN", patterns: /man(chester)? united|مان(شستر)? يونايتد|red devils|الشياطين الحمر|old trafford/ },
  { tla: "CHE", patterns: /chelsea|تشيلسي|the blues|stamford bridge/ },
  { tla: "ARS", patterns: /arsenal|آرسنال|أرسنال|gunners|المدفعجية|emirates stadium/ },
  { tla: "BAY", patterns: /bayern|بايرن|die roten|fc bayern/ },
  { tla: "BVB", patterns: /dortmund|دورتموند|borussia dortmund|bvb/ },
  { tla: "JUV", patterns: /juventus|يوفنتوس|juve|bianconeri|la vecchia signora/ },
  { tla: "INT", patterns: /inter milan|إنتر ميلان|internazionale|nerazzurri|الإنتر/ },
  { tla: "PSG", patterns: /paris saint.germain|باريس سان جيرمان|psg|باريس/ },
  { tla: "BRA", patterns: /brazil|البرازيل|seleção|brasilien|brésil/ },
  { tla: "ARG", patterns: /argentina|الأرجنتين|albiceleste|argentinien/ },
  { tla: "FRA", patterns: /\bfrance\b|فرنسا|les bleus|frankreich|équipe de france/ },
  { tla: "GER", patterns: /\bgermany\b|ألمانيا|die mannschaft|deutschland/ },
  { tla: "ENG", patterns: /\bengland\b|إنجلترا|three lions|angleterr/ },
  { tla: "ESP", patterns: /\bspain\b|إسبانيا|la roja|spanien|espagne/ },
  { tla: "USA", patterns: /\busa\b|أمريكا|usmnt|united states|états.unis/ },
  { tla: "MAR", patterns: /morocco|المغرب|atlas lions|marokko|maroc/ },
  { tla: "EGY", patterns: /\begypt\b|مصر|pharaohs|الفراعنة/ },
  { tla: "KSA", patterns: /saudi arabia|السعودية|الأخضر/ },
];

function detectTeamTags(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const { tla, patterns } of TEAM_NAMES) {
    if (patterns.test(lower)) found.add(tla);
  }
  return [...found];
}

// ── isSimilarTitle ──

function isSimilarTitle(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((w) => w.length > 2);
  const wordsA = new Set(normalize(a));
  const wordsB = new Set(normalize(b));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 && intersection / union > 0.65;
}

// ── splitTextChunks ──

function splitTextChunks(text: string, maxLen: number): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if (current.length + p.length + 2 > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current += (current ? "\n\n" : "") + p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ── stripHtml ──

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .trim();
}

// ── extractParagraphs ──

function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    const text = stripHtml(match[1]!).trim();
    if (text.length < 40) continue;
    if (/^(import |require\(|function |var |const |let |window\.|document\.)/.test(text)) continue;
    if (/^(vor \d|il y a|hace \d|ago$|min\.$)/i.test(text)) continue;
    const letters = text.replace(/[^a-zA-ZÀ-ÿ\u0600-\u06FF]/g, "").length;
    if (letters < text.length * 0.4) continue;
    paragraphs.push(text);
  }
  return paragraphs;
}

// ── htmlToText ──

function htmlToText(html: string): string {
  let text = html.replace(/<(script|style|nav|aside|figure|figcaption|header|footer|button|form|iframe|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "");
  const paragraphs = extractParagraphs(text);
  if (paragraphs.length >= 2) {
    return paragraphs.join("\n\n");
  }
  text = stripHtml(text);
  text = text
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
  return text.length > 100 ? text : "";
}

// ── hasRepetitionOrHallucination ──

function hasRepetitionOrHallucination(text: string): boolean {
  const words = text.split(/\s+/);
  if (words.length >= 12) {
    const seen = new Map<string, number>();
    for (let i = 0; i <= words.length - 4; i++) {
      const phrase = words.slice(i, i + 4).join(" ").toLowerCase();
      const count = (seen.get(phrase) ?? 0) + 1;
      seen.set(phrase, count);
      if (count >= 3) return true;
    }
  }
  const lower = text.toLowerCase();
  if (/it is important to keep in mind/.test(lower)) return true;
  if (/the quality of the product/.test(lower)) return true;
  if (/as we can see/.test(lower)) return true;
  return false;
}

// ── validateTranslation ──

function validateTranslation(input: string, output: string): boolean {
  if (!output || !output.trim()) return false;
  const inLen = input.length;
  const outLen = output.length;
  if (inLen > 10 && outLen > inLen * 5) return false;
  if (inLen > 20 && outLen < inLen * 0.15) return false;
  return !hasRepetitionOrHallucination(output);
}

// ── validateSummary ──

function validateSummary(text: string): boolean {
  if (!text || text.trim().length < 50) return false;
  return !hasRepetitionOrHallucination(text);
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("slugify", () => {
  it("converts basic text to slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips special characters", () => {
    expect(slugify("Arsenal 2-1 Chelsea: Gunners win!")).toBe("arsenal-2-1-chelsea-gunners-win");
  });

  it("collapses multiple dashes", () => {
    expect(slugify("foo---bar")).toBe("foo-bar");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("truncates to 80 chars", () => {
    const long = "a ".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it("handles Arabic text (strips non-word chars, keeps digits)", () => {
    // \w in JS doesn't match Arabic — slugify strips them, keeping only digits
    expect(slugify("كأس العالم 2026")).toBe("2026");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

describe("detectCompetition", () => {
  // English
  it("detects World Cup (English)", () => {
    expect(detectCompetition("World Cup 2026 draw revealed")).toBe("WC");
  });

  it("detects Champions League (English)", () => {
    expect(detectCompetition("Champions League quarter-final draw")).toBe("CL");
  });

  it("detects UCL abbreviation", () => {
    expect(detectCompetition("UCL semi-final preview")).toBe("CL");
  });

  it("detects Premier League", () => {
    expect(detectCompetition("Premier League title race heats up")).toBe("PL");
  });

  it("detects EPL abbreviation", () => {
    expect(detectCompetition("EPL matchday 32 predictions")).toBe("PL");
  });

  it("detects La Liga", () => {
    expect(detectCompetition("La Liga standings after matchday 30")).toBe("PD");
  });

  it("detects Liga EA Sports", () => {
    expect(detectCompetition("Liga EA Sports roundup")).toBe("PD");
  });

  it("detects Bundesliga", () => {
    expect(detectCompetition("Bundesliga: Bayern top the table")).toBe("BL1");
  });

  it("detects Serie A", () => {
    expect(detectCompetition("Serie A title race between Inter and Napoli")).toBe("SA");
  });

  it("detects Ligue 1", () => {
    expect(detectCompetition("Ligue 1 preview: PSG vs Marseille")).toBe("FL1");
  });

  it("detects Europa League", () => {
    expect(detectCompetition("Europa League group stage results")).toBe("EL");
  });

  // Arabic
  it("detects World Cup (Arabic)", () => {
    expect(detectCompetition("كأس العالم 2026 في أمريكا")).toBe("WC");
  });

  it("detects Champions League (Arabic)", () => {
    expect(detectCompetition("دوري أبطال أوروبا نصف النهائي")).toBe("CL");
  });

  it("detects Premier League (Arabic)", () => {
    expect(detectCompetition("الدوري الإنجليزي الممتاز")).toBe("PL");
  });

  it("detects La Liga (Arabic)", () => {
    expect(detectCompetition("الدوري الإسباني ترتيب الفرق")).toBe("PD");
  });

  // Spanish
  it("detects Copa del Mundo", () => {
    expect(detectCompetition("Copa del Mundo 2026 sedes")).toBe("WC");
  });

  it("detects Primera División", () => {
    expect(detectCompetition("Primera División resultados")).toBe("PD");
  });

  // German
  it("detects WM 2026", () => {
    expect(detectCompetition("WM 2026 Qualifikation")).toBe("WC");
  });

  it("detects German League", () => {
    expect(detectCompetition("German League roundup")).toBe("BL1");
  });

  // French
  it("detects Coupe du Monde", () => {
    expect(detectCompetition("Coupe du Monde 2026 calendrier")).toBe("WC");
  });

  it("detects Ligue des Champions", () => {
    expect(detectCompetition("Ligue des Champions tirage")).toBe("CL");
  });

  // Portuguese
  it("detects Copa do Mundo", () => {
    expect(detectCompetition("Copa do Mundo 2026 grupos")).toBe("WC");
  });

  // Edge cases
  it("returns null for unrelated text", () => {
    expect(detectCompetition("Tennis results from Wimbledon")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectCompetition("")).toBeNull();
  });

  it("prioritizes WC over CL in mixed text", () => {
    // WC regex is checked first
    expect(detectCompetition("World Cup and Champions League news")).toBe("WC");
  });

  it("detects champions final pattern", () => {
    expect(detectCompetition("Champions final showdown in Munich")).toBe("CL");
  });
});

describe("SOURCE_COMPETITION_HINT", () => {
  it("maps competition-specific Guardian feeds", () => {
    expect(SOURCE_COMPETITION_HINT["The Guardian PL"]).toBe("PL");
    expect(SOURCE_COMPETITION_HINT["The Guardian WC"]).toBe("WC");
  });

  it("maps language-specific sources", () => {
    expect(SOURCE_COMPETITION_HINT["Marca"]).toBe("PD");
    expect(SOURCE_COMPETITION_HINT["Kicker"]).toBe("BL1");
    expect(SOURCE_COMPETITION_HINT["Gazzetta dello Sport"]).toBe("SA");
    expect(SOURCE_COMPETITION_HINT["L'Equipe"]).toBe("FL1");
  });

  it("doesn't have entries for general sources", () => {
    expect(SOURCE_COMPETITION_HINT["BBC Sport"]).toBeUndefined();
    expect(SOURCE_COMPETITION_HINT["ESPN"]).toBeUndefined();
    expect(SOURCE_COMPETITION_HINT["Sky Sports"]).toBeUndefined();
  });
});

describe("detectTeamTags", () => {
  it("detects English club names", () => {
    expect(detectTeamTags("Arsenal beat Chelsea in derby")).toEqual(
      expect.arrayContaining(["ARS", "CHE"]),
    );
  });

  it("detects Spanish club names", () => {
    expect(detectTeamTags("Real Madrid vs Barcelona el clasico")).toEqual(
      expect.arrayContaining(["RMA", "BAR"]),
    );
  });

  it("detects Arabic club names", () => {
    expect(detectTeamTags("ريال مدريد يفوز على برشلونة")).toEqual(
      expect.arrayContaining(["RMA", "BAR"]),
    );
  });

  it("detects German clubs", () => {
    expect(detectTeamTags("Bayern Munich defeat Dortmund in Der Klassiker")).toEqual(
      expect.arrayContaining(["BAY", "BVB"]),
    );
  });

  it("detects Italian clubs", () => {
    expect(detectTeamTags("Juventus draw with Inter Milan in Derby d'Italia")).toEqual(
      expect.arrayContaining(["JUV", "INT"]),
    );
  });

  it("detects national teams", () => {
    expect(detectTeamTags("Brazil face Argentina in World Cup qualifier")).toEqual(
      expect.arrayContaining(["BRA", "ARG"]),
    );
  });

  it("detects nicknames", () => {
    expect(detectTeamTags("The Gunners secured three points at Anfield")).toEqual(
      expect.arrayContaining(["ARS", "LIV"]),
    );
  });

  it("detects Arabic national team names", () => {
    expect(detectTeamTags("مصر تواجه المغرب في تصفيات كأس العالم")).toEqual(
      expect.arrayContaining(["EGY", "MAR"]),
    );
  });

  it("returns empty for unrelated text", () => {
    expect(detectTeamTags("Tennis news: Djokovic wins Australian Open")).toEqual([]);
  });

  it("deduplicates tags", () => {
    // "Real Madrid" + "مدريد" both map to RMA
    const tags = detectTeamTags("Real Madrid — مدريد");
    const rmaCount = tags.filter((t) => t === "RMA").length;
    expect(rmaCount).toBe(1);
  });

  it("detects PSG in French", () => {
    expect(detectTeamTags("Paris Saint-Germain remporte le match")).toEqual(
      expect.arrayContaining(["PSG"]),
    );
  });

  it("detects USA team", () => {
    expect(detectTeamTags("USMNT prepare for World Cup on home soil")).toEqual(
      expect.arrayContaining(["USA"]),
    );
  });
});

describe("isSimilarTitle", () => {
  it("returns true for identical titles", () => {
    expect(isSimilarTitle("Arsenal beat Chelsea 2-1", "Arsenal beat Chelsea 2-1")).toBe(true);
  });

  it("returns true for mostly overlapping titles", () => {
    expect(isSimilarTitle(
      "Arsenal beat Chelsea in Premier League",
      "Arsenal beat Chelsea Premier League win",
    )).toBe(true);
  });

  it("returns false for completely different titles", () => {
    expect(isSimilarTitle(
      "Arsenal beat Chelsea 2-1",
      "Bayern Munich sign new striker from Dortmund",
    )).toBe(false);
  });

  it("returns false for empty strings", () => {
    expect(isSimilarTitle("", "")).toBe(false);
    expect(isSimilarTitle("Arsenal beat Chelsea", "")).toBe(false);
  });

  it("ignores punctuation", () => {
    expect(isSimilarTitle(
      "Arsenal beat Chelsea: match report!",
      "Arsenal beat Chelsea - match report",
    )).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSimilarTitle(
      "ARSENAL BEAT CHELSEA",
      "arsenal beat chelsea",
    )).toBe(true);
  });

  it("returns false when key words differ despite shared small words", () => {
    // After filtering words <=2 chars, "goal", "the", "match", "year" vs "goal", "the", "match", "century"
    // Jaccard: 3 shared / 5 union = 0.6 < 0.65 threshold
    expect(isSimilarTitle(
      "a goal in the match of the year",
      "a goal in the match of the century",
    )).toBe(false);
  });
});

describe("splitTextChunks", () => {
  it("returns single chunk for short text", () => {
    expect(splitTextChunks("Hello world", 100)).toEqual(["Hello world"]);
  });

  it("splits on paragraph boundaries", () => {
    const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
    const chunks = splitTextChunks(text, 30);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should be within limit (approximately)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(35); // small buffer for edge
    }
  });

  it("keeps paragraphs together when possible", () => {
    const text = "Short.\n\nAlso short.";
    expect(splitTextChunks(text, 100)).toEqual(["Short.\n\nAlso short."]);
  });

  it("handles empty text", () => {
    expect(splitTextChunks("", 100)).toEqual([]);
  });

  it("handles single long paragraph", () => {
    const text = "A".repeat(200);
    const chunks = splitTextChunks(text, 100);
    // Can't split mid-paragraph, so it stays as one chunk
    expect(chunks).toEqual([text]);
  });

  it("handles multiple paragraph breaks", () => {
    const text = "A\n\n\n\nB\n\n\n\nC";
    const chunks = splitTextChunks(text, 100);
    expect(chunks).toEqual(["A\n\nB\n\nC"]);
  });
});

describe("stripHtml", () => {
  it("strips basic HTML tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("converts <br> to newlines", () => {
    expect(stripHtml("line1<br>line2<br/>line3")).toBe("line1\nline2\nline3");
  });

  it("converts </p> to double newlines", () => {
    expect(stripHtml("<p>para1</p><p>para2</p>")).toBe("para1\n\npara2");
  });

  it("decodes &amp; &lt; &gt; &quot; &apos;", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &apos;")).toBe('& < > " \'');
  });

  it("decodes &nbsp;", () => {
    expect(stripHtml("hello&nbsp;world")).toBe("hello world");
  });

  it("decodes hex entities", () => {
    expect(stripHtml("&#xDF;")).toBe("ß");
    expect(stripHtml("&#xF6;")).toBe("ö");
  });

  it("decodes decimal entities", () => {
    expect(stripHtml("&#39;")).toBe("'");
    expect(stripHtml("&#8217;")).toBe("\u2019"); // right single quotation mark
  });

  it("handles empty string", () => {
    expect(stripHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("just text")).toBe("just text");
  });
});

describe("extractParagraphs", () => {
  it("extracts paragraphs from HTML", () => {
    const html = `
      <p>This is a paragraph with enough text to pass the length filter easily.</p>
      <p>Another paragraph that also has sufficient content to be included here.</p>
    `;
    const result = extractParagraphs(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("This is a paragraph");
  });

  it("skips short paragraphs (<40 chars)", () => {
    const html = `<p>Short</p><p>This is a long enough paragraph to be included in the extraction output.</p>`;
    const result = extractParagraphs(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("long enough");
  });

  it("skips code-like paragraphs", () => {
    const html = `<p>import React from 'react'; const App = () => {}; export default App;</p>`;
    expect(extractParagraphs(html)).toHaveLength(0);
  });

  it("skips paragraphs with low letter ratio", () => {
    const html = `<p>123456789 123456789 123456789 123456789 123456789 1234</p>`;
    expect(extractParagraphs(html)).toHaveLength(0);
  });

  it("handles paragraphs with nested HTML", () => {
    const html = `<p>This is a <strong>bold</strong> paragraph with <a href="#">links</a> inside it that is long.</p>`;
    const result = extractParagraphs(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("This is a bold paragraph with links inside it that is long.");
  });

  it("returns empty for no paragraphs", () => {
    expect(extractParagraphs("<div>no paragraphs here</div>")).toEqual([]);
  });
});

describe("htmlToText", () => {
  it("strips script and style tags entirely", () => {
    const html = `<p>Real content that is long enough to extract properly from this page.</p><script>alert('xss')</script><p>More real content that also passes the minimum length threshold here.</p>`;
    const result = htmlToText(html);
    expect(result).not.toContain("alert");
    expect(result).toContain("Real content");
  });

  it("strips nav, aside, header, footer", () => {
    const html = `<nav>menu items</nav><p>Article body text that is long enough to be extracted by the parser.</p><footer>copyright</footer><p>Second paragraph with enough content to pass the minimum threshold.</p>`;
    const result = htmlToText(html);
    expect(result).not.toContain("menu items");
    expect(result).not.toContain("copyright");
    expect(result).toContain("Article body");
  });

  it("returns empty for very short text", () => {
    expect(htmlToText("<div>short</div>")).toBe("");
  });

  it("joins multiple paragraphs with double newlines", () => {
    const html = `<p>First paragraph that is definitely long enough for extraction.</p><p>Second paragraph that also meets the minimum character requirement.</p>`;
    const result = htmlToText(html);
    expect(result).toContain("\n\n");
  });
});

describe("hasRepetitionOrHallucination", () => {
  it("returns false for normal text", () => {
    expect(hasRepetitionOrHallucination(
      "Arsenal secured a dominant victory over Chelsea at the Emirates Stadium on Saturday",
    )).toBe(false);
  });

  it("detects 4-gram repetition (3+ times)", () => {
    const repeated = "the ball is round " .repeat(5) + "end of article";
    expect(hasRepetitionOrHallucination(repeated)).toBe(true);
  });

  it("detects known hallucination: 'it is important to keep in mind'", () => {
    expect(hasRepetitionOrHallucination(
      "Some context. It is important to keep in mind that this matters.",
    )).toBe(true);
  });

  it("detects known hallucination: 'the quality of the product'", () => {
    expect(hasRepetitionOrHallucination(
      "Some context about the quality of the product in question.",
    )).toBe(true);
  });

  it("detects known hallucination: 'as we can see'", () => {
    expect(hasRepetitionOrHallucination(
      "As we can see from the data, the results are clear.",
    )).toBe(true);
  });

  it("returns false for short text (< 12 words)", () => {
    expect(hasRepetitionOrHallucination("Short text here")).toBe(false);
  });
});

describe("validateTranslation", () => {
  it("returns false for empty output", () => {
    expect(validateTranslation("some input", "")).toBe(false);
    expect(validateTranslation("some input", "   ")).toBe(false);
  });

  it("returns false for suspiciously long output (>5x input)", () => {
    const input = "Short sentence here."; // 20 chars
    const output = "x".repeat(101); // >5x
    expect(validateTranslation(input, output)).toBe(false);
  });

  it("returns false for suspiciously short output (<0.15x input)", () => {
    const input = "A reasonably long input sentence that has many characters."; // ~58 chars
    const output = "Hi"; // way too short
    expect(validateTranslation(input, output)).toBe(false);
  });

  it("returns true for reasonable translation", () => {
    expect(validateTranslation(
      "Arsenal beat Chelsea in the Premier League",
      "أرسنال يتغلب على تشيلسي في الدوري الإنجليزي الممتاز",
    )).toBe(true);
  });

  it("returns false for output with repetition", () => {
    const input = "Some normal input text.";
    const output = "the ball is round the ball is round the ball is round the ball is round and more text";
    expect(validateTranslation(input, output)).toBe(false);
  });

  it("passes for very short inputs regardless of ratio", () => {
    // inLen <= 10: ratio checks don't apply
    expect(validateTranslation("Hi", "مرحبا")).toBe(true);
  });
});

describe("validateSummary", () => {
  it("returns false for empty text", () => {
    expect(validateSummary("")).toBe(false);
  });

  it("returns false for text shorter than 50 chars", () => {
    expect(validateSummary("Too short to be a real summary.")).toBe(false);
  });

  it("returns true for valid summary", () => {
    expect(validateSummary(
      "Arsenal secured a crucial 2-1 victory over Chelsea at the Emirates Stadium on Saturday evening, moving them closer to the Premier League title.",
    )).toBe(true);
  });

  it("returns false for summary with hallucination", () => {
    expect(validateSummary(
      "As we can see from this lengthy analysis of the match between Arsenal and Chelsea that took place at the Emirates Stadium.",
    )).toBe(false);
  });

  it("returns false for summary with repetition loops", () => {
    const loopy = "the match was great " .repeat(10);
    expect(validateSummary(loopy)).toBe(false);
  });
});
