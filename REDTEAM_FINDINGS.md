# YancoCup — red team findings (v3)

> Updated April 2026. V2 audit added findings 11-20. V3 audit (code review, April 11 2026) adds findings 21-26.
> All V3 findings are verified from source code — no assumptions.

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
