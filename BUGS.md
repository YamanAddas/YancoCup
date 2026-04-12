# YancoCup — Known Issues & Technical Debt

## Critical (must fix before World Cup launch)

### BUG-001: ~~Client-side scoring race condition~~ MITIGATED
**Status:** Two guards prevent double-scoring:
1. **Database guard:** `useScoring.ts` uses `.is("scored_at", null)` — Supabase conditional update only writes if `scored_at` is null. Second concurrent scorer's write is silently ignored.
2. **Client guard:** `useAutoScore.ts` has module-level `scoringInProgress` flag + 5-minute throttle. Prevents rapid re-scoring within the same client.
**Remaining concern:** Scoring is still client-side. Preferred long-term fix is Worker-side scoring after match results are confirmed.

### BUG-002: Verify football-data.org covers World Cup 2026 live
**What:** The free tier page lists "Worldcup" but the 2026 tournament hasn't started yet. Live score polling hasn't been tested against an active World Cup.
**Impact:** If live scores don't flow during the World Cup, the core product is broken.
**Fix:** Test the API endpoint `GET /v4/competitions/WC/matches` before June 11. Have API-Football fallback cron ready and tested.

### BUG-003: KV cache staleness during live matches
**What:** Cron polls every 60 seconds and writes to KV. Users read KV. During live matches, scores can be up to 60 seconds stale.
**Impact:** User sees old score, refreshes, still sees old score (KV hasn't updated).
**Fix:** Add `last_updated` timestamp to KV response. Display "Updated X seconds ago" on live match cards. Consider reducing cron interval to 30s during matchday hours.

## High (should fix, impacts user experience)

### BUG-004: Missing loading/empty/error states
**What:** Several components show blank areas or raw error text when data is unavailable.
**Affected:** Team pages with no news, empty pool chat, competition pages before season starts.
**Fix:** Systematic audit — every data-fetching component needs skeleton/empty/error treatment.

### BUG-005: RTL layout issues in Arabic — PARTIALLY RESOLVED
**What:** Some components used `margin-left` / `text-right` instead of logical properties.
**Status (Session 65):** Fixed in MatchCard, PredictionCard, LeaderboardPage, StandingsPage — replaced `text-left/right` → `text-start/end`, `ml-/mr-` → `ms-/me-`.
**Remaining:** Full page-by-page RTL audit needed. Test every page in Arabic mode.

### BUG-006: Globe performance on low-end mobile — PARTIALLY RESOLVED
**What:** The R3F globe can cause frame drops and battery drain on older phones.
**Status:** `frameloop="demand"` active. `dpr` scaling for mobile. `GlobeErrorBoundary` catches WebGL crashes. Device detection reduces quality on low-end.
**Remaining:** IntersectionObserver to stop rendering when globe scrolls off-screen. Consider static SVG map for mobile.

### BUG-007: Inconsistent design tokens
**What:** Some components use hardcoded hex values instead of CSS custom properties. The design tokens in globals.css may not match STYLE.md exactly.
**Fix:** Grep for hardcoded color values (`#0a0a0a`, `#1a1a1a`, `#00ff88`, etc.) and replace with `var(--yc-*)`. Reconcile globals.css with STYLE.md as the source of truth.

## Medium (improve when possible)

### DEBT-001: ~~No automated tests~~ RESOLVED
**Status:** 13 test files covering scoring, i18n, badges, ranks, formatting, hooks, and worker logic. See CLAUDE.md "Confirmed test coverage" for full list.
**Remaining gap:** No component/page tests, no E2E tests.

### DEBT-002: No Supabase migrations in repo
**What:** Database schema is managed via Supabase dashboard. No version-controlled migration files.
**Impact:** Schema changes can't be reviewed or rolled back.
**Fix:** Export current schema. Add migration files to `supabase/migrations/`. Use Supabase CLI for future changes.

### DEBT-003: Worker error monitoring
**What:** Sentry is configured for the frontend but not the Worker.
**Impact:** Worker errors (API failures, KV write failures) are silent.
**Fix:** Add Sentry to the Cloudflare Worker.

### DEBT-004: No CI/CD pipeline
**What:** Deployment is manual (`npm run deploy` for frontend, `wrangler deploy` for worker).
**Impact:** Easy to deploy broken code.
**Fix:** Add GitHub Actions: lint + typecheck + build on every PR. Auto-deploy on merge to main.

## Low (backlog)

### DEBT-005: ~~Bundle size — globe code splitting~~ RESOLVED
**Status:** GlobeScene is lazy-loaded via `React.lazy()` + `Suspense` in `GlobeView.tsx`. Three.js is only loaded when the globe renders. `GlobeScene.js` chunk is 2MB — still large but isolated.
**Remaining concern:** The 2MB chunk itself. Bundle composition analysis not yet done.

### DEBT-006: SEO limitations
**What:** GitHub Pages + HashRouter + SPA means no server-side rendering. Social media link previews show generic metadata.
**Impact:** Shared links to specific matches or predictions show generic YancoCup title/image.
**Fix:** Add dynamic `<meta>` tags via a Cloudflare Worker proxy for social sharing URLs. Or accept this limitation for now.

### DEBT-007: Pool cleanup
**What:** No mechanism to archive or delete inactive pools.
**Fix:** Add `archived_at` field. Auto-archive pools with no activity for 30 days.

## Regressions to watch

- **Prediction scoring:** Any change to `scoring.ts` must be verified against all scoring scenarios (exact, GD, result, wrong, upset, joker, streak, knockout multiplier).
- **Competition config:** Adding a new competition requires updates in `competitions.ts`, the Worker cron, and potentially KV namespace setup.
- **Auth flow:** HashRouter + Supabase auth token handling is fragile. The token extraction in `main.tsx` must happen before HashRouter mounts.
- **RTL:** Any new component must work in both LTR and RTL. Test with Arabic selected.
