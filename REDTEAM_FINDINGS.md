# YancoCup — red team findings (v4)

> Updated April 2026. V2 audit added findings 11-20. V3 audit (code review, April 11 2026) added 21-26.
> **V4 audit (data pipeline deep dive, April 11 2026) adds findings 27-44.**
> All findings verified from source code — no assumptions.

---

## Original findings status (v1)

### 1-10. (Various original findings)
**STATUS: ALL RESOLVED.** See v2 for details.

---

## V2 findings status

### 11. Design token inconsistency across documentation
**STATUS: RESOLVED.** globals.css is the single source of truth. All docs updated.

### 12. Cron runs every minute regardless of match activity
**STATUS: PARTIALLY RESOLVED.**
- Cron is now `*/5 * * * *` (was `* * * * *`) — 288 calls/day, within free tier ✅
- However: no early-exit logic exists in `handleCron()`. The function makes an upstream call to `/v4/matches` on every single tick, even at 3am with no matches anywhere in the world.
- `all:live` KV key exists and is written on each cron run — but it is never checked at the start of `handleCron()` to short-circuit the upstream call.
- **Remaining fix:** Add early-exit at top of `handleCron()`: if `all:live` is empty AND tick % 5 !== 0, skip the upstream call.

### 13. Client-side scoring is exploitable
**STATUS: OPEN — accepted risk.**
Scoring via `useAutoScore` hook writes results to Supabase client-side. Technically exploitable. Mitigation via RLS + `scored_at`/`scored_by` fields is in place. Accepted at current friend-group scale.

### 14. `/api/:comp/matches` endpoint triggers upstream on cache miss
**STATUS: PARTIALLY RESOLVED.**
- WC is fully protected — cache miss returns `{ matches: [] }`, never hits upstream ✅
- Leagues still hit upstream on cache miss. The endpoint does cache the result after fetching, so subsequent requests are served from KV.
- Risk: multiple concurrent requests within the same cold-cache window could trigger parallel upstream calls. No lock mechanism exists.
- **Remaining fix:** Either pre-populate league schedules via the every-5th-tick cron logic, or add a KV-based lock (`{comp}:schedule:fetching`) before the upstream call.

### 15. No React error boundary around the globe
**STATUS: RESOLVED.** `GlobeErrorBoundary` implemented in both `GlobeView.tsx` and internally in `GlobeScene.tsx`.

### 16. React Router v7 with v6 patterns
**STATUS: OPEN.**
`react-router-dom@^7.14.0` in package.json. Code uses v6-compatible `<Routes>/<Route element={}>` patterns. Works today via v7 compatibility mode, but `^7` semver could pull breaking changes.
**Fix options:** Pin to `^6.28.0` (safest) or lock v7 to a known-good minor in package.json overrides.

### 17. Zustand installed but unused
**STATUS: RESOLVED.** Removed.

### 18. Champions League format not reflected in UI
**STATUS: OPEN — not urgent.**
`hasGroups: false` is correct. Bracket component needs to handle the new Swiss-model format (9th-24th playoff, then R16) when CL knockouts begin. Not urgent until that stage starts.

### 19. AI news article length creates legal risk
**STATUS: RESOLVED.**
Worker prompt: `"Summarize this football article in 3-5 sentences. Be factual and specific."` with `max_tokens: 400`. Length is enforced at the AI call level. Source attribution is required.

### 20. Arabic RSS source URLs are unverified
**STATUS: UNKNOWN — requires manual verification.**
Cannot determine from code alone whether the RSS URLs in the pipeline resolve to valid XML. Requires running the curl verification commands against each source.

---

## V3 findings (code review, April 11 2026)

### 21. GlobeScene.js is 2.0MB — critical mobile loading issue

**Severity: High**

The production build shows `GlobeScene-X5kK4xVT.js` at 2,000,529 bytes uncompressed. Even with gzip compression (~60%), this is likely 800KB–1.2MB transferred. On a mobile 4G connection at ~10Mbps, this alone takes 1-2 seconds to download — before parsing and execution time.

