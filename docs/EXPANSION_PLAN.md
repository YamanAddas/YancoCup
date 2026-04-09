# YancoScore — Multi-Competition Expansion Plan

> Audited against best practices from FotMob, Superbru, Kicktipp, FPL, and industry research (2024-2026).

## Rebrand: YancoCup → YancoScore

- "Cup" implies one tournament. "Score" covers leagues + cups
- Keep "Yanco" prefix for YancoVerse continuity
- `yc_` table prefix still works (YancoScore)
- Logo: `Yanco<span class="text-yc-green">Score</span>`

---

## Target Competitions (all free on football-data.org TIER_ONE)

| Code | Competition | Type | Matches/season |
|------|-------------|------|----------------|
| WC | FIFA World Cup 2026 | Tournament | 104 |
| CL | UEFA Champions League | Tournament | ~125 |
| PL | Premier League | League | 380 |
| PD | La Liga | League | 380 |
| BL1 | Bundesliga | League | 306 |
| SA | Serie A | League | 380 |
| FL1 | Ligue 1 | League | 306 |
| EC | European Championship | Tournament | ~51 |

---

## Key Innovations (from research)

### 1. `/v4/matches` endpoint — single call, all competitions
football-data.org's `/v4/matches` (no competition filter) returns matches across ALL competitions in one API call. This changes our rate limit math:
- **Before**: 2 calls per competition per cron tick = 16 calls for 8 competitions = impossible
- **After**: 1 call gets ALL live/today matches across all competitions. Budget: 1-2 req/min, leaving 8 req/min headroom

### 2. Private leagues ("Pools") — the #1 retention feature
Every successful prediction app (Superbru, Kicktipp, LEBOM) centers on friend group competitions:
- Create pool with join code / shareable link
- Pool-specific leaderboard
- Pools are competition-scoped (your PL pool ≠ your WC pool)
- Pool admins can customize scoring rules (JSONB config)

### 3. Gamification features that actually work (ranked by retention impact)
1. **Streaks** — consecutive correct results, milestone bonuses (3→+2, 5→+5, 10→+10)
2. **Joker picks** — 1 per matchday, doubles points for that match (from Kicktipp)
3. **Knockout round multipliers** — 1.5x R32, 2x R16, 2.5x QF, 3x SF/Final
4. **Community consensus** — "67% predict Brazil" shown before you pick (just a Supabase aggregate)
5. **Post-deadline prediction reveal** — hide friends' predictions until kickoff, then reveal all at once
6. **AI bot on leaderboard** — simple Elo-based bot that makes predictions, users try to beat it
7. **Weekly recaps** — "Best predictor this week", "Biggest upset caught"
8. **Badges** — "Oracle" (5 exact in a row), "Upset Whisperer", "Perfect Matchday"

### 4. League prediction fatigue solution
380 PL matches is too many. Solutions:
- **Matchday-based UI** — show one matchday at a time (8-10 matches)
- **Per-match deadlines** — predict Saturday games Saturday, Sunday games Sunday
- **Auto-fill missed predictions** — score 0 if you don't predict (don't punish, just no reward)
- **Quick-predict mode** — simplified 1X2 prediction (home/draw/away) for faster input, fewer points than exact score

### 5. Scoring system upgrades
Current: 10 (exact) / 5 (GD) / 3 (result) / 0 (wrong)

Add:
| Feature | Points | Description |
|---------|--------|-------------|
| Knockout multiplier | 1.5x-3x | Points scale up in later rounds |
| Joker | 2x | One match per matchday, user chooses |
| Streak bonus | +2/+5/+10 | 3/5/10 consecutive correct results |
| Quick predict (1X2) | 2 pts max | Home/Draw/Away only, no exact score |

---

## Architecture

### Database Schema

```sql
-- Competition registry
CREATE TABLE yc_competitions (
  id text PRIMARY KEY,           -- 'WC', 'PL', 'CL', etc.
  name text NOT NULL,
  type text NOT NULL,            -- 'tournament' | 'league'
  season text,                   -- '2026', '2025/26'
  status text DEFAULT 'active',  -- 'active' | 'upcoming' | 'finished'
  fd_code text NOT NULL,         -- football-data.org code
  fd_competition_id integer,     -- football-data.org ID (2000 for WC)
  config jsonb DEFAULT '{}'      -- competition-specific settings
);

-- Pools (friend groups) — scoped per competition
CREATE TABLE yc_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id text REFERENCES yc_competitions(id),
  name text NOT NULL,
  join_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  scoring_config jsonb DEFAULT '{}',  -- custom scoring per pool
  created_at timestamptz DEFAULT now()
);

CREATE TABLE yc_pool_members (
  pool_id uuid REFERENCES yc_pools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, user_id)
);

-- Predictions — add competition_id, use API match IDs
ALTER TABLE yc_predictions
  ADD COLUMN competition_id text NOT NULL DEFAULT 'WC',
  ADD COLUMN pool_id uuid REFERENCES yc_pools(id),
  ADD COLUMN is_joker boolean DEFAULT false;

-- Migrate match_id from local (1-104) to API IDs
-- Then update unique constraint:
-- UNIQUE(user_id, competition_id, match_id)

-- Streaks tracking
CREATE TABLE yc_streaks (
  user_id uuid REFERENCES auth.users(id),
  competition_id text REFERENCES yc_competitions(id),
  current_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  last_match_id integer,
  PRIMARY KEY (user_id, competition_id)
);
```

### Worker — Multi-Competition Polling

**Key insight**: Use `/v4/matches` (all competitions, one call) instead of per-competition polling.

