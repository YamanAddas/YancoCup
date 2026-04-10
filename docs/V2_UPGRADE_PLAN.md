# YancoCup — V2 Upgrade Plan

> From prediction game to daily football destination.
> Covers: UX polish, prediction enhancements, social features, gamification depth, AI-powered news.
> Replaces: EXPANSION_PLAN.md (completed) and PREMIUM_UPGRADE_PLAN.md (completed).

## What's Already Done (V1 Complete)

These features are live and working:

- Multi-competition architecture (WC, CL, PL, PD, BL1, SA, FL1, EL)
- Club crests via football-data.org API URLs + circle-flags for national teams
- Form guide dots on standings + zone coloring (CL/EL/relegation)
- Match detail page with tabs (Overview/Stats/Lineup/H2H)
- Bracket visualization for knockout tournaments
- Team profile pages (squad, form, fixtures)
- Gamification: badges (activity/skill), streak tracking, rank tiers (Bronze→Diamond)
- Profile pages with stats, badge collection, rank display
- Pools (create/join, join codes, competition-scoped)
- Skeleton loading screens
- Shareable prediction cards
- 3D interactive globe
- Activity feed with spoiler protection
- Community consensus visualization
- Leaderboard with podium, PPP, accuracy
- Browser notifications
- 6-language i18n (EN, AR, ES, FR, DE, PT)

---

## Phase 1: Core UX Fixes

Small changes that immediately improve daily usage. No DB changes.

### 1.1 — "Predicted" indicator on match cards

- **Files**: `MatchCard.tsx`
- Add a small teal checkmark badge on matches the user has already predicted
- Cross-reference `usePredictions()` result set with match `apiId`
- Show on both schedule page and home page match cards

### 1.2 — "My Predictions Today" widget on Home Page

- **Files**: `HomePage.tsx`
- Card for logged-in users: "3/5 predicted today" with teal progress ring
- CTA button → competition predictions page
- Pull today's matches from `useScores()`, cross-ref with `usePredictions()`

### 1.3 — Personalized greeting on Home Page

- **Files**: `HomePage.tsx`
- Replace generic header with: "Welcome back, Yaman — you're #4 in Premier League"
- Show rank in user's most-active competition (most predictions)
- Falls back to generic greeting for logged-out users

### 1.4 — Timezone display on match times

- **Files**: `MatchCard.tsx`, `PredictionCard.tsx`, `MatchDetailPage.tsx`
- Append user's local timezone abbreviation: "21:00 CEST"
- Use `Intl.DateTimeFormat().resolvedOptions().timeZone` to detect
- Small helper in `src/lib/formatDate.ts`

### 1.5 — Your prediction on Match Detail page

- **Files**: `MatchDetailPage.tsx`
- Banner at top: "You predicted 2-1 — earned 5 pts" (green) or "pending" (gray)
- Show only for logged-in users who predicted this match
- Pull from `usePredictions()` filtered by match ID

---

## Phase 2: Predictions Enhancement

Reduce fatigue for leagues, increase fun for all competitions.

### 2.1 — Quick-Predict mode (1X2) for leagues

The most important feature for league engagement. Without this, 380-match leagues cause burnout.

- **Files**: `PredictionsPage.tsx`, `PredictionCard.tsx`, `useScoring.ts`, `scoring.ts`
- Toggle on predictions page: "Quick (1X2)" vs "Full (Exact Score)"
- Quick mode: 3 large buttons per match — Home / Draw / Away
- Quick predictions score result-only: max 2 pts (correct result), 0 pts (wrong)
- Full mode: existing exact score inputs, max 10 pts

**DB migration:**
```sql
ALTER TABLE yc_predictions ADD COLUMN quick_pick TEXT DEFAULT NULL;
-- Values: 'H', 'D', 'A', or NULL (exact score mode)
```

