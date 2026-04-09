# YancoCup — Premium Upgrade Plan

> From demo-quality to FotMob/SofaScore-level polish.
> Audited against FotMob, SofaScore, Superbru, FPL, FlashScore (April 2026).

## Problem Statement

YancoCup's architecture, UI polish, and scoring logic are production-grade. But the **data richness** and **feature depth** make league competitions feel unfinished compared to the fully-fleshed World Cup experience. Specifically:

1. No club crests/logos — clubs show as plain TLA text
2. Standings are bare — no form guides, no zone coloring, no crests
3. Match cards lack depth — no events, no form context
4. No match detail drill-down (FotMob's tabbed Facts/Stats/Lineup/H2H)
5. Zero gamification beyond points (no badges, streaks, ranks, challenges)
6. No team profile pages
7. No knockout bracket visualization
8. Minimal social features (no pool chat, no shareable cards, no notifications)

---

## Copyright Strategy: Club Crests

### The Problem
The original build plan says "DO NOT include: team crests/badges, player photos, FIFA branding/logos" — this was about bundling copyrighted static files in the repo.

### The Solution
**football-data.org provides `crest` URLs in every API response.** These point to SVGs hosted on `crests.football-data.org` (e.g., `https://crests.football-data.org/57.svg` for Arsenal). This is the intended use of their API — every app that consumes football-data.org renders these crests (FotMob, SofaScore, etc.).

**What we do:**
- Worker passes through the `crest` URL from football-data.org responses (currently stripped)
- Frontend renders `<img src={crestUrl}>` — we never host, bundle, or redistribute the images
- For WC national teams: continue using circle-flags (these are country flags, not FIFA crests)
- Fallback: TLA badge in a rounded box (already exists) when crest URL is missing

**What we DON'T do:**
- Never download/bundle crest files into the repo
- Never host crests on our own CDN
- Never use FIFA/UEFA official logos or branding
- Never use player photos

### Implementation
1. Worker: Add `crest` field to `FDMatch.homeTeam`/`awayTeam` interface and `StandingTeam.team`
2. Worker: Pass `crest` through in `transformMatch()` and standings responses
3. Frontend: Add `crest?: string` to all team-related types
4. Frontend: Create `<TeamCrest>` component with circle-flags fallback for national teams
5. Frontend: Use `<TeamCrest>` on all surfaces (match cards, standings, predictions, leaderboard)

---

## Phase 1: Data Enrichment (Worker)

**Goal:** Pass rich team/match data through the Worker instead of stripping it.

### 1A. Team Crests in Match Data

**File: `worker/src/index.ts`**

Update `FDMatch` interface to include crest:
```typescript
interface FDMatch {
  // ... existing fields
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;  // ADD: "https://crests.football-data.org/57.svg"
  } | null;
  awayTeam: { /* same */ } | null;
}
```

Update `MatchScore` to pass through team metadata:
```typescript
interface MatchScore {
  // ... existing fields
  homeTeam: string | null;       // TLA (keep for backward compat)
  awayTeam: string | null;
  homeCrest: string | null;      // ADD
  awayCrest: string | null;      // ADD
  homeTeamName: string | null;   // ADD: full name for display
  awayTeamName: string | null;   // ADD
}
```

Update `transformMatch()` to pass these through.

### 1B. Team Crests + Form in Standings

football-data.org standings response already includes `team.crest` and `form` (e.g., `"W,W,D,L,W"`).

Update `StandingTeam` interface:
```typescript
interface StandingTeam {
  position: number;
  team: {
    id: number;       // ADD: for team page links
    tla: string;
    name: string;
    shortName: string;
    crest: string;    // ADD
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string | null;  // ADD: "W,W,D,L,W"
}
```

**Currently the Worker stores raw standings JSON from football-data.org.** Check if `crest` and `form` are already flowing through (the standings endpoint may already pass raw data). If so, this is frontend-only work.

### 1C. New Endpoint: Team Detail

**New: `GET /api/:comp/teams`** — team roster with crests for a competition.

football-data.org provides `/v4/competitions/{code}/teams` which returns squad, coach, crest, venue, etc.

Cache in KV with 24hr TTL (teams don't change often):
```typescript
app.get("/api/:comp/teams", async (c) => {
  const comp = c.req.param("comp").toUpperCase();
  const cached = await c.env.SCORES_KV.get(`${comp}:teams`);
  if (cached) return c.json(JSON.parse(cached));

  const res = await fetchFromFootballData(
    `/competitions/${comp}/teams`,
    c.env.FOOTBALL_DATA_API_KEY,
  );
  if (!res.ok) return c.json({ error: "Failed" }, 502);

  const data = await res.json();
  await c.env.SCORES_KV.put(`${comp}:teams`, JSON.stringify(data), {
    expirationTtl: 86400,
  });
  return c.json(data);
});
```

### 1D. New Endpoint: Match Detail (Rich)

**New: `GET /api/match/:id/detail`** — full match data from football-data.org.

Returns: lineups, goals, bookings, substitutions, referee, venue, head-to-head.

football-data.org provides `/v4/matches/{id}` with full detail.

Cache with 5min TTL for live matches, 1hr for finished:
```typescript
app.get("/api/match/:id/detail", async (c) => {
  const id = c.req.param("id");
  const cacheKey = `matchdetail:${id}`;
  const cached = await c.env.SCORES_KV.get(cacheKey);
  if (cached) return c.json(JSON.parse(cached));

  const res = await fetchFromFootballData(
    `/matches/${id}`,
    c.env.FOOTBALL_DATA_API_KEY,
  );
  if (!res.ok) return c.json({ error: "Match not found" }, 404);

  const data = await res.json();
  const ttl = data.status === "FINISHED" ? 3600 : 300;
  await c.env.SCORES_KV.put(cacheKey, JSON.stringify(data), {
    expirationTtl: ttl,
  });
  return c.json(data);
});
```

**Rate limit note:** These are on-demand endpoints (not cron). They count against 10 req/min. Use aggressive KV caching. Consider fetching during cron for active/live matches.

### 1E. New Endpoint: Head-to-Head

**New: `GET /api/h2h/:id`** — head-to-head for a match.

football-data.org: `/v4/matches/{id}` includes `head2head` aggregates when you add `?include=head2head`.

Cache with 24hr TTL (historical data doesn't change):
```typescript
app.get("/api/h2h/:id", async (c) => {
  const id = c.req.param("id");
  const cacheKey = `h2h:${id}`;
  const cached = await c.env.SCORES_KV.get(cacheKey);
  if (cached) return c.json(JSON.parse(cached));

  const res = await fetchFromFootballData(
    `/matches/${id}?include=head2head`,
    c.env.FOOTBALL_DATA_API_KEY,
  );
  // ... cache and return
});
```

### Files Changed (Phase 1)
- `worker/src/index.ts` — update interfaces, add endpoints, pass through crests/form

---

## Phase 2: Visual Foundation (Frontend)

**Goal:** Club crests everywhere, form guides on standings, zone coloring. Instant visual transformation.

### 2A. `<TeamCrest>` Component

**New file: `src/components/match/TeamCrest.tsx`**

```typescript
interface TeamCrestProps {
  tla: string;
  crest?: string | null;
  isoCode?: string;     // For national teams → circle-flags
  size?: "sm" | "md" | "lg";
  className?: string;
}
```

Logic:
1. If `isoCode` provided → render circle-flag SVG (national team)
2. If `crest` URL provided → render `<img>` with lazy loading + error fallback
3. Fallback → TLA badge in a styled circle (already exists in MatchCard)

Sizes: `sm` = 24px, `md` = 32px, `lg` = 48px.

### 2B. Update Match Cards

**File: `src/components/match/MatchCard.tsx`**

- Replace inline flag logic with `<TeamCrest>`
- Add crest display for club teams (currently only flags work)
- Show form guide dots below team name (if form data available)

### 2C. Update Standings Page

**File: `src/pages/StandingsPage.tsx`**

Major upgrade:

1. **Team crest** next to team name (small, 20px)
2. **Form guide column** — last 5 results as colored dots:
   - `W` → green (#00ff88) filled circle
   - `D` → gray (#666) filled circle
   - `L` → red (#ef4444) filled circle
3. **Zone coloring** — position-based row tinting:
   - Champions League spots (1-4 for PL/PD/SA; 1-3 for BL1; 1-3 for FL1): left border green
   - Europa League: left border amber
   - Conference League: left border sky blue
   - Relegation zone: left border red, subtle red tint on row
   - Zone config per competition in `competitions.ts`
4. **Competition zone config** — add to `CompetitionConfig`:
   ```typescript
   zones?: {
     cl: number[];      // positions that qualify for CL
     el: number[];      // Europa League
     ecl: number[];     // Conference League
     relegation: number[]; // relegated
   }
   ```

### 2D. Update Prediction Cards

**File: `src/components/predictions/PredictionCard.tsx`**

- Replace inline flag logic with `<TeamCrest>`
- Crests visible on prediction cards for club matches

### 2E. Skeleton Loading Screens

Replace spinner-based loading with skeleton screens that match the layout of what's loading.

**New file: `src/components/layout/SkeletonCard.tsx`**

Skeleton variants:
- `SkeletonMatchCard` — mimics match card shape with pulsing gray blocks
- `SkeletonStandingsRow` — mimics table row
- `SkeletonPredictionCard` — mimics prediction card

Use Tailwind `animate-pulse` on `bg-yc-bg-elevated` blocks.

### Files Changed (Phase 2)
- **New:** `src/components/match/TeamCrest.tsx`
- **New:** `src/components/layout/SkeletonCard.tsx`
- `src/components/match/MatchCard.tsx`
- `src/pages/StandingsPage.tsx`
- `src/components/predictions/PredictionCard.tsx`
- `src/lib/competitions.ts` (add zone config)
- `src/lib/api.ts` (update types for crest/form)
- `src/types/index.ts` (if needed)

---

## Phase 3: Match Detail Experience

**Goal:** Tabbed match detail page — the core depth feature that makes casual users become engaged users.

### 3A. Match Detail Page

**New file: `src/pages/MatchDetailPage.tsx`**

Route: `/:competition/match/:id`

Tabbed layout (horizontal, swipeable feel):

**Tab 1: Overview**
- Score with team crests (large)
- Match status (live minute / FT / upcoming countdown)
- Key events timeline (goals with scorer name, cards, subs)
- Mini-stats bar (possession, shots, shots on target)
- Venue + referee

**Tab 2: Stats**
- Full stat comparison (horizontal bar pairs):
  - Possession, shots, shots on target, corners, fouls, offsides, passes, pass accuracy
- Each stat as a split bar: home (left, green) vs away (right, white)

**Tab 3: Lineup** (if available)
- Formation visualization (simplified pitch graphic)
- Starting XI listed with numbers
- Substitutes listed
- Manager name

**Tab 4: H2H**
- Previous meetings (last 10)
- Aggregate: wins/draws/losses
- Last meeting result

### 3B. Events Timeline Component

**New file: `src/components/match/EventsTimeline.tsx`**

Vertical timeline with minute markers:
- Goal icon (ball) + scorer name + minute
- Yellow card icon + player name + minute
- Red card icon + player name + minute
- Substitution icon (arrows) + in/out players + minute

### 3C. Stats Comparison Component

**New file: `src/components/match/StatsComparison.tsx`**

Split horizontal bars for each stat. Home team value on left, away on right. Bar width proportional to value.

### 3D. Update Routing

**File: `src/App.tsx`** (or wherever routes are defined)

Add route: `/:competition/match/:id` → `MatchDetailPage`

Make match cards clickable → navigate to match detail.

### Files Changed (Phase 3)
- **New:** `src/pages/MatchDetailPage.tsx`
- **New:** `src/components/match/EventsTimeline.tsx`
- **New:** `src/components/match/StatsComparison.tsx`
- `src/components/match/MatchCard.tsx` (make clickable, link to detail)
- `src/App.tsx` (add route)
- `src/lib/api.ts` (add match detail fetch function)

---

## Phase 4: Gamification System

**Goal:** Badges, streaks, rank tiers — the retention engine.

### 4A. Database Schema

**Supabase migration:**

```sql
-- Badges catalog
CREATE TABLE yc_badges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,           -- Lucide icon name
  category text NOT NULL,       -- 'activity' | 'skill' | 'loyalty' | 'special'
  condition jsonb NOT NULL      -- machine-readable unlock condition
);

-- User badges
CREATE TABLE yc_user_badges (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id text REFERENCES yc_badges(id),
  earned_at timestamptz DEFAULT now(),
  competition_id text,          -- null = global badge
  PRIMARY KEY (user_id, badge_id)
);

-- Streaks (already planned in expansion, now implementing)
CREATE TABLE yc_streaks (
  user_id uuid REFERENCES auth.users(id),
  competition_id text NOT NULL,
  current_streak integer DEFAULT 0,
  best_streak integer DEFAULT 0,
  last_match_id integer,
  last_result text,            -- 'correct' | 'wrong'
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, competition_id)
);

-- User stats (aggregated for profile/rank)
CREATE TABLE yc_user_stats (
  user_id uuid REFERENCES auth.users(id),
  competition_id text NOT NULL,
  total_predictions integer DEFAULT 0,
  exact_scores integer DEFAULT 0,
  correct_results integer DEFAULT 0,
  total_points integer DEFAULT 0,
  best_matchday_points integer DEFAULT 0,
  jokers_used integer DEFAULT 0,
  PRIMARY KEY (user_id, competition_id)
);
```

### 4B. Badge Definitions

Seed `yc_badges` with initial badges:

**Activity badges:**
| ID | Name | Condition |
|----|------|-----------|
| `first_prediction` | First Blood | Make your first prediction |
| `ten_predictions` | Getting Started | Make 10 predictions |
| `fifty_predictions` | Dedicated | Make 50 predictions |
| `century_club` | Century Club | Make 100 predictions |
| `all_matchday` | Completionist | Predict every match in a matchday |

**Skill badges:**
| ID | Name | Condition |
|----|------|-----------|
| `first_exact` | Sharpshooter | Get your first exact score |
| `five_exact` | Sniper | Get 5 exact scores |
| `perfect_matchday` | Oracle | Get every match right in a matchday |
| `upset_caller` | Upset Whisperer | Correctly predict an upset (tournament only) |
| `streak_3` | Hot Streak | 3 correct results in a row |
| `streak_5` | On Fire | 5 correct results in a row |
| `streak_10` | Unstoppable | 10 correct results in a row |

**Loyalty badges:**
| ID | Name | Condition |
|----|------|-----------|
| `founding_member` | Founding Member | Joined before WC 2026 kickoff |
| `multi_comp` | Globe Trotter | Predict in 3+ competitions |
| `season_complete` | Marathon Runner | Predict in a full league season |

### 4C. Rank Tiers

Client-side calculation based on total points across all competitions:

| Tier | Points | Icon |
|------|--------|------|
| Bronze | 0-99 | Bronze shield |
| Silver | 100-299 | Silver shield |
| Gold | 300-599 | Gold shield |
| Platinum | 600-999 | Platinum shield |
| Diamond | 1000+ | Diamond shield |

Each tier has 5 stars (subdivisions). Display on leaderboard next to username.

**New file: `src/lib/ranks.ts`**

### 4D. Streak Tracking

Client-side streak calculation (same pattern as scoring — first user to load triggers update):

When scoring a prediction:
1. If result is correct (≥3 pts): increment `current_streak`, update `best_streak` if new max
2. If wrong (0 pts): reset `current_streak` to 0
3. Award streak badges at 3/5/10 milestones

**Update: `src/lib/scoring.ts`** — add streak logic to scoring flow.

### 4E. Badges UI

**New file: `src/components/predictions/BadgeCard.tsx`**

Badge display: Lucide icon + name + description + earned date. Unearned badges shown grayed out.

**New file: `src/pages/ProfilePage.tsx`**

Route: `/profile` (own) or `/profile/:userId` (others)

Sections:
- Username + avatar + rank badge
- Stats summary (predictions made, accuracy, best streak, exact scores)
- Badge collection (earned + locked)
- Competition breakdown
- Recent predictions

### 4F. Leaderboard Upgrade

**File: `src/pages/LeaderboardPage.tsx`**

Add to each row:
- Rank tier badge (small icon)
- Current streak indicator (flame icon + number)
- Accuracy percentage

### Files Changed (Phase 4)
- **New:** `src/lib/ranks.ts`
- **New:** `src/lib/badges.ts` (badge check logic)
- **New:** `src/components/predictions/BadgeCard.tsx`
- **New:** `src/pages/ProfilePage.tsx`
- `src/lib/scoring.ts` (streak integration)
- `src/pages/LeaderboardPage.tsx` (rank badges, streaks)
- `src/lib/supabase.ts` or equivalent (new table queries)
- Supabase migration SQL

---

## Phase 5: Team Profiles

**Goal:** Tap a team anywhere → see squad, form, fixtures, league position.

### 5A. Team Page

**New file: `src/pages/TeamPage.tsx`**

Route: `/:competition/team/:teamId`

Sections:
- **Header**: Large crest + team name + stadium + manager
- **Form**: Last 10 results as W/D/L bars with opponent crests
- **Squad**: Player list with position, number, nationality flag (from `/api/:comp/teams`)
- **Upcoming**: Next 5 fixtures
- **League position**: Mini standings snippet showing 2 above + 2 below

### 5B. Clickable Team Names

Update all surfaces where team names appear to be clickable links to team pages:
- Standings table rows
- Match cards
- Match detail page
- Prediction cards

### Files Changed (Phase 5)
- **New:** `src/pages/TeamPage.tsx`
- `src/pages/StandingsPage.tsx` (team name links)
- `src/components/match/MatchCard.tsx` (team name links)
- `src/App.tsx` (add route)

---

## Phase 6: Knockout Bracket Visualization

**Goal:** Visual bracket tree for WC and CL knockout stages.

### 6A. Bracket Component

**New file: `src/components/match/BracketView.tsx`**

Horizontal bracket tree layout:
```
R32 → R16 → QF → SF → Final
```

Each node: team crests + score (if played) or "TBD".

For WC: starts at Round of 32 (32 teams → 16 → 8 → 4 → 2 → 1).
For CL: depends on stage (playoffs → R16 → QF → SF → Final).

Use CSS Grid for layout. No heavy libraries.

### 6B. Integration

Add "Bracket" tab/button on competition pages for tournaments.
Show bracket view alongside match list.

### Files Changed (Phase 6)
- **New:** `src/components/match/BracketView.tsx`
- Competition match pages (add bracket toggle)
- Nav (add bracket link for tournaments)

---

## Phase 7: Social & Engagement

**Goal:** Features that make users come back and share.

### 7A. Pool Activity Feed

**File: Pool-related components**

Within a pool view, show recent predictions by pool members (after deadline).
Mini-feed: "[avatar] Yaman predicted 2-1 for Arsenal vs Chelsea".

### 7B. Shareable Prediction Cards

**New file: `src/lib/shareCard.ts`**

Generate a shareable image (using Canvas API or html2canvas) of a prediction result:
- YancoCup branding
- Match: [Crest] Team A 2-1 Team B [Crest]
- "Yaman predicted 2-1 — Exact Score! +10 pts"
- Share via Web Share API (native share sheet on mobile)

### 7C. Notifications (Browser)

**New file: `src/lib/notifications.ts`**

Request browser notification permission. Send notifications for:
- Match about to start (prediction deadline)
- Match result (if predicted)
- Badge earned
- Leaderboard position change

### 7D. Profile Pages (Public)

Route: `/profile/:userId`

Show username, rank badge, badge collection, stats.
Other users can see your profile from leaderboard or pool member list.

### Files Changed (Phase 7)
- **New:** `src/lib/shareCard.ts`
- **New:** `src/lib/notifications.ts`
- Pool components (activity feed)
- Leaderboard (link to profile)

---

## Implementation Priority & Sequencing

### Sprint 1: "Instant Visual Upgrade" (P0)
**Phase 1A + 1B + Phase 2A-2D**
- Worker: pass through crests + form
- Frontend: `<TeamCrest>`, form guide dots, zone coloring, crests on all surfaces
- **Impact**: Night-and-day visual transformation
- **Effort**: ~3 sessions
- **Dependencies**: None

### Sprint 2: "Standings Premium" (P0)
**Phase 2E + remaining Phase 2**
- Skeleton loading screens
- Zone coloring polish
- **Impact**: Standings page goes from bare table to FotMob-level
- **Effort**: ~1 session
- **Dependencies**: Sprint 1

### Sprint 3: "Match Depth" (P1)
**Phase 1C + 1D + Phase 3**
- Worker: match detail + H2H endpoints
- Frontend: match detail page with tabs
- **Impact**: Core engagement feature — casual users become engaged users
- **Effort**: ~4 sessions
- **Dependencies**: Sprint 1

### Sprint 4: "Gamification Engine" (P1)
**Phase 4**
- DB migration + badges + streaks + ranks + profile page
- **Impact**: 22%+ retention lift (industry benchmark)
- **Effort**: ~4 sessions
- **Dependencies**: Sprint 1 (for crests on profile/leaderboard)

### Sprint 5: "Team World" (P2)
**Phase 1C + Phase 5**
- Worker: team detail endpoint
- Frontend: team profile pages
- **Impact**: Data richness signal — feels like a real sports platform
- **Effort**: ~3 sessions
- **Dependencies**: Sprint 1

### Sprint 6: "Tournament Brackets" (P2)
**Phase 6**
- Bracket visualization for WC + CL
- **Impact**: Tournament UX essential, visual wow factor
- **Effort**: ~2 sessions
- **Dependencies**: Sprint 1

### Sprint 7: "Social Layer" (P3)
**Phase 7**
- Share cards, notifications, pool activity, public profiles
- **Impact**: Viral growth + retention loop
- **Effort**: ~3 sessions
- **Dependencies**: Sprint 4 (for badges/ranks on profiles)

---

## What This Does NOT Include (Cut List)

| Feature | Why Cut |
|---------|---------|
| Live chat per match | Too complex, activity feed is enough |
| Full fantasy football | Different product entirely |
| xG / advanced stats | football-data.org free tier doesn't provide xG |
| Player heatmaps | Requires paid data providers |
| Attack momentum graph | Requires granular event data not in free tier |
| Player ratings (SofaScore-style) | Proprietary algorithm, not buildable with free data |
| Custom badge creator (FPL + Adobe) | Over-engineered for friend group app |
| Paid premium tier | Don't monetize before product-market fit |
| Push notifications (native) | Browser notifications sufficient for web app |
| Live text commentary | Not available in free API tier |

---

## API Rate Budget After Upgrade

| Action | Frequency | Calls/min |
|--------|-----------|-----------|
| Cron: `/v4/matches` (all comps) | Every 60s | 1 |
| Cron: `/v4/matches?dateFrom/To` | Every 5min | 0.2 |
| Cron: standings rotation | Every 15min | 0.07 |
| On-demand: match detail | User click | ~0.5 avg (KV cached) |
| On-demand: teams | User click | ~0.01 (24hr cache) |
| On-demand: H2H | User click | ~0.1 (24hr cache) |
| **Total average** | | **~2 req/min** |

Budget: 10 req/min. Headroom: 8 req/min. Safe.

---

## Success Metrics

After premium upgrade is complete:
- [ ] Every club team shows its crest on all surfaces
- [ ] Standings show form guide, zone coloring, crests
- [ ] Tapping a match opens a rich detail page with stats/lineup/H2H
- [ ] Users have rank badges visible on leaderboard
- [ ] At least 10 earnable badges exist
- [ ] Streak counter visible on leaderboard
- [ ] Team pages accessible from any team name
- [ ] WC bracket visualization works for knockout stage
- [ ] Prediction results are shareable as images
- [ ] Build passes (`npm run build`) at every phase
