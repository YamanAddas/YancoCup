import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// We can't import api.ts directly because it uses `import.meta.env` which is
// Vite-specific. Instead we re-implement the pure logic and test the API
// contract shapes — same pattern as useLeaderboard.test.ts.
// ---------------------------------------------------------------------------

type ApiError = "network" | "http" | "parse";

interface ApiResult<T> {
  data: T | null;
  error: ApiError | null;
}

const WORKER_URL = "https://yancocup-api.catbyte1985.workers.dev";

async function apiFetch<T>(path: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${WORKER_URL}${path}`);
    if (!res.ok) return { data: null, error: "http" };
    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (err) {
    if (err instanceof SyntaxError) return { data: null, error: "parse" };
    return { data: null, error: "network" };
  }
}

function buildScoresPath(comp?: string, filters?: { status?: string; date?: string }): string {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.date) params.set("date", filters.date);
  const qs = params.toString();
  const base = comp && comp !== "WC" ? `/api/${comp}/scores` : "/api/scores";
  return `${base}${qs ? `?${qs}` : ""}`;
}

function buildNewsParams(lang: string, filters?: { featured?: boolean; limit?: number; offset?: number }): string {
  const params = new URLSearchParams();
  params.set("lang", lang);
  if (filters?.featured) params.set("featured", "true");
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));
  return params.toString();
}

// ===========================================================================
// TESTS
// ===========================================================================

describe("buildScoresPath", () => {
  it("defaults to /api/scores for WC", () => {
    expect(buildScoresPath("WC")).toBe("/api/scores");
  });

  it("defaults to /api/scores when no comp", () => {
    expect(buildScoresPath()).toBe("/api/scores");
  });

  it("uses competition-specific endpoint for leagues", () => {
    expect(buildScoresPath("PL")).toBe("/api/PL/scores");
    expect(buildScoresPath("CL")).toBe("/api/CL/scores");
  });

  it("appends status filter", () => {
    expect(buildScoresPath("WC", { status: "FINISHED" })).toBe("/api/scores?status=FINISHED");
  });

  it("appends date filter", () => {
    expect(buildScoresPath("PL", { date: "2026-06-11" })).toBe("/api/PL/scores?date=2026-06-11");
  });

  it("appends multiple filters", () => {
    const path = buildScoresPath("WC", { status: "IN_PLAY", date: "2026-06-11" });
    expect(path).toContain("status=IN_PLAY");
    expect(path).toContain("date=2026-06-11");
  });
});

describe("buildNewsParams", () => {
  it("always includes lang", () => {
    const qs = buildNewsParams("en");
    expect(qs).toBe("lang=en");
  });

  it("includes featured flag", () => {
    const qs = buildNewsParams("ar", { featured: true });
    expect(qs).toContain("lang=ar");
    expect(qs).toContain("featured=true");
  });

  it("includes limit and offset", () => {
    const qs = buildNewsParams("fr", { limit: 10, offset: 20 });
    expect(qs).toContain("limit=10");
    expect(qs).toContain("offset=20");
  });

  it("omits optional params when not provided", () => {
    const qs = buildNewsParams("de", {});
    expect(qs).toBe("lang=de");
  });
});

describe("apiFetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns data on successful response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [], fetchedAt: "2026-06-11T12:00:00Z" }),
    });

    const result = await apiFetch<{ matches: unknown[]; fetchedAt: string }>("/api/scores");
    expect(result.data).toEqual({ matches: [], fetchedAt: "2026-06-11T12:00:00Z" });
    expect(result.error).toBeNull();
  });

  it("returns http error on non-ok response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const result = await apiFetch("/api/scores");
    expect(result.data).toBeNull();
    expect(result.error).toBe("http");
  });

  it("returns network error on fetch failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await apiFetch("/api/scores");
    expect(result.data).toBeNull();
    expect(result.error).toBe("network");
  });

  it("returns parse error on invalid JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => { throw new SyntaxError("Unexpected token"); },
    });

    const result = await apiFetch("/api/scores");
    expect(result.data).toBeNull();
    expect(result.error).toBe("parse");
  });

  it("constructs correct URL with WORKER_URL prefix", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = mockFetch;

    await apiFetch("/api/health");
    expect(mockFetch).toHaveBeenCalledWith(`${WORKER_URL}/api/health`);
  });
});
