# YancoCup

FIFA World Cup 2026 companion portal. 3D interactive globe, live scores, predictions game, broadcast links, multilingual.

## Stack

- **Frontend**: Vite + React 18 + Tailwind CSS 4
- **Globe**: r3f-globe (by Vasturiano) + React Three Fiber + Three.js — NOT custom globe from scratch
- **Backend proxy**: Cloudflare Workers with Hono (API key vault + caching)
- **Database**: Supabase free tier (auth, predictions, leaderboard, unlimited realtime)
- **Live scores**: football-data.org free tier (10 req/min) — primary, **verify WC coverage before Phase 3**
- **Live scores fallback**: API-Football (100 req/day + Cron Trigger + KV cache) or WC2026 API
- **Live score delivery**: Cloudflare Cron Triggers poll upstream, write to KV. User requests read KV only.
- **Static data**: openfootball/worldcup.json (public domain, no API key)
- **Flags**: circle-flags (circular SVG country flags, open source)
- **Icons**: Lucide React (open source, dark-theme friendly)
- **Error monitoring**: Sentry free tier (5K errors/month)
- **Analytics**: Cloudflare Web Analytics (free, unlimited, no cookies)
- **Deploy**: GitHub Pages via `gh-pages` branch
- **i18n**: Client-side auto-translate (no build-time i18n framework), 6 languages

## Project structure

```
src/
  components/       # React components
    globe/          # Three.js globe and city markers
    match/          # Match center, live scores, schedule
    predictions/    # Betting game, leaderboard
    broadcast/      # Broadcaster links and embeds
    activity/       # Friend activity feed
    layout/         # Nav, footer, language switcher
  hooks/            # Custom React hooks
  lib/              # Utilities, API clients, i18n engine
  data/             # Static JSON: teams, groups, venues, schedule
  styles/           # Global CSS, Tailwind config
  pages/            # Route-level components
worker/             # Cloudflare Worker source (separate deploy)
docs/               # Architecture decisions, API notes
```

## Commands

- `npm run dev` — local dev server (Vite)
- `npm run build` — production build (outputs to `dist/`)
- `npm run preview` — preview production build locally
- `npm run deploy` — build + push to `gh-pages` branch
- `npm run lint` — ESLint
- `npm run format` — Prettier
- `npm run typecheck` — TypeScript check

## Code style

- TypeScript strict mode. No `any` unless explicitly justified with a comment.
- ES modules only. No CommonJS.
- Functional components with hooks. No class components.
- Destructure imports: `import { useState } from 'react'`
- Tailwind for styling. No CSS modules, no styled-components, no inline style objects.
- Component files: PascalCase (`MatchCard.tsx`). Utilities: camelCase (`formatDate.ts`).
- One component per file. Co-locate component-specific hooks and types in the same directory.

## Design system — YancoVerse aesthetic

IMPORTANT: This is not a generic sports site. It follows the YancoVerse design language.

- **Background**: Deep black (#0a0a0a) with subtle gradient to #111
- **Primary accent**: #00ff88 (signature green) — used for highlights, hover states, active elements
- **Secondary accent**: #00cc6a (muted green) — borders, subtle indicators
- **Text**: #ffffff primary, #a0a0a0 secondary, #666666 tertiary
- **Cards/surfaces**: #1a1a1a with 1px #222 borders, subtle glow on hover
- **Typography**: "Space Grotesk" for headings, "Inter" for body (these are the YancoVerse fonts)
- **Effects**: Subtle particle backgrounds, green glow on interactive elements, smooth transitions (300ms ease)
- **NO**: Bright backgrounds, generic sports-site blue/red schemes, stock photo vibes, flat corporate look

When in doubt about visual direction, think: "dark, atmospheric, premium gaming lounge" not "ESPN clone."

## Workflow rules

IMPORTANT: These rules are non-negotiable.

1. **Plan before code.** Before touching any file, write a brief plan (what files change, what the expected outcome is) and wait for approval.
2. **One task per session.** Do not scope-creep. If you discover related work, note it and move on.
3. **Commit after every completed task.** Descriptive commit message. Separate commits per logical change.
4. **Never commit secrets.** API keys go in `.env` (gitignored) or Cloudflare Workers secrets. Never hardcode.
5. **Static export.** The React app MUST work as a static site on GitHub Pages. No SSR, no server-side routes. Use HashRouter or basename config.
6. **Test your build.** Run `npm run build` before committing UI changes. If it fails, fix it.
7. **When compacting**, preserve: current task status, list of modified files, any unresolved bugs.

## API architecture

- Frontend NEVER calls external APIs directly (keys would leak in client JS).
- All external API calls go through the Cloudflare Worker at `https://yancocup-api.<domain>.workers.dev/`
- Worker endpoints: `/api/scores`, `/api/standings`, `/api/match/:id`
- Primary data source: football-data.org (10 req/min free tier) — **verify WC coverage first**
- Fallback data source: API-Football (100 req/day) or WC2026 API
- **Cron Trigger architecture**: Worker polls upstream on a Cron schedule (every 60s during match windows), writes to KV. All user-facing endpoints read from KV only. This decouples user traffic from API rate limits entirely.
- Static data (schedule, groups, teams): sourced from openfootball/worldcup.json, stored in src/data/
- Match IDs: use the chosen API's match IDs as canonical — no mapping table needed
- Knockout team resolution: API returns resolved team names automatically
- Supabase is the exception — the Supabase JS client uses the public anon key (safe for client-side).
- **Scoring is client-side.** No Edge Functions. When user loads leaderboard, client checks for unscored finished matches and calculates points.

## What Claude gets wrong on this project (fix these)

- Forgetting that GitHub Pages is static — no server routes, no API routes in the React app.
- Using dark mode media queries instead of always-dark. This site is ALWAYS dark. No light mode.
- Putting API keys in `.env` files that get bundled by Vite. Use `VITE_` prefix only for public values.
- Over-engineering i18n with heavy frameworks. We use a simple runtime translation layer, 6 languages only.
- Making the globe a performance hog. Use `frameloop="demand"` in R3F. Render only when interacting.
- Building custom globe components from scratch. Use r3f-globe by Vasturiano — it handles sphere, atmosphere, markers, labels, and camera out of the box.
- Using emoji flags. They look different on every OS. Use circle-flags SVGs.
- Using BALLDONTLIE as a football API. It's an NBA API — does not cover soccer.
- Using API-Football without Cron Trigger + KV caching. 100 req/day works only with aggressive caching.
- Triggering upstream API calls on user requests. Use Cron Triggers to poll, KV to serve.
- Over-engineering scoring with Edge Functions. Scoring is client-side, no server triggers.
- Forgetting match ID mapping. Use the chosen API's match IDs as canonical IDs in schedule.json.
- Hardcoding knockout match teams. The API resolves them automatically.
- Making the globe full-screen on homepage. Content (countdown, today's matches, CTA) must be visible without scrolling.
- Forgetting auth redirect issues with HashRouter. Handle Supabase auth token before HashRouter processes the URL.
