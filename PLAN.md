# YancoCup — Innovation & Fix Plan

The audit-driven plan for making YancoCup feel finished, owned, and unique before the World Cup. Three lanes: Foundation (must not feel broken), Innovation (the differentiators), Decisions (calls to make before coding).

> **Status (2026-05-04, post-audit):** 13/20 items fully shipped, 2 mostly shipped, 5 partial. **Done:** A1, A3, A4, A5, A6, A7, A9, A10, B5, C1, C2, C3, C4. **Mostly done:** B1 (group-stage shipped, knockouts/post-final still scaffold), B6 (shareable image shipped, worker schedule still missing). **Partial:** A2, A8, B2, B3, B4.

---

## Lane A — Foundation

Things that must work, must feel finished, must stop being silently broken.

**A1. Cut EL, ship 7 competitions.** ✅ `1de9436` + `af54e08`
Frontend registers `EL`, Worker registers `EC` — every `/api/EL/*` 404s. Drop the 8th competition entirely; don't ship a broken hub.
**Reality:** Both frontend and worker now register exactly 7 competitions: WC, CL, PL, PD, BL1, SA, FL1. EC removed from worker `COMPETITIONS`, `STANDINGS_COMPS`, `AF_LEAGUE_IDS`, season-year calc, and the transformMatch test. Worker redeploy pending for production effect.
Files: `src/lib/competitions.ts`, `worker/src/index.ts`, `worker/src/transformMatch.test.ts`.

**A2. Worker cron at 60s + visible freshness timestamps.** ⚠️ PARTIAL `3d4103e`
Currently `*/5 * * * *`. Switch to `*/1 * * * *` during WC. Add "Updated Xs ago" to live cards. Stop pretending to be live; own the freshness honestly.
**Reality:** ✅ `StaleBadge` self-ticks "↻ Xs ago" on live cards ([MatchCard.tsx:142-172](src/components/match/MatchCard.tsx:142)). ❌ Cron still `*/5 * * * *` ([wrangler.toml:23](worker/wrangler.toml:23)). The switch is **documented** in a comment as a manual June 10 task, not executed. Half-shipped — flag for the WC switch checklist.
Files: `worker/wrangler.toml`, `src/components/match/MatchCard.tsx`.

**A3. Per-match countdown + urgency states.** ✅ `f5db78e`
The product's defining moment is currently a static date string. Add live countdown on match cards: amber <60min, red <10min, prominent "PREDICT NOW" CTA, locked state after kickoff.
**Reality:** `useCountdown` adaptive ticking (1s under 10min, 30s under 2h), `getUrgencyTier` thresholds match plan exactly, "PREDICT NOW" CTA appears at urgent tier, locked state via `<Lock>` icon and `canPredict` gate.
Files: `src/components/match/MatchCard.tsx`, `src/components/predictions/PredictionCard.tsx`.

**A4. Persist confidence stars.** ✅ `6bd5335` + `33d83cf`
UI for 🔥/🤔/🎲 is already built — never saved to DB. Add `confidence` column to `yc_predictions`, persist via `upsertPrediction`, read back on render.
**Reality:** `confidence` column exists, persisted via upsert, read on render at PredictionCard line 63, surfaced to pool members in PoolsPage activity feed and WallOfFame.
Files: `src/components/predictions/PredictionCard.tsx:53,366-384`, `src/hooks/usePredictions.ts`.

**A5. WC bracket placeholder resolver.** ✅ `538f4b3`
`schedule.json` has `homePlaceholder: "L101"` strings with no resolver. When group stage ends June 24, bracket won't auto-populate. Build a resolver from group standings → placeholder slots.
**Reality:** `bracketResolver.ts` (`computeGroupStandings`, `computeKnockoutResults`, `resolveBracketPlaceholder`) wired into `BracketPage` via `BracketNode` (uses `resolvedHomeTla`/`resolvedAwayTla` fallback). Tested in `bracketResolver.test.ts`.
Files: `src/data/schedule.json:804-1209`, `src/pages/BracketPage.tsx`.

**A6. Close translation gaps + finish RTL audit.** ✅ `34d8454`
21 keys missing in es/de/fr/pt. 10 files still use LTR-only utilities.
**Reality:** All 6 languages have **567 keys exactly** — no gaps. No LTR-only Tailwind utilities (`text-left/right`, `ml-/mr-`, `pl-/pr-`) found in components or pages.
Files: `src/data/translations/{es,de,fr,pt}.json`, plus RTL fixes across 10 components.

