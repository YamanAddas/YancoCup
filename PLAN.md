# YancoCup — Innovation & Fix Plan

The audit-driven plan for making YancoCup feel finished, owned, and unique before the World Cup. Three lanes: Foundation (must not feel broken), Innovation (the differentiators), Decisions (calls to make before coding).

---

## Lane A — Foundation

Things that must work, must feel finished, must stop being silently broken.

**A1. Cut EL, ship 7 competitions.**
Frontend registers `EL`, Worker registers `EC` — every `/api/EL/*` 404s. Drop the 8th competition entirely; don't ship a broken hub.
Files: `src/lib/competitions.ts`, `worker/src/index.ts:113`.

**A2. Worker cron at 60s + visible freshness timestamps.**
Currently `*/5 * * * *`. Switch to `*/1 * * * *` during WC. Add "Updated Xs ago" to live cards. Stop pretending to be live; own the freshness honestly.
Files: `worker/wrangler.toml`, `src/components/match/MatchCard.tsx`.

**A3. Per-match countdown + urgency states.**
The product's defining moment is currently a static date string. Add live countdown on match cards: amber <60min, red <10min, prominent "PREDICT NOW" CTA, locked state after kickoff.
Files: `src/components/match/MatchCard.tsx`, `src/components/predictions/PredictionCard.tsx`.

**A4. Persist confidence stars.**
UI for 🔥/🤔/🎲 is already built — never saved to DB. Add `confidence` column to `yc_predictions`, persist via `upsertPrediction`, read back on render. Cheapest unlock in the codebase.
Files: `src/components/predictions/PredictionCard.tsx:53,366-384`, `src/hooks/usePredictions.ts`.

**A5. WC bracket placeholder resolver.**
`schedule.json` has `homePlaceholder: "L101"` strings with no resolver. When group stage ends June 24, bracket won't auto-populate. Build a resolver from group standings → placeholder slots.
Files: `src/data/schedule.json:804-1209`, `src/pages/BracketPage.tsx`.

**A6. Close translation gaps + finish RTL audit.**
21 keys missing in es/de/fr/pt (predictions.batch*, recap.*, nav.bracket, etc.). 10 files still use LTR-only utilities (text-left/right, ml-/mr-, pl-/pr-). Hardcoded English in TeamPage prediction CTAs and Terms/Privacy bodies.
Files: `src/data/translations/{es,de,fr,pt}.json`, plus RTL fixes in `ActivityFeed`, `MatchDetailPage`, `MatchesPage`, `TeamPage`, `PoolsPage`, `WatchPage`, `CityPopup`, `AppLayout`, `CommentCard`, `ArabesquePatterns`.

**A7. Anonymous predict → save after 3 picks.**
Auth is currently a wall before the product. Let users predict anonymously, then prompt account save once they have 3+ predictions. Defer Google OAuth as polish, not blocker.
Files: `src/lib/auth.tsx`, `src/hooks/usePredictions.ts`.

**A8. Stat leaders: assists, clean sheets, cards.**
football-data.org `/scorers` already returns assists + penalties. UI only renders goals. Add tabbed leaders panel on standings (Goals / Assists / Cards / Clean Sheets).
Files: `src/pages/StandingsPage.tsx:407`, `src/lib/api.ts:117`.

**A9. Fix pool activity feed score leak.**
`PoolActivityFeed` shows raw predicted scores pre-kickoff (line 343-356). Global `ActivityFeed` correctly masks them. Make pool feed match the global anti-copy gate.
Files: `src/pages/PoolsPage.tsx:343-356`, `src/components/activity/ActivityFeed.tsx:100-106`.

**A10. Service worker + contextual push permission.**
No service worker registered → "push notifications" only fire while a tab is open. Build an SW, register on app load, but **don't ask for permission on landing**. Ask after match #1 finishes: "want to know when your next match starts?"
Files: new `public/sw.js`, `src/lib/notifications.ts`.

---

## Lane B — Innovation

Differentiators that survived red-teaming. The reasons users choose YancoCup over FotMob.

**B1. Phase-aware home page (replaces globe).**
Hero auto-shifts based on tournament phase:
- Pre-kickoff: "Build your WC2026 Bracket" full-bracket fill UX
- Group stage (Jun 11–27): live grid of all 12 groups, today's matches, live ticker
- Knockouts (Jun 28–Jul 19): Bracket Cathedral with your picks overlaid, filling in as results land
- Post-final: Recap mode, shareable tournament summary
Kill the globe immediately; ship the scaffold even if late phases stub.
Files: `src/pages/HomePage.tsx`, `src/components/globe/*` (delete), new `src/components/hero/*`.

**B2. Pool Pulse — real-time pool activity stream.**
Supabase Realtime is already wired for chat. Extend it to broadcast pool events: "Ahmad just locked his pick", "Sarah upgraded to 🔥", "Mohammed reacted 🤡". Live pool feed becomes the always-on social texture.
Files: `src/components/pool/PoolChat.tsx`, `src/hooks/usePoolChat.ts`, new `src/hooks/usePoolPulse.ts`.

**B3. Confidence-as-currency.**
Once A4 persists confidence, surface it: visible to pool members on every prediction, factored into a weekly "Most-confident-and-correct" award, shown on shareable cards. Bragging rights texture nobody else has.
Files: `src/components/predictions/PredictionCard.tsx`, `src/pages/PoolsPage.tsx`, `src/lib/scoring.ts`.

**B4. Cinematic points reveal.**
Current reveal is a tiny flip + confetti on exact only. Build the full ceremony: 0→N counter animation, joker 2x stamp, streak bonus flash, exact-score gold rain. Make the payoff match the build-up.
Files: `src/components/predictions/PredictionCard.tsx:423-437`, new reveal sequence.

**B5. Pre-kickoff heatmap unlock.**
`PredictionHeatmap` currently only renders post-FT. Show crowd consensus *before* lock — tension, not post-mortem. The "X% of your pool predicts Brazil to win" moment.
Files: `src/components/predictions/PredictionHeatmap.tsx`, `src/hooks/useConsensus.ts`.

**B6. Wall of Fame / Shame weekly auto-card.**
Every Sunday: auto-generated pool card with best pick (Ahmad nailed an exact 3-0 upset) + worst (Sarah said 🔥 Sure Thing on Spain, lost 0-2). Shareable image. Drives weekly return + WhatsApp shares.
Files: new `src/lib/wallOfFame.ts`, `src/lib/shareCard.ts`, scheduled in `worker/src/index.ts`.

---

## Lane C — Decisions to make first

Choices that block coding. Decide these, then execute.

**C1. EL or EC for the 8th slot?**
My recommendation: **drop entirely**. Ship 7 competitions that work. EL is broken; EC is between cycles (next 2028).

**C2. WC national-squad data — source or skip?**
My recommendation: **skip**. Show "Final squad announced ~late May 2026" placeholder. Manual sourcing or API-Football integration isn't worth the effort 5 weeks out.

**C3. Auth: anonymous-first or sign-up-first?**
My recommendation: **anonymous-first**. Lower friction wins for WC2026 newcomers. Google OAuth + password reset are polish for after launch.

**C4. Globe — kill immediately or stage replacement?**
My recommendation: **kill this weekend**. Replace with phase-aware hero scaffold even if some phases stub initially. A clean stub beats a hated globe.

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
- Streak-at-risk warnings + multi-type streaks
- Real H2H rivals computation