```
Cron (every 60s):
  1. GET /v4/matches?status=LIVE,IN_PLAY,PAUSED,FINISHED
     → 1 API call, all competitions
  2. Write results to KV keyed by competition:
     PL:scores, CL:scores, WC:scores, etc.
  3. Every 5th tick: GET /v4/matches?dateFrom=today&dateTo=tomorrow
     → catches upcoming matches, 1 API call
  4. Every 15th tick: GET /v4/competitions/{code}/standings
     → rotate through active competitions

Budget: 2-3 req/min average, well within 10 req/min
```

Endpoints:
```
GET /api/competitions              — list active competitions
GET /api/:comp/scores              — match scores
GET /api/:comp/standings           — league table / group standings
GET /api/:comp/match/:id           — single match detail
GET /api/live                      — all live matches across all competitions
```

### Frontend — Routing & UX

```
/                           — Home: competition cards, today's matches across all
/:competition               — Competition home (WC, PL, CL, etc.)
/:competition/matches       — Match schedule (matchday-based for leagues)
/:competition/groups        — Groups (tournaments only)
/:competition/standings     — League table (leagues only)
/:competition/predictions   — Predict matches
/:competition/leaderboard   — Per-competition leaderboard
/:competition/pools         — Pool management (create, join, view)
/pool/:joinCode             — Join pool deeplink
/admin                      — Admin panel
```

**Competition switching**:
- Homepage: competition cards (Superbru pattern) with logo, next deadline, your rank
- In-context: compact dropdown in NavBar showing current competition

**CompetitionProvider context**:
```typescript
interface CompetitionContext {
  id: string;           // 'PL'
  config: CompetitionConfig;
  type: 'tournament' | 'league';
  hasGroups: boolean;
}
```

### Schedule Handling — Hybrid

| Competition | Source | Reason |
|-------------|--------|--------|
| WC | Static JSON (schedule.json) | Fixed 104 matches, venues, known in advance |
| Leagues | Worker API (`/api/:comp/scores`) | 300-380 matches, rescheduled often |
| CL/EC | Worker API | Groups drawn late, knockout TBD |

---

## Phased Implementation

### Phase 0 — Database + Hook Migration (non-breaking)
**Goal**: Add competition_id to everything, WC works identically.

1. Supabase migration: add `competition_id` column with default `'WC'`
2. Migrate `match_id` from local IDs to API IDs (using existing match-id-map.json)
3. Update unique constraint
4. Update all hooks to pass `competitionId` parameter (default `'WC'`)
5. Update Worker KV keys to be competition-namespaced
6. **Test**: everything works exactly as before

### Phase 1 — Multi-Competition Worker
**Goal**: Worker serves data for all competitions.

1. Refactor cron to use `/v4/matches` (single call, all competitions)
2. Write per-competition KV entries
3. Add `/api/:comp/*` parameterized endpoints
4. Add `/api/competitions` and `/api/live` endpoints
5. Backward-compatible aliases for existing `/api/scores`
6. **Test**: WC still works, PL/CL endpoints return data

### Phase 2 — Frontend Multi-Competition
**Goal**: Users can switch between competitions and predict.

1. `CompetitionConfig` registry + `CompetitionProvider` context
2. Competition cards on homepage
3. Route restructuring to `/:competition/*`
4. `useCompetitionSchedule` hook (static for WC, API for leagues)
5. Matchday-based prediction UI for leagues
6. Standings page for leagues (separate from group tables)
7. Per-competition leaderboards
8. Update all 6 translation files
9. **Pilot with Premier League first**, then add others

### Phase 3 — Pools (Private Leagues)
**Goal**: Friend group competitions.

1. Create/join pool with code/link
2. Pool-specific leaderboard
3. Pool activity feed
4. Pool settings (custom scoring via JSONB)
5. Deeplink join flow (`/pool/:joinCode`)

### Phase 4 — Gamification
**Goal**: Retention features.

1. Joker picks (1 per matchday, doubles points)
2. Knockout round multipliers
3. Streak tracking + bonuses
4. Community consensus ("67% predict Home")
5. Post-deadline prediction reveal
6. Badges system
7. Quick-predict mode (1X2) for leagues
8. AI bot on leaderboards

### Phase 5 — Polish & Rebrand
**Goal**: Ship as YancoScore.

1. Rename YancoCup → YancoScore throughout
2. Update OG tags, PWA manifest
3. Cross-competition "today's matches" on homepage
4. Weekly recap notifications
5. Competition-specific subtle theming
6. Update CLAUDE.md and docs

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Migration breaks existing WC predictions | `DEFAULT 'WC'` ensures existing rows are fine. Test in Supabase branch first. |
| 10 req/min rate limit | `/v4/matches` (all comps, 1 call) + KV caching. User requests never hit upstream. |
| League schedules too large | Fetch from Worker, not static JSON. Frontend caches in React state. |
| Prediction fatigue (380 matches) | Matchday-based UI + quick-predict + auto-fill missed = 0 pts. |
| Supabase 500MB limit | ~2000 matches × realistic user count is well under 500MB. |
| Bundle size growth | Lazy-load competition pages. Only registry (~1KB) in main bundle. |
| Breaking existing URLs | `/matches` redirects to `/WC/matches` for backward compat. |

---

## What NOT to Build (Cut List)

| Feature | Why cut |
|---------|---------|
| Full fantasy football | Different product. Prediction game is simpler and stickier. |
| Live chat per match | Too complex for v1. Activity feed + reactions is enough. |
| Paid premium tier | Don't monetize before product-market fit. Keep free. |
| Player-level predictions (goalscorer) | Phase 5+ bonus, not core. |
| Custom competition creation | Let users request, admin adds. Not self-serve yet. |
| Notification system | Use browser notifications later. For now, the app is the loop. |