**A7. Anonymous predict → save after 3 picks.** ✅ `30cb95f`
Auth is currently a wall before the product. Let users predict anonymously, then prompt account save once they have 3+ predictions.
**Reality:** `anonPredictions.ts` lib (localStorage-backed), `AnonSaveBanner` component gates on `count < 3` ([PredictionsPage.tsx:36](src/pages/PredictionsPage.tsx:36)), `migrateAnonPredictions` runs on sign-in ([auth.tsx:16-39](src/lib/auth.tsx:16)).
Files: `src/lib/auth.tsx`, `src/hooks/usePredictions.ts`, `src/lib/anonPredictions.ts`.

**A8. Stat leaders: assists, clean sheets, cards.** ⚠️ PARTIAL `30489a3`
football-data.org `/scorers` already returns assists + penalties. UI only renders goals. Add tabbed leaders panel on standings (Goals / Assists / Cards / Clean Sheets).
**Reality:** Tabs are **Goals / Assists / Penalties** ([StandingsPage.tsx:420](src/pages/StandingsPage.tsx:420)) — not Goals/Assists/Cards/Clean Sheets as planned. football-data.org `/scorers` doesn't return cards or clean sheets directly; would need different endpoints. Penalties was a substitute.
Files: `src/pages/StandingsPage.tsx:407`, `src/lib/api.ts:117`.

**A9. Fix pool activity feed score leak.** ✅ `9b9b8e8`
**Reality:** Scores masked with `?-?` until `matchStarted` ([PoolsPage.tsx:422-426](src/pages/PoolsPage.tsx:422)) using `canPredict` gate. Matches the global ActivityFeed behavior.
Files: `src/pages/PoolsPage.tsx:343-356`, `src/components/activity/ActivityFeed.tsx:100-106`.

**A10. Service worker + contextual push permission.** ✅ `d8de778` + `96e8fc2` + `08dbf9d`
**Reality:** `public/sw.js` registered via `main.tsx:35-41`. `PushPromptBanner` ([components/notifications/PushPromptBanner.tsx](src/components/notifications/PushPromptBanner.tsx)) only shows when user has at least one **scored** prediction (after living through a match cycle). Persists dismissal via `yc_push_asked` localStorage. Never asks on landing.
Files: `public/sw.js`, `src/lib/notifications.ts`, `src/components/notifications/PushPromptBanner.tsx`.

---

## Lane B — Innovation

Differentiators that survived red-teaming. The reasons users choose YancoCup over FotMob.

**B1. Phase-aware home page (replaces globe).** ⚠️ MOSTLY DONE `1de9436` + `cb97dd4`
Hero auto-shifts based on tournament phase: pre-kickoff bracket, group-stage live grid, knockouts cathedral, post-final recap.
**Reality:** Globe deleted ✓. Pre-kickoff phase ✓. **Group-stage phase shipped** — live ticker (only when matches IN_PLAY/PAUSED), today's matches as MatchCards, all 12 groups in a responsive grid ranked by `computeGroupStandings`. Knockouts and post-final still scaffold to pre-kickoff. `?phase=group-stage|knockouts|post-final|pre-kickoff` query override added for visual testing pre-launch.
Files: `src/pages/HomePage.tsx`, `src/components/hero/PhaseHero.tsx`, `src/components/hero/GroupStagePhase.tsx`, `src/components/hero/CompactGroupCard.tsx`.

**B2. Pool Pulse — real-time pool activity stream.** ⚠️ PARTIAL `9ad737b`
Broadcast pool events: "Ahmad just locked his pick", "Sarah upgraded to 🔥", "Mohammed reacted 🤡".
**Reality:** Realtime subscription to `yc_predictions` via `pool_pulse_${competitionId}` channel ✓. New picks pulse green for 2.5s ✓. **Missing:** rich event-type messages (no "upgraded to 🔥" / "reacted 🤡" texture), reactions are not broadcast, logic is inlined into PoolsPage instead of a `usePoolPulse.ts` hook. The "always-on social texture" the plan promised is much thinner than spec.
Files: `src/pages/PoolsPage.tsx:355-391` (inlined).

**B3. Confidence-as-currency.** ⚠️ PARTIAL `33d83cf`
Surface confidence to pool members, factor into a weekly "Most-confident-and-correct" award.
**Reality:** Confidence visible to pool members in activity feed and WallOfFame ✓. **NOT factored into scoring** — `scoring.ts` has zero confidence references. **The "Most-confident-and-correct weekly award" doesn't exist.** WallOfFame uses confidence only as a tiebreaker for best pick, which is one form of "factoring in" but not the dedicated award.
Files: `src/components/predictions/PredictionCard.tsx`, `src/pages/PoolsPage.tsx`, `src/lib/scoring.ts` (untouched — gap).