**Scoring rules for quick-predict:**
- Correct result: 2 pts
- Wrong: 0 pts
- Joker still applies (2x → max 4 pts)
- Knockout multipliers still apply
- No GD or exact score tiers (those require actual scores)

**Storage:**
- Quick predictions: `home_score = NULL, away_score = NULL, quick_pick = 'H'|'D'|'A'`
- Full predictions: `home_score = 2, away_score = 1, quick_pick = NULL`
- Scoring logic checks `quick_pick` first; if set, use result-only scoring

### 2.2 — Prediction streak counter on prediction page

- **Files**: `PredictionsPage.tsx`
- Show below matchday nav: "🔥 12 consecutive correct predictions"
- Data already in `yc_streaks` table — just display it
- Flame icon + count, animated glow if streak ≥ 5

### 2.3 — "Bold Prediction" tag

- **Files**: `PredictionCard.tsx`, `ActivityFeed.tsx`
- If user predicts away win when consensus shows <25% away → tag as "Bold"
- Small "BOLD" badge on the prediction card in orange/amber
- On activity feed after match: "🔥 Bold call!" if the bold prediction was correct
- Client-side only — compare prediction against consensus data from `useConsensus()`

### 2.4 — Post-match points reveal animation

- **Files**: `PredictionCard.tsx`
- When a prediction transitions from unscored to scored, animate:
  - Points number counts up from 0 to final value
  - Flash color: green (10pts), teal (5pts), amber (3pts), gray (0pts)
  - Confetti-style particle burst for exact scores (10pts)
- CSS animation triggered when `scored_at` transitions from null
- Use `@keyframes` — no animation library

### 2.5 — "Copy last matchday" button for leagues

- **Files**: `PredictionsPage.tsx`
- Button in matchday header: "Copy from Matchday X"
- Pre-fills score inputs with previous matchday's predictions for same teams
- User can adjust before saving — nothing auto-saves
- Only available if previous matchday has predictions

---

## Phase 3: Leaderboard & Social

Features that keep people coming back and create viral moments.

### 3.1 — Matchday / Weekly / Monthly sub-leaderboards

- **Files**: `LeaderboardPage.tsx`, `useLeaderboard.ts`
- Filter tabs: "All Time" | "This Matchday" | "This Week" | "This Month"
- "This Matchday": aggregate points from current matchday only
- "This Week"/"This Month": filter `yc_predictions` by `scored_at` date range
- Re-rank per filter — latecomers can compete on weekly boards

### 3.2 — Rank movement arrows

- **Files**: `LeaderboardPage.tsx`
- Show ↑3 / ↓2 / — next to each row
- Calculation: compare current rank to rank from one matchday ago
- Approach: compute "total points minus this matchday's points" → re-rank → diff
- Green arrow up, red arrow down, gray dash for no change

### 3.3 — Pool leaderboard integration

- **Files**: `LeaderboardPage.tsx`
- Dropdown filter: "Global" | "My Pool: Arsenal Lads" | "My Pool: Work Friends"
- When pool selected, filter leaderboard to pool members only
- Data: join `yc_pool_members` with leaderboard aggregation

### 3.4 — Pool chat / comments

- **Files**: new `PoolChat.tsx`, pool page components
- Simple threaded comments per pool

**DB migration:**
```sql
CREATE TABLE yc_pool_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID REFERENCES yc_pools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: only pool members can read/write
CREATE POLICY pool_messages_select ON yc_pool_messages
  FOR SELECT USING (
    pool_id IN (SELECT pool_id FROM yc_pool_members WHERE user_id = auth.uid())
  );
CREATE POLICY pool_messages_insert ON yc_pool_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    pool_id IN (SELECT pool_id FROM yc_pool_members WHERE user_id = auth.uid())
  );
```

- Supabase Realtime subscription for live message updates
- Input field at bottom of pool view, messages scroll above
- Max 500 chars per message, basic text only

### 3.5 — Pool matchday recap (auto-generated)

