# YancoScore — build plan (v4)

> Formerly YancoCup. Expanding from World Cup 2026 to a multi-competition soccer prediction platform.
> Phases 0-4 (Sessions 1-17) are COMPLETE. This plan covers Phase 5+ (expansion).

Phased execution plan. One task per Claude Code session. Commit after each.
Total cost: $0/month. Entire stack is free.

## Free stack

| Need | Solution | Cost |
|------|----------|------|
| Hosting | GitHub Pages | $0 |
| API proxy | Cloudflare Workers (100K req/day free) + Cron Triggers | $0 |
| Database + Auth + Realtime | Supabase free (unlimited realtime, 500MB DB) | $0 |
| Live scores | football-data.org (10 req/min, all major competitions) | $0 |
| Live scores fallback | API-Football (100 req/day + Cron Trigger + KV cache) | $0 |
| Static WC data | openfootball/worldcup.json (public domain) | $0 |
| Globe visualization | r3f-globe by Vasturiano (open source) | $0 |
| Country flags | circle-flags (400+ circular SVGs, open source) | $0 |
| Icons | Lucide React (open source, dark-theme friendly) | $0 |
| Error monitoring | Sentry free (5K errors/month) | $0 |
| Analytics | Cloudflare Web Analytics (unlimited, no cookies) | $0 |
| Fonts | Google Fonts (Space Grotesk, Inter, JetBrains Mono) | $0 |

---

## Completed phases (Sessions 1-17)

| Phase | Sessions | Status |
|-------|----------|--------|
| Phase 0: Scaffold + Globe | 1-2 | DONE |
| Phase 1: Static Data + Pages | 3-5 | DONE |
| Phase 2: Predictions Game | 6-10 | DONE |
| Phase 3: Live Data Layer | 11-13 | DONE |
| Phase 4: Polish + i18n | 14-17 | DONE |

Live at: https://yamanaddas.github.io/YancoCup/
Worker at: https://yancocup-api.catbyte1985.workers.dev/
Sentry + Cloudflare Analytics active.

---

## Target competitions for expansion

All available on football-data.org free tier (TIER_ONE):

| Code | Competition | Type | Matches/season | Priority |
|------|-------------|------|----------------|----------|
| WC | FIFA World Cup 2026 | Tournament | 104 | DONE |
| CL | UEFA Champions League | Tournament | ~125 | High |
| PL | Premier League | League | 380 | High |
| PD | La Liga | League | 380 | High |
| BL1 | Bundesliga | League | 306 | Medium |
| SA | Serie A | League | 380 | Medium |
| FL1 | Ligue 1 | League | 306 | Medium |
| EC | European Championship | Tournament | ~51 | Future |

---

## Phase 5: Database + Hook Migration (Sessions 18-19)

**Goal:** Add competition_id to everything. Zero visual change. WC works identically.

### Session 18 — Database schema migration

- Add `yc_competitions` table:
  ```sql
  CREATE TABLE yc_competitions (
    id text PRIMARY KEY,           -- 'WC', 'PL', 'CL'
    name text NOT NULL,
    type text NOT NULL,            -- 'tournament' | 'league'
    season text,                   -- '2026', '2025/26'
    status text DEFAULT 'active',
    fd_code text NOT NULL,         -- football-data.org code
    fd_competition_id integer,     -- football-data.org numeric ID
    config jsonb DEFAULT '{}'
  );
  ```
- Add `competition_id` column to `yc_predictions` with default `'WC'`
- Migrate existing `match_id` values from local IDs (1-104) to football-data.org API IDs using `match-id-map.json`
- Update unique constraint: `UNIQUE(user_id, competition_id, match_id)`
- Add index on `competition_id`
- Add `is_joker` boolean column to `yc_predictions` (default false)
- Add `yc_streaks` table for streak tracking
- Update RLS policies to include `competition_id`
- **Verify:** existing WC predictions untouched, new schema works

### Session 19 — Hook + API migration

- Update `usePredictions.ts`: add `competitionId` param to all queries, change `onConflict` to `"user_id,competition_id,match_id"`, use API match IDs directly
- Update `useLeaderboard.ts`: filter by `competition_id`
- Update `useActivityFeed.ts`: add optional `competition_id` filter
- Update `useScoring.ts`: use API match IDs directly (no local-to-API mapping)
- Update `useAutoScore.ts`: match predictions to results using API IDs
- Update `useScores.ts`: remove `toLocalId` mapping
- Update `src/lib/api.ts`: remove `toApiId`/`toLocalId`, add `competitionId` param to all fetch functions
- Remove `match-id-map.json` from runtime imports (keep file for reference)
- **Verify:** all WC features work exactly as before