**What IS correctly implemented (do not redo):**
- `frameloop="demand"` on the R3F Canvas — renders only on interaction
- `dpr={device.isMobile ? [1, 1.5] : [1, 2]}` — responsive pixel ratio
- `React.lazy()` + `Suspense` in GlobeView.tsx — lazy loaded, not in main bundle
- `GlobeErrorBoundary` — WebGL crash protection
- Mobile/low-end device detection via `useDeviceProfile()`

**What is NOT implemented:**
- IntersectionObserver to pause/resume rendering when globe scrolls off-screen
- Bundle composition analysis to understand what's in the 2MB

**Fix:** Run `npx vite-bundle-visualizer` to identify the composition. The 2MB likely comes from Three.js being bundled inside r3f-globe rather than shared with the main chunk, or from earth texture images encoded as base64. Fix depends on root cause.

### 22. No concurrent upstream call protection on league schedule cache miss

**Severity: Medium**

When `/api/:comp/matches` gets a KV cache miss for a league (not WC — WC correctly returns `[]`), it:
1. Fetches from football-data.org upstream
2. Writes result to KV
3. Returns the data

If 5 users hit this endpoint simultaneously before the first request writes to KV, all 5 trigger upstream calls. With a 10 req/min rate limit, 5 simultaneous cold-cache hits against 5 competitions could consume half the rate limit budget instantly.

**Fix:** Set a `{comp}:schedule:fetching = "1"` KV flag before the upstream call. Check this flag before fetching. If flag is set, return `{ matches: [], message: "Loading..." }` and let the cron pre-populate it.

### 23. Supabase RLS policies are undocumented and unaudited

**STATUS: RESOLVED.**
- Full audit completed April 11, 2026 via Supabase MCP (queried `pg_policies` directly).
- All policies documented in `docs/RLS_POLICIES.md`.
- **Critical fix applied:** `yc_predictions` SELECT policy changed from `true` (all authenticated) to `auth.uid() = user_id OR kickoff_time <= now() OR scored_at IS NOT NULL`. Added `kickoff_time` column; frontend passes it on upsert.
- Pool read policies confirmed intentionally open (needed for join-by-code and leaderboard).
- Client-writable badges/streaks confirmed as accepted consequence of client-side scoring architecture (FK-constrained).
- `profiles_public` uses a shared YancoVerse function gate — flagged as potential gap for leaderboard display names.

### 24. Twitter card type is `summary` instead of `summary_large_image`

**Severity: Low**

In `index.html`:
```html
<meta name="twitter:card" content="summary" />
```

`summary` displays a small square thumbnail. `summary_large_image` displays a full-width preview image. Given that social sharing is a core feature (pool invites, prediction cards), the share preview on Twitter/X should be as prominent as possible.

Also: `og:image` and `twitter:image` both point to `logo-192.png` — a 192px square logo. The recommended OG image size is 1200×630px. A properly designed YancoVerse-aesthetic share image would significantly improve click-through on shares.

**Fix (two steps):**
1. Change `twitter:card` to `summary_large_image` — 1 line change, immediate improvement
2. Design and generate a proper 1200×630 OG image in YancoVerse aesthetic

### 25. Worker `src/index.ts` is a 2,874-line god file

**Severity: Medium** (maintainability and debugging complexity)

All Worker logic lives in a single file: live score polling, standings, match enrichment, news pipeline (RSS fetching, AI rewrite, translation, Supabase storage), utility functions, and all HTTP route handlers.

This makes:
- Debugging harder (searching through 2,874 lines for any issue)
- Claude Code sessions more expensive (large context)
- Accidental coupling between unrelated systems likely

The issue is currently manageable but will worsen as features are added.

