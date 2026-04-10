---
name: yancoverse-design
description: Applies the YancoVerse design language to UI components. Use when building or styling any visual element, component, page, or layout. Covers color system, typography, spacing, effects, animation patterns, and the atmospheric dark aesthetic that defines YancoCup.
---

# YancoVerse design system for YancoCup

YancoCup is not a generic sports site. It belongs to the YancoVerse family — a design language defined by deep navy backgrounds, signature green (#00ff88) accents, atmospheric particle effects, and a premium gaming-lounge feel. Every component must feel like it belongs in this universe.

**The single source of truth for design tokens is `src/styles/globals.css`.** If anything in this document conflicts with globals.css, globals.css wins.

## Color tokens

These are defined in `src/styles/globals.css` using Tailwind 4 `@theme` and `:root` CSS variables.

### @theme tokens (Tailwind classes: `bg-yc-bg-deep`, `text-yc-green`, etc.)

```
--color-yc-bg-deep:       #060b14    /* page background (deep navy, NOT black) */
--color-yc-bg-surface:    #0c1620    /* cards, panels */
--color-yc-bg-elevated:   #121e30    /* hover states, modals */

--color-yc-green:         #00ff88    /* primary accent — highlights, CTAs, active states */
--color-yc-green-muted:   #00cc6a    /* secondary accent — borders, subtle indicators */
--color-yc-green-dark:    #004d29    /* green used on dark fills for contrast */

--color-yc-text-primary:  #dde5f0
--color-yc-text-secondary:#8a9bb0
--color-yc-text-tertiary: #3d4f63

--color-yc-border:        #142035
--color-yc-border-hover:  #1e3050

--color-yc-danger:        #ff4757    /* red card, loss indicator */
--color-yc-warning:       #ffc800    /* yellow card, draw indicator */
--color-yc-info:          #4488ff    /* informational badges */
```

### :root CSS variables (for rgba values that can't go in @theme)

```
--yc-bg-glass:              rgba(8, 16, 28, 0.88)     /* glassmorphism panels */
--yc-bg-glass-light:        rgba(12, 22, 40, 0.75)
--yc-accent-glow:           rgba(0, 255, 136, 0.35)   /* glow behind interactive elements */
--yc-accent-dim:            rgba(0, 255, 136, 0.08)
--yc-border-accent:         rgba(0, 255, 136, 0.12)
--yc-border-accent-bright:  rgba(0, 255, 136, 0.25)
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

### Cards (`.yc-card`)
```
background: linear-gradient(170deg, rgba(12, 22, 40, 0.9) 0%, rgba(8, 14, 26, 0.95) 100%)
border: 1px solid var(--yc-accent-dim)
border-radius: 12px
transition: border-color 0.3s ease, box-shadow 0.3s ease
hover: border-color var(--yc-border-accent-bright), box-shadow with accent glow
```

### Buttons (primary)
```
bg: #00ff88
color: #060b14 (dark text on green)
border-radius: 8px
font-weight: 600
hover: brightness(1.1), subtle scale(1.02)
active: scale(0.98)
```

### Live indicators
Pulsing green dot (CSS animation, no JS):
```css
@keyframes yc-pulse-glow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
```

### Glass panels (`.yc-glass`)
```
background: var(--yc-bg-glass)
backdrop-filter: blur(16px)
-webkit-backdrop-filter: blur(16px)
border: 1px solid var(--yc-accent-dim)
```

## Animation principles

- Default duration: 300ms ease for hover/focus. 500ms ease-out for enter animations.
- Stagger children by 50ms for list reveals.
- Use `transform` and `opacity` only — never animate layout properties.
- Globe interactions: use spring physics via R3F/drei `useSpring`.
- Page transitions: fade + subtle translateY(8px) (`animate-fade-in` class).
- Entry animations: 3D materialize effect (`yc-hex-materialize` keyframes).
- `@media (prefers-reduced-motion: reduce)` — disable all non-essential animation.

### Available animation classes
- `.animate-breathe` — breathing glow on live elements (3s infinite)
- `.animate-shimmer` — shimmer overlay sweep (4s infinite)
- `.animate-fade-in` — fade + translateY entrance (0.35s)
- `.animate-slide-up` — slide up with elastic ease (0.4s)
- `.yc-hex-enter` — 3D materialize for hex cards (0.7s)

## Responsive breakpoints

- Mobile: < 640px — single column, globe shrinks, hamburger nav
- Tablet: 640-1024px — two column, globe medium
- Desktop: > 1024px — full layout, globe prominent
- Globe: `min-height: 400px` on desktop, `min-height: 280px` on mobile

## Icons

Use Lucide React (`lucide-react`) for all UI icons. Open source, consistent, dark-theme friendly.
- Import individually: `import { Search, Filter, Share2, HelpCircle } from 'lucide-react'`
- Default size: 20px for inline, 24px for standalone
- Color: inherit from parent (usually yc-text-secondary or yc-green)
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
- Pure black (#000000 or #0a0a0a) backgrounds — use #060b14 (deep navy)
- Generic blue/red sports color schemes
- Stock photo aesthetics
- Rounded-everything bubbly UI (this is sharp and atmospheric, not cute)
- Heavy borders or thick dividers — use subtle 1px lines or spacing
- Gratuitous gradients — one subtle radial gradient on the page bg is enough
- Emoji flags (render differently per OS, look cheap)
- Full-screen globe blocking content (globe is a hero element, not the entire page)
- Generic loading spinners — use skeleton screens with YancoVerse dark tones
- Using #00e5c1 or #00b89a as the primary accent — the accent is #00ff88
