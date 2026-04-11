# YancoCup — build plan (v6)

> Multi-competition soccer prediction platform. Live and in public testing.
> Phases 0-9 (Sessions 1-33) are COMPLETE. V2 Upgrade is COMPLETE.
> **This plan covers Phase 10: Live product iteration.**
> **World Cup 2026 kicks off June 11, 2026.**

---

## Free stack

| Need | Solution | Cost |
|------|----------|------|
| Hosting | GitHub Pages | $0 |
| API proxy | Cloudflare Workers (100K req/day free) + Cron Triggers | $0 |
| Database + Auth + Realtime | Supabase free (unlimited realtime, 500MB DB) | $0 |
| Live scores | football-data.org (10 req/min, all major competitions) | $0 |
| Live scores fallback | API-Football (100 req/day + Cron Trigger + KV cache) | $0 |
| Globe visualization | r3f-globe by Vasturiano (open source) | $0 |
| Country flags | circle-flags (400+ circular SVGs, open source) | $0 |
| Icons | Lucide React (open source) | $0 |
| Error monitoring | Sentry free (5K errors/month) | $0 |
| Analytics | Cloudflare Web Analytics (unlimited, no cookies) | $0 |
| Fonts | Google Fonts (Space Grotesk, Inter, JetBrains Mono) | $0 |
| AI News | Cloudflare Workers AI (10K neurons/day free) | $0 |

---

## Completed work

| Phase | Sessions | Status |
|-------|----------|--------|
| Phase 0: Scaffold + Globe | 1-2 | DONE |
| Phase 1: Static Data + Pages | 3-5 | DONE |
| Phase 2: Predictions Game | 6-10 | DONE |
| Phase 3: Live Data Layer | 11-13 | DONE |
| Phase 4: Polish + i18n | 14-17 | DONE |
| Phase 5: Database + Hook Migration | 18-19 | DONE |
| Phase 6: Worker Multi-Competition | 20-21 | DONE |
| Phase 7: Frontend Multi-Competition | 22-26 | DONE |
| Phase 8: Pools | 27-29 | DONE |
| Phase 9: Gamification | 30-33 | DONE |
| V2 Upgrade (Tracks A-F) | 34-66 | DONE |

Live at: https://yamanaddas.github.io/YancoCup/
Worker at: https://yancocup-api.catbyte1985.workers.dev/

---

## Phase 10: Live product iteration

App is live and in public testing. Priority order is: stability and security first, then performance, then design elevation, then features.

Each session is one task. Commit after each. Do not combine sessions.

---

### Track A: Security (highest priority — before WC)

#### Session 34: Supabase RLS audit and documentation
**Goal:** Know exactly what RLS policies exist and verify they're correct.
- Open Supabase dashboard → every table → document all RLS policies
- Create `docs/RLS_POLICIES.md` with policy definitions and rationale
- Test with a secondary test account: verify predictions hidden before kickoff, pool isolation, message isolation
- Document any gaps found and fix them in the same session

#### Session 35: Input sanitization audit
**Goal:** Ensure all user text inputs are sanitized before reaching Supabase.
- Audit: pool names, display names, pool chat messages, any other user-controlled text
- Add server-side length limits and HTML stripping where missing
- Test with adversarial inputs (HTML tags, script injection attempts)

---

### Track B: Performance (critical — GlobeScene is 2MB)

#### Session 36: GlobeScene bundle analysis
**Goal:** Understand what's driving the 2MB and establish a fix plan.
- Run `npx vite-bundle-visualizer` — capture the output
- Identify the top contributors to the GlobeScene chunk (Three.js? earth textures? r3f-globe internals?)
- Document findings. Do not fix yet — just understand.
- Propose 2-3 fix options with estimated impact. Get approval before proceeding.

#### Session 37: GlobeScene bundle reduction
**Goal:** Reduce GlobeScene from 2MB to a target determined after Session 36.
- Implement the approved fix from Session 36
- Verify with `npm run build` — measure new bundle size
- Test globe on mobile (physical device or accurate emulation)
- Do not ship if globe breaks

#### Session 38: Globe IntersectionObserver
**Goal:** Stop globe from consuming GPU when it's scrolled off-screen.
- Add IntersectionObserver in GlobeView.tsx
- When globe is not in viewport: pause the R3F canvas (set `frameloop="never"` or unmount)
- When globe returns to viewport: resume
- Test on mobile — confirm no flicker or crash on scroll

---

### Track C: Worker reliability

#### Session 39: Cron early-exit for no-live-activity
**Goal:** Stop paying API budget when no matches are happening.
- Add early-exit at top of `handleCron()`: if `all:live` is empty AND tick % 5 !== 0, skip upstream call
- Keep the 5th-tick schedule pre-population logic running regardless
- Verify: cron still wakes correctly when a match starts
- Test with mock KV state