**Suggested extraction (do not do all at once — one per session):**
- `worker/src/scores.ts` — live score polling and KV writes
- `worker/src/news.ts` — RSS + AI rewrite + translation + Supabase pipeline
- `worker/src/enrichment.ts` — API-Football lineup/stats pre-caching
- `worker/src/routes.ts` — HTTP route handlers (imports from above)
- `worker/src/index.ts` — entry point, cron handler, bindings only

### 26. No early-exit in cron when no live activity

**Severity: Low** (wastes API budget, not a correctness issue)

`handleCron()` calls `fetchFromFootballData("/matches", ...)` on every single execution — including at 3am UTC when there are no matches in any competition anywhere in the world.

The `all:live` KV key exists and is written with a 120-second TTL after each successful poll. This key being absent or empty is a reliable signal that no matches are currently in play.

**Fix:**
```typescript
// At the top of handleCron(), before the upstream call:
const liveCheck = await env.SCORES_KV.get("all:live");
const hasLive = liveCheck && JSON.parse(liveCheck).length > 0;

// Skip upstream if: no live matches AND not a 5th-tick scheduled enrichment
if (!hasLive && tick % 5 !== 0) {
  await kvPut(env.SCORES_KV, KV_TICK, String(tick));
  return;
}
```

This eliminates the majority of unnecessary upstream calls during off-peak hours without affecting live match tracking.

---

---

## V4 findings (data pipeline deep dive, April 11 2026)

### WORKER — Cron & polling

#### 27. No retry logic on football-data.org API failure
**Severity: Critical**
**File:** `worker/src/index.ts:1417-1474`

When `fetchFromFootballData("/matches", ...)` fails (429 rate-limited, 500 server error, network timeout), the entire tick is silently skipped. No retry, no backoff. A single API hiccup = 5 minutes of missing score updates.

```typescript
const res = await fetchFromFootballData("/matches", env.FOOTBALL_DATA_API_KEY);
if (res.ok) { /* process */ }
// Silent fallthrough if not res.ok — no retry, no error logging
```

**Impact:** During a live WC match, one API blip means 5 min of stale scores for all users.
**Fix:** Add 1-2 retries with exponential backoff (1s, 3s) before giving up on the tick.

#### 28. `fetchFromApiFootball()` has no timeout
**Severity: High**
**File:** `worker/src/index.ts:186-193`

```typescript
async function fetchFromApiFootball(path: string, apiKey: string): Promise<Response> {
  return fetch(`${AF_BASE}${path}`, {
    headers: { "x-apisports-key": apiKey },
  }); // No AbortSignal.timeout()
}
```

Other fetches have timeouts (scrapeArticleText: 10s, fetchRSSFeed: 8s) but API-Football has none. If API-Football hangs, the Worker hits the Cloudflare 30s CPU limit and hard-kills, losing ALL work for that tick — including already-fetched football-data.org scores.

**Fix:** Add `signal: AbortSignal.timeout(8000)` to the fetch call.

#### 29. API-Football fixture matching logic is broken for many teams
**Severity: High**
**File:** `worker/src/index.ts:237-246`

```typescript
const homeUp = homeTla.toUpperCase(); // e.g. "MCI"
const awayUp = awayTla.toUpperCase();
return fixtures.find((f) => {
  const hName = (teams?.home?.name ?? "").toUpperCase(); // e.g. "MANCHESTER CITY"
  return (hName.includes(homeUp) || homeUp.includes(hName.slice(0, 3))) && ...
});
```

Tested cases that **fail**:
- `"MANCHESTER CITY".includes("MCI")` → false, `"MCI".includes("MAN")` → false — **Man City never matches**
- `"MANCHESTER UNITED".includes("MUN")` → false — **Man United never matches**
- `"REAL MADRID".includes("RMA")` → false — **Real Madrid never matches**
- `"FC BARCELONA".includes("FCB")` → false — **Barcelona never matches**

Cases that **accidentally match wrong teams**:
- TLA "PAR" matches any team name containing "PAR" (Paris, Parma, Paraguay)

