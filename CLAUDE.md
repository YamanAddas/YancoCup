# YancoCup

Multi-competition soccer prediction platform with AI-powered news. World Cup 2026 + Champions League + top European leagues. 3D interactive globe, live scores, predictions game with pools, broadcast links, gamification, multilingual, auto-curated team news.

**Current phase:** V2 Complete — all features shipped. Pre-launch polish and bug fixes before World Cup 2026 kickoff.

**World Cup 2026 launch target:** June 11, 2026. All 48 teams are finalized — qualifying completed March 31, 2026. Static data (groups.json, teams.json, schedule.json) is up to date. Group stage matches have resolved team IDs; knockout matches correctly have null teams with placeholders.

## Stack

- **Frontend**: Vite 8 + React 19 + Tailwind CSS 4
- **Globe**: r3f-globe (by Vasturiano) + React Three Fiber + Three.js — NOT custom globe from scratch
- **Backend proxy**: Cloudflare Workers with Hono (API key vault + caching)
- **Database**: Supabase free tier (auth, predictions, pools, leaderboard, news articles, unlimited realtime)
- **Live scores**: football-data.org free tier (10 req/min) — covers WC, CL, PL, PD, BL1, SA, FL1, EC
- **Live scores fallback**: API-Football (100 req/day + Cron Trigger + KV cache)
- **Live score delivery**: Cloudflare Cron Triggers poll upstream, write to KV. User requests read KV only.
- **Key API optimization**: `/v4/matches` (no competition filter) returns ALL competitions in one call — 2-3 req/min for all competitions combined
- **AI News**: Cloudflare Workers AI (free tier, Llama 3.1 8B) rewrites RSS articles from 18+ sources (EN/AR/ES/DE/FR/PT)
- **News sources**: RSS feeds from BBC Sport, Al Jazeera, Kooora, beIN Sports, Guardian, ESPN, Marca, Kicker, Gazzetta, L'Equipe + more
- **Static data**: WC schedule/teams/groups/venues in `src/data/`. League schedules fetched from Worker.
- **Flags**: circle-flags (circular SVG country flags, open source)
- **Club crests**: football-data.org API `crest` URLs (hotlinked, never bundled) — see copyright strategy below
- **Icons**: Lucide React (open source, dark-theme friendly)
- **State**: React hooks for component-local state (no global state library currently in use)
- **Error monitoring**: Sentry free tier (5K errors/month) — active
- **Analytics**: Cloudflare Web Analytics (free, unlimited, no cookies) — active
- **Deploy**: GitHub Pages via `gh-pages` branch
- **i18n**: Client-side runtime translation, 6 languages (EN, AR, ES, FR, DE, PT)

## Live deployments

- **Frontend**: https://yamanaddas.github.io/YancoCup/
- **Worker**: https://yancocup-api.catbyte1985.workers.dev/
- **Supabase**: vxmopqjpqqdlkfceufru (shared YancoVerse project)

## Project structure

```
src/
  components/       # React components
    globe/          # Three.js globe and city markers
    match/          # Match center, live scores, schedule, standings, TeamCrest, events, stats
    predictions/    # Prediction cards, how-to-play, pools, badges
    broadcast/      # Broadcaster links
    activity/       # Friend activity feed
    news/           # News cards, related articles
    pool/           # Pool chat, pool recaps
    layout/         # Nav, footer, language switcher, mobile nav, skeletons
  hooks/            # Custom React hooks (competition-aware)
  lib/              # Utilities, API clients, i18n, auth, scoring, competitions, ranks, badges
  data/             # Static JSON: teams, groups, venues, schedule, translations, broadcasters
  styles/           # Global CSS (globals.css — single source of truth for design tokens)
  pages/            # Route-level components (incl. MatchDetailPage, TeamPage, ProfilePage, NewsPage, ArticlePage)
  types/            # TypeScript type definitions
worker/             # Cloudflare Worker source (separate deploy)
docs/               # V2 upgrade plan
```

## Commands

- `npm run dev` — local dev server (Vite)
- `npm run build` — production build (outputs to `dist/`)
- `npm run preview` — preview production build locally
- `npm run deploy` — build + push to `gh-pages` branch
- `npm run lint` — ESLint
- `npm run format` — Prettier
- `npm run typecheck` — TypeScript check
- `cd worker && npm run dev` — Worker local dev
- `cd worker && npm run deploy` — deploy Worker to Cloudflare

## Code style

