# YancoCup — build plan (v5)

> Multi-competition soccer prediction platform.
> Phases 0-9 (Sessions 1-33) are COMPLETE. This plan covers V2 Upgrade.
> **World Cup 2026 kicks off June 11, 2026. All work is prioritized against this deadline.**

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
| Static WC data | `src/data/` JSON files (football-data.org match IDs) | $0 |
| Globe visualization | r3f-globe by Vasturiano (open source) | $0 |
| Country flags | circle-flags (400+ circular SVGs, open source) | $0 |
| Icons | Lucide React (open source, dark-theme friendly) | $0 |
| Error monitoring | Sentry free (5K errors/month) | $0 |
| Analytics | Cloudflare Web Analytics (unlimited, no cookies) | $0 |
| Fonts | Google Fonts (Space Grotesk, Inter, JetBrains Mono) | $0 |
| AI News (V2) | Cloudflare Workers AI (10K neurons/day free) | $0 |

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

Live at: https://yamanaddas.github.io/YancoCup/
Worker at: https://yancocup-api.catbyte1985.workers.dev/
Sentry + Cloudflare Analytics active.
All 48 World Cup teams finalized (qualifying completed March 31, 2026).

---

## V2 Upgrade — Priority order for World Cup launch

The V2 upgrade is documented in full in `docs/V2_UPGRADE_PLAN.md`. Below is the **execution priority** reordered for the June 11 deadline.

### MUST SHIP (before June 11)

These directly impact the core prediction loop that friends will use during the World Cup.

**Track A: Prediction UX (Phase 1 + Phase 2 from V2 plan)** — ALL DONE
1. ~~"Predicted" indicator (checkmark) on match cards~~ DONE
2. ~~"My Predictions Today" widget on home page~~ DONE
3. ~~Timezone display on match times~~ DONE
4. ~~Your prediction banner on match detail page~~ DONE
5. ~~Quick-predict mode (1X2) for leagues~~ DONE
6. ~~Post-match points reveal animation~~ DONE

**Track B: Social & Pools (Phase 3 from V2 plan)** — ALL DONE
7. ~~Pool chat (Supabase Realtime)~~ DONE
8. ~~Pool matchday recap (auto-generated, shareable)~~ DONE
9. ~~Social share buttons (WhatsApp, Telegram, Twitter)~~ DONE
10. ~~Pool admin controls (rename, remove members)~~ DONE

**Track C: Leaderboard polish (Phase 3 from V2 plan)** — ALL DONE
11. ~~Matchday / weekly / monthly sub-leaderboards~~ DONE
12. ~~Rank movement arrows~~ DONE
13. ~~Pool leaderboard filter~~ DONE

**Track D: Critical fixes** — ALL DONE
14. ~~Add React error boundary around globe component~~ DONE
15. ~~Fix `/api/:comp/matches` cache-miss → upstream call (should read KV only)~~ DONE
16. ~~Verify cron schedule is appropriate for current match windows~~ DONE (*/5 pre-tournament)
17. ~~Verify broadcaster data covers at least 15 countries~~ DONE (18 countries)

### SHOULD SHIP (before or during group stage)

These enhance the experience but won't break anything if delayed.

18. ~~Personalized greeting with rank~~ DONE
19. ~~Prediction streak counter~~ DONE
20. ~~"Bold Prediction" tag for upset picks~~ DONE
21. ~~"Copy last matchday" button for leagues~~ DONE
22. ~~Activity feed reactions (🔥 😂 🤡)~~ DONE
23. ~~Post-match result display in activity feed~~ DONE
24. Standings: sortable columns + "if season ended today" banner
25. User predictions overlay on bracket
26. Watch page: broadcaster lookup by country

### NICE TO HAVE (post-launch or during tournament)

These can ship incrementally during the World Cup without disrupting users.

27. Prediction history on profile page
28. Accuracy breakdown visualization
29. Competition-specific stats on profile
30. Loyalty badges (Opening Day, All-In, Marathon, Night Owl, Globe Trotter, Social Butterfly)
31. Rivals system (pick 1-3 rivals, side-by-side comparison)
32. Shareable profile card
33. Points-to-safety / points-to-title calculator
34. "Path to the final" bracket highlight

### DEFER TO POST-WC (Phase 6: AI News)

AI-powered news is the most complex feature and has the least impact on the core prediction game. Ship after the WC launch is stable.