#### Session 40: League schedule cache miss protection
**Goal:** Prevent concurrent user requests from triggering parallel upstream calls on cold cache.
- Add KV-based lock: `{comp}:schedule:fetching = "1"` (30s TTL) before upstream call
- If lock is set on incoming request: return `{ matches: [], message: "Loading..." }`
- Remove lock after successful write to KV
- Verify WC still returns `[]` on miss (unchanged)

---

### Track D: Design elevation (design spec required before each session)

Before any design session: write a full design spec following the pre-implementation protocol in CLAUDE.md. Get approval on the spec before implementing.

#### Session 41: Design audit — current state report
**Goal:** Know exactly what to fix before fixing anything.
- Read SKILL.md fully
- Review every major page: Home, Matches, Predictions, Leaderboard, Pools, Profile, Match Detail
- Rate each component 1-5 on YancoVerse design fidelity
- List specific components that are generic, inconsistent, or below quality bar
- Produce a prioritized design debt list. No code changes in this session.

#### Session 42: Match card redesign
**Goal:** Match cards are the most-seen component. Elevate them first.
- Design spec first (Step 3 of protocol)
- Implement to spec
- All five states: default, live, finished, postponed, empty
- Test on mobile

#### Session 43: Home page redesign
**Goal:** First impression. Must make someone go "whoa" immediately.
- Globe positioning and sizing
- Competition cards
- My predictions today widget
- Countdown to WC

#### Session 44: Leaderboard redesign
**Goal:** The social core of the app — should feel competitive and alive.
- Podium
- User rows (rank movement, streaks, accuracy)
- Empty state (no predictions yet)

#### Session 45: Profile page redesign
**Goal:** Makes users feel proud to share.
- Stats layout
- Badge display
- Rivals section
- Shareable card preview

#### Session 46: Custom thematic SVG icons
**Goal:** Replace any remaining generic Lucide icons used for sport/thematic purposes.
- Audit all icon usage across the app
- Identify icons that should be custom (trophies, balls, shields, competition badges)
- Design and implement custom inline SVG components

---

### Track E: Codebase health

#### Session 47: Worker god file — extract news pipeline
**Goal:** Reduce worker/src/index.ts from 2,874 lines.
- Extract the full news pipeline (RSS fetching, AI rewrite, translation, Supabase storage) to `worker/src/news.ts`
- Update imports in index.ts
- Run worker tests — verify nothing breaks
- Do not touch scores or routes logic in this session

#### Session 48: React Router version resolution
**Goal:** Resolve the v7/v6 mismatch before it causes a breaking change.
- Option A: Pin `react-router-dom` to `^6.28.0` in package.json
- Option B: Lock v7 to a known-good minor via overrides
- Make the decision, implement, verify app still works end-to-end

---

### Track F: WC-specific preparation (before June 11)

#### Session 49: Cron switch to every-minute for WC
**Goal:** Switch cron from `*/5 * * * *` to `* * * * *` in wrangler.toml for WC match windows.
- Update wrangler.toml
- Verify KV write budget has headroom for 1,440 writes/day during WC
- Plan to switch back after July 19

#### Session 50: Pre-launch verification run
**Goal:** Walk through every user flow before WC kickoff.
- Predict a match end-to-end
- Verify scoring runs after match completes
- Verify leaderboard updates
- Verify pool creation + join + pool leaderboard
- Verify all 6 language switches work
- Test on iOS Safari and Android Chrome (physical devices preferred)
- Verify football-data.org returns WC data: `curl -H "X-Auth-Token: YOUR_KEY" https://api.football-data.org/v4/competitions/WC`
- Run `npm run test` — all tests green
- Run `npm run build` — zero errors

---

### Track G: Data pipeline reliability (V4 findings — before WC)

These fix the "data is broken/stale/missing" issues found in the V4 deep dive audit. Ordered by user-facing impact.

#### Session 51: Worker — retry logic + timeout hardening
**Goal:** Stop losing entire ticks on transient API failures.
**Findings addressed:** #27 (no retry), #28 (no API-Football timeout), #38 (silent errors)
- Add retry wrapper: 2 retries with 1s/3s backoff for `fetchFromFootballData()`
- Add `AbortSignal.timeout(8000)` to `fetchFromApiFootball()`
- Add `cron:error:count` KV key, expose in `/api/health`
- Write worker test for retry behavior

#### Session 52: Worker — fix API-Football fixture matching
**Goal:** Lineups and stats actually appear for top clubs.
**Findings addressed:** #29 (broken matching), #30 (concurrent cache miss)
- Replace TLA name-substring matching with a static TLA→API-Football team ID map
- Deduplicate date fetches: collect all dates first, fetch each once, then match
- Test with known problem TLAs: MCI, MUN, RMA, FCB, PSG

#### Session 53: Worker — KV write optimization
**Goal:** Stay within free-tier KV write budget (or upgrade).
**Findings addressed:** #31 (KV writes exceed limit), #32 (match TTL always 24h), #33 (all:live TTL)
- Option A: Upgrade to Workers Paid ($5/month) — eliminates all KV write concerns
- Option B (if staying free): Remove per-match KV writes (use per-competition scores array only). Batch writes. Status-dependent TTL.
- Increase `all:live` TTL from 600s to 1200s
- Add KV write failure counter to health endpoint