---

## Phase 6: Worker Multi-Competition (Sessions 20-21)

**Goal:** Worker serves data for all competitions using efficient single-call polling.

### Session 20 — Worker refactor

**Key insight:** `/v4/matches` (no competition filter) returns ALL competitions in one API call.

- Refactor cron handler:
  ```
  Every 60s:
    1. GET /v4/matches (all live/today matches) → 1 API call
    2. Parse by competition, write per-competition KV entries
    3. Every 5th tick: GET /v4/matches?dateFrom=today&dateTo=tomorrow
    4. Every 15th tick: rotate standings call through active competitions
  Budget: 2-3 req/min (well within 10 req/min)
  ```
- KV keys namespaced: `{comp}:scores`, `{comp}:standings`, `{comp}:match:{id}`
- Config KV key `config:active_competitions` (list of codes to poll)
- Remove hardcoded WC-only tournament window check
- **Verify:** WC data still in KV, PL/CL data populates

### Session 21 — Worker endpoints + deploy

- Add parameterized routes:
  - `GET /api/:comp/scores` — match scores for a competition
  - `GET /api/:comp/standings` — standings
  - `GET /api/:comp/match/:id` — single match
  - `GET /api/:comp/matches` — full schedule (for league schedule fetching)
  - `GET /api/competitions` — list active competitions with metadata
  - `GET /api/live` — all live matches across all competitions
- Backward-compatible: `/api/scores` aliases to `/api/WC/scores`
- Update CORS for any new domains
- Deploy updated Worker
- **Verify:** all endpoints return data, WC endpoints unchanged

---

## Phase 7: Frontend Multi-Competition (Sessions 22-26)

**Goal:** Users can switch between competitions and predict.

### Session 22 — Competition registry + context

- Create `src/lib/competitions.ts` — CompetitionConfig registry:
  ```typescript
  interface CompetitionConfig {
    id: string;           // 'WC', 'PL'
    fdCode: string;       // football-data.org code
    name: string;         // 'FIFA World Cup 2026'
    shortName: string;    // 'World Cup'
    type: 'tournament' | 'league';
    hasGroups: boolean;
    staticSchedule: boolean; // true for WC only
    seasonLabel: string;
  }
  ```
- Create `CompetitionProvider` context (reads `:competition` from route params)
- Create `useCompetitionSchedule` hook:
  - WC: reads static `schedule.json`
  - Leagues: fetches from Worker `GET /api/:comp/matches`
- **Verify:** context provides correct config, schedule hook loads data

### Session 23 — Routing + competition switcher

- Restructure `App.tsx` routes:
  ```
  /                           → HomePage (competition cards)
  /:competition/matches       → MatchesPage
  /:competition/groups        → GroupsPage (tournaments only)
  /:competition/standings     → StandingsPage (leagues only)
  /:competition/predictions   → PredictionsPage
  /:competition/leaderboard   → LeaderboardPage
  /watch                      → WatchPage (global)
  /sign-in                    → SignInPage
  /admin                      → AdminPage
  /*                          → 404
  ```
- Build `CompetitionSelector` component (dropdown in NavBar)
- Build competition cards on HomePage (logo, name, next deadline, your rank)
- Update `MobileNav` to be competition-aware
- Add backward-compatible redirect: `/matches` → `/WC/matches`
- **Verify:** switching competitions works, URLs are correct

### Session 24 — League pages (Matches + Standings)

- Build `StandingsPage.tsx` — league table (P, W, D, L, GF, GA, GD, Pts)
  - Fetches from Worker `GET /api/:comp/standings`
  - Different from group tables: single table, 20 teams, relegation zones
- Update `MatchesPage.tsx` for leagues:
  - Matchday-based grouping (not date-based)
  - Matchday selector/pagination
  - Remove "Groups" filter for leagues
- Teams for leagues: use TLA codes from API (no static teams.json)
- Flags for league teams: TLA → ISO code mapping for circle-flags
- **Verify:** PL standings load, matches grouped by matchday

### Session 25 — League predictions