- **Files**: new `PoolRecap.tsx`, pool page components
- After all matches in a matchday are finished+scored, generate a recap card:
  - **MVP**: highest total points this matchday
  - **Wooden Spoon**: lowest total points
  - **Best Prediction**: highest single-match score (name the match)
  - **Biggest Upset Call**: correct bold prediction (if any)
  - **Pool Average**: mean points per member
- Client-side computed when viewing pool after matchday completes
- "Share Recap" button → generates text for clipboard/WhatsApp:
  ```
  🏆 Arsenal Lads — Matchday 32 Recap
  MVP: Ahmed (18 pts)
  Wooden Spoon: Yaman (2 pts)
  Best Call: Sara nailed Bayern 2-1!
  → yancocup.com
  ```

### 3.6 — Pool admin controls

- **Files**: pool page components
- Pool creator (identified by `created_by`) can:
  - Rename pool
  - Remove members
  - Toggle "allow late joins" (boolean)
- Add columns to `yc_pools`: `allow_late_joins BOOLEAN DEFAULT true`

### 3.7 — Social share buttons for pool invites

- **Files**: pool page components
- Pre-filled share links:
  - WhatsApp: `https://wa.me/?text=Join%20my%20YancoCup%20pool!%20...`
  - Telegram: `https://t.me/share/url?url=...&text=...`
  - Twitter/X: `https://twitter.com/intent/tweet?text=...`
  - Copy link (existing, enhance with toast confirmation)

### 3.8 — Activity feed reactions

- **Files**: `ActivityFeed.tsx`
- React to predictions with emoji: 🔥 (fire), 😂 (laugh), 🤡 (clown)
- Tap emoji → increment counter, show aggregate

**DB migration:**
```sql
CREATE TABLE yc_reactions (
  prediction_id UUID REFERENCES yc_predictions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,  -- 'fire', 'laugh', 'clown'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (prediction_id, user_id)
);
```

- One reaction per user per prediction (tap again to remove)
- Show count under each activity feed item

### 3.9 — Activity feed: post-match results

- **Files**: `ActivityFeed.tsx`
- After match finishes, activity items update to show:
  - "Ahmed scored 10 pts on Bayern 2-1!" instead of "Ahmed predicted Bayern vs Dortmund"
  - Points shown with tier coloring

---

## Phase 4: Profile & Gamification Depth

Build user identity and progression that drives retention.

### 4.1 — Prediction history on profile

- **Files**: `ProfilePage.tsx`, new `PredictionHistory.tsx`
- New tab/section on profile: "History"
- Paginated list (20 per page):

  | Match | Your Pick | Actual | Points | Date |
  |-------|-----------|--------|--------|------|
  | ARS 2-1 CHE | 2-1 | 2-1 | 10 ✓ | Apr 5 |

- Filter by competition dropdown
- Sort by date (default) or points
- Data: query `yc_predictions` where `scored_at IS NOT NULL`, join with match data from KV

### 4.2 — Prediction accuracy breakdown

- **Files**: `ProfilePage.tsx`
- Visual breakdown bar (CSS-only, horizontal stacked bar):
  - Exact Score (green): 12%
  - Goal Difference (teal): 18%
  - Correct Result (amber): 35%
  - Wrong (gray): 35%
- Calculate from scored predictions: group by points tier

### 4.3 — Competition-specific stats

- **Files**: `ProfilePage.tsx`
- Per-competition mini cards:
  - Competition emblem + name
  - Accuracy %, total points, predictions count
  - Small bar showing relative accuracy
- "Best at: Premier League (62%)" highlight at top

### 4.4 — Loyalty badges (new category)

- **Files**: `badges.ts`, badge checker hooks

