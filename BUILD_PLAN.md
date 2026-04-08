# YancoCup — build plan (revised v3)

Phased execution plan. One task per Claude Code session. Commit after each.
Priority: wow factor first, social hooks second, utilities last.
Total cost: $0/month. Entire stack is free.

## Free stack

| Need | Solution | Cost |
|------|----------|------|
| Hosting | GitHub Pages | $0 |
| API proxy | Cloudflare Workers (100K req/day free) + Cron Triggers | $0 |
| Database + Auth + Realtime | Supabase free (unlimited realtime, 500MB DB) | $0 |
| Live scores (primary) | football-data.org (10 req/min, WC free forever) — **verify before Phase 3** | $0 |
| Live scores (fallback) | API-Football (100 req/day + Cron Trigger + KV cache) or WC2026 API | $0 |
| Static WC data | openfootball/worldcup.json (public domain, no key) | $0 |
| Globe visualization | r3f-globe by Vasturiano (open source) | $0 |
| Earth textures | three-globe bundled assets via jsDelivr CDN (MIT) | $0 |
| Country flags | circle-flags (400+ circular SVGs, open source) | $0 |
| Icons | Lucide React (open source, dark-theme friendly) | $0 |
| Error monitoring | Sentry free (5K errors/month) | $0 |
| Analytics | Cloudflare Web Analytics (unlimited, no cookies) | $0 |
| Fonts | Google Fonts (Space Grotesk, Inter, JetBrains Mono) | $0 |

### CRITICAL: Verify football-data.org before Phase 3

Register at football-data.org, then run:
```bash
curl -H "X-Auth-Token: YOUR_KEY" https://api.football-data.org/v4/competitions/WC
```
If 200 → proceed with football-data.org as primary.
If 403 → use API-Football (100 req/day) with Cron Trigger + KV cache pattern. 100 req/day works fine when the Worker caches aggressively and user requests never hit upstream.

---

## Phase 0: Scaffold + First Impression (Sessions 1-2)

### Session 1 — Project init + globe

**Goal:** Spinning 3D globe on a black page. The "whoa" moment.

- `npm create vite@latest . -- --template react-ts`
- Install core: `tailwindcss`, `@tailwindcss/vite`, `react-router-dom`, `zustand`
- Install globe: `@react-three/fiber`, `@react-three/drei`, `three`, `r3f-globe`
- Install flags: `circle-flags` (circular SVG country flags)
- Install icons: `lucide-react`
- Create `.gitignore`:
  ```
  node_modules/
  dist/
  .env
  .env.local
  .env.*.local
  *.log
  .DS_Store
  ```
- Configure Tailwind with YancoVerse tokens (colors, fonts, spacing)
- Set up folder structure per CLAUDE.md
- Configure `vite.config.ts` for GitHub Pages (base path)
- Create `index.html` with Google Fonts (Space Grotesk, Inter, JetBrains Mono), meta tags
- Build `GlobeScene.tsx` using `r3f-globe`:
  - Earth night texture from three-globe CDN: `cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg` (MIT)
  - Earth bump map: `cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png` (MIT)
  - Atmosphere halo effect (built into r3f-globe)
  - Auto-rotate, OrbitControls with zoom limits
  - `frameloop="demand"` for performance
- Code-split Three.js bundle with `React.lazy` so the page shell loads instantly
- **Verify:** `npm run dev` starts, `npm run build` succeeds, globe spins on black background, page shell loads before globe JS

### Session 2 — City markers + countdown + layout shell

**Goal:** 16 glowing cities on the globe, countdown to kickoff, navigation.

