# YancoCup — red team findings (v2)

> Updated April 2026. Original findings from V1 are marked RESOLVED or STILL OPEN.

## Original findings status

### 1. Verify football-data.org free tier covers World Cup
**STATUS: RESOLVED.** The free tier coverage page explicitly lists "Worldcup" as a free competition. The `schedule.json` uses football-data.org API match IDs (537xxx range). Still, run a live test before June 11:
```bash
curl -H "X-Auth-Token: YOUR_KEY" https://api.football-data.org/v4/competitions/WC
```

### 2. Remove BALLDONTLIE from fallback list
**STATUS: RESOLVED.** BALLDONTLIE was removed. Fallback is API-Football with Cron Trigger + KV caching.

### 3. Add Cloudflare Cron Trigger for live score polling
**STATUS: RESOLVED.** Worker uses cron triggers (`* * * * *`), polls `/v4/matches`, writes to per-competition KV. See new finding #12 below.

### 4. Simplify scoring engine
**STATUS: RESOLVED.** Scoring is client-side in `src/lib/scoring.ts`. No Edge Functions. See new finding #13 below for architectural concern.

### 5. Fix HashRouter + Supabase auth collision
**STATUS: RESOLVED.** Auth token handling happens before HashRouter in `src/main.tsx`.

### 6. Handle unresolved playoff teams in data
**STATUS: RESOLVED.** All 48 teams are finalized as of March 31, 2026. `groups.json` and `teams.json` are updated. No more placeholder entries in group stage matches.

### 7-10. (Lucide icons, assets, .gitignore, broadcaster data)
**STATUS: RESOLVED.** All implemented.

---

## New findings (v2 audit, April 2026)

### 11. Design token inconsistency across documentation

**Severity: Medium** (causes incorrect implementations)

Three documents had different color values:
- VISION.md said `#0a0a0a` background, `#00ff88` accent
- CLAUDE.md said `#060b14` background, `#00e5c1` accent
- SKILL.md said `#0a0a0a` background, `#00ff88` accent

**Actual values in `globals.css`:** `#060b14` background, `#00ff88` accent.

**Fix:** All three documents have been updated to match `globals.css`. Added "globals.css is the single source of truth" statements to prevent future drift.

### 12. Cron runs every minute regardless of match activity

**Severity: Medium** (wastes free tier budget)

`wrangler.toml` has `crons = ["* * * * *"]`. This fires 1,440 times/day even when zero matches are happening. Each tick writes to KV. Cloudflare Workers free tier allows 100K requests/day and KV has 1,000 writes/day limit on the free plan (1M on paid).

**Fix options:**
- Change to `*/5 * * * *` and increase to `* * * * *` only during known match windows
- Add early exit in `handleCron()`: check `all:live` KV key, skip upstream call if empty and tick % 5 !== 0
- Monitor KV write usage in Cloudflare dashboard

### 13. Client-side scoring is exploitable

**Severity: Low** (acceptable for friend-group scale)

The `useAutoScore` hook scores predictions client-side and writes results to Supabase. A malicious user could modify the client to submit inflated scores. Race conditions are also possible when two users load the leaderboard simultaneously.

**Current mitigation:** RLS policies, `scored_at` and `scored_by` fields prevent double-scoring.

**Future fix:** Move scoring to a Supabase RPC function (`rpc('score_predictions', { match_id, actual_home, actual_away })`). This is a Postgres function, not an Edge Function — stays within free tier.

### 14. `/api/:comp/matches` endpoint triggers upstream on cache miss

**Severity: Medium** (violates architecture principle)

When KV cache is empty for a competition's schedule, the endpoint fetches directly from football-data.org on user request. If 5 users hit this simultaneously, it generates 5 upstream calls.

**Fix:** Either:
- Pre-populate schedules via cron (add to the 5th-tick logic)
- Add a KV-based lock: set `{comp}:schedule:fetching = true` before upstream call, check before fetch
- Return empty `{ matches: [], message: "Schedule loading..." }` instead of upstream call

### 15. No React error boundary around the globe

**STATUS: RESOLVED.** `GlobeErrorBoundary` class component added in `src/components/globe/GlobeView.tsx`. Wraps `GlobeScene` with a graceful fallback showing a message when WebGL is unavailable.

### 16. React Router v7 with v6 patterns

**Severity: Low** (works but could break on minor update)

`react-router-dom@^7.14.0` is installed but the code uses v6 patterns (`<Routes>`, `<Route element={}>`). RR v7 supports v6 compatibility mode, but the `^7` semver range could pull in a version that changes behavior.

**Fix options:**
- Pin to `react-router-dom@^6.28.0` (safest)
- Or keep v7 but add `react-router-dom` to `overrides` in package.json to lock a known-good version

### 17. Zustand is installed but unused

**STATUS: RESOLVED.** Was in `package.json` but never imported. Removed via `npm uninstall zustand`. Still appears in `package-lock.json` as a transitive dependency of `tunnel-rat` (used by R3F) — that's expected. CLAUDE.md updated to reflect hooks-only state management.

### 18. Champions League format not reflected in UI

**Severity: Medium** (incorrect bracket visualization)

The CL has used a Swiss-model league phase since 2024/25 (36 teams in a single table, not 8 groups of 4). The `competitions.ts` config has `hasGroups: false` which is technically correct, but the bracket visualization and knockout format need to handle the new structure (knockout round play-off for teams 9th-24th, then round of 16).

**Fix:** When implementing CL bracket, ensure the bracket component supports the new format. This is not urgent until CL knockout rounds begin.

### 19. AI news article length creates legal risk

**Severity: Medium** (legal exposure)

The V2 plan specifies "200-400 word" AI rewrites of RSS articles. This is long enough to substitute for the original article, which weakens the "transformative use" argument.

**Fix:** Cap AI output at 3-5 sentences (60-100 words). Always include a prominent "Read full article →" link to the original source. Frame as "summary with attribution" not "rewritten article."

### 20. Arabic RSS source URLs are unverified

**Severity: Medium** (pipeline will fail silently)

The V2 plan lists 8 Arabic RSS sources. Many Arabic news sites don't maintain public RSS feeds, or feeds are broken/outdated. Likely 3-4 of these won't work.

**Fix:** Before building the news pipeline, manually verify each RSS URL returns valid XML:
```bash
curl -s "https://aljazeera.net/sport/rss" | head -20
curl -s "https://www.kooora.com/rss" | head -20
# etc.
```
Build the pipeline only with verified sources. Add others later.

---

## Things that are solid (no changes needed)

- r3f-globe choice ✓
- circle-flags ✓
- Static WC data in `src/data/` with football-data.org match IDs ✓
- Cloudflare Workers as proxy ✓
- Supabase for predictions ✓
- YancoVerse design system (now consistent) ✓
- Session-by-session build plan structure ✓
- CLAUDE.md "What Claude gets wrong" section ✓
- Club crest copyright strategy (hotlink API URLs, never bundle) ✓
- Cron Trigger + KV architecture for live scores ✓
- Multi-competition routing and context ✓
- Competition-scoped pools ✓
- Static WC data + API data for leagues ✓
- Lazy-loaded pages ✓
- 6 languages (not 9) ✓