**B4. Cinematic points reveal.** ⚠️ PARTIAL `a9800c1`
0→N counter, joker 2x stamp, streak bonus flash, exact-score gold rain.
**Reality:** ✅ 0→N counter (800ms ease-out cubic, [PredictionCard.tsx:91-104](src/components/predictions/PredictionCard.tsx:91)). ✅ Joker 2x stamp (line 460-463). ✅ Exact-score gold rain (twin bursts in gold + green for points ≥10, line 114-118). ❌ **Streak bonus flash fully missing.** No streak system exists in `scoring.ts` at all — only base points + knockout multiplier + joker + upset bonus + perfect-group bonus. Plan promised "+5 STREAK BONUS animates in" — there's no streak system to flash from.
Files: `src/components/predictions/PredictionCard.tsx:423-437`, `src/lib/scoring.ts` (no streak modifier).

**B5. Pre-kickoff heatmap unlock.** ✅ `0355f65`
**Reality:** `useConsensus` no longer gates on `locked` — only `hasPrediction` ([useConsensus.ts:30](src/hooks/useConsensus.ts:30)). `PredictionHeatmap` rendered pre-kickoff at [PredictionCard.tsx:500-509](src/components/predictions/PredictionCard.tsx:500). Anti-copy preserved (must predict first to see). Quick-pick predictions don't get the heatmap (only score-based) — small spec deviation.
Files: `src/components/predictions/PredictionHeatmap.tsx`, `src/hooks/useConsensus.ts`.

**B6. Wall of Fame / Shame weekly auto-card.** ⚠️ MOSTLY DONE `477a929` + `18bd537`
Every Sunday: auto-generated pool card with best/worst pick. Shareable image. Drives weekly return + WhatsApp shares.
**Reality:** [WallOfFame.tsx](src/components/pool/WallOfFame.tsx) renders best/worst ✓. **Shareable image shipped** — `src/lib/wallOfFameCard.ts::generateWallOfFameCard` produces a 1200×630 PNG with side-by-side fame/shame panels reusing the share-card primitives exported from `shareCard.ts`. Share button on the wall calls `navigator.share` or falls back to PNG download. **Still missing:** worker-side Sunday auto-fire — currently the wall renders on demand; no automatic post/notification on Sundays. Not a launch-blocker; the share loop now works manually.
Files: `src/components/pool/WallOfFame.tsx`, `src/lib/wallOfFameCard.ts`, `src/lib/shareCard.ts` (helpers exported), `worker/src/index.ts` (no schedule).

---

## Lane C — Decisions

**C1. EL or EC for the 8th slot?** ✅ Dropped entirely. Both frontend and worker register 7 competitions. Worker redeploy pending for production.
**C2. WC national-squad data — source or skip?** ✅ Skipped. No squad pages implemented.
**C3. Auth: anonymous-first or sign-up-first?** ✅ Anonymous-first. See A7.
**C4. Globe — kill immediately or stage replacement?** ✅ Killed. `src/components/globe/` directory deleted.

---

## What's actually left for WC2026 launch (June 11)

Ranked by criticality:

1. ~~**B1 group-stage phase**~~ ✅ shipped `cb97dd4`
2. **A2 cron switch** — Has to flip to `*/1 * * * *` on/around June 10 alongside the threshold edits documented in `wrangler.toml`. Not code work, but checklist work. **Worker redeploy needed (also covers A1/C1 EC removal landed in `af54e08`).**
3. ~~**A1 / C1 worker EC cleanup**~~ ✅ shipped `af54e08`
4. ~~**B6 shareable image**~~ ✅ shipped `18bd537`
5. **B1 knockouts phase** — Activates June 28. Currently falls through to pre-kickoff hero. Bracket Cathedral with picks overlay. Less urgent than group-stage (17 days of runway after launch) but still launch-window work.
6. **B4 streak system** — Affects scoring + reveal + gamification. Needs a design call: how does a streak break/extend? What's the bonus? Adds depth but not a launch-blocker.
7. **B3 confidence-in-scoring** — "Most-confident-and-correct" weekly award is a meaningful innovation but optional for launch.
8. **B2 rich event broadcasts** — "Sarah upgraded to 🔥" texture. Polish.
9. **B1 post-final phase** — Activates July 19. Recap mode. Lowest urgency in B1.
10. **A8 Cards / Clean Sheets tabs** — would need new data sources. Lowest priority.
11. **B6 worker schedule** — Sunday auto-fire to push the wall card. Pure polish; the share loop already works on demand.

---

## Out of scope (post-launch polish)

Explicitly deprioritized — do NOT get sucked in:

- Honours/trophy history JSON (table-stakes, not innovation)
- Manager pages, stadium details, derby highlighting (decoration)
- Player profile pages (no data source)
- H2H history page (endpoint exists but cosmetic)
- Pre-match preview articles
- Worker-side Sentry
- Per-route SEO meta tags
- Avatar upload, display name editing
- EC 2024 archive
- Promoted/relegated indicators
- Real H2H rivals computation