- Update `PredictionsPage.tsx` for leagues:
  - Show one matchday at a time
  - Per-match deadline (each match locks at its own kickoff)
  - Quick-predict mode: simplified 1X2 (home/draw/away) for 2 pts max
  - Exact score prediction for full points (10/5/3)
- Update `PredictionCard.tsx`:
  - Work with API match IDs directly
  - Show quick-predict toggle
  - Handle league teams (no static team data, use API TLA)
- Auto-fill: missed predictions score 0 (no penalty, just no reward)
- **Verify:** can predict PL matches, per-match deadlines work

### Session 26 — Per-competition leaderboards + activity

- Leaderboard scoped by `competition_id`
- Activity feed shows competition filter tabs
- Homepage: cross-competition "today's matches" widget (all active competitions)
- Update all 6 translation files with new keys (competition names, matchday, standings, etc.)
- **Verify:** separate leaderboards per competition, activity filterable

---

## Phase 8: Pools — Private Leagues (Sessions 27-29)

**Goal:** Friend group competitions with join codes.

### Session 27 — Pool backend

- Supabase tables:
  ```sql
  yc_pools (id, competition_id, name, join_code, created_by, scoring_config jsonb, created_at)
  yc_pool_members (pool_id, user_id, joined_at, PRIMARY KEY(pool_id, user_id))
  ```
- RLS: members can read their pool's predictions; anyone can join via code
- Pool join code generation (6 chars, alphanumeric, unique)
- Add `pool_id` column to `yc_predictions` (nullable — global predictions have no pool)
- **Verify:** tables created, RLS works

### Session 28 — Pool UI (create + join)

- Create pool: name, select competition, get join code + shareable link
- Join pool: enter code or visit `/pool/:joinCode` deeplink
- Pool management page: member list, leave pool
- Pool selector within competition context
- **Verify:** create pool, share code, friend joins, both see same pool

### Session 29 — Pool leaderboard + activity

- Pool-scoped leaderboard (separate from global competition leaderboard)
- Pool activity feed (predictions by pool members only)
- Pool card on homepage showing your rank in each pool
- Pool admin: custom scoring config (JSONB — point values for exact/GD/result)
- **Verify:** pool leaderboard shows only members, custom scoring works

---

## Phase 9: Gamification (Sessions 30-33)

**Goal:** Features that drive daily returns.

### Session 30 — Joker picks + knockout multipliers

- Joker: 1 per matchday, doubles points for that match
  - `is_joker` boolean on `yc_predictions`
  - UI: star/joker icon toggle on PredictionCard
  - Constraint: max 1 joker per user per matchday per competition
- Knockout multipliers for tournaments:
  - Group stage: 1x
  - Round of 32: 1.5x
  - Round of 16: 2x
  - Quarterfinal: 2.5x
  - Semifinal: 3x
  - Final: 3x
- Update `scoring.ts` to apply multipliers
- **Verify:** joker doubles points, knockout multiplier applies

### Session 31 — Streaks + badges

- Streak tracking in `yc_streaks` table:
  - Consecutive correct results (any points > 0)
  - Milestone bonuses: 3 in a row → +2, 5 → +5, 10 → +10
  - Streak counter visible on leaderboard
- Badges (stored in `yc_badges` or user metadata):
  - "Oracle" — 5 exact scores in a row
  - "Upset Whisperer" — 3 upsets correctly predicted
  - "Perfect Matchday" — all results correct on one matchday
  - "Ironman" — predicted every match in a competition
- Badge display on profile / leaderboard
- **Verify:** streaks track correctly, badges awarded

### Session 32 — Community consensus + prediction reveal

- Community consensus: aggregate predictions per match
  - Show "65% predict Home | 20% Draw | 15% Away" before user picks
  - Simple Supabase query: count predictions grouped by result type
  - Only show after user has submitted their own prediction (prevent copying)
- Post-deadline prediction reveal:
  - Hide friends' exact scores until match kicks off
  - After kickoff: reveal all predictions in the pool/global feed
  - "Prediction reveal" animation moment
- **Verify:** consensus percentages display, predictions hidden before kickoff

### Session 33 — AI bot + weekly recaps

- AI bot on leaderboards:
  - Simple Elo-based predictions (home advantage + team rating)
  - Bot "user" in profiles table, makes predictions via edge function or client-side on cron
  - Named "YancoBot" — users try to beat it
- Weekly recaps (client-side generated):
  - "Best predictor this week"
  - "Worst call of the week"
  - "Biggest upset correctly called"
  - Displayed as a card on homepage or pool page
