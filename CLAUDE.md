# YancoCup

Multi-competition soccer prediction platform. World Cup 2026 + Champions League + top European leagues. 3D interactive globe, live scores, predictions game with pools, broadcast links, gamification, multilingual.

**Current phase:** Premium upgrade — enriching data, adding club crests, form guides, match detail pages, gamification (badges/streaks/ranks), team profiles, bracket visualization. See `docs/PREMIUM_UPGRADE_PLAN.md` for full plan.

## Stack

- **Frontend**: Vite + React 18 + Tailwind CSS 4
- **Globe**: r3f-globe (by Vasturiano) + React Three Fiber + Three.js — NOT custom globe from scratch
- **Backend proxy**: Cloudflare Workers with Hono (API key vault + caching)
- **Database**: Supabase free tier (auth, predictions, pools, leaderboard, unlimited realtime)
- **Live scores**: football-data.org free tier (10 req/min) — covers WC, CL, PL, PD, BL1, SA, FL1, EC
- **Live scores fallback**: API-Football (100 req/day + Cron Trigger + KV cache)
- **Live score delivery**: Cloudflare Cron Triggers poll upstream, write to KV. User requests read KV only.
- **Key API optimization**: `/v4/matches` (no competition filter) returns ALL competitions in one call — 2-3 req/min for all competitions combined
- **Static data**: WC schedule/teams/groups/venues in `src/data/`. League schedules fetched from Worker.
- **Flags**: circle-flags (circular SVG country flags, open source)
- **Club crests**: football-data.org API `crest` URLs (hotlinked, never bundled) — see copyright strategy below
- **Icons**: Lucide React (open source, dark-theme friendly)
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
    layout/         # Nav, footer, language switcher, mobile nav, skeletons
  hooks/            # Custom React hooks (competition-aware)
  lib/              # Utilities, API clients, i18n, auth, scoring, competitions, ranks, badges
  data/             # Static JSON: teams, groups, venues, schedule, translations, broadcasters
  styles/           # Global CSS, Tailwind config
  pages/            # Route-level components (incl. MatchDetailPage, TeamPage, ProfilePage)
worker/             # Cloudflare Worker source (separate deploy)
docs/               # Architecture decisions, expansion plan, premium upgrade plan
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

## Design system — YancoVerse aesthetic

IMPORTANT: This is not a generic sports site. It follows the YancoVerse design language.

