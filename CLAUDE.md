# YancoCup

Multi-competition soccer prediction platform with AI-powered news. World Cup 2026 + Champions League + top European leagues. 3D interactive globe, live scores, predictions game with pools, broadcast links, gamification, multilingual, auto-curated team news.

**Current phase:** Live and in public testing. All V2 features shipped. Ongoing: performance, design elevation, security hardening, and live competition quality.

**Active work:** Team Page redesign (Sessions 58-63 in BUILD_PLAN.md). Hybrid design: cinematic command center + arabesque geometric patterns + collapsible accordions. See "Arabesque design system" section below.

**World Cup 2026:** June 11, 2026. App is live now at https://yamanaddas.github.io/YancoCup/ with active championships running.

---

## Stack

- **Frontend**: Vite 8 + React 19 + Tailwind CSS 4
- **Globe**: r3f-globe (by Vasturiano) + React Three Fiber + Three.js — NOT custom globe from scratch
- **Backend proxy**: Cloudflare Workers with Hono (API key vault + caching)
- **Database**: Supabase free tier (auth, predictions, pools, leaderboard, news, unlimited realtime)
- **Live scores**: football-data.org free tier (10 req/min) — WC, CL, PL, PD, BL1, SA, FL1, EC
- **Live scores fallback**: API-Football (100 req/day + Cron Trigger + KV cache)
- **Live score delivery**: Cron Triggers poll upstream (`*/5 * * * *` pre-WC, switch to `* * * * *` during WC June 11–July 19), write to KV. Users read KV only.
- **AI News**: Cloudflare Workers AI (Llama 3.1 8B + m2m100) — 3-5 sentence summaries, always attributed
- **Static data**: WC schedule/teams/groups/venues in `src/data/`. Leagues from Worker.
- **Flags**: circle-flags (circular SVG, open source)
- **Club crests**: football-data.org API crest URLs (hotlinked, never bundled)
- **Icons**: Lucide React — functional UI only (see icon rules)
- **State**: React hooks, no global state library
- **Testing**: Vitest — `npm run test` covers `src/**/*.test.ts` and `worker/**/*.test.ts`
- **Error monitoring**: Sentry free tier — active
- **Analytics**: Cloudflare Web Analytics — active
- **Deploy**: GitHub Pages via `gh-pages` branch
- **i18n**: Client-side runtime translation, 6 languages (EN, AR, ES, FR, DE, PT)

## Live deployments

- **Frontend**: https://yamanaddas.github.io/YancoCup/
- **Worker**: https://yancocup-api.catbyte1985.workers.dev/
- **Supabase**: vxmopqjpqqdlkfceufru (shared YancoVerse project)

---

## MANDATORY: Pre-implementation protocol

### Quick fix (color, copy, single-line change)
1. Grep to verify what exists before touching anything
2. Make the change
3. Done — skip the rest

### New component or feature
Complete all steps before writing code.

**Step 1 — Intent**
One sentence: what does this feel like to the user? Not what it does — what it *feels* like.

**Step 2 — Audit what exists**
Grep for similar components. Reuse before creating. Never reinvent.

**Step 3 — Design spec (all UI work)**
- Exact layout (flex/grid, columns, gaps)
- Every color token by name (not hex — reference globals.css names)
- All five states: loading, empty, error, success, default
- Hover and active states
- Animation: which class, timing, easing
- Mobile behavior
- One sentence on why this is distinctly YancoVerse and not generic

**Step 4 — Self-critique the spec**
"Could this appear on any other website?" If yes — not done. Push until no.

**Step 5 — Failure modes**
What breaks this? Error path? Empty state? Offline behavior?

**Step 6 — Implement**
Only after steps 1-5.

**Step 7 — Post-implementation critique**
Before marking complete: "What would a senior UI designer flag? What's still generic? Does this match the spec?"

---

## CRITICAL: GlobeScene bundle size

**The #1 performance issue in the codebase.**

