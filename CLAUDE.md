# YancoCup

Premium soccer prediction platform. World Cup 2026 + Champions League + top European leagues. Live scores, prediction pools with friends, AI-curated news, shareable moments, gamification, multilingual.

**Live at:** https://yamanaddas.github.io/YancoCup/
**Worker at:** https://yancocup-api.catbyte1985.workers.dev/
**World Cup 2026 kickoff:** June 11, 2026. All 48 teams finalized.

## Read these files first

Before any session, read the file most relevant to the task:
- `VISION.md` — product identity, what YancoCup is and is NOT
- `STYLE.md` — design system, tokens, component patterns, anti-patterns
- `ARCHITECTURE.md` — technical stack, data flow, API details, file structure
- `ROADMAP.md` — phased execution plan, what to build and in what order
- `BUGS.md` — known issues, technical debt, things that must not regress

## Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Vite 8 + React 19 + Tailwind CSS 4 | TypeScript strict |
| 3D | React Three Fiber + r3f-globe | `frameloop="demand"` |
| Backend | Cloudflare Workers + Hono | API proxy + cron polling |
| Database | Supabase | Auth, predictions, pools, realtime |
| Live scores | football-data.org (primary) | 10 req/min, covers WC/CL/PL/PD/BL1/SA/FL1/EC |
| Live scores | API-Football (fallback) | 100 req/day + KV cache |
| AI News | Cloudflare Workers AI | Llama 3.1 8B, RSS rewrite |
| Deploy | GitHub Pages | Static SPA, HashRouter |
| Monitoring | Sentry + Cloudflare Analytics | Free tiers |

**Total infrastructure cost: $0/month.**

## Code rules

- TypeScript strict. No `any` without a `// REASON:` comment.
- Functional components + hooks only. No class components.
- Tailwind for all styling. No CSS modules, no styled-components, no inline style objects.
- One component per file. PascalCase files (`MatchCard.tsx`). Utility files camelCase (`formatDate.ts`).
- Destructured imports: `import { useState } from 'react'`
- All user-facing strings go through the i18n system (`useTranslation` hook).
- Images/crests: hotlink from football-data.org API URLs only. Never host copyrighted assets.
- Flags: circle-flags package (MIT). Icons: Lucide React (ISC).

## Workflow rules

1. **Read before writing.** Before editing any file, read it first. Verify current state with `grep -n` — do not trust stale context.
2. **One task per session.** Complete it fully, test it, commit.
3. **Show plan first.** Before implementing, describe what you'll change and why. Wait for approval on complex tasks.
4. **Commit after each task.** Message format: `feat: description` / `fix: description` / `refactor: description`
5. **No broad rewrites.** Prefer surgical edits. Touch the minimum files needed.
6. **Test on mobile dimensions.** This is a mobile-first product. Always verify at 375px width.

## Common mistakes to avoid

- **GitHub Pages is static.** No server routes. No SSR. HashRouter only.
- **Always dark.** No light mode. No `prefers-color-scheme` media queries. Site is always dark.
- **API keys are secret.** Never put real keys in `VITE_` env vars. All API calls go through the Worker proxy.
- **football-data.org rate limits.** `/v4/matches` (no competition filter) returns ALL competitions in one call — use this to minimize requests. Max 10 req/min.
- **Scoring is client-side.** `src/lib/scoring.ts` runs in-browser. First user to load leaderboard triggers scoring for finished matches. This is a known architectural concern — do not add server-side scoring without explicit approval.
- **Supabase RLS.** Every new table needs Row Level Security policies. Never skip this.
- **Globe performance.** Use `frameloop="demand"` in R3F Canvas. Do not render every frame. Suspend globe below 640px width to save mobile battery.

## File structure

```
src/
  components/       # UI components
    globe/          # 3D globe + markers
    match/          # Match cards, detail, live indicators
    predictions/    # Prediction forms, reveals, cards
    pools/          # Pool management, chat, recaps
    leaderboard/    # Leaderboard, podium, rankings
    news/           # News feed, article cards
    team/           # Team profiles, squad, form
    layout/         # Nav, footer, language switcher
    shared/         # Reusable atoms (buttons, badges, skeletons)
  hooks/            # Custom React hooks
  lib/              # Utilities, API clients, scoring, i18n
  data/             # Static JSON (teams, groups, schedule, venues)
  pages/            # Route-level components
  styles/           # globals.css, design tokens
worker/             # Cloudflare Worker (separate deploy)
docs/               # Documentation (VISION, STYLE, etc.)
```