| ID | Name | Description | Condition |
|----|------|-------------|-----------|
| `opening_day` | Opening Day | Predicted matchday 1 | Prediction exists for matchday 1 of any competition |
| `all_in` | All-In | Predicted every match in a matchday | All matches in a matchday have predictions |
| `marathon` | Marathon | 20+ consecutive matchdays predicted | Track in `yc_streaks` or compute from predictions |
| `night_owl` | Night Owl | Predicted after midnight | `created_at` hour >= 0 AND hour < 5 (local time) |
| `globe_trotter` | Globe Trotter | Predicted in 4+ competitions | Count distinct `competition_id` in predictions |
| `social_butterfly` | Social Butterfly | Joined 3+ pools | Count pool memberships |

**DB migration:** Insert new badge rows into `yc_badges`.

### 4.5 — Rivals system

- **Files**: `ProfilePage.tsx`, `LeaderboardPage.tsx`

**DB migration:**
```sql
ALTER TABLE profiles_public ADD COLUMN rivals UUID[] DEFAULT '{}';
-- Max 3 rivals per user
```

- "Add as rival" button on leaderboard rows → adds their user_id to your `rivals` array
- On your profile, show side-by-side comparison:
  - Your stats vs each rival's stats
  - Who's ahead in each competition
- "Remove rival" button on profile

### 4.6 — Shareable profile card

- **Files**: `ProfilePage.tsx`, share utilities
- Canvas-generated image (reuse existing share infra):
  - YancoCup branding + cosmic background
  - Rank badge (large), username, avatar
  - Key stats: Total Points, Accuracy, Best Streak
  - Top 3 earned badges
- Share via Web Share API or download as PNG

---

## Phase 5: Standings, Bracket & Watch

Polish existing features with high-value additions.

### 5.1 — "If season ended today" banner

- **Files**: `StandingsPage.tsx`
- Small callout above league table:
  - "Champions League: Arsenal, Chelsea, Liverpool, Man City"
  - "Relegated: Leicester, Ipswich, Southampton"
- Derive from zone config per competition (already exists in `competitions.ts`)

### 5.2 — Points-to-safety / points-to-title

- **Files**: `StandingsPage.tsx`
- Calculate mathematical minimum points needed:
  - Top team: "Arsenal need 12 pts to clinch" (remaining matches × 3 minus gap)
  - Bottom team: "Leicester need 15 pts for safety"
- Show as subtle text below table or on hover

### 5.3 — Sortable standings columns

- **Files**: `StandingsPage.tsx`
- Click column header (GD, GF, GA, Form, W, D, L) to re-sort
- Sort indicator arrow on active column
- Default sort: position (as returned by API)

### 5.4 — User predictions overlay on bracket

- **Files**: `BracketView.tsx`
- If user predicted knockout matches, overlay on bracket nodes:
  - Green border = correct prediction
  - Red border = wrong prediction
  - Gray border = pending (match not played yet)
- Small prediction score label on each node

### 5.5 — "Path to the final" bracket highlight

- **Files**: `BracketView.tsx`
- Click a team → highlight all their bracket nodes + connector lines
- Dim non-related matches
- CSS class toggle, no complex state

### 5.6 — Watch page: Broadcaster lookup

- **Files**: `WatchPage.tsx` (currently stub), new `src/data/broadcasters.json`
- Static JSON mapping: `{ country: { competition: [{ name, url }] } }`
- User selects country → see channels per competition
- On match detail page: "Watch on: beIN Sports (MENA), Sky Sports (UK)"
- Data sources: public broadcaster deal announcements (manually curated, ~20 countries)

---

## Phase 6: AI-Powered News Section (DEFERRED — post World Cup launch)

> **Priority:** Ship after WC launch is stable. This is the most complex feature and has the least impact on the core prediction game. See BUILD_PLAN.md for priority ordering.

The big differentiator. Turns YancoCup from a prediction game into a daily football destination.

### Architecture Overview

