# ⚽ YancoCup

**Predict. Compete. Prove it.**

Premium soccer prediction platform where friends compete to prove who knows the beautiful game best. Live scores, prediction pools, matchday recaps, shareable moments — wrapped in a polished dark interface with 6-language support.

## Competitions

FIFA World Cup 2026 • UEFA Champions League • Premier League • La Liga • Bundesliga • Serie A • Ligue 1 • European Championship

## Features

- **Predictions** — Full score or quick 1X2 picks for every match
- **Pools** — Private groups with friends, custom scoring, pool chat, matchday recaps
- **Leaderboard** — Per-competition and per-pool rankings with streaks, badges, and rank tiers
- **Live scores** — Real-time updates via Cloudflare Worker-cached football-data.org data
- **AI News** — Auto-curated soccer news from 18+ sources, rewritten by AI, in 6 languages
- **Gamification** — Badges, streaks, jokers, upset bonuses, knockout multipliers
- **Shareable** — Prediction cards and recap cards for WhatsApp, Telegram, Twitter
- **Globe** — Interactive 3D globe showing World Cup host cities
- **Multilingual** — English, Arabic (RTL), Spanish, French, German, Portuguese

## Stack

Everything runs on free tiers — $0/month total.

| Layer | Tech |
|-------|------|
| Frontend | Vite + React 19 + Tailwind CSS 4 + TypeScript |
| 3D | React Three Fiber + r3f-globe |
| Backend | Cloudflare Workers + Hono |
| Database | Supabase (Auth + DB + Realtime) |
| Live data | football-data.org + API-Football fallback |
| AI | Cloudflare Workers AI (Llama 3.1 8B) |
| Hosting | GitHub Pages |
| Monitoring | Sentry + Cloudflare Analytics |

## Quick start

```bash
npm install
npm run dev          # Local dev server at localhost:5173
npm run build        # Production build
npm run deploy       # Deploy to GitHub Pages
```

Worker deployment:
```bash
cd worker
npx wrangler deploy  # Deploy to Cloudflare Workers
```

## Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Claude Code operating instructions |
| `VISION.md` | Product identity and positioning |
| `STYLE.md` | Design system (colors, typography, components) |
| `ARCHITECTURE.md` | Technical architecture and data flow |
| `ROADMAP.md` | Execution plan and innovation ideas |
| `BUGS.md` | Known issues and technical debt |

## License

Private project. Not open source.