#### Session 54: Worker — news pipeline fixes
**Goal:** News articles flow faster and don't get permanently stuck.
**Findings addressed:** #34 (scrape counter), #35 (slow summarize), #36 (dedup threshold)
- Reset `scrape_failures: 0` on successful scrape
- Increase summarize limit from 2 to 5 articles per cycle
- Raise Jaccard dedup threshold from 0.65 to 0.80

#### Session 55: Worker — admin auth hardening
**Goal:** Remove hardcoded backdoor, use proper admin secret.
**Finding addressed:** #37 (admin auth)
- Add `ADMIN_KEY` via `wrangler secret put`
- Remove `"yanco2026trigger"` hardcoded string
- Update admin endpoint auth check

#### Session 56: Frontend — error states and stale indicators
**Goal:** Users know when data is stale or unavailable.
**Findings addressed:** #39 (useScores no error), #44 (api.ts null for all errors)
- Update `apiFetch` to return `{ data, error }` instead of bare `null`
- Add error state to `useScores` — show "Scores temporarily unavailable" banner
- Add `lastUpdated` timestamp to score display

#### Session 57: Frontend — hook race conditions
**Goal:** Fix auto-scoring and comments edge cases.
**Findings addressed:** #40 (useAutoScore race), #42 (unbounded replies)
- Move useAutoScore throttle to module-level variable (shared across instances)
- Add reply pagination (limit 10 per top-level comment)

---

## Open red team findings (from REDTEAM_FINDINGS.md v4)

### V3 findings (still open)

| Finding | Severity | Session |
|---------|----------|---------|
| #21 GlobeScene 2MB bundle | High | 36-37 |
| #22 No concurrent cache miss protection | Medium | 40 |
| #24 Twitter card `summary` not `summary_large_image` | Low | Quick fix anytime |
| #25 Worker god file (2,874 lines) | Medium | 47 |
| #26 No cron early-exit when no live matches | Low | 39 |
| #12 Cron no early-exit (partial) | Low | 39 |
| #14 League cache miss hits upstream (partial) | Medium | 40 |
| #16 React Router v7/v6 mismatch | Low | 48 |
| #18 CL bracket format | Medium | Before CL knockouts |
| #20 Arabic RSS unverified | Medium | Manual curl test |

### V4 findings (data pipeline deep dive)

| Finding | Severity | Session |
|---------|----------|---------|
| #27 No retry on football-data.org failure | **Critical** | 51 |
| #28 No timeout on API-Football fetch | **High** | 51 |
| #29 Fixture matching broken for top clubs | **High** | 52 |
| #30 Concurrent API-Football cache miss | Medium | 52 |
| #31 KV writes exceed free-tier limit | **High** | 53 |
| #32 Match detail TTL always 24h | Medium | 53 |
| #33 `all:live` TTL barely above cron | Low | 53 |
| #34 Scrape failure counter never resets | Medium | 54 |
| #35 News summarize too slow (2/cycle) | Medium | 54 |
| #36 Title dedup threshold too lenient | Low | 54 |
| #37 Admin auth uses API key + backdoor | Medium | 55 |
| #38 Silent cron errors, no alerting | Medium | 51 |
| #39 useScores has no error state | Medium | 56 |
| #40 useAutoScore race on navigation | Medium | 57 |
| #41 AbortController self-abort | Low | Low priority |
| #42 Unbounded reply fetch in comments | Medium | 57 |
| #43 Pool chat profile cache unbounded | Low | Low priority |
| #44 api.ts returns null for all errors | Medium | 56 |

---

## Scoring system

**Base scoring** (all competitions):
| Outcome | Points |
|---------|--------|
| Exact score | 10 |
| Correct goal difference | 5 |
| Correct winner/draw | 3 |
| Wrong | 0 |

**Quick-predict (1X2, leagues only):**
| Outcome | Points |
|---------|--------|
| Correct result | 2 |
| Wrong | 0 |

**Modifiers:**
| Feature | Effect | Scope |
|---------|--------|-------|
| Upset bonus | +3 | Tournaments only |
| Perfect group stage | +15 | Tournaments with groups |
| Knockout multiplier | 1.5x-3x by round | Tournaments only |
| Joker pick | 2x on chosen match | All competitions |
| Streak bonus | +2/+5/+10 at milestones | All competitions |

---

## What NOT to build

| Feature | Why cut |
|---------|---------|
| Full fantasy football | Different product |
| Live chat per match | Activity feed + pool chat is enough |
| Paid premium tier | Premature |
| Player predictions (goalscorer) | Not core |
| Custom competition creation | Admin adds competitions |
| Native mobile app | PWA is sufficient |
| xG / heatmaps / player ratings | Not on free tier |
| Original journalism | Summarize and link only |
| Video highlights | Copyright issues |
| Light mode | Always dark |
| Worker features without extracting modules first | God file is already 2,874 lines |