35-40. Full AI news pipeline (RSS → Workers AI → Supabase → frontend)

---

## Pre-launch checklist

Before June 11, 2026:

- [ ] Static data verified: all 48 teams, 12 groups, 104 matches with correct dates/times/venues
- [ ] football-data.org API returns WC data (test: `GET /v4/competitions/WC`)
- [ ] Worker cron populates WC match data in KV
- [ ] Prediction flow: can predict, score shows after match finishes
- [ ] Leaderboard: shows correct rankings per competition
- [ ] Pools: create, join via code, pool leaderboard works
- [ ] Globe: renders without crash, error boundary catches WebGL failures
- [ ] Mobile: all pages usable on phone (test iOS Safari + Android Chrome)
- [ ] Broadcaster data: covers US, UK, Canada, Mexico, Germany, France, Spain, Saudi Arabia, Jordan, UAE, Brazil, Australia, Japan, South Korea, Turkey
- [ ] Build passes: `npm run build` succeeds with zero errors
- [ ] Deploy: production build live on GitHub Pages
- [ ] Supabase RLS: predictions hidden until match kickoff
- [ ] Auth: sign-in/sign-up works, HashRouter doesn't break auth redirect
- [ ] i18n: all 6 languages load without errors
- [ ] Sentry: error monitoring active and receiving events

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
| CL | Worker API | League phase (Swiss model since 2024/25), knockout TBD |
| PL, PD, BL1, SA, FL1 | Worker API | 300-380 matches, rescheduled frequently |

### Database size (500MB Supabase free tier)

~2,000 matches/season across all competitions. Even with 1,000 users predicting everything: ~300MB. Realistic usage (users predict 1-2 competitions): well under 500MB.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| 10 req/min rate limit | `/v4/matches` (all comps, 1 call) + KV caching. Users never hit upstream. |
| football-data.org doesn't cover WC 2026 | Free tier explicitly lists "Worldcup" as covered. Test API call before launch. |
| Prediction fatigue (380 league matches) | Matchday UI + quick-predict + auto-fill + joker. |
| Supabase 500MB limit | Realistic usage well under limit. Monitor with dashboard. |
| Bundle size growth | Lazy-load competition pages. Only registry (~1KB) in main bundle. |
| Breaking existing URLs | `/matches` redirects to `/WC/matches`. |
| Client-side scoring race conditions | Acceptable for V1 friend-group scale. Migrate to Supabase RPC post-launch. |
| WebGL crash on bad GPU | DONE — React error boundary in `GlobeView.tsx` with fallback UI. |
| AI news legal risk | Summarize (3-5 sentences), always link to source, never reproduce full articles. Defer to post-launch. |
| Cron burning free tier during off-peak | Short-circuit when no live matches; consider `*/5` schedule outside match windows. |
| Workers AI neuron budget | 10K neurons/day ≈ 15 articles per cron run × 6 runs/day = ~90 max. Test actual consumption. |
| Arabic RSS feeds broken/missing | Verify each RSS URL resolves before building pipeline. Expect 3-4 to be non-functional. |

---

## What NOT to build

| Feature | Why cut |
|---------|---------|
| Full fantasy football | Different product entirely |
| Live chat per match | Activity feed + pool chat is enough |
| Paid premium tier | Premature. Keep free until product-market fit. |
| Player predictions (goalscorer) | Not core. Maybe post-WC. |
| Custom competition creation | Admin adds competitions. Not self-serve. |
| Native mobile app | Web app with PWA is sufficient |
| NFT/card trading (Sorare model) | Not aligned with friend-group prediction focus |
| xG / heatmaps / player ratings | football-data.org free tier doesn't provide these |
| Original journalism | We aggregate and summarize, not report |
| Video highlights | Copyright issues, not available via RSS |
| Light mode | This site is always dark. No light mode. |

---

## Copyright / licensing notes

DO NOT include in the project:
- Team crests/badges (copyrighted by FIFA/federations) — use football-data.org API crest URLs (hotlink only)
- Player photos (rights issues)
- Any FIFA branding/logos

Safe to use:
- Earth textures from three-globe CDN (MIT license)
- Venue photos from Wikimedia Commons (CC-BY-SA, attribute in footer)
- circle-flags (MIT)
- Lucide icons (ISC)
- Sound FX from freesound.org (CC0)