`GlobeScene.js` is **2.0MB uncompressed** in the current build. Even gzipped it is likely 800KB–1.2MB. This is a significant loading problem on mobile.

**Already correctly implemented — do not re-do these:**
- `frameloop="demand"` — renders only on interaction ✅
- `dpr={device.isMobile ? [1, 1.5] : [1, 2]}` — responsive pixel ratio ✅
- `React.lazy()` + `Suspense` in GlobeView — lazy loaded ✅
- `GlobeErrorBoundary` — WebGL crash protection ✅
- Mobile/low-end device detection ✅

**Not implemented:**
- IntersectionObserver to stop rendering when globe scrolls off-screen
- Bundle composition analysis to find what's driving 2MB

**Before adding any globe feature:** run `npx vite-bundle-visualizer` to understand what's in the 2MB. Do not make it larger without a clear reason.

---

## Design system — YancoVerse aesthetic

**Single source of truth: `src/styles/globals.css`. Anything conflicting with it is wrong.**

Design language: **cinematic command center**. Gaming lounge aesthetic, not ESPN. Atmospheric dark UI, not Bootstrap dark theme.

### Design quality bar

Before shipping any UI: "Does this look like it belongs in the same universe as Linear (interaction precision), Letterboxd (atmospheric dark), or SofaScore (sports data density)? Or does it look like a template?"

If the latter — it's not done.

### Color tokens (@theme in globals.css)

```
--color-yc-bg-deep:       #060b14    /* page background — deep navy, NOT black */
--color-yc-bg-surface:    #0c1620    /* cards, panels */
--color-yc-bg-elevated:   #121e30    /* hover states, modals */

--color-yc-green:         #00ff88    /* primary accent */
--color-yc-green-muted:   #00cc6a    /* secondary accent */
--color-yc-green-dark:    #004d29    /* green on dark fills */

--color-yc-text-primary:  #dde5f0
--color-yc-text-secondary:#8a9bb0
--color-yc-text-tertiary: #3d4f63

--color-yc-border:        #142035
--color-yc-border-hover:  #1e3050

--color-yc-danger:        #ff4757
--color-yc-warning:       #ffc800
--color-yc-info:          #4488ff
```

### Glass and glow tokens (:root in globals.css)

```
--yc-bg-glass:              rgba(8, 16, 28, 0.88)
--yc-bg-glass-light:        rgba(12, 22, 40, 0.75)
--yc-accent-glow:           rgba(0, 255, 136, 0.35)
--yc-accent-dim:            rgba(0, 255, 136, 0.08)
--yc-border-accent:         rgba(0, 255, 136, 0.12)
--yc-border-accent-bright:  rgba(0, 255, 136, 0.25)
```

### Typography

- **Headings**: Space Grotesk (font-heading), weight 500-700
- **Body**: Inter (font-body), weight 400-500
- **Data/scores**: JetBrains Mono (font-mono)

Loaded via `<link>` in index.html. Never `@import` in CSS.

### Spacing

Tailwind 4 default scale. No arbitrary values like `mt-[13px]`. Use the nearest Tailwind utility. If a value genuinely isn't in the scale, add it to globals.css with a comment.

### Available animation classes (defined in globals.css)

```
.animate-breathe / .yc-breathe       — breathing glow for live elements
.animate-shimmer / .yc-shimmer        — shimmer sweep
.animate-fade-in / .yc-fade-in        — fade + translateY entrance
.animate-slide-up / .yc-slide-up      — slide up entrance
.yc-hex-enter / .yc-hex-materialize   — 3D materialize for hex cards
.yc-points-reveal                      — post-match points animation
.yc-crystal-reflect                    — crystal surface reflection
.yc-border-pulse                       — border pulse for active states
```

Always add `@media (prefers-reduced-motion: reduce)` to disable non-essential animations.

### Icon rules

- **Lucide React**: functional UI only — close, search, arrow, chevron, menu, calendar, info, etc.
- **Thematic / sport-specific / decorative**: custom inline SVG, designed to match YancoVerse. Never Lucide for these.
- Import individually: `import { Search } from 'lucide-react'`