- Download WC2026 venue data from `openfootball/worldcup.json` as base for `src/data/cities.json`
- Check for "Path winner" entries in openfootball data — show "TBD" in UI with tooltip if playoffs haven't resolved
- Configure r3f-globe's labels/points layer for 16 host cities:
  - Green (#00ff88) glowing markers
  - City name labels on hover
  - Click interaction to select city
- Build `CityPopup.tsx` — HTML overlay showing venue name, capacity, city
- Build `Countdown.tsx` — days/hours/min/sec until June 11, 2026
- Build `HomePage.tsx` layout:
  - Hero section: globe (left/background) + countdown + CTA "Predict matches with friends" (right/foreground)
  - "Today's Matches" section below (placeholder for now)
  - Globe is NOT full-screen — content is visible without scrolling
- Build `AppLayout.tsx`: nav bar, main content area, footer
- Build `NavBar.tsx`: logo, nav links (Home, Matches, Predictions, Leaderboard, Watch)
- Set up React Router (HashRouter for GitHub Pages)
- Placeholder pages for each route
- **Verify:** Globe with 16 glowing cities, countdown, nav works, content visible on first load without scrolling

---

## Phase 1: Static Data + Core Pages (Sessions 3-5)

### Session 3 — City detail + camera animation

- Smooth camera orbit to selected city on click (r3f-globe's `pointOfView` API)
- Expand `CityPopup.tsx`: venue photo (Wikimedia Commons, CC-BY-SA), capacity, upcoming matches
- Mobile touch support (rotate, pinch zoom)
- **Verify:** click city -> camera moves -> popup shows venue info

### Session 4 — Static schedule data

**Goal:** All 104 matches, 48 teams, 12 groups in structured JSON.

- Import and transform data from `openfootball/worldcup.json` (public domain):
  - `src/data/teams.json` — 48 teams: name, FIFA 3-letter code, isoCode, confederation, group
  - `src/data/groups.json` — 12 groups with team assignments
  - `src/data/schedule.json` — 104 matches: date, time (UTC), venue, group/round, teams
  - `src/data/venues.json` — 16 venues: name, city, country, capacity, lat, lng
- Handle unresolved playoff teams: if openfootball has "Path winner" entries, store as `null` with a `placeholder` field ("UEFA Path A winner"). Show "TBD" in UI with tooltip.
- Use football-data.org match IDs as canonical IDs if available (verify API access first). If not, use openfootball's match ordering.
- Build data hooks: `useTeams()`, `useGroups()`, `useSchedule()`, `useVenues()`
- Use `circle-flags` SVGs for team flag display (not emoji)
- **Verify:** data loads, flags render, TBD teams show correctly, no TypeScript errors

### Session 5 — Schedule + groups pages

- Build `MatchesPage.tsx` with filterable match list (by group, team, date, venue)
- Build `MatchCard.tsx` component (team circular flags, score/time, venue, match status)
- Build `GroupsPage.tsx` with 12 group tables
- Build `GroupTable.tsx` (FIFA-style: P, W, D, L, GF, GA, GD, Pts)
- "Today's Matches" widget on homepage — shows today's fixtures with prediction status
- **Verify:** all 104 matches displayed, groups correct, filters work, today's matches visible on home

---

## Phase 2: Predictions Game (Sessions 6-10)

### Session 6 — Supabase setup + auth

- Init Supabase project, get anon key + URL
- Create tables: profiles, predictions (per schema in predictions-system skill)
- Enable RLS policies
- Install `@supabase/supabase-js`
- Build `AuthProvider.tsx` context
- Google OAuth + email sign-in
- **HashRouter auth redirect fix:**
  1. In `index.html` or app entry point, before React mounts, check if URL hash contains `access_token`
  2. If yes: extract tokens, call `supabase.auth.setSession()`, strip the hash
  3. Then mount React with HashRouter
  4. This prevents HashRouter from interpreting auth tokens as routes
- Build `SignInPage.tsx` (YancoVerse styled)
- Profile creation on first sign-in
- Add Supabase health check cron (prevents free tier auto-pause during dev)
- **Verify:** full auth flow works end-to-end including OAuth redirect on GitHub Pages

### Session 7 — Prediction UI

- Build `PredictionCard.tsx` (score input for upcoming matches)
- Lock logic: client-side `canPredict()` checks kickoff time. Server-side: RLS policy with kickoff time check if possible, otherwise accept the small risk for a friends-only app.
- Submit to Supabase
- Show prediction count per match (without revealing scores)
- "Matches you haven't predicted" section (engagement nudge)
- Build "How to Play" section — scoring rules visible before first prediction:
  - Exact score: 10 pts
  - Correct result + goal difference: 5 pts
  - Correct result only: 3 pts
  - Wrong: 0 pts
  - Upset bonus: +3
  - Perfect group stage: +15
- **Verify:** can submit and retrieve predictions, scoring rules visible

### Session 8 — Scoring engine (client-side)

**Scoring is client-side. No Edge Functions. No server triggers.**

- When a user opens the leaderboard or predictions page:
  1. Check for any finished matches that have unscored predictions
  2. Calculate points client-side using the scoring rules
  3. Write results to Supabase via RLS-protected upsert
  4. Add `scored_at` timestamp to prevent duplicate scoring
  5. First user to load after full-time does the scoring work
- Build scoring logic:
  - Exact score: 10 pts
  - Correct result + goal difference: 5 pts
  - Correct result only: 3 pts
  - Wrong: 0 pts
  - Upset bonus (lower-ranked team wins): +3
  - Perfect group stage (all 3 exact): +15
- Update user totals in profiles table
- **Verify:** scores calculate correctly for test fixtures, no duplicate scoring

### Session 9 — Leaderboard

- Build `LeaderboardPage.tsx`
- Real-time updates via Supabase Realtime (unlimited connections on free tier)
- Columns: Rank, Name, Points, Correct/Total, Accuracy %, Points Per Prediction
- "Points Per Prediction" metric — fair ranking for late joiners
- Current user highlighted with green accent
- Top 3 highlighted
- Leaderboard snippet on homepage
- **Verify:** leaderboard updates when predictions are scored, late joiners aren't permanently disadvantaged

### Session 10 — Prediction sharing + friend activity

- Build shareable prediction cards (screenshot-friendly component):
  - Team circular flags, predicted score, YancoCup branding, dark background
  - "Share your prediction" button per match
  - Copy as image or share via Web Share API
- Build `ActivityFeed.tsx` — recent predictions by friends, leaderboard moves
- Show on homepage section
- **Verify:** shareable cards look premium, activity feed updates in real time

---

## Phase 3: Live Data Layer (Sessions 11-13)

### BEFORE STARTING: Verify football-data.org access

```bash
curl -H "X-Auth-Token: YOUR_KEY" https://api.football-data.org/v4/competitions/WC
```

**If 200 (WC is covered):** Proceed as planned with football-data.org as primary.
**If 403 (WC not on free tier):** Switch to API-Football with Cron Trigger + KV cache pattern:
- API-Football free tier: 100 req/day
- Cron Trigger polls every 60s during match windows only (~90 req per match day)
- All results cached in KV, user requests never hit upstream
- 100 req/day is enough: max ~4 matches/day, Cron only active during match hours

### Session 11 — Cloudflare Worker setup

**Goal:** Worker that polls live scores via Cron Trigger and serves from KV cache.

- Init worker project with Hono
- Register free API key for the chosen primary source, store as Workers secret
- Register free WC2026 API key (fallback), store as Workers secret
- **Cron Trigger architecture** (key improvement over user-triggered polling):
  - Cron Trigger fires every 60s during match windows (configurable via Wrangler)
  - Cron handler fetches live scores from upstream API
  - Writes results to KV with TTL
  - All `/api/*` GET endpoints read from KV only — zero upstream calls on user requests
  - This decouples user traffic from API rate limits entirely
- Build `/api/scores` endpoint (reads from KV)
- Build `/api/standings` endpoint (reads from KV)
- Build `/api/match/:id` endpoint (reads from KV, single match detail with events)
- CORS config for GitHub Pages + localhost
- Fallback: if primary API fails during Cron, try fallback source
- Rate limiting for clients: 60 req/min/IP
- **Verify:** Cron Trigger writes to KV, endpoints return cached data, fallback works

### Session 12 — Live scores integration

- Build `useScores()` hook:
  - Polls Worker every 60s during live matches, every 5 min otherwise
  - Match IDs map to schedule.json (same canonical IDs)
- Connect MatchCard to live data
- Live indicator (pulsing green dot)
- Match minute display
- **Match events on card expand**: click/tap a live match card to see goals, cards, substitutions
- Knockout team auto-resolution: Worker returns resolved team names from API
- Graceful degradation: show static schedule if Worker is unreachable
- **Verify:** match cards update with live data, events visible on expand

### Session 13 — Broadcast finder

- Build broadcast finder as a searchable modal/dropdown (not a full page)
- Static data: `src/data/broadcasters.json` — curate for ~15 countries friends are in:
  US, UK, Canada, Mexico, Germany, France, Spain, Saudi Arabia, Jordan, UAE, Brazil, Australia
- Source: Wikipedia "2026 FIFA World Cup broadcasting rights"
- Accessible from nav "Watch" link and from individual match cards
- YouTube oEmbed for available highlights
- **Verify:** country selector -> shows broadcaster links

---

## Phase 4: Polish + i18n (Sessions 14-17)

### Session 14 — i18n implementation

- Build i18n context + hook per i18n-auto skill
- Translate ~100 UI strings for 6 languages: English, Arabic, Spanish, French, German, Portuguese
- Language switcher with circle-flags for language country indicators
- RTL support for Arabic (Tailwind `rtl:` modifiers)
- **Verify:** switching languages works, Arabic renders RTL

### Session 15 — Mobile optimization

- Responsive pass on all pages
- Globe: reduce detail on mobile via r3f-globe's `globeResolution` prop
- Disable auto-rotate on mobile (battery)
- Touch-friendly prediction inputs (larger tap targets)
- Bottom navigation bar on mobile
- Globe fallback: if `navigator.hardwareConcurrency < 4`, use r3f-globe with minimal config (no atmosphere, low resolution, no auto-rotate)
- **Verify:** full flow works on iPhone and Android viewport sizes

### Session 16 — Performance + monitoring + engagement

- **Sentry** free tier: `npm i @sentry/react`, init with DSN, 3 lines of code. Source maps for readable stack traces.
- **Cloudflare Web Analytics**: one `<script>` tag in index.html. Unlimited, free.
- Lighthouse audit, fix issues
- Lazy load routes with `React.lazy` (Three.js already lazy from Session 1)
- Image optimization (WebP, responsive sizes)
- Meta tags, Open Graph for social sharing
- Browser notification opt-in: "match starting soon, you haven't predicted"
- Homepage "Today's Matches" widget with prediction status per match
- **Verify:** Lighthouse performance > 85, Sentry captures test error, analytics shows page views

### Session 17 — Final polish

- Loading states and skeletons everywhere
- Error boundaries with friendly messages (Sentry captures these)
- 404 page (YancoVerse themed)
- Simple admin route (`/admin`, protected by Supabase role check):
  - Re-trigger scoring for a match (manual client-side re-calc)
  - Manual knockout team override (emergency fallback if API doesn't resolve)
- Final build test + deploy to GitHub Pages
- **Verify:** everything works in production

---

## Phase 5: Bonus (if time allows)

- Reactions on predictions (fire, laugh, etc.) — social layer within the app
- Team detail pages with squad info
- Match detail page with minute-by-minute timeline (full page, beyond card expand)
- Animated page transitions with Framer Motion
- PWA manifest for "add to home screen"
- Sound FX on score animation (freesound.org, CC0 licensed)

---

## What was cut and why

| Cut | Reason |
|-----|--------|
| News feed page | Low engagement. Replaced with friend activity feed. |
| Session 3 design system | Premature abstraction. Components built inline when needed. |
| 9 languages | Reduced to 6 (EN, AR, ES, FR, DE, PT). |
| Broadcast as full page | Overkill. Now a searchable modal. |
| Custom globe from scratch | r3f-globe does 80% of the work. |
| Emoji flags | Inconsistent across OS. circle-flags SVGs are premium. |
| BALLDONTLIE as fallback | NBA API, does not cover football. |
| Supabase Edge Functions for scoring | Over-engineered. Client-side scoring is simpler, zero infra. |

## Key risks and mitigations

| Risk | Mitigation |
|------|-----------|
| football-data.org free tier doesn't cover WC | Verify with curl before Phase 3. Fallback: API-Football + Cron Trigger + KV cache. |
| API goes down during a live match | Automatic fallback to secondary source in Cron handler |
| Supabase free tier auto-pauses during dev | Cron health check ping |
| Auth redirect breaks with HashRouter | Extract auth tokens before HashRouter mounts (Session 6) |
| Scoring calculates wrong | Admin re-score in `/admin` route |
| Bundle too large for mobile first load | Three.js lazy loaded, page shell renders instantly |
| Late joiner feels hopeless on leaderboard | "Points Per Prediction" metric as secondary ranking |
| Unresolved playoff teams in data | Show "TBD" with tooltip, resolve via API or manual update |
| Something breaks during tournament | Sentry captures errors, Cloudflare Analytics shows traffic |

## Copyright / licensing notes

DO NOT include in the project:
- Team crests/badges (copyrighted by FIFA/federations)
- Player photos (rights issues)
- Any FIFA branding/logos

Safe to use:
- Earth textures from three-globe CDN (MIT license)
- Venue photos from Wikimedia Commons (CC-BY-SA, attribute in footer)
- circle-flags (MIT)
- Lucide icons (ISC)
- Sound FX from freesound.org (CC0)