- TypeScript strict mode. No `any` unless explicitly justified with a comment.
- ES modules only. No CommonJS.
- Functional components with hooks. No class components.
- Destructure imports: `import { useState } from 'react'`
- Tailwind for styling. No CSS modules, no styled-components, no inline style objects.
- Component files: PascalCase (`MatchCard.tsx`). Utilities: camelCase (`formatDate.ts`).
- One component per file. Co-locate component-specific hooks and types in the same directory.
- React Router v7 — currently using v6-compatible `<Routes>/<Route>` patterns. Do NOT introduce loader/action patterns or v7 data APIs without a planned migration.

## Design system — YancoVerse aesthetic

IMPORTANT: This is not a generic sports site. It follows the YancoVerse design language.

**The canonical design tokens live in `src/styles/globals.css`.** If anything below conflicts with globals.css, globals.css wins.

- **Background**: Deep navy (#060b14) with cosmic gradient — NOT pure black, NOT #0a0a0a
- **Surface**: #0c1620 (cards, panels)
- **Elevated**: #121e30 (hover states, modals)
- **Primary accent**: #00ff88 (signature green) — interactive elements, glow effects, active states, CTAs
- **Muted accent**: #00cc6a — borders, subtle indicators
- **Text**: #dde5f0 primary, #8a9bb0 secondary, #3d4f63 tertiary
- **Borders**: #142035 default, #1e3050 hover
- **Glass panels**: `var(--yc-bg-glass)` = `rgba(8, 16, 28, 0.88)` + `backdrop-filter: blur(16px)` + crystal gradient borders
- **Typography**: "Space Grotesk" for headings, "Inter" for body, "JetBrains Mono" for scores/data
- **Effects**: Glassmorphism panels, ambient orb glows, breathing animations on live elements, shimmer overlays, crystal borders, cosmic background gradient
- **Layout utilities**: `.yc-glass` (glass panel), `.yc-card` (crystal card), `.yc-card-glow` (active glow), `.yc-hex` (hex clip-path), `.animate-breathe` (breathing glow)
- **NO**: Bright backgrounds, generic sports-site blue/red schemes, stock photo vibes, flat corporate look, pure black backgrounds, #0a0a0a anywhere

When in doubt about visual direction, think: "cinematic immersion with depth, glow, and smooth motion" — matching YancoHub's hexagonal-glass aesthetic.

## Club crests — copyright strategy

- **National teams**: Use circle-flags (country flags, MIT license). Already implemented.
- **Club teams**: Use football-data.org API `crest` URLs (e.g., `https://crests.football-data.org/57.svg`). These are provided as part of the API response and intended for consumer apps. We hotlink — never download, bundle, or redistribute.
- **Fallback**: TLA badge in a styled circle when crest URL is unavailable.
- **Never** host crest files in the repo, use FIFA/UEFA official logos, or use player photos.
- The `<TeamCrest>` component handles all logic: circle-flag for national teams, API crest for clubs, TLA fallback.

## Completed features (V1 + V2)

These are live and working. Do not re-implement.

### Core platform (V1)
- Multi-competition architecture (WC, CL, PL, PD, BL1, SA, FL1, EL)
- Club crests via football-data.org API URLs + `<TeamCrest>` component
- Form guide dots on standings + zone coloring (CL/EL/relegation per competition)
- Match detail page — tabbed (Overview/Stats/Lineup/H2H) at `/:competition/match/:id`
- Bracket visualization — hexagonal nodes, 3D tilt, connector lines
- Team profile pages — squad, form, fixtures at `/:competition/team/:teamId`
- Gamification: badges (activity/skill), streak tracking, rank tiers (Bronze→Diamond)
- Profile pages — stats, badge collection, rank at `/profile`
- Pools — create/join, competition-scoped, join codes, deeplinks
- Skeleton loading screens
- Shareable prediction cards (Canvas API + Web Share)
- 3D interactive globe with stadium markers
- Activity feed with spoiler protection
- Community consensus visualization (H/D/A percentages)
- Leaderboard with podium, PPP, accuracy
- Browser notifications
- 6-language i18n (EN, AR, ES, FR, DE, PT)

### UX polish (V2 Phase 1)
- "Predicted" indicator (checkmark) on match cards
- "My Predictions Today" widget on home page
- Personalized greeting with rank
- Timezone display on match times
- Your prediction banner on match detail page (exact score + quick-pick, i18n)

### Predictions enhancement (V2 Phase 2)
- Quick-predict mode (1X2) for leagues — 3 buttons, max 2 pts, reduces fatigue
- Prediction streak counter on prediction page
- "Bold Prediction" tag for upset picks
- Post-match points reveal animation
- "Copy last matchday" button for leagues

### Leaderboard & social (V2 Phase 3)
- Matchday / weekly / monthly sub-leaderboards
- Rank movement arrows
- Pool leaderboard filter
- Pool chat (Supabase Realtime)
- Pool matchday recap (auto-generated, shareable)
- Pool admin controls (rename, remove members)
- Social share buttons (WhatsApp, Telegram, Twitter)
- Activity feed reactions
- Post-match result display in activity feed

### Profile & gamification depth (V2 Phase 4)
- Prediction history (paginated, filterable by competition)
- Accuracy breakdown (exact/GD/result/wrong visual bar)
- Competition-specific stats
- Loyalty badges (Opening Day, All-In, Marathon, Night Owl, Globe Trotter, Social Butterfly)
- Rivals system (pick 1-3 rivals, side-by-side comparison)
- Shareable profile card

### Standings, bracket & watch (V2 Phase 5)
- "If season ended today" banner on standings
- Sortable standings columns
- User predictions overlay on bracket
- Watch page: broadcaster lookup by country

### AI-powered news (V2 Phase 6)
- Cloudflare Workers AI (Llama 3.1 8B) rewrites RSS articles
- 18+ sources: BBC, Guardian, ESPN, Al Jazeera, Kooora, beIN, Marca, Kicker, Gazzetta, L'Equipe, and more
- Arabic sources: Al Jazeera Sport, beIN Arabic, Kooora, Yalla Kora, FilGoal, Goal.com Arabic, Arryadia, SSC
- Auto-curated team news pages (articles tagged by team ID)
- Competition-filtered news tabs
- Article pages with source attribution
- Worker cron fetches RSS every 4 hours, AI rewrites, stores in Supabase `yc_articles`

## Multi-competition architecture

### Competitions

Competitions are defined in `src/lib/competitions.ts` with a `CompetitionConfig` registry. Each has:
- `id` (e.g., `'WC'`), `fdCode`, `name`, `type` ('tournament' | 'league')
- `hasGroups`, `staticSchedule`, `seasonLabel`

**Note on Champions League:** Since 2024/25, the CL uses a Swiss-model league phase (36 teams in a single table) instead of traditional groups. `hasGroups: false` is correct. The bracket/knockout stage begins at the round of 16 (with a new "knockout round" play-off for teams finishing 9th-24th). Ensure bracket visualization handles this format.

### Routing

Routes are competition-scoped:
```
/                           → Home (competition cards, cross-competition matches)
/:competition               → Competition hub (redirects to /overview)
/:competition/overview      → Competition overview tab
/:competition/matches       → Match schedule
/:competition/groups        → Group tables (tournaments only)
/:competition/standings     → League table (leagues only)
/:competition/predictions   → Predict matches
/:competition/leaderboard   → Per-competition leaderboard
/:competition/pools         → Pool management
/:competition/match/:id     → Match detail (tabs: Overview/Stats/Lineup/H2H)
/:competition/team/:teamId  → Team profile (squad, form, fixtures, news)
/:competition/bracket       → Knockout bracket (tournaments only)
/:competition/news          → Competition news feed
/news                       → Global news feed
/news/:slug                 → Article page
/watch                      → Broadcast finder (global)
/profile                    → Own profile (badges, stats, rank, history)
/profile/:userId            → Public profile
/sign-in                    → Auth
/admin                      → Admin panel
/pool/:joinCode             → Pool join deeplink
```

### Data flow

- **WC schedule**: Static JSON in `src/data/schedule.json` (104 matches, known in advance)
- **League schedules**: Fetched from Worker `GET /api/:comp/matches` (300-380 matches, rescheduled often)
- **Live scores**: Worker cron polls `/v4/matches` (all competitions, 1 call) every 60s, writes per-competition KV entries
- **Predictions**: Stored in `yc_predictions` with `competition_id` column, using football-data.org API match IDs
- **Leaderboards**: Per-competition aggregation from `yc_predictions`
- **News articles**: Worker cron fetches RSS every 4h, AI rewrites, stores in `yc_articles` with team/competition tags

### Pools (private leagues)

- `yc_pools` table scoped by `competition_id`
- Join via code or shareable deeplink
- Pool-specific leaderboard
- Pool chat via `yc_pool_messages` (Supabase Realtime)
- Pool matchday recaps (client-side generated)
- Custom scoring config (JSONB)

### Scoring

Base: 10 (exact) / 5 (GD) / 3 (result) / 0 (wrong)
Quick-predict (1X2): 2 (correct result) / 0 (wrong) — leagues only
Modifiers: upset bonus (+3, tournaments), knockout multipliers (1.5x-3x), joker (2x, one per matchday), streak bonuses (+2/+5/+10)

**Known architecture concern:** Scoring is currently client-side (first user to load leaderboard triggers scoring for finished matches). This creates race conditions and is technically exploitable. Future improvement: move scoring to a Supabase RPC function (Postgres function) that computes points server-side. No Edge Functions needed — just an `rpc('score_predictions', { match_id, ... })` call. This is a V2+ improvement, not a blocker.

### League prediction fatigue mitigation

- Matchday-based UI (one matchday at a time)
- Per-match deadlines (not per-round)
- Quick-predict mode (home/draw/away, faster input, max 2 pts)
- Missed predictions = 0 pts (no penalty)
- Joker pick adds strategic depth
- "Copy last matchday" for repeat predictions

## Workflow rules

IMPORTANT: These rules are non-negotiable.

1. **Plan before code.** Before touching any file, write a brief plan (what files change, what the expected outcome is) and wait for approval.
2. **One task per session.** Do not scope-creep. If you discover related work, note it and move on.
3. **Commit after every completed task.** Descriptive commit message. Separate commits per logical change.
4. **Never commit secrets.** API keys go in `.env` (gitignored) or Cloudflare Workers secrets. Never hardcode.
5. **Static export.** The React app MUST work as a static site on GitHub Pages. No SSR, no server-side routes. Uses HashRouter with `base: "/YancoCup/"` in vite.config.ts.
6. **Test your build.** Run `npm run build` before committing UI changes. If it fails, fix it.
7. **When compacting**, preserve: current task status, list of modified files, any unresolved bugs.
8. **Verify changes via grep.** File reads can return stale cached content in long sessions. After editing, always `grep -n` the changed lines to verify the edit landed.

## API architecture

- Frontend NEVER calls external APIs directly (keys would leak in client JS).
- All external API calls go through the Cloudflare Worker.
- Worker endpoint pattern: `/api/:competition/scores`, `/api/:competition/standings`, `/api/:competition/match/:id`, `/api/:competition/teams`, `/api/match/:id/detail`, `/api/h2h/:id`
- **News endpoints**: `/api/news`, `/api/news/:slug`, `/api/:comp/news`, `/api/team/:teamId/news`
- **Cron Trigger architecture**: Worker polls `/v4/matches` (ALL competitions, one call) every 60s, writes per-competition KV entries. User requests read from KV only. This decouples user traffic from API rate limits entirely.
- **IMPORTANT**: The `/api/:comp/matches` endpoint currently falls back to upstream on cache miss (user-triggered). This violates the "users never hit upstream" principle. Fix: pre-populate schedules via cron, or add a lock to prevent concurrent upstream fetches.
- **News cron**: Worker fetches RSS feeds every 4 hours, rewrites via Workers AI, stores in Supabase `yc_articles`.
- Static data (WC schedule, groups, teams): in `src/data/`. League data: from Worker.
- Match IDs: use football-data.org API IDs as canonical across all competitions.
- Supabase is the exception — the Supabase JS client uses the public anon key (safe for client-side).
- **Scoring is client-side** (see scoring architecture concern above).
- **Badges and streaks are client-side calculated** (same pattern as scoring).

## Database tables

### Existing (V1)
- `yc_predictions` — user predictions per match per competition
- `yc_pools` — competition-scoped private leagues
- `yc_pool_members` — pool membership
- `yc_badges` — badge catalog
- `yc_user_badges` — earned badges per user
- `yc_streaks` — consecutive correct prediction tracking
- `profiles_public` — user display info (handle, avatar, name)

### New (V2)
- `yc_articles` — AI-rewritten news articles with team/competition tags
- `yc_pool_messages` — pool chat messages (Supabase Realtime)
- `yc_reactions` — activity feed reactions (fire/laugh/clown)

### V2 Migrations
- `yc_predictions`: add `quick_pick TEXT` column for 1X2 mode
- `profiles_public`: add `rivals UUID[]` column for rivals system
- `yc_pools`: add `allow_late_joins BOOLEAN` column

## Environment variables (.env, gitignored)

```
VITE_SUPABASE_URL=https://vxmopqjpqqdlkfceufru.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_ADMIN_USER_ID=<comma-separated Supabase user IDs>
VITE_SENTRY_DSN=<Sentry DSN>
VITE_WORKER_URL=https://yancocup-api.catbyte1985.workers.dev (optional, has default)
```

Worker secrets (Cloudflare dashboard):
```
FOOTBALL_DATA_API_KEY=...
API_FOOTBALL_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...   (for news article inserts from Worker)
```

## What Claude gets wrong on this project (fix these)

### Deployment & architecture mistakes
- Forgetting that GitHub Pages is static — no server routes, no API routes in the React app.
- Putting API keys in `.env` files that get bundled by Vite. Use `VITE_` prefix only for public values.
- Triggering upstream API calls on user requests. Use Cron Triggers to poll, KV to serve.
- Over-engineering scoring with Edge Functions. Scoring is client-side, no server triggers.
- Forgetting auth redirect issues with HashRouter. Handle Supabase auth token before HashRouter processes the URL.

### Design system mistakes
- Using dark mode media queries instead of always-dark. This site is ALWAYS dark. No light mode.
- Using #0a0a0a or pure black for backgrounds. The actual background is #060b14 (deep navy). Check `globals.css`.
- Using #00e5c1 or #00b89a as accent colors. The actual accent is #00ff88 (signature green). Check `globals.css`.
- Making the globe full-screen on homepage. Content must be visible without scrolling.

### Data & API mistakes
- Using BALLDONTLIE as a football API. It's an NBA API — does not cover soccer.
- Using API-Football without Cron Trigger + KV caching. 100 req/day works only with aggressive caching.
- Polling per-competition endpoints separately. Use `/v4/matches` (no filter) — one call gets ALL competitions.
- Creating separate static schedule files per competition. Only WC has static data. Leagues fetch from Worker.
- Adding xG, heatmaps, or player ratings. football-data.org free tier does NOT provide these. Only show data the API actually returns.
- Using BALLDONTLIE, worldfootballapi, or any unverified API. Stick to football-data.org + API-Football.

### UI & component mistakes
- Over-engineering i18n with heavy frameworks. We use a simple runtime translation layer, 6 languages only.
- Making the globe a performance hog. Use `frameloop="demand"` in R3F. Render only when interacting.
- Building custom globe components from scratch. Use r3f-globe by Vasturiano.
- Using emoji flags. They look different on every OS. Use circle-flags SVGs.
- Making the bracket visualization a heavy library dependency. Use CSS Grid, not D3 or other charting libs.
- Using FontAwesome or Heroicons. Use Lucide React only.

### Competition logic mistakes
- Making pools global. Pools are competition-scoped — your PL pool ≠ your WC pool.
- Showing friends' predictions before match kickoff. Predictions are hidden until deadline to prevent copying.
- Forgetting zone config is per-competition. PL has 4 CL spots, BL1 has 4. Don't hardcode.
- Treating CL as having traditional groups. Since 2024/25, CL uses a Swiss-model league phase (36 teams, single table). `hasGroups: false` is correct.

### Crest & media mistakes
- Downloading/bundling club crests into the repo. Use football-data.org API `crest` URLs (hotlink only). Never host crests locally.
- Building a custom crest/logo system. Use the `<TeamCrest>` component which handles national flags (circle-flags), club crests (API URLs), and TLA fallback in one place.

### News pipeline mistakes
- Scraping news sites directly. Use RSS feeds only — they're public, legal, and intended for consumption.
- Copying articles verbatim. AI must rewrite as SHORT SUMMARIES (3-5 sentences + link), not full rewrites. Always attribute the original source with a link.
- Hosting news images locally. Hotlink from RSS `<media:content>` URL or use gradient placeholders.
- Making the news cron too aggressive. Every 4 hours is enough (6 runs/day). More frequent wastes Workers AI quota.
- Forgetting Arabic RSS feeds use UTF-8 with Arabic chars. Worker XML parser must handle this.
- Using paid AI APIs for news. Cloudflare Workers AI free tier (10K neurons/day) is sufficient — budget is ~15 articles per cron run (6 runs/day = ~90 articles/day max). Test actual neuron consumption before committing.
- Building a CMS for news. Articles are auto-generated from RSS + AI. No manual editorial workflow.
- Showing AI-generated content without source attribution. Every article MUST link back to original source.

### Globe safety
- ~~Not wrapping the globe in a React error boundary.~~ **RESOLVED** — `GlobeErrorBoundary` added in `GlobeView.tsx`. WebGL crashes show a graceful fallback instead of white-screening the app.

## Cron scheduling note

The `wrangler.toml` currently runs `* * * * *` (every minute). This is fine during active match windows but wasteful otherwise. Before launch, consider:
- `*/5 * * * *` during off-peak (no live matches)
- `* * * * *` only during known match windows
- Using the tick counter to short-circuit when no live matches exist (check `all:live` KV key)

Cloudflare Workers free tier allows 100K requests/day and KV has write limits. Monitor usage.