### Arabesque design system (Team Page and beyond)

Design extension for pages requiring cultural identity and premium feel. Built on top of the core YancoVerse tokens. The arabesque vocabulary is a **layer of polish**, never structural — if patterns fail to render, the page must look complete without them.

**Philosophy:** "Cinematic command center framed in geometric elegance." Structure from Linear, density from SofaScore, emotion from EA FC, glass from Dribbble, soul from arabesque geometry.

**4 reusable SVG patterns** (defined in `src/components/ui/ArabesquePatterns.tsx`):

| Pattern | Size | Use |
|---------|------|-----|
| Lattice overlay | 120px tile, 3-5% opacity | Hero backgrounds, page-level atmosphere |
| Geometric band | 12px tall strip | Section dividers, expanded accordion borders |
| Corner accents | 8px star-polygon clusters | Featured cards (Next Match, Prediction CTA) |
| Star divider | Inline diamond/star | Stat separators, list bullets |

**Pattern rules:**
- Opacity: 3-8% only. Pattern is felt, not read. At 10%+ it competes with content.
- Fragment, don't frame: let patterns bleed off edges, show partial rosettes
- Monochrome: only `yc-green` at varying opacities. No multicolor fills.
- Sparse: one geometric moment per viewport. Scarcity = luxury.
- Gold accent (`yc-warning` #ffc800 at 8% opacity) at star intersections only — traditional Islamic green+gold pairing, used sparingly.
- Every pattern SVG under 2KB. Total arabesque weight under 8KB for any page.
- All patterns use `currentColor` — inherit from parent, override via class.

**Accordion component pattern:**
- Header: icon + title + summary text + chevron (rotates 180deg, 300ms ease)
- Expand: `max-height` transition 350ms `cubic-bezier(0.4, 0, 0.2, 1)`, opacity 0→1 over 200ms
- Multiple sections open simultaneously (independent, not exclusive)
- Collapsed: title + one-line summary + item count badge
- Expanded bottom border: geometric band replaces plain line
- `prefers-reduced-motion`: instant display toggle, no animation

**New animation classes** (add to globals.css):
```
.yc-star-breathe          — opacity 4%→8% on 4s cycle (live indicators)
.yc-geometric-drift       — 720s full rotation for hero rosettes (imperceptible)
.yc-accordion-expand      — max-height + opacity, 350ms ease
```

**Octagonal frames:**
- `.yc-octagonal` — CSS `clip-path: polygon()` creating octagonal shape
- Use on: hero crest frame, prediction CTA card only. Never on all cards.

**Team-color personalization:**
- API returns `clubColors` per team — use as subtle radial gradient (4% opacity) in hero background
- Each team page feels unique without needing photography (Apple Sports pattern)

**Responsive arabesque scaling:**
| Breakpoint | Pattern treatment |
|------------|------------------|
| Mobile (<640px) | Corner accents only, no full lattice |
| Tablet (640-1024px) | Partial lattice overlay |
| Desktop (>1024px) | Full lattice + geometric wing |

**What makes this distinctly YancoVerse (not generic):**
1. No other sports app uses arabesque geometric patterns as structural UI elements
2. Collapsible sections with geometric expansion borders (plain line → ornate band on expand)
3. Arch-shaped CTA card via CSS clip-path references Islamic architecture
4. Octagonal crest frame references geometric tiling
5. Green accent appears through geometric shapes, not just borders/text

### Anti-patterns (zero exceptions)

- White or light backgrounds
- Pure black (#000 or #0a0a0a) — use #060b14
- #00e5c1 or #00b89a — accent is #00ff88 only
- Generic blue/red sports scheme
- Bootstrap or MUI feel
- Arbitrary spacing values
- Lucide for decorative/thematic icons
- Light mode — always dark
- Globe blocking all content above fold

---

## State design standards

Every component with dynamic data needs all five states before implementation.

**Loading** — skeleton screens, not spinners. Match exact shape of loaded content. Background #0c1620, shimmer to #142035.

**Empty** — never a blank container. Meaningful message + context. Examples: "No predictions yet — make your first pick", "Your pool is waiting for friends". Should feel intentional.

**Error** — never raw error messages. Friendly message + next action. Retry if applicable. Log to Sentry silently.

**Success** — confirm actions visually. Brief animation (300ms) then settle. Use `.yc-points-reveal` for scoring moments.

**Offline/degraded** — show cached data with "Live scores temporarily unavailable" badge. Never white-screen on API failure.

---

## Testing

Tests exist and are configured. `npm run test` covers both frontend (`src/`) and worker (`worker/`).

```bash
npm run test          # all tests
npm run test:watch    # watch mode
npm run typecheck     # TypeScript strict
npm run lint          # ESLint
npm run build         # production build — always run before committing
```

### Confirmed test coverage

- `src/lib/scoring.test.ts` — scoring engine (good coverage)
- `src/lib/badges.test.ts`
- `src/lib/competitions.test.ts`
- `src/lib/i18n.test.ts` + `i18n-data.test.ts`
- `src/lib/notifications.test.ts`
- `src/lib/ranks.test.ts`
- `src/lib/share.test.ts`
- `src/lib/formatDate.test.ts`
- `src/lib/canPredict.test.ts`
- `src/hooks/useCompetitionSchedule.test.ts`
- `src/hooks/useLeaderboard.test.ts`
- `worker/src/newsPipeline.test.ts`
- `worker/src/transformMatch.test.ts`
- `worker/src/workerUtils.test.ts`

### Known gaps (no tests)
- Supabase RLS policies — managed in dashboard, cannot be unit tested
- Globe rendering — requires browser environment
- Full prediction flow end-to-end

---

## Security

### Supabase RLS
Policies are managed in the Supabase dashboard only. There are no SQL migration files in this repo. Policies cannot be reviewed from code — must be audited directly in the dashboard.

**Required audit (dedicated session):**
Dashboard → each table → RLS policies. Check:
- `yc_predictions`: other users' predictions hidden until kickoff
- `yc_pools`: read restricted to members only
- `yc_pool_messages`: read/write restricted to pool members
- `yc_articles`: public read, service-role write only
- `profiles_public`: public read, own-user write only

### API key hygiene
- `VITE_` prefix only for public values
- Worker secrets via `wrangler secret put` — never in wrangler.toml or code

### Input validation
- User text inputs (pool names, chat, display names): sanitize before insert, strip HTML, limit length
- Client-side scoring: known exploitability risk, documented and accepted at current scale

---

## Known data pipeline issues (V4 audit, April 2026)

> Full details in REDTEAM_FINDINGS.md v4, findings 27-44. Sessions mapped in BUILD_PLAN.md.

### Critical/High — must fix before WC

| Issue | Impact | Fix session | Status |
|-------|--------|-------------|--------|
| No retry on football-data.org failure (#27) | 5 min of stale scores on any API blip | 51 | **FIXED** — `fetchWithRetry` added (2 retries, 1s/3s backoff) |
| No timeout on API-Football fetch (#28) | Worker hard-kill loses all tick data | 51 | Open |
| API-Football fixture matching broken (#29) | Lineups missing for MCI, MUN, RMA, FCB, etc. | 52 | Open |
| KV writes may exceed free-tier limit (#31) | Scores freeze after ~2 hours on busy days | 53 | **MITIGATED** — change detection skips unchanged writes. ~200-400/day vs ~2,880 before. Still possible on very busy WC days. |

### Medium — should fix before WC

| Issue | Impact | Fix session | Status |
|-------|--------|-------------|--------|
| Match detail TTL always 24h (#32) | Live match KV entry stale | 53 | **FIXED** — TTLs: live=2min, finished=10min, upcoming=5min |
| Scrape failure counter never resets (#34) | Articles permanently stuck | 54 | Open |
| News summarize too slow (#35) | Backlog grows, articles take days | 54 | Open |
| Admin auth uses hardcoded backdoor (#37) | Security risk | 55 | Open |
| Silent cron errors (#38) | Stale data with no alerting | 51 | **FIXED** — `lastError` field in health endpoint, error stored in KV |
| useScores has no error state (#39) | "No matches" vs "API down" indistinguishable | 56 | Open |
| useAutoScore race condition (#40) | Possible double-scoring on navigation | 57 | Open |
| api.ts returns null for all errors (#44) | No error differentiation anywhere | 56 | Open |

### Low — fix when convenient

| Issue | Impact |
|-------|--------|
| `all:live` TTL barely above cron interval (#33) | Brief "no live" windows |
| Title dedup too lenient (#36) | Occasional duplicate articles |
| AbortController self-abort (#41) | Harmless but confusing code |
| Pool chat profile cache unbounded (#43) | Slow memory growth |
| Unbounded reply fetch (#42) | Performance on viral articles |

---

## Disaster scenarios

**football-data.org down during a match:**
- `fetchWithRetry` retries 2x with 1s/3s backoff. If all fail, tick is lost but cron recovers next tick.
- Stale-status cleanup runs independently (outside try/catch): any match >4h past kickoff is auto-marked FINISHED regardless of API state.
- Client-side fallback in MatchCard: matches >4h past kickoff show as "FT" even if Worker KV is stale.
- KV cache serves last-known data (stale but functional)
- "Live scores temporarily unavailable" badge is NOT currently shown — frontend can't distinguish error from empty (#39)
- Health endpoint now includes `lastError` field for debugging (`/api/health`)

**KV write limit exhausted:**
- Free tier: 1,000 writes/day. Change detection reduces to ~200-400 writes/day.
- If exhausted: `kvPut` swallows errors silently, scores freeze, stale cleanup can't write fixes.
- Client-side MatchCard fallback still marks past matches as FT visually.
- Resets at midnight UTC. Scores backfill on next successful cron tick.

**Supabase down:**
- Predictions, leaderboard, pool chat unavailable — graceful degraded message
- Static pages (schedule, globe, bracket) still functional

**Worker down:**
- KV persists independently
- GitHub Pages static files always up
- Worst case: stale scores, but app is usable
- Health endpoint `/api/health` shows `lastPoll`, `cronErrorCount`, `lastError` for debugging

---

## Social sharing (current state)

OG and Twitter card meta tags exist in index.html. Current gaps:
- `og:image` is logo-192.png — a small logo, not a 1200×630 share image
- `twitter:card` is `summary` — should be `summary_large_image` for full-width previews on Twitter/X

These work but share previews are not optimized. Future improvement, not blocking.

---

## Project structure

```
src/
  components/
    globe/          # GlobeScene.tsx (2MB — see performance note), GlobeView.tsx, CityPopup.tsx
    match/          # MatchCard, GroupTable, TeamCrest
    predictions/    # PredictionCard, RivalsSection, HowToPlay
    pool/           # PoolChat, PoolRecap, SocialShareButtons
    activity/       # ActivityFeed
    comments/       # CommentCard, CommentComposer, CommentsSection, CommentThread
    ui/             # ArabesquePatterns, Accordion — reusable design system components
    layout/         # NavBar, MobileNav, AppLayout, Skeleton, Countdown, LanguageSwitcher, ErrorFallback
  hooks/            # useAutoScore, useCompetitionSchedule, useLeaderboard, useScores, useScoring,
                    # useActivityFeed, useConsensus, useLiveResults, usePoolChat, useReactions, etc.
  lib/              # scoring, badges, competitions, i18n, auth, ranks, share, shareCard,
                    # api, sentry, supabase, notifications, CompetitionProvider
  data/             # teams.json, groups.json, schedule.json, venues.json, cities.json,
                    # broadcasters.json, match-id-map.json, translations/ (6 languages)
  styles/           # globals.css — single source of truth
  pages/            # All route-level components
  types/            # index.ts
worker/
  src/index.ts      # 3,121 lines — god file (all Worker logic in one file)
  src/*.test.ts     # Worker tests
```

---

## Commands

```bash
npm run dev          # local dev
npm run build        # production build — always run before committing
npm run preview      # preview production build
npm run deploy       # build + push to gh-pages
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript strict
npm run test         # all Vitest tests (src + worker)
npm run test:watch   # Vitest watch mode
cd worker && npm run dev      # Worker local dev
cd worker && npm run deploy   # deploy Worker
```

---

## Multi-competition architecture

### Competitions

Defined in `src/lib/competitions.ts` — `CompetitionConfig` registry with `id`, `fdCode`, `name`, `type`, `hasGroups`, `staticSchedule`, `seasonLabel`.

**CL:** Swiss-model league phase since 2024/25 — 36 teams, single table, no groups. `hasGroups: false` is correct.

### Routing

```
/                           → Home
/:competition/overview      → Competition hub
/:competition/matches       → Matches
/:competition/groups        → Groups (tournaments only)
/:competition/standings     → Standings (leagues only)
/:competition/predictions   → Predictions
/:competition/leaderboard   → Leaderboard
/:competition/pools         → Pools
/:competition/match/:id     → Match detail
/:competition/team/:teamId  → Team profile
/:competition/bracket       → Bracket (tournaments only)
/:competition/news          → Competition news
/news                       → Global news
/news/:slug                 → Article
/watch                      → Broadcast finder
/profile                    → Own profile
/profile/:userId            → Public profile
/sign-in                    → Auth
/admin                      → Admin
/pool/:joinCode             → Pool join deeplink
```

### Scoring

Base: 10 (exact) / 5 (GD) / 3 (result) / 0 (wrong)
Quick-predict (leagues, 1X2): 2 / 0
Modifiers: upset +3 (tournaments), knockout 1.5x-3x, joker 2x, streak +2/+5/+10

Known risk: client-side, exploitable, accepted at current scale.

### Cron

Current: `*/5 * * * *` (288 ticks/day). Switch to `* * * * *` in wrangler.toml during WC.

**Implemented safeguards:**
- `fetchWithRetry` — 2 retries with 1s/3s backoff on upstream failures (#27 fixed)
- Change detection — KV writes only when data differs from existing (JSON compare). Reduced from ~2,880 to ~200-400 writes/day (#31 mitigated)
- Stale-status cleanup — runs outside main try/catch, marks any non-FINISHED match >4h past kickoff as FINISHED. Handles IN_PLAY, PAUSED, TIMED, SCHEDULED.
- `lastError` stored in KV for debugging via `/api/health` (#38 fixed)
- Tick counter and lastPoll written every 5th tick (not every tick) to save KV budget

**Remaining gaps:**
- No early-exit when no live matches — makes upstream call every tick regardless (#26)
- Switching to `* * * * *` for WC will 5x the tick count — need to verify KV budget holds

---

## Worker architecture

- 3,121 lines in a single file — god file. Do not add to it without considering extraction.
- Cache miss on `/api/:comp/matches` hits upstream once then caches. WC is protected (`[]` on miss). Leagues do hit upstream on cold cache — no concurrent request lock.
- API-Football used for match enrichment (lineups, stats) on a per-tick budget of max 3 enrichments. Not a score fallback.
- `fetchWithRetry` — 2 retries with backoff on all upstream calls (#27 fixed)
- Change detection on KV writes — only writes when JSON differs (#31 mitigated, ~200-400 writes/day)
- Stale-status cleanup runs outside main try/catch — auto-expires matches >4h past kickoff
- Health endpoint returns `lastPoll`, `tickCount`, `cronErrorCount`, `lastError`
- **API-Football fixture matching is broken** — uses TLA substring match against full team names. Fails for MCI, MUN, RMA, FCB, PSG, and many others. Lineups are silently missing (#29)
- **No timeout** on API-Football fetches — can hard-kill the Worker (#28)
- **Admin endpoints** use ADMIN_KEY secret or football-data.org API key as auth (#37 partially improved)

---

## Database tables

```
yc_predictions      — competition-scoped, hidden until kickoff
yc_pools            — competition-scoped
yc_pool_members
yc_pool_messages    — Supabase Realtime
yc_badges
yc_user_badges
yc_streaks
yc_articles         — AI news summaries
yc_reactions
profiles_public     — rivals UUID[]
```

---

## Environment variables

```bash
# .env (gitignored)
VITE_SUPABASE_URL=https://vxmopqjpqqdlkfceufru.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_ADMIN_USER_ID=...
VITE_SENTRY_DSN=...
VITE_WORKER_URL=https://yancocup-api.catbyte1985.workers.dev

# Worker secrets (wrangler secret put — never in code)
FOOTBALL_DATA_API_KEY
API_FOOTBALL_KEY
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

---

## Workflow rules

1. **Pre-implementation protocol first.** No code without completing the appropriate steps.
2. **Plan before code.** State which files change and why.
3. **One task per session.** Note related work, don't scope-creep.
4. **Commit after every task.** Descriptive message, separate commits per logical change.
5. **Never commit secrets.**
6. **Static export.** GitHub Pages, HashRouter, `base: "/YancoCup/"`.
7. **Build before commit.** `npm run build` before any UI commit.
8. **Verify via grep.** File reads can be stale. Always `grep -n` to confirm edits landed.
9. **Design review.** Before done: "Is this distinctly YancoVerse or generic?"

---

## What Claude gets wrong on this project

### Deployment & architecture
- Forgetting GitHub Pages is static — no server routes
- API keys in `.env` bundled by Vite — `VITE_` only for public values
- Triggering upstream calls on user requests — Cron populates KV, users read KV
- Over-engineering scoring with Edge Functions — client-side
- HashRouter + Supabase auth redirect interaction

### Design
- Dark mode media queries — always dark, no light mode
- #0a0a0a or black backgrounds — use #060b14
- #00e5c1 or teal accent — accent is #00ff88
- Globe full-screen — content above fold
- Arbitrary spacing — use Tailwind scale
- Lucide for decorative icons — custom SVG only
- Skipping any of the five states
- Arabesque patterns above 8% opacity — they compete with content
- Multicolor geometric patterns — monochrome green only
- Arabesque on every card — sparse placement, one moment per viewport
- Full centered rosettes — fragment and bleed off edges for modern feel
- SVG patterns over 2KB each — keep lightweight, use `<pattern>` tiles
- Forgetting `prefers-reduced-motion` on geometric animations

### Data & API
- BALLDONTLIE — NBA, not soccer
- Per-competition polling — use `/v4/matches` (one call)
- Static schedules for leagues — only WC is static
- Assuming API-Football fixture matching works — it's broken for most top clubs (#29)
- Assuming KV writes are unlimited — free tier is 1,000/day. Change detection mitigates but doesn't eliminate on busy WC days (#31)
- Forgetting `timeZone: "UTC"` on `toLocaleDateString` — all match dates must use UTC or they shift -1 day in western timezones
- Lowercasing league TLAs — causes false collisions with WC team IDs (e.g., "ESP" Espanyol → "esp" Spain)
- Assuming `apiFetch()` returning null means "no data" — it also means "Worker down" (#44)
- xG, heatmaps, player ratings — not available on free tier
- Adding to worker/src/index.ts without noting god file concern

### Competition logic
- Global pools — competition-scoped
- Showing predictions before kickoff — hidden until deadline
- Hardcoded zone config — per-competition
- CL traditional groups — Swiss model since 2024/25

### News
- Scraping sites — RSS only
- Full article reproduction — 3-5 sentence summaries, max_tokens: 400 in Worker prompt
- News cron more than every 4 hours
- No source attribution

### Security
- New Supabase tables without noting RLS must be set in dashboard
- Not sanitizing user input before insert