```
RSS Feeds (15+ sources, EN + AR + EU)
    ↓ (Cloudflare Cron Trigger, every 4 hours)
Cloudflare Workers AI (free tier)
    ↓ Llama 3.1 8B — summarize + rewrite
Supabase: yc_articles table
    ↓
Frontend: /news, /:competition/news, team news tabs
```

### 6.1 — Free AI Strategy

| Provider | Free Tier | Role |
|----------|-----------|------|
| **Cloudflare Workers AI** | 10,000 neurons/day (~15 articles/run × 6 runs = ~90/day) | Primary — already on CF, zero latency |
| **Google Gemini API** | 15 RPM, 1M tokens/day | Backup if CF quota hit |
| **Groq** | 14,400 req/day (Llama 3.3 70B) | Secondary backup, fastest inference |

**Recommended: Cloudflare Workers AI** as primary. Model: `@cf/meta/llama-3.1-8b-instruct`. Already on Cloudflare, no extra accounts needed, runs at edge.

**Fallback chain:** Workers AI → Groq → Gemini. If all fail, store raw RSS summary without AI rewrite (still useful).

### 6.2 — News Sources

#### English Sources (Global + League-specific)

| Source | RSS Feed Pattern | Coverage |
|--------|-----------------|----------|
| BBC Sport Football | `feeds.bbci.co.uk/sport/football/rss.xml` | Global, PL focus |
| The Guardian Football | `theguardian.com/football/rss` | PL, European |
| ESPN FC | `espn.com/espn/rss/soccer/news` | Global |
| Sky Sports Football | `skysports.com/rss/12040` | PL, CL |
| UEFA.com | `uefa.com/rssfeed/...` | CL, EL, EC |
| Goal.com | `goal.com/feeds/en/news` | Global |

#### Arabic Sources

| Source | RSS Feed Pattern | Coverage | Notes |
|--------|-----------------|----------|-------|
| **Al Jazeera Sport** | `aljazeera.net/sport/rss` | Global, MENA focus | Top Arabic news, credible |
| **beIN Sports Arabic** | `beinsports.com/ar/rss` | Global, MENA | Major Arabic sports broadcaster |
| **Kooora.com** | `kooora.com/rss` | All leagues, Arabic-native | Biggest Arabic football site |
| **Yalla Kora** | `yallakora.com/rss` | Egyptian + Arab leagues | Huge Arabic audience |
| **FilGoal** | `filgoal.com/rss` | Egyptian + European | Very popular in MENA |
| **Goal.com Arabic** | `goal.com/feeds/ar/news` | Global, Arabic edition | Good CL/WC coverage |
| **Arryadia** (Morocco) | `arryadia.ma/rss` | Moroccan + Ligue 1 | French-speaking Africa angle |
| **Saudi Sports (SSC)** | `ssc.sa/rss` | Saudi + Asian football | Growing market |

#### European Sources (League-specific)

| Source | RSS Feed Pattern | Coverage |
|--------|-----------------|----------|
| **Marca** (Spanish) | `marca.com/rss/futbol.xml` | La Liga |
| **Kicker** (German) | `kicker.de/rss/news` | Bundesliga |
| **Gazzetta dello Sport** (Italian) | `gazzetta.it/rss/calcio.xml` | Serie A |
| **L'Equipe** (French) | `lequipe.fr/rss/actu_foot.xml` | Ligue 1 |
| **A Bola** (Portuguese) | `abola.pt/rss` | Liga Portugal |

**Total: ~18 sources across 4 languages.** The AI rewrites everything into the user's language (or English by default), so source language doesn't matter.

### 6.3 — Database Schema

