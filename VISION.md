# YancoCup — product vision

## What is this?

YancoCup is a World Cup 2026 companion portal for friends and football fans. It's not a news site. It's not an ESPN clone. It's a premium, atmospheric, interactive experience that makes following the World Cup feel like being in a high-end gaming lounge.

Built by Yaman as part of the YancoVerse family of projects. Published on GitHub Pages for friends and the wider community.

## Who is it for?

- Yaman's friends and social circle (primary)
- Football fans who want a beautiful, centralized World Cup hub (secondary)
- People who appreciate dark, atmospheric UI and don't want another corporate sports site (tertiary)

## Core experience

When someone opens YancoCup, they see a slowly rotating 3D globe with 16 glowing green pins marking the host cities. The background is deep black with subtle floating particles. It feels like looking at a command center, not a sports page.

They can:
1. **Explore the globe** — spin, click cities, see what matches are happening where
2. **Check live scores** — clean, real-time match cards with minute-by-minute updates
3. **Browse the full schedule** — all 104 matches, filterable by group, team, date, venue
4. **Predict matches** — place friendly bets (no money) on match outcomes, compete on a leaderboard
5. **Find broadcasts** — links to official broadcasters in their country + YouTube embeds where available
6. **Read news** — aggregated World Cup news from top sources
7. **Switch languages** — English, Arabic, Spanish, French, German, Portuguese, Japanese, Korean, Turkish

## Design identity

YancoCup inherits the YancoVerse aesthetic:
- Deep blacks (#0a0a0a) as the foundation
- Signature green (#00ff88) as the accent that makes everything pop
- Atmospheric: subtle particles, gentle glows, smooth transitions
- Premium but not pretentious: it should feel cool, not corporate
- Inspired by gaming UIs, sci-fi interfaces, and music streaming apps — not traditional sports sites

## What makes it different?

1. **The globe** — no other World Cup site has an interactive 3D globe as its centerpiece
2. **The predictions game** — turns passive watching into active social competition
3. **The aesthetic** — dark, atmospheric, distinctive. You remember this site.
4. **Multilingual by default** — respects the global nature of the World Cup
5. **Broadcast finder** — actually useful for "where do I watch this match in my country?"

## What it is NOT

- Not a streaming platform (we link to broadcasters, we don't host streams)
- Not a betting site (predictions are for fun, zero real money)
- Not a news site (we aggregate, not produce)
- Not a Wikipedia clone (we curate, not dump everything)

## Technical philosophy

- Static-first: the core experience works without any backend (schedule, groups, teams are all static data)
- Progressive enhancement: live scores layer on top of static data when available
- Performance-conscious: the globe must not tank mobile performance
- Open source: the repo is public, friends can contribute

## Success criteria

- Friends use it during the World Cup
- The globe makes someone go "whoa"
- The predictions game creates friendly competition
- It works well on both desktop and phone
- It looks nothing like any other sports site
