# YancoCup — Architecture

## System overview

```
┌─────────────────────────────────────────────────────┐
│  GitHub Pages (static SPA)                          │
│  React 19 + Vite 8 + Tailwind 4 + R3F              │
│  HashRouter — all routes are client-side            │
└──────────────────┬──────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────────────────┐
│  Cloudflare Worker (yancocup-api.catbyte1985)        │
│  Hono framework                                      │
│  - API proxy (hides API keys)                        │
│  - Cron: polls /v4/matches every 60s → writes KV    │
│  - Cron: RSS fetch every 4h → AI rewrite → Supabase │
│  - KV cache for live scores per competition          │
└──────┬────────────────┬─────────────────────────────┘
       │                │
┌──────▼──────┐  ┌──────▼──────────────────────┐
│ football-   │  │ Supabase                     │
│ data.org    │  │ - Auth (Google + email)       │
│ Free tier   │  │ - yc_predictions              │
│ 10 req/min  │  │ - yc_pools + yc_pool_members  │
│             │  │ - yc_pool_messages (Realtime)  │
│ Fallback:   │  │ - yc_articles (AI news)       │
│ API-Football│  │ - yc_user_profiles             │
│ 100 req/day │  │ - yc_badges                    │
└─────────────┘  └────────────────────────────────┘
```

## Routing

All routes are client-side via HashRouter. GitHub Pages serves `index.html` for all paths.

```
/                              → Home (followed teams, live matches, prediction deadlines)
/:competition                  → Competition hub (redirects to /overview)
/:competition/overview         → Competition overview
/:competition/matches          → Match schedule (filterable by matchday/date)
/:competition/groups           → Group tables (tournaments only)
/:competition/standings        → League table (leagues only)
/:competition/predictions      → Predict matches
/:competition/leaderboard      → Per-competition leaderboard
/:competition/pools            → Pool management
/:competition/match/:id        → Match detail (Overview / Stats / Lineup / H2H tabs)
/:competition/team/:teamId     → Team profile (squad, form, fixtures, news)
/:competition/bracket          → Knockout bracket (tournaments only)
/:competition/news             → Competition news feed
/news                          → Global news feed
/news/:slug                    → Article detail page
/watch                         → Broadcast finder (global)
/profile                       → Own profile (badges, stats, rank, history)
/profile/:userId               → Public profile
/sign-in                       → Auth page
/admin                         → Admin panel
/pool/:joinCode                → Pool join deeplink
```

## Competition config

Defined in `src/lib/competitions.ts`. Each competition has:
- `id`: short code (`'WC'`, `'CL'`, `'PL'`, etc.)
- `fdCode`: football-data.org competition code
- `name`: display name
- `type`: `'tournament'` | `'league'`
- `hasGroups`: boolean (WC = true, CL = false since 2024/25 Swiss model)
- `staticSchedule`: boolean (WC schedule is static JSON; league schedules fetched live)
- `seasonLabel`: current season string

**Champions League note:** Since 2024/25, the CL uses a Swiss-model league phase (36 teams, single table) instead of groups. `hasGroups: false` is correct. Knockout starts at round of 16 with a preliminary knockout play-off for seeds 9-24.

## Data flow

### Live scores
```
Cloudflare Cron (every 60s)
  → GET football-data.org /v4/matches (no competition filter = ALL competitions in 1 call)
  → Parse response, split by competition
  → Write per-competition KV entries
  → Client reads KV via Worker GET /api/:comp/matches
```

This design means the client NEVER talks to football-data.org directly. All requests go through the Worker, which serves cached KV data. Rate limit concern is at the Worker level only.

### World Cup schedule
Static JSON in `src/data/schedule.json` (104 matches). Group stage matches have resolved team IDs. Knockout matches have `null` teams until those matches are determined by results.

### League schedules
Fetched from Worker `GET /api/:comp/matches`. Updated by cron. 300-380 matches per league season.

### Predictions
```
User submits prediction
  → Supabase INSERT into yc_predictions
  → Fields: user_id, competition_id, match_id (football-data.org ID), home_score, away_score, prediction_type ('full' | 'quick'), created_at

Match finishes
  → First user to load leaderboard triggers client-side scoring
  → scoring.ts compares prediction vs actual result
  → Updates yc_predictions with points_earned
```

**Scoring rules:**
| Category | Points | Condition |
|----------|--------|-----------|
| Exact score | 10 | Predicted 2-1, result 2-1 |
| Goal difference | 5 | Correct GD but wrong score |
| Correct result | 3 | Correct W/D/L but wrong score |
| Wrong | 0 | Incorrect result |
| Quick predict (1X2) | 2 / 0 | Correct result / Wrong |

**Modifiers:**
- Upset bonus: +3 (underdog wins in tournaments)
- Knockout multiplier: 1.5x (R16) → 2x (QF) → 2.5x (SF) → 3x (Final)
- Joker: 2x on one match per matchday
- Streak bonus: +2 (3 correct), +5 (5 correct), +10 (10 correct)

### AI News
```
Cloudflare Cron (every 4h)
  → Fetch RSS from 18+ sources (BBC, Al Jazeera, Kooora, beIN, Marca, Kicker, etc.)
  → Filter for soccer articles
  → Workers AI (Llama 3.1 8B) rewrites headline + summary
  → Tag with team/competition IDs
  → INSERT into yc_articles in Supabase
  → Client fetches via Supabase query, filtered by competition or team
```

### Pools
```
yc_pools: id, name, competition_id, created_by, join_code, scoring_config (JSONB), created_at
yc_pool_members: pool_id, user_id, joined_at
yc_pool_messages: pool_id, user_id, content, created_at (Supabase Realtime subscription)
```

Pool-specific leaderboard is computed client-side by filtering yc_predictions for pool members.

## Team crests and assets

- **National team flags:** circle-flags package (MIT, bundled SVGs)
- **Club crests:** Hotlinked from football-data.org API response URLs. These are official API-provided URLs intended for consumer apps.
- **Fallback:** Three-letter abbreviation (TLA) in a styled circle when crest URL unavailable.
- **Component:** `<TeamCrest>` handles all logic — flag for national teams, API crest for clubs, TLA fallback.
- **NEVER host crest files in the repo.** Copyright restriction.
- **NEVER use player photos.** Rights issues.

## Key files

| File | Purpose | Watch out |
|------|---------|-----------|
| `src/App.tsx` | Route definitions, layout wrapper | Don't add logic here |
| `src/lib/competitions.ts` | Competition registry | Source of truth for comp IDs |
| `src/lib/scoring.ts` | Prediction scoring engine | Client-side — architectural debt |
| `src/hooks/useAutoScore.ts` | Triggers scoring on leaderboard load | Race condition risk |
| `src/data/schedule.json` | WC 2026 full schedule | 104 matches, static |
| `src/data/groups.json` | WC 2026 group assignments | All 48 teams resolved |
| `src/data/teams.json` | Team metadata | Includes FIFA codes |
| `src/styles/globals.css` | Design tokens, base styles | Single source for colors |
| `worker/src/index.ts` | Cloudflare Worker | Separate deploy |

## Deployment

- **Frontend:** `npm run deploy` → builds to `dist/`, pushes to `gh-pages` branch → GitHub Pages serves it
- **Worker:** `cd worker && npx wrangler deploy` → Cloudflare Workers
- **Supabase:** Schema managed via Supabase dashboard (no migrations in repo yet)