- **Background**: Deep black (#0a0a0a) with subtle gradient to #111
- **Primary accent**: #00ff88 (signature green) — used for highlights, hover states, active elements
- **Secondary accent**: #00cc6a (muted green) — borders, subtle indicators
- **Text**: #ffffff primary, #a0a0a0 secondary, #666666 tertiary
- **Cards/surfaces**: #1a1a1a with 1px #222 borders, subtle glow on hover
- **Typography**: "Space Grotesk" for headings, "Inter" for body (these are the YancoVerse fonts)
- **Effects**: Subtle particle backgrounds, green glow on interactive elements, smooth transitions (300ms ease)
- **NO**: Bright backgrounds, generic sports-site blue/red schemes, stock photo vibes, flat corporate look

When in doubt about visual direction, think: "dark, atmospheric, premium gaming lounge" not "ESPN clone."

## Club crests — copyright strategy

- **National teams**: Use circle-flags (country flags, MIT license). Already implemented.
- **Club teams**: Use football-data.org API `crest` URLs (e.g., `https://crests.football-data.org/57.svg`). These are provided as part of the API response and intended for consumer apps. We hotlink — never download, bundle, or redistribute.
- **Fallback**: TLA badge in a styled circle when crest URL is unavailable.
- **Never** host crest files in the repo, use FIFA/UEFA official logos, or use player photos.
- The `<TeamCrest>` component handles all logic: circle-flag for national teams, API crest for clubs, TLA fallback.

## Premium features (in progress)

See `docs/PREMIUM_UPGRADE_PLAN.md` for full plan. Key additions:

- **Form guide dots**: W/D/L colored circles on standings and match cards (green/gray/red)
- **Zone coloring**: Champions League, Europa League, relegation zones on standings tables
- **Match detail page**: Tabbed (Overview/Stats/Lineup/H2H) — route `/:competition/match/:id`
- **Team profile pages**: Squad, form, fixtures — route `/:competition/team/:teamId`
- **Gamification**: Badges (activity/skill/loyalty), streak tracking, rank tiers (Bronze→Diamond)
- **Profile pages**: Stats, badge collection, rank — route `/profile/:userId`
- **Bracket visualization**: Tournament knockout tree for WC and CL
- **Skeleton loading**: Replace spinners with layout-matching skeleton screens
- **Shareable prediction cards**: Canvas-generated images via Web Share API

## Multi-competition architecture

### Competitions

Competitions are defined in `src/lib/competitions.ts` with a `CompetitionConfig` registry. Each has:
- `id` (e.g., `'WC'`), `fdCode`, `name`, `type` ('tournament' | 'league')
- `hasGroups`, `staticSchedule`, `seasonLabel`

### Routing

Routes are competition-scoped:
```
/                           → Home (competition cards, cross-competition matches)
/:competition/matches       → Match schedule
/:competition/groups        → Group tables (tournaments only)
/:competition/standings     → League table (leagues only)
/:competition/predictions   → Predict matches
/:competition/leaderboard   → Per-competition leaderboard
/:competition/pools         → Pool management
/:competition/match/:id     → Match detail (tabs: Overview/Stats/Lineup/H2H)
/:competition/team/:teamId  → Team profile (squad, form, fixtures)
/:competition/bracket       → Knockout bracket (tournaments only)
/watch                      → Broadcast finder (global)
/profile                    → Own profile (badges, stats, rank)
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

### Pools (private leagues)

- `yc_pools` table scoped by `competition_id`
- Join via code or shareable deeplink
- Pool-specific leaderboard
- Custom scoring config (JSONB)

### Scoring

Base: 10 (exact) / 5 (GD) / 3 (result) / 0 (wrong)
Modifiers: upset bonus (+3, tournaments), knockout multipliers (1.5x-3x), joker (2x, one per matchday), streak bonuses (+2/+5/+10)
Leagues also support quick-predict (1X2 only, max 2 pts)

### League prediction fatigue mitigation

- Matchday-based UI (one matchday at a time)
- Per-match deadlines (not per-round)
- Quick-predict mode (home/draw/away, faster input)
- Missed predictions = 0 pts (no penalty)
- Joker pick adds strategic depth

## Workflow rules

IMPORTANT: These rules are non-negotiable.

1. **Plan before code.** Before touching any file, write a brief plan (what files change, what the expected outcome is) and wait for approval.
2. **One task per session.** Do not scope-creep. If you discover related work, note it and move on.
3. **Commit after every completed task.** Descriptive commit message. Separate commits per logical change.
4. **Never commit secrets.** API keys go in `.env` (gitignored) or Cloudflare Workers secrets. Never hardcode.
5. **Static export.** The React app MUST work as a static site on GitHub Pages. No SSR, no server-side routes. Use HashRouter or basename config.
6. **Test your build.** Run `npm run build` before committing UI changes. If it fails, fix it.
7. **When compacting**, preserve: current task status, list of modified files, any unresolved bugs.

## API architecture

- Frontend NEVER calls external APIs directly (keys would leak in client JS).
- All external API calls go through the Cloudflare Worker.
- Worker endpoint pattern: `/api/:competition/scores`, `/api/:competition/standings`, `/api/:competition/match/:id`, `/api/:competition/teams`, `/api/match/:id/detail`, `/api/h2h/:id`
- **Cron Trigger architecture**: Worker polls `/v4/matches` (ALL competitions, one call) every 60s, writes per-competition KV entries. User requests read from KV only. This decouples user traffic from API rate limits entirely.
- Static data (WC schedule, groups, teams): in `src/data/`. League data: from Worker.
- Match IDs: use football-data.org API IDs as canonical across all competitions.
- Supabase is the exception — the Supabase JS client uses the public anon key (safe for client-side).
- **Scoring is client-side.** No Edge Functions. When user loads leaderboard, client checks for unscored finished matches and calculates points.

## Environment variables (.env, gitignored)

```
VITE_SUPABASE_URL=https://vxmopqjpqqdlkfceufru.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_ADMIN_USER_ID=<comma-separated Supabase user IDs>
VITE_SENTRY_DSN=<Sentry DSN>
VITE_WORKER_URL=https://yancocup-api.catbyte1985.workers.dev (optional, has default)
```

## What Claude gets wrong on this project (fix these)

- Forgetting that GitHub Pages is static — no server routes, no API routes in the React app.
- Using dark mode media queries instead of always-dark. This site is ALWAYS dark. No light mode.
- Putting API keys in `.env` files that get bundled by Vite. Use `VITE_` prefix only for public values.
- Over-engineering i18n with heavy frameworks. We use a simple runtime translation layer, 6 languages only.
- Making the globe a performance hog. Use `frameloop="demand"` in R3F. Render only when interacting.
- Building custom globe components from scratch. Use r3f-globe by Vasturiano.
- Using emoji flags. They look different on every OS. Use circle-flags SVGs.
- Using BALLDONTLIE as a football API. It's an NBA API — does not cover soccer.
- Using API-Football without Cron Trigger + KV caching. 100 req/day works only with aggressive caching.
- Triggering upstream API calls on user requests. Use Cron Triggers to poll, KV to serve.
- Over-engineering scoring with Edge Functions. Scoring is client-side, no server triggers.
- Making the globe full-screen on homepage. Content must be visible without scrolling.
- Forgetting auth redirect issues with HashRouter. Handle Supabase auth token before HashRouter processes the URL.
- Polling per-competition endpoints separately. Use `/v4/matches` (no filter) — one call gets ALL competitions.
- Creating separate static schedule files per competition. Only WC has static data. Leagues fetch from Worker.
- Making pools global. Pools are competition-scoped — your PL pool ≠ your WC pool.
- Showing friends' predictions before match kickoff. Predictions are hidden until deadline to prevent copying.
- Downloading/bundling club crests into the repo. Use football-data.org API `crest` URLs (hotlink only). Never host crests locally.
- Building a custom crest/logo system. Use the `<TeamCrest>` component which handles national flags (circle-flags), club crests (API URLs), and TLA fallback in one place.
- Adding xG, heatmaps, or player ratings. football-data.org free tier does NOT provide these. Only show data the API actually returns.
- Over-engineering gamification with server-side triggers. Badges and streaks are client-side calculated (same pattern as scoring).
- Making the bracket visualization a heavy library dependency. Use CSS Grid, not D3 or other charting libs.
- Forgetting zone config is per-competition. PL has 4 CL spots, BL1 has 3. Don't hardcode.