```sql
CREATE TABLE yc_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT NOT NULL,              -- AI-generated 2-3 sentence summary
  body TEXT NOT NULL,                 -- AI-generated short summary (3-5 sentences, 60-100 words)
  source_url TEXT NOT NULL,           -- original article link (attribution)
  source_name TEXT NOT NULL,          -- "BBC Sport", "Al Jazeera", etc.
  source_lang TEXT NOT NULL,          -- "en", "ar", "es", "de", "fr", "pt"
  image_url TEXT,                     -- from RSS <media:content> if available
  competition_id TEXT,                -- "PL", "CL", etc. (NULL = general football)
  team_ids INTEGER[],                -- football-data.org team IDs mentioned
  team_names TEXT[],                 -- searchable team names
  tags TEXT[],                       -- "transfer", "injury", "preview", "result", "analysis"
  published_at TIMESTAMPTZ NOT NULL, -- original publish date from RSS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ai_model TEXT DEFAULT 'llama-3.1-8b',
  lang TEXT DEFAULT 'en'             -- output language of the AI rewrite
);

CREATE INDEX idx_articles_comp ON yc_articles(competition_id);
CREATE INDEX idx_articles_teams ON yc_articles USING GIN(team_ids);
CREATE INDEX idx_articles_published ON yc_articles(published_at DESC);
CREATE INDEX idx_articles_slug ON yc_articles(slug);
CREATE INDEX idx_articles_tags ON yc_articles USING GIN(tags);

-- Cleanup: auto-delete articles older than 30 days (Supabase pg_cron or manual)
-- Keep DB lean on free tier
```

### 6.4 — Worker Cron: News Pipeline

New cron job in existing worker. Runs every 4 hours (6 times/day).

**Flow:**

1. **Fetch RSS feeds** (all sources, parallel `Promise.allSettled`)
   - Parse XML → extract: title, link, description, pubDate, media:content
   - Normalize dates to UTC

2. **Deduplicate** against `yc_articles.source_url`
   - Query Supabase for existing URLs in this batch
   - Skip already-processed articles

3. **AI rewrite** (batch, 20-30 articles per cron run)
   - For each new article, call Workers AI:
   ```
   System: You are a football journalist writing for YancoCup, a prediction
   game platform. Rewrite this news in an engaging, concise style.
   Keep all facts accurate. Output JSON with these fields:
   - title: rewritten headline (max 80 chars)
   - summary: 2-3 sentence summary
   - body: 3-5 sentence summary (60-100 words). NOT a full article rewrite.
   - competition: one of [WC, CL, PL, PD, BL1, SA, FL1, EL] or null
   - teams: array of team names mentioned
   - tags: array from [transfer, injury, preview, result, analysis, breaking]

   Original headline: {title}
   Original text: {description}
   Source: {source_name}
   ```

4. **Team ID mapping**
   - Match extracted team names against football-data.org team registry
   - Use fuzzy matching (team names vary across sources: "Man Utd" vs "Manchester United" vs "مانشستر يونايتد")
   - Store both `team_ids` (integer[]) and `team_names` (text[]) for flexible querying

5. **Generate slug** from title: `kebab-case-title-2026-04-09`

6. **Insert into Supabase** `yc_articles`

**Rate limit management:**
- Workers AI: 10K neurons/day. Cap at 15 articles per cron run × 6 runs/day = ~90 articles/day max. Test actual neuron consumption before launch.
- RSS fetches: no rate limit (public feeds)
- Supabase inserts: negligible

**Worker endpoint additions:**
```
GET /api/news                    — latest articles (paginated, ?page=1&limit=20)
GET /api/news/:slug              — single article by slug
GET /api/:comp/news              — articles filtered by competition
GET /api/team/:teamId/news       — articles mentioning a team
```

These read from Supabase directly (or cache in KV with 15min TTL for hot articles).

### 6.5 — Frontend: News Pages

#### Global News Feed: `/news`

- **Files**: new `src/pages/NewsPage.tsx`
- Reverse-chronological card grid (2 columns desktop, 1 mobile)
- Each card:
  - Image (if available, or gradient placeholder with competition emblem)
  - Title (bold)
  - Summary (2 lines, truncated)
  - Source attribution: "Based on BBC Sport" with small logo
  - Time ago: "2h ago"
  - Competition badge pill
  - Team crests mentioned (small, inline)
