# YancoCup — red team findings

## Critical fixes (do these before building)

### 1. Verify football-data.org free tier covers World Cup
The free tier lists 12 competitions but World Cup may not be one of them.
TEST NOW: Register at football-data.org, then run:
```bash
curl -H "X-Auth-Token: YOUR_KEY" https://api.football-data.org/v4/competitions/WC
```
If it returns 403 → fallback plan:
- API-Football free tier (100 req/day) WITH aggressive Worker caching
- 100 req/day is fine if Worker caches for 60s during live matches
  (user requests hit KV cache, not upstream API)
- Only ~40 matches/day maximum, most not overlapping

### 2. Remove BALLDONTLIE from fallback list
BALLDONTLIE is an NBA API. It does not cover football/soccer.
Replace with: worldcupapi.com (verify free tier first) or openfootball JSON polling.

### 3. Add Cloudflare Cron Trigger for live score polling
Don't rely on user requests to trigger upstream API calls.
Use a Cron Trigger (free) to poll scores every 60s during match windows.
Write results to KV. All user requests read from KV only.
This prevents rate limit exhaustion during group stage (8+ matches/day).

### 4. Simplify scoring engine
Remove Supabase Edge Function trigger concept.
Replace with: client-side scoring on leaderboard load.
- When user opens leaderboard, check for any finished matches without scored predictions
- Calculate points client-side, write to Supabase via RLS-protected upsert
- Add `scored_at` timestamp + `scored_by` user to prevent duplicate scoring
- First user to load after full-time does the work

### 5. Fix HashRouter + Supabase auth collision
Add to predictions-system SKILL.md:
```
Auth redirect strategy:
1. In index.html, before React mounts, check if URL hash contains 'access_token'
2. If yes: extract tokens, call supabase.auth.setSession(), then strip the hash
3. Then mount React with HashRouter
4. This prevents HashRouter from interpreting auth tokens as routes
```

### 6. Handle unresolved playoff teams in data
Add to Session 4 instructions:
- Check openfootball/worldcup.json for "Path winner" entries
- If playoffs haven't been played yet, show "TBD" in UI with a tooltip
- After playoffs resolve, update the static JSON (one commit)
- football-data.org API will have resolved names once qualifiers finish

## Recommended additions

### 7. Add Lucide React icons to stack
```bash
npm install lucide-react
```
Add to CLAUDE.md stack section. Consistent, open source, dark-theme friendly.

### 8. Premium open-source assets to source
| Asset | Source | License |
|-------|--------|---------|
| Earth night texture | cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg | MIT (bundled with three-globe) |
| Earth bump map | cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png | MIT (bundled with three-globe) |
| Venue photos | Wikimedia Commons (search each stadium) | CC-BY-SA (attribute in footer) |
| Icons | lucide-react | ISC |
| Sound FX (score animation) | freesound.org, search "notification ding" | CC0 |
| Country flags | circle-flags (already in stack) | MIT |

DO NOT include: team crests/badges (copyrighted by FIFA/federations), player photos (rights issues), any FIFA branding/logos.

### 9. Add .gitignore to kit
```
node_modules/
dist/
.env
.env.local
.env.*.local
*.log
.DS_Store
```

### 10. Broadcaster data strategy
Don't build a comprehensive global broadcaster database.
Curate for ~15 countries your friends are in:
US, UK, Canada, Mexico, Germany, France, Spain, Saudi Arabia, Jordan, UAE, Brazil, Australia, Japan, South Korea, Turkey.
Wikipedia "2026 FIFA World Cup broadcasting rights" has the full list.
Store in src/data/broadcasters.json.

## Things that are fine (no changes needed)

- r3f-globe choice ✓
- circle-flags ✓ 
- openfootball as static data source ✓
- Cloudflare Workers as proxy ✓
- Supabase for predictions ✓
- YancoVerse design system ✓
- Session-by-session build plan structure ✓
- CLAUDE.md line count and instruction density ✓
- "What Claude gets wrong" section ✓
- Cutting news feed for activity feed ✓
- 6 languages instead of 9 ✓
- Broadcast as modal instead of full page ✓