- **Verify:** bot predictions appear on leaderboard, recap card shows

---

## Phase 10: Rebrand + Polish (Sessions 34-35)

**Goal:** Ship as YancoScore.

### Session 34 — Rebrand YancoCup → YancoScore

- Logo: `Yanco<span class="text-yc-green">Score</span>`
- Update all branding text in code, translations, meta tags
- Update OG tags, Twitter Cards
- Update Worker name: `yancocup-api` → `yancoscore-api`
- Update CORS origins if domain changes
- GitHub repo: rename or redirect
- Update CLAUDE.md and all docs
- **Verify:** all references updated, no "YancoCup" remains in UI

### Session 35 — Final polish

- Cross-competition "today's matches" on homepage (all active competitions)
- Competition-specific subtle theming (accent color per league, optional)
- PWA manifest for "add to home screen"
- Performance audit: Lighthouse > 85
- Final build test + deploy
- **Verify:** everything works in production across all competitions

---

## Key architecture decisions

### Rate limit budget (10 req/min)

Using `/v4/matches` (no competition filter) — one call returns ALL competitions:

| Scenario | Calls/min | Notes |
|----------|-----------|-------|
| No live matches | 0.2 | Check every 5 min |
| Matches live (any competition) | 1-2 | Every 60s, all comps in one call |
| + Standings rotation | +0.2 | One competition's standings per 5 min |
| **Total max** | **~2.5** | **Well within 10 req/min** |

### Schedule handling

| Competition | Source | Why |
|-------------|--------|-----|
| WC | Static JSON (schedule.json) | Fixed 104 matches, venues, known in advance |
| CL, EC | Worker API | Groups drawn late, knockout TBD |
| PL, PD, BL1, SA, FL1 | Worker API | 300-380 matches, rescheduled frequently |

### Prediction fatigue (leagues with 380 matches)

- Matchday-based UI: show one matchday at a time (8-10 matches)
- Per-match deadlines: predict Saturday games Saturday, Sunday games Sunday
- Quick-predict mode: simplified 1X2 (home/draw/away) for 2 pts max
- Auto-fill: missed predictions score 0 (no penalty, just no reward)
- Joker pick: 1 per matchday, strategic depth

### Scoring system

**Base scoring** (all competitions):
| Outcome | Points |
|---------|--------|
| Exact score | 10 |
| Correct goal difference | 5 |
| Correct winner/draw | 3 |
| Wrong | 0 |

**Modifiers:**
| Feature | Effect | Scope |
|---------|--------|-------|
| Upset bonus | +3 | Tournaments only |
| Perfect group stage | +15 | Tournaments with groups |
| Knockout multiplier | 1.5x-3x by round | Tournaments only |
| Joker pick | 2x on chosen match | All competitions |
| Streak bonus | +2/+5/+10 at milestones | All competitions |
| Quick predict (1X2) | Max 2 pts | Leagues only |

### Database size (500MB Supabase free tier)

~2,000 matches/season across all competitions. Even with 1,000 users predicting everything: ~300MB. Realistic usage (users predict 1-2 competitions): well under 500MB.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Migration breaks WC predictions | `DEFAULT 'WC'` on competition_id. Test in Supabase branch first. |
| 10 req/min rate limit | `/v4/matches` (all comps, 1 call) + KV caching. Users never hit upstream. |
| League schedules too large for static JSON | Fetch from Worker. Frontend caches in React state. |
| Prediction fatigue (380 matches) | Matchday UI + quick-predict + auto-fill + joker. |
| Supabase 500MB limit | Realistic usage well under limit. Monitor with dashboard. |
| Bundle size growth | Lazy-load competition pages. Only registry (~1KB) in main bundle. |
| Breaking existing URLs | `/matches` redirects to `/WC/matches`. |
| Pool abuse (spam pools) | Rate limit pool creation. Require auth. |

---

## What NOT to build

| Feature | Why cut |
|---------|---------|
| Full fantasy football | Different product entirely |
| Live chat per match | Activity feed + reactions is enough for v1 |
| Paid premium tier | Premature. Keep free until product-market fit. |
| Player predictions (goalscorer) | Phase 10+ bonus. Not core. |
| Custom competition creation | Admin adds competitions. Not self-serve. |
| Push notifications | Browser notifications later. App is the loop for now. |
| NFT/card trading (Sorare model) | Not aligned with friend-group prediction focus |

---

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