- Competition filter tabs across top: All | PL | CL | La Liga | ...
- Infinite scroll or "Load more" pagination
- Glassmorphic card styling matching YancoVerse aesthetic

#### Article Page: `/news/:slug`

- **Files**: new `src/pages/ArticlePage.tsx`
- Full article layout:
  - Hero image (or gradient header)
  - Title (Space Grotesk, large)
  - Meta: source attribution + published date + competition badge
  - Body text (Inter, 18px, good line-height for readability)
  - "Read original article →" link (opens source URL in new tab)
  - Team crests sidebar (teams mentioned)
  - Related articles (3-4 cards, same competition or team)
  - Share buttons (WhatsApp, Twitter, copy link)

#### Competition News Tab: `/:competition/news`

- **Files**: competition tab layout
- New tab in competition hub navigation (alongside Matches, Standings, etc.)
- Shows articles filtered by `competition_id`
- Same card layout as global news feed

#### Team News Section

- **Files**: `TeamPage.tsx`
- New tab or section on team profile page
- Articles where `team_ids @> ARRAY[teamId]`
- Shows team-specific news alongside squad, form, fixtures

### 6.6 — Team Blog Pages (Auto-Curated)

For the top ~50 teams across all competitions, the team profile page automatically becomes a "blog" page:

**Top teams (auto-curated by having articles):**
- PL: Arsenal, Chelsea, Liverpool, Man City, Man United, Tottenham + all 20 teams
- La Liga: Real Madrid, Barcelona, Atletico Madrid
- BL1: Bayern Munich, Dortmund, Leverkusen
- Serie A: Juventus, Inter, AC Milan, Napoli
- Ligue 1: PSG, Marseille, Lyon
- CL: all participants
- National teams: top WC contenders

No manual curation needed — if articles mention a team, they appear on that team's page. Teams with more news naturally have richer pages.

### 6.7 — Arabic-Specific Features

Since YancoCup already supports Arabic (RTL layout, Arabic translations):

- **Arabic article toggle**: on article page, if the source was Arabic, offer "Read in Arabic" / "Read in English" toggle
- **Arabic sources prioritized for MENA users**: if user's language is AR, show Arabic-source articles first (they'll be AI-rewritten to English by default, but can show original)
- **Arabic team name matching**: the team mapper must handle Arabic names (e.g., "ريال مدريد" → Real Madrid, "الأهلي" → Al Ahly)
- **Arabic RSS parsing**: some Arabic RSS feeds use different encoding (UTF-8 with Arabic chars). Worker must handle this correctly.

### 6.8 — Legal / Attribution

- **Always** link back to original source with prominent attribution
- AI rewrites, not verbatim copies — transformative use
- Display: "Based on reporting by [Source Name]" with clickable link
- Never claim original reporting or original journalism
- If a source requests removal, add to blocklist in Worker config
- Articles auto-delete after 30 days (reduces storage, keeps content fresh)

### 6.9 — Content Quality Safeguards

- **Deduplication**: same story from multiple sources → keep only the first, skip duplicates
  - Use title similarity (Levenshtein distance or simple keyword overlap) to detect dupes
- **Minimum quality**: skip articles with description < 50 chars (usually not real articles)
- **Relevance filter**: AI prompt includes instruction to only rewrite football-related content
- **No opinion/editorials**: instruct AI to stick to facts, no speculation or hot takes
- **Error handling**: if AI rewrite fails or returns garbage, fall back to raw RSS summary

---

## New Routes Summary

```
/news                          → Global news feed
/news/:slug                    → Article page
/:competition/news             → Competition-filtered news
```

Team news is a tab on existing `/:competition/team/:teamId` route.

## New Database Tables

```sql
yc_articles           — AI-generated news articles
yc_pool_messages      — Pool chat messages
yc_reactions          — Activity feed reactions (fire/laugh/clown)
```