**Impact:** Lineups, events, and statistics are silently missing for most top-club matches. Users open match detail and see no lineups even though data exists in API-Football.
**Fix:** Build a static TLA→API-Football team ID mapping (or match by league + date + kickoff time instead of team names).

#### 30. Concurrent API-Football cache miss causes duplicate upstream calls
**Severity: Medium**
**File:** `worker/src/index.ts:209-235`

When 3 matches on the same date all need enrichment on the same tick, all 3 check `af:${compCode}:${matchDate}` cache key — all 3 miss — all 3 call API-Football for the same date. First write wins, other 2 are wasted API calls.

At 100 req/day limit, wasting 2 calls per date is significant during a tournament with 4+ matches/day.

**Fix:** After the first fetch, cache immediately before processing. Or deduplicate by date before entering the enrichment loop.

#### 31. KV write volume may exceed free-tier daily limit
**Severity: High**
**File:** `worker/src/index.ts` (throughout cron)

Cloudflare KV free tier: **1,000 writes/day**. Per cron tick:
- 1 tick counter + 1 last-poll + 1 all:live = 3 writes
- N individual match writes (today's matches, ~0-30)
- K per-competition score writes (~1-8)

Every 5th tick adds more (upcoming week: 20-50 match writes + competition writes).
Every 15th tick: 1 standings write. Every 60th tick: 1 schedule write.

**Conservative estimate (active match day):** ~40 writes/tick × 288 ticks/day = **~11,500 writes/day** — 11x over the 1,000 free limit.

After quota exhaustion, `kvPut()` silently fails (caught in try-catch at line 317). All writes are lost. Users see completely stale data with no warning.

**Impact:** Worker becomes read-only after ~25 ticks (~2 hours) on busy match days. All scores freeze.
**Fix options:**
1. Upgrade to Workers Paid ($5/month) — 1,000 writes/second, problem disappears
2. Batch writes: one KV write per competition per tick instead of per-match
3. Skip individual match detail writes (use per-competition scores array instead)

#### 32. Individual match KV TTL is 24h regardless of match status
**Severity: Medium**
**File:** `worker/src/index.ts:1445-1448`

```typescript
await kvPut(env.SCORES_KV, kvMatch(m.id), JSON.stringify(score), {
  expirationTtl: 86400, // Always 24h — even for live matches
});
```

A live match changing score every few minutes is cached for 24h. If the match detail endpoint serves from this KV entry instead of the per-competition scores, users see stale individual match data.

**Fix:** TTL should be status-dependent: live=120s, finished=86400s, upcoming=3600s.

#### 33. `all:live` TTL (600s) is barely above cron interval (300s)
**Severity: Low**
**File:** `worker/src/index.ts:1471-1473`

600s TTL with 300s cron interval means the window between "TTL expires" and "next cron writes" is 0-300s. If a cron tick fails or is delayed, clients see "no live matches" even during an active game.

**Fix:** Increase TTL to 900s or 1200s.

### WORKER — News pipeline

#### 34. Scrape failure counter never resets on success
**Severity: Medium**
**File:** `worker/src/index.ts:1266-1284`

When scraping succeeds (`fullText.length > 100`), only `full_content` is written. The `scrape_failures` counter stays at whatever it was. If an article had 2 prior failures, then succeeds, it stays at 2. One more transient failure → hits 3 → permanently skipped.

**Fix:** Reset `scrape_failures: 0` on successful scrape:
```typescript
body: JSON.stringify({ full_content: fullText, scrape_failures: 0 }),
```

#### 35. News summarize phase only processes 2 articles per cycle
**Severity: Medium**
**File:** `worker/src/index.ts:1293`

```
...&limit=2&select=...
```

With 4 phases cycling every 24th tick (~2 hours), and news phase 2 (summarize) processing only 2 articles: that's 2 articles per 8-hour cycle = **6 articles/day summarized**. If RSS feeds produce 20+ articles/day, there's an ever-growing backlog.

**Fix:** Increase limit to 5-10. Workers AI free tier (10K neurons/day) can handle it.

#### 36. News title dedup threshold too lenient (Jaccard 0.65)
**Severity: Low**
**File:** `worker/src/index.ts:1169-1177`

Two articles about different Chelsea matches (e.g., "Chelsea 2-1 Liverpool" vs "Chelsea 1-3 Arsenal") share many common words and could exceed 0.65 Jaccard similarity, causing one to be incorrectly deduplicated.

**Fix:** Raise threshold to 0.80+ or add source URL dedup as primary check.

### WORKER — Security & error handling

#### 37. Admin endpoints use API key as auth + hardcoded backdoor
**Severity: Medium**
**File:** `worker/src/index.ts:1755-1774`

```typescript
if (key !== c.env.FOOTBALL_DATA_API_KEY && key !== "yanco2026trigger") {
  return c.json({ error: "Unauthorized" }, 401);
}
```

The `"yanco2026trigger"` string is a hardcoded backdoor password. If the API key leaks, admin endpoints (trigger news phases, backfill, etc.) are compromised.

**Fix:** Use a dedicated admin secret via `wrangler secret put ADMIN_KEY`.

#### 38. Silent errors in cron — no alerting, no health degradation signal
**Severity: Medium**
**File:** `worker/src/index.ts:1663-1665`

```typescript
} catch (err) {
  console.error("Cron poll failed:", err);
}
```

The entire cron handler is wrapped in one try-catch that only logs. No structured error reporting, no Sentry integration on the Worker side, no health check that detects stale data.

**Impact:** If cron fails repeatedly, the `lastPoll` timestamp stops updating but no one is alerted. Users see stale data indefinitely.

**Fix:** Write a `cron:error:count` KV key. Expose in `/api/health`. Alert if error count > 3 in a row.

### FRONTEND — Data hooks

#### 39. `useScores` — no error state, no stale indicator
**Severity: Medium**
**File:** `src/hooks/useScores.ts:44-76`

```typescript
const poll = useCallback(async () => {
  const raw = await fetchScores(); // returns [] on error
  if (raw.length === 0) { setLoading(false); return; }
  // ...
}, []);
```

If the Worker is down, `fetchScores()` returns `[]` (via api.ts catch). The hook sets `loading=false` with an empty map. The user sees "no matches" — indistinguishable from "API is down." No error state, no stale-data indicator, no retry differentiation.

**Fix:** Return `{ data, error, isStale }` from the hook. Show "Scores temporarily unavailable" banner when error.

#### 40. `useAutoScore` — race condition on rapid navigation
**Severity: Medium**
**File:** `src/hooks/useAutoScore.ts:26-49`

If a user navigates: Predictions → Leaderboard → Predictions rapidly, three `useAutoScore` instances may mount/unmount. The 5-min throttle is per-instance (via `useRef`), so each new mount gets a fresh `lastRunRef = 0`. Multiple concurrent `scorePredictions()` calls can fire for the same matches.

Since `scorePredictions` updates rows where `scored_at IS NULL`, concurrent calls could both pass the check before either writes — resulting in double-scoring.

**Fix:** Use a global (module-level) throttle timestamp instead of per-instance ref. Or add a Supabase RPC that scores atomically.

#### 41. `useCompetitionSchedule` — AbortController self-abort on first call
**Severity: Low**
**File:** `src/hooks/useCompetitionSchedule.ts:24-29`

```typescript
let controller = new AbortController();
async function fetchSchedule() {
  controller.abort(); // Aborts immediately on first call!
  controller = new AbortController();
  const res = await fetch(url, { signal: controller.signal });
```

On the very first call, `controller.abort()` is called before any request has been made. This is harmless (aborting an unused controller is a no-op) but the pattern is confusing and could cause issues if the first abort somehow races with the new fetch.

**Fix:** Only abort if a previous request is in flight (track with a boolean flag).

#### 42. `useArticleComments` — unbounded reply fetch
**Severity: Medium**
**File:** `src/hooks/useArticleComments.ts`

Top-level comments are paginated (limit 20), but ALL replies for the entire article are fetched in a single query with no limit. A viral article with 10,000 replies would fetch all 10,000 in one Supabase call.

**Fix:** Paginate replies per top-level comment (e.g., limit 10 replies, "show more" button).

#### 43. `usePoolChat` — profile cache grows unbounded
**Severity: Low**
**File:** `src/hooks/usePoolChat.ts:22`

```typescript
const profileCache = useRef(new Map<string, ...>());
```

The profile cache never evicts entries. In a large pool with hundreds of users chatting over time, the Map grows without bound for the lifetime of the component.

**Fix:** Cap at 200 entries with LRU eviction, or clear cache on pool change.

#### 44. `api.ts` — zero error differentiation
**Severity: Medium**
**File:** `src/lib/api.ts:59-68`

```typescript
async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${WORKER_URL}${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}
```

Network error, 404, 500, JSON parse error — all return the same `null`. Calling code can't distinguish "no data exists" from "Worker is down" from "malformed response."

**Fix:** Return `{ data: T | null; error: string | null }` or throw typed errors that hooks can handle.

---

## V4 findings summary table

| # | Category | Severity | One-line |
|---|----------|----------|----------|
| 27 | Worker/Cron | **Critical** | No retry on football-data.org API failure |
| 28 | Worker/API-Football | **High** | No timeout on API-Football fetch |
| 29 | Worker/API-Football | **High** | Fixture matching broken for most top clubs |
| 30 | Worker/API-Football | Medium | Concurrent cache miss → duplicate calls |
| 31 | Worker/KV | **High** | KV writes exceed free-tier 1,000/day limit |
| 32 | Worker/KV | Medium | Match detail TTL always 24h (even live) |
| 33 | Worker/KV | Low | `all:live` TTL barely above cron interval |
| 34 | Worker/News | Medium | Scrape failure counter never resets |
| 35 | Worker/News | Medium | Summarize phase too slow (2 articles/cycle) |
| 36 | Worker/News | Low | Title dedup threshold too lenient |
| 37 | Worker/Security | Medium | Admin auth uses API key + hardcoded backdoor |
| 38 | Worker/Error | Medium | Silent cron errors, no alerting |
| 39 | Frontend/Hooks | Medium | useScores has no error state |
| 40 | Frontend/Hooks | Medium | useAutoScore race condition on navigation |
| 41 | Frontend/Hooks | Low | AbortController self-abort on first call |
| 42 | Frontend/Hooks | Medium | Unbounded reply fetch in comments |
| 43 | Frontend/Hooks | Low | Pool chat profile cache unbounded |
| 44 | Frontend/API | Medium | api.ts returns null for all error types |

---

## Things that are solid (no changes needed)

- r3f-globe choice ✅
- circle-flags ✅
- Static WC data in `src/data/` ✅
- Cloudflare Workers as proxy ✅
- Supabase for predictions ✅
- YancoVerse design system (globals.css as source of truth) ✅
- Vitest test suite — 15+ test files covering scoring, badges, i18n, competitions, worker transforms ✅
- GlobeErrorBoundary with WebGL fallback ✅
- `frameloop="demand"` on globe ✅
- `React.lazy()` for GlobeScene ✅
- AI news: 3-5 sentence summaries with source attribution ✅
- Cron `*/5 * * * *` pre-tournament ✅
- Competition-scoped pools ✅
- Multi-competition routing ✅
- OG + Twitter card meta tags in index.html ✅
- PWA manifest.json ✅
- Sentry error monitoring ✅
- Cloudflare Web Analytics ✅
- Lazy-loaded pages ✅
- useCompetitionSchedule: good AbortController cancellation pattern ✅
- usePoolChat: good realtime subscription with dedup ✅
- useAutoScore: good 5-min throttle concept ✅
- useScores: dynamic polling interval (60s live / 5min idle) ✅
