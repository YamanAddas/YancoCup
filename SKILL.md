---
name: yancoverse-design
description: Applies the YancoVerse design language to UI components. Use when building or styling any visual element, component, page, or layout. Covers color system, typography, spacing, effects, animation patterns, and the atmospheric dark aesthetic that defines YancoCup.
---

# YancoVerse design system for YancoCup

YancoCup is not a generic sports site. It belongs to the YancoVerse family — a design language defined by deep blacks, signature green (#00ff88) accents, atmospheric particle effects, and a premium gaming-lounge feel. Every component must feel like it belongs in this universe.

## Color tokens

Define these in `src/styles/tokens.css` as CSS variables and in `tailwind.config.ts` as extended theme colors.

```
--yc-bg-deep:       #0a0a0a    /* page background */
--yc-bg-surface:    #1a1a1a    /* cards, panels */
--yc-bg-elevated:   #222222    /* hover states, modals */
--yc-bg-glass:      rgba(26, 26, 26, 0.85)  /* glassmorphism panels */

--yc-green:         #00ff88    /* primary accent — highlights, CTAs, active states */
--yc-green-muted:   #00cc6a    /* secondary accent — borders, subtle indicators */
--yc-green-glow:    rgba(0, 255, 136, 0.15) /* glow behind interactive elements */
--yc-green-dark:    #004d29    /* green used on dark fills for contrast */

--yc-text-primary:  #ffffff
--yc-text-secondary:#a0a0a0
--yc-text-tertiary: #666666
--yc-text-accent:   #00ff88    /* when text needs to pop — scores, live indicators */

--yc-border:        #2a2a2a
--yc-border-hover:  #3a3a3a
--yc-border-accent: #00ff8833  /* green border with low opacity */

--yc-danger:        #ff4444    /* red card, loss indicator */
--yc-warning:       #ffaa00    /* yellow card, draw indicator */
--yc-info:          #4488ff    /* informational badges */
```

## Typography

- **Headings**: "Space Grotesk" (Google Fonts), weight 500-700
- **Body**: "Inter", weight 400-500
- **Mono** (scores, stats): "JetBrains Mono"
- Heading scale: 48/36/28/22/18/16px
- Body: 16px base, line-height 1.6
- Letter spacing: headings -0.02em, body 0

Load via Google Fonts link in `index.html`. Do NOT use `@import` in CSS (render-blocking).

## Component patterns

### Cards
```
bg: var(--yc-bg-surface)
border: 1px solid var(--yc-border)
border-radius: 12px
padding: 20px
transition: border-color 300ms ease, box-shadow 300ms ease
hover: border-color var(--yc-border-hover), box-shadow 0 0 20px var(--yc-green-glow)
```

### Buttons (primary)
```
bg: var(--yc-green)
color: #0a0a0a (dark text on green)
border-radius: 8px
font-weight: 600
hover: brightness(1.1), subtle scale(1.02)
active: scale(0.98)
```

### Live indicators
Pulsing green dot (CSS animation, no JS):
```css
@keyframes pulse-live {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0,255,136,0.4); }
  50% { opacity: 0.8; box-shadow: 0 0 0 6px rgba(0,255,136,0); }
}
```

### Glass panels (for overlays, modals, navigation)
```
bg: var(--yc-bg-glass)
backdrop-filter: blur(12px)
border: 1px solid var(--yc-border)
```

## Animation principles

- Default duration: 300ms ease for hover/focus. 500ms ease-out for enter animations.
- Stagger children by 50ms for list reveals.
- Use `transform` and `opacity` only — never animate layout properties.
- Globe interactions: use spring physics via R3F/drei `useSpring`.
- Page transitions: fade + subtle translateY(10px).
- `@media (prefers-reduced-motion: reduce)` — disable all non-essential animation.

## Particle background

A subtle floating particle field behind the globe and hero sections. Implementation:
- Use `@react-three/fiber` Canvas with transparent background
- OR a lightweight 2D canvas with ~50 small green dots drifting slowly
- Particles: 1-2px circles, color #00ff88 at 10-20% opacity, speed ~0.2px/frame
- Do NOT use heavy particle libraries (tsparticles). Keep it minimal.

## Responsive breakpoints

- Mobile: < 640px — single column, globe shrinks, hamburger nav
- Tablet: 640-1024px — two column, globe medium
- Desktop: > 1024px — full layout, globe prominent
- Globe: `min-height: 400px` on desktop, `min-height: 280px` on mobile

## Icons

Use Lucide React (`lucide-react`) for all UI icons. Open source, consistent, dark-theme friendly.
- Import individually: `import { Search, Filter, Share2, HelpCircle } from 'lucide-react'`
- Default size: 20px for inline, 24px for standalone
- Color: inherit from parent (usually --yc-text-secondary or --yc-green)
- Do NOT use FontAwesome, Heroicons, or other icon libraries

## Flags

Use circle-flags (https://github.com/HatScripts/circle-flags) for all country flag display.
- 400+ circular SVG flags
- Circular shape fits the dark, premium aesthetic
- Map FIFA 3-letter team codes to ISO alpha-2 codes for flag lookup
- Do NOT use emoji flags (inconsistent across OS, look amateur on Windows)
- Do NOT use rectangular flag-icons — circular is the YancoVerse way

## Anti-patterns (things that break the vibe)

- White or light backgrounds anywhere
- Generic blue/red sports color schemes
- Stock photo aesthetics
- Rounded-everything bubbly UI (this is sharp and atmospheric, not cute)
- Heavy borders or thick dividers — use subtle 1px lines or spacing
- Gratuitous gradients — one subtle radial gradient on the page bg is enough
- Emoji flags (render differently per OS, look cheap)
- Full-screen globe blocking content (globe is a hero element, not the entire page)
- Generic loading spinners — use skeleton screens with YancoVerse dark tones