## Database Migrations

```sql
-- Phase 2: Quick-predict
ALTER TABLE yc_predictions ADD COLUMN quick_pick TEXT DEFAULT NULL;

-- Phase 4: Rivals
ALTER TABLE profiles_public ADD COLUMN rivals UUID[] DEFAULT '{}';

-- Phase 3: Pool admin
ALTER TABLE yc_pools ADD COLUMN allow_late_joins BOOLEAN DEFAULT true;
```

## New Worker Endpoints

```
GET /api/news                    — latest articles (paginated)
GET /api/news/:slug              — single article
GET /api/:comp/news              — competition-filtered news
GET /api/team/:teamId/news       — team-filtered news
```

## New Frontend Files

```
src/pages/NewsPage.tsx           — global news feed
src/pages/ArticlePage.tsx        — single article view
src/components/news/NewsCard.tsx  — news card component
src/components/news/RelatedArticles.tsx
src/components/pool/PoolChat.tsx  — pool chat
src/components/pool/PoolRecap.tsx — matchday recap
src/components/predictions/PredictionHistory.tsx
src/hooks/useNews.ts             — news fetching hook
src/hooks/usePoolChat.ts         — pool chat hook
```

---

## Implementation Priority & Sequencing

| Phase | Focus | Sessions | Dependencies |
|-------|-------|----------|-------------|
| **Phase 1** | Core UX fixes | 1-2 | None |
| **Phase 2** | Prediction enhancements | 2-3 | None |
| **Phase 3** | Leaderboard & social | 3-4 | Phase 2 (quick-predict scoring) |
| **Phase 4** | Profile & gamification | 2-3 | Phase 2 (prediction history data) |
| **Phase 5** | Standings/bracket/watch | 1-2 | None |
| **Phase 6** | AI-powered news | 3-4 | None (parallel track) |

**Recommended parallel tracks:**
- Track A: Phase 1 → Phase 2 → Phase 3 → Phase 4 (prediction & social features)
- Track B: Phase 6 (AI news, independent of other phases)
- Track C: Phase 5 (standings/bracket polish, independent)

**Total: ~12-18 sessions**

---

## What This Does NOT Include (Cut List)

| Feature | Why Cut |
|---------|---------|
| Live match chat rooms | Too complex, pool chat is enough |
| Full fantasy football (transfers, budgets) | Different product entirely |
| xG / advanced stats / heatmaps | football-data.org free tier doesn't provide these |
| Player ratings (SofaScore-style) | Proprietary algorithm, not buildable with free data |
| Original journalism / match reports | We aggregate and rewrite, not report |
| Paid premium tier | Don't monetize before product-market fit |
| Native mobile app | Web app with PWA is sufficient |
| AI match predictions / betting tips | Legal risk, not aligned with prediction game |
| Video highlights | Copyright issues, not available via RSS |
| User-generated articles | Moderation burden too high |

---

## Success Metrics (V2 Complete)

- [ ] Quick-predict (1X2) mode works for all league competitions
- [ ] "Predicted" checkmark visible on match cards
- [ ] Matchday/weekly/monthly leaderboard filters work
- [ ] Pool chat functional with realtime updates
- [ ] Pool matchday recaps shareable via WhatsApp
- [ ] Prediction history viewable on profile page
- [ ] 6+ loyalty badges earnable
- [ ] Rivals system functional (add/compare/remove)
- [ ] Standings sortable with "if season ended today" banner
- [ ] Bracket shows user prediction overlay
- [ ] Watch page shows broadcaster lookup by country
- [ ] News feed shows 50+ articles from 15+ sources
- [ ] Arabic news sources (Al Jazeera, Kooora, beIN) active
- [ ] Team pages show auto-curated news
- [ ] Articles have proper source attribution
- [ ] Build passes (`npm run build`) at every phase
