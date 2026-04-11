---
name: yancoverse-design
description: Applies the YancoVerse design language to UI components. Use when building or styling any visual element, component, page, or layout. Covers color system, typography, spacing, effects, animation patterns, state design standards, and the atmospheric dark aesthetic that defines YancoCup.
---

# YancoVerse design system for YancoCup

YancoCup is not a generic sports site. It belongs to the YancoVerse family — a design language defined by deep navy backgrounds, signature green (#00ff88) accents, atmospheric effects, and a premium gaming-lounge feel. Every component must feel like it belongs in this universe.

**The single source of truth for design tokens is `src/styles/globals.css`.** If anything in this document conflicts with globals.css, globals.css wins.

---

## Design quality bar

Before shipping any UI component, ask: "Does this look like it belongs in the same universe as:
- **Linear** — interaction precision, micro-animations, component polish
- **Letterboxd** — how darkness creates mood and atmosphere
- **SofaScore** — data density done right in sports context

...or does it look like a dark-mode Bootstrap template?"

If the latter — it is not done. Push the design until the answer is no.

---

## Color tokens

Defined in `src/styles/globals.css` using Tailwind 4 `@theme` and `:root`.

### @theme tokens (Tailwind classes: `bg-yc-bg-deep`, `text-yc-green`, etc.)

```
--color-yc-bg-deep:       #060b14    /* page background — deep navy, NOT black */
--color-yc-bg-surface:    #0c1620    /* cards, panels */
--color-yc-bg-elevated:   #121e30    /* hover states, modals */

--color-yc-green:         #00ff88    /* primary accent — highlights, CTAs, active states */
--color-yc-green-muted:   #00cc6a    /* secondary accent — borders, subtle indicators */
--color-yc-green-dark:    #004d29    /* green on dark fills for contrast */

--color-yc-text-primary:  #dde5f0
--color-yc-text-secondary:#8a9bb0
--color-yc-text-tertiary: #3d4f63

--color-yc-border:        #142035
--color-yc-border-hover:  #1e3050

--color-yc-danger:        #ff4757    /* loss, error */
--color-yc-warning:       #ffc800    /* draw, caution */
--color-yc-info:          #4488ff    /* informational */
```

### :root CSS variables (rgba values that cannot go in @theme)

```
--yc-bg-glass:              rgba(8, 16, 28, 0.88)     /* glassmorphism panels */
--yc-bg-glass-light:        rgba(12, 22, 40, 0.75)
--yc-accent-glow:           rgba(0, 255, 136, 0.35)   /* glow behind interactive elements */
--yc-accent-dim:            rgba(0, 255, 136, 0.08)
--yc-border-accent:         rgba(0, 255, 136, 0.12)
--yc-border-accent-bright:  rgba(0, 255, 136, 0.25)
```

---

## Typography

- **Headings**: Space Grotesk (font-heading), weight 500-700
- **Body**: Inter (font-body), weight 400-500
- **Data / scores / stats**: JetBrains Mono (font-mono)
- Scale: 48 / 36 / 28 / 22 / 18 / 16 / 14 / 12px
- Line height: headings 1.2, body 1.6
- Letter spacing: headings -0.02em, body 0, mono 0

Load via `<link>` in index.html. Never `@import` in CSS (render-blocking).

---

## Spacing

**Tailwind 4 default spacing scale applies.** Do not introduce arbitrary values like `mt-[13px]` or `gap-[18px]`. Map to the nearest Tailwind utility.

If a value genuinely does not exist in the Tailwind scale, add it to globals.css with a comment explaining why it cannot use a standard value. This should be rare.

---

## Component patterns

### Cards (`.yc-card`)

```css
background: linear-gradient(170deg, rgba(12, 22, 40, 0.9) 0%, rgba(8, 14, 26, 0.95) 100%);
border: 1px solid var(--yc-accent-dim);
border-radius: 12px;
transition: border-color 0.3s ease, box-shadow 0.3s ease;

/* hover */
border-color: var(--yc-border-accent-bright);
box-shadow: 0 0 20px rgba(0, 255, 136, 0.06), 0 4px 16px rgba(0, 0, 0, 0.3);
```

### Active / live cards (`.yc-card-glow`)

```css
border-color: var(--yc-border-accent-bright);
box-shadow:
  0 0 20px rgba(0, 255, 136, 0.12),
  0 0 40px rgba(0, 255, 136, 0.04),
  0 4px 20px rgba(0, 0, 0, 0.4);
```

### Glass panels (`.yc-glass`)

```css
background: var(--yc-bg-glass);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border: 1px solid var(--yc-accent-dim);
```

### Buttons (primary)

```css
background: #00ff88;
color: #060b14;        /* dark text on green */
border-radius: 8px;
font-weight: 600;

/* hover */ filter: brightness(1.1); transform: scale(1.02);
/* active */ transform: scale(0.98);
```

### Live indicators

Pulsing green dot — CSS only, no JS:

```css
@keyframes yc-pulse-glow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
```

---

## Available animation classes (defined in globals.css)

```
.animate-breathe / .yc-breathe       — breathing glow for live elements (3s infinite)
.animate-shimmer / .yc-shimmer        — shimmer sweep (4s infinite)
.animate-fade-in / .yc-fade-in        — fade + translateY(8px) entrance (0.35s)
.animate-slide-up / .yc-slide-up      — slide up with elastic ease (0.4s)
.yc-hex-enter / .yc-hex-materialize   — 3D materialize for hex cards (0.7s)
.yc-points-reveal                      — post-match points reveal animation
.yc-crystal-reflect                    — crystal surface light reflection
.yc-border-pulse                       — border pulse for active/selected states
```

### Animation principles

- Default: 300ms ease for hover/focus. 500ms ease-out for enter animations.
- Stagger list children: 50ms delay increments.
- Use `transform` and `opacity` only — never animate layout properties (width, height, margin, padding).
- Globe interactions: spring physics via R3F/drei `useSpring`.
- Page transitions: `.yc-fade-in` (fade + translateY).
- Always add `@media (prefers-reduced-motion: reduce)` — disable all non-essential animation.

---

## State design standards

Every component with dynamic data MUST have all five states designed and implemented. No exceptions. Design them before writing any code.

### Loading

- Skeleton screens, not spinners
- Skeleton must match the exact shape and dimensions of the loaded content
- Background: `#0c1620`
- Shimmer: animated gradient from `#0c1620` to `#142035` (use `.animate-shimmer`)
- Never a blank white flash or an empty container

### Empty

- Never an empty container
- Every empty state needs: a meaningful icon (custom SVG, not Lucide), a headline (1 sentence), context (1 sentence explaining why it's empty), and optionally a CTA
- Empty states should feel designed and intentional, not like an afterthought
- Good examples:
  - "No predictions yet — the group stage kicks off June 11"
  - "Your pool is ready — share the code with your friends"
  - "No live matches right now — check back during match windows"

### Error

- Never show raw error messages to users
- Show: a friendly explanation, what they can do next
- Include a retry action if applicable
- Log the full technical error to Sentry silently
- Use `--color-yc-danger: #ff4757` sparingly — for actual errors, not warnings

### Success

- Confirm actions visually — don't make things disappear without acknowledgment
- Brief animation (~300ms) then settle to a stable state
- Use `.yc-points-reveal` for scoring moments
- Green accent (`--color-yc-green`) for success confirmation

### Offline / degraded

- If the live data API is unavailable: show the last cached data with a "Live scores temporarily unavailable" badge
- Never white-screen because an API is down
- Static WC schedule, groups, and teams are always available regardless of API status

---

## Icon rules

### Functional UI icons — Lucide React

Use Lucide for standard functional interface icons only:
- Navigation: chevron, arrow, menu, external-link
- Actions: search, filter, copy, share, send, log-in, log-out
- Status: check, circle-alert, info, loader-circle, clock
- Media: calendar, map-pin, newspaper, globe

Import individually — never barrel import:
```tsx
import { Search, ChevronDown } from 'lucide-react'
```

Default size: 20px inline, 24px standalone. Color: inherit from parent.

### Thematic / sport-specific / decorative icons — custom SVG

Do NOT use Lucide for:
- Trophies, medals, cups
- Football / soccer balls
- Competition shields or badges
- Special rank or tier indicators
- YancoVerse-specific branded elements

These must be custom inline SVG components designed to match the YancoVerse aesthetic. They live in `src/components/shared/icons/`. Examples: `<TrophyIcon />`, `<MatchBallIcon />`, `<CompetitionBadge />`.

A Lucide icon for a trophy looks generic. A custom dark-glass hexagonal trophy icon looks like YancoVerse.

---

## Responsive breakpoints

- Mobile: < 640px — single column, globe shrinks, hamburger nav
- Tablet: 640–1024px — two column, globe medium
- Desktop: > 1024px — full layout, globe prominent
- Globe: `min-height: 400px` desktop, `min-height: 280px` mobile
- GlobeView: `h-[min(45vh,400px)] sm:h-[min(60vh,600px)] min-h-[220px]`

All interactive elements: minimum 44×44px touch target on mobile.

---

## Flags and crests

- **Country flags**: circle-flags (circular SVG, MIT). Map FIFA 3-letter → ISO alpha-2.
- **Club crests**: football-data.org API `crest` URLs — hotlinked, never downloaded or bundled.
- **Fallback**: TLA badge in a styled circle.
- Use `<TeamCrest>` component for all team identity — handles the above logic in one place.
- Never: emoji flags, rectangular flag-icons, local crest files.

---

## Anti-patterns (zero exceptions)

- White or light backgrounds anywhere
- Pure black (#000000 or #0a0a0a) — background is #060b14 (deep navy)
- #00e5c1, #00b89a, or any teal as primary accent — accent is #00ff88 only
- Generic blue/red sports color scheme
- Bootstrap, MUI, or "dark mode template" aesthetics
- Arbitrary spacing values not in the Tailwind scale
- Lucide icons for thematic or decorative purposes
- Light mode anything — always dark, no toggle
- Globe blocking all content above fold
- Emoji flags
- Generic loading spinners — use skeleton screens
- Rounded-everything bubbly UI — sharp and atmospheric, not cute
- Thick borders or heavy dividers — subtle 1px or spacing only
- Gratuitous gradients — one subtle radial on body background is enough
- Using `#00ff88` on a white or light background (it's designed for dark contexts)

---

## Design critique protocol

After implementing any UI component, run this checklist before marking it done:

1. **Uniqueness check**: "Could this component appear on any other website?" If yes, push further.
2. **Token check**: Are you using token names from globals.css, or hardcoded hex values? Only token names.
3. **State check**: Are all five states (loading, empty, error, success, default) implemented?
4. **Mobile check**: Does it work and look intentional on 390px width?
5. **Animation check**: Is there unnecessary animation? Does it have a reduced-motion fallback?
6. **Icon check**: Are any Lucide icons being used for thematic purposes? Replace with custom SVG.
7. **Spacing check**: Are there arbitrary spacing values? Replace with Tailwind scale.
8. **Vibe check**: Does this feel like a cinematic command center or a sports template? Be honest.
