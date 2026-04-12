# YancoCup — Design System

## Design direction

**Premium sports intelligence.** Think: a high-end sportsbook UI (without the betting) crossed with FotMob's clarity crossed with Bloomberg's data density. Not "atmospheric gaming lounge." Not "generic dark theme." Every element should feel like it was designed by someone who cares about soccer AND design.

**Key principles:**
1. **Hierarchy over decoration.** Clear visual hierarchy beats glow effects. If you can't tell what's most important in 0.5 seconds, the layout is wrong.
2. **Density over sprawl.** Soccer fans scan. Show more per screen, not less. But density ≠ clutter — spacing and grouping create readable density.
3. **States over statics.** Every component has 5 states: loading, empty, populated, error, and interactive. All five must be designed, not just the populated one.
4. **Motion over stillness.** The app should feel alive on matchday — but motion must be purposeful (score updates, prediction reveals, leaderboard shifts), not decorative.
5. **Mobile over desktop.** 70%+ of users will be on phones during matches. Mobile is the primary design target.

## Color system

All colors defined as CSS custom properties in `src/styles/globals.css` and extended in `tailwind.config.ts`.

```css
:root {
  /* Backgrounds — layered depth system */
  --yc-bg-deep:       #060b14;   /* page background */
  --yc-bg-surface:    #0d1520;   /* cards, panels */
  --yc-bg-elevated:   #141d2b;   /* hover states, active cards, modals */
  --yc-bg-glass:      rgba(13, 21, 32, 0.85); /* glassmorphism overlays */

  /* Primary accent — signature green */
  --yc-green:         #00ff88;   /* CTAs, active states, live indicators */
  --yc-green-muted:   #00cc6a;   /* secondary green — borders, subtle indicators */
  --yc-green-glow:    rgba(0, 255, 136, 0.12); /* glow behind interactive elements */
  --yc-green-dark:    #003d20;   /* green fills for dark contexts */

  /* Text hierarchy */
  --yc-text-primary:  #f0f4f8;   /* main text — not pure white, slightly warm */
  --yc-text-secondary:#8899aa;   /* labels, metadata, timestamps */
  --yc-text-tertiary: #4a5568;   /* disabled, placeholder */
  --yc-text-accent:   #00ff88;   /* live scores, active elements */

  /* Borders */
  --yc-border:        #1a2332;   /* default borders */
  --yc-border-hover:  #2a3a4e;   /* hover state borders */
  --yc-border-accent: rgba(0, 255, 136, 0.2); /* green-tinted borders */

  /* Semantic colors */
  --yc-win:           #00ff88;   /* win, correct prediction */
  --yc-draw:          #ffaa00;   /* draw, partial credit, yellow card */
  --yc-loss:          #ff4455;   /* loss, wrong prediction, red card */
  --yc-live:          #ff4455;   /* LIVE indicator — red, pulsing */
  --yc-info:          #4488ff;   /* informational badges */
  --yc-upcoming:      #8899aa;   /* upcoming match, neutral state */
}
```

**The background is deep navy-black, not pure black.** Pure `#000000` looks cheap on OLED screens and creates harsh contrast. The navy-tinted dark (`#060b14`) feels premium and allows the green accent to glow naturally.

## Typography

```
Headings:  "Space Grotesk", sans-serif  — weight 500 (medium), 600 (semibold), 700 (bold)
Body:      "Inter", sans-serif          — weight 400 (regular), 500 (medium)
Mono:      "JetBrains Mono", monospace  — scores, stats, countdowns, prediction numbers
```

**Scale (desktop → mobile):**
```
Hero:       48px → 32px   (Space Grotesk 700, letter-spacing: -0.03em)
Page title: 32px → 24px   (Space Grotesk 600, letter-spacing: -0.02em)
Section:    24px → 20px   (Space Grotesk 600)
Card title: 18px → 16px   (Space Grotesk 500)
Body:       16px → 15px   (Inter 400, line-height: 1.6)
Caption:    14px → 13px   (Inter 400, color: var(--yc-text-secondary))
Micro:      12px → 11px   (Inter 500, uppercase, letter-spacing: 0.05em)
Score:      28px → 24px   (JetBrains Mono 700, tabular-nums)
```

Load fonts via `<link>` in `index.html`. Never `@import` in CSS.

## Spacing

Base unit: 4px. Use multiples: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Card padding: 16px mobile, 20px desktop
- Card gap: 12px mobile, 16px desktop
- Section spacing: 32px mobile, 48px desktop
- Page padding: 16px mobile, 24px tablet, 32px desktop

## Border radius

- Cards: 12px
- Buttons: 8px
- Badges/pills: 999px (full round)
- Inputs: 8px
- Avatar/crest: 50% (circle)

## Component patterns

### Match card
The most important component. Appears everywhere.
```
Container:  bg: var(--yc-bg-surface), border: 1px solid var(--yc-border), radius: 12px
            hover: border-color var(--yc-border-hover), translateY(-1px)
Layout:     [Home crest + name] — [Score / Time / Status] — [Away crest + name]
States:
  upcoming:  Time in center, prediction CTA below, countdown if <2h
  live:      Score in center (JetBrains Mono, green glow), minute indicator, pulsing red dot
  finished:  Final score in center, result indicators (W/D/L dots), points earned if predicted
  predicted: Subtle checkmark badge, "Your pick: 2-1" below score area
```

### Prediction form
Must be completable in 2 taps on mobile.
```
Full predict: Two score inputs (number steppers, large tap targets), submit button
Quick predict: Three buttons [Home / Draw / Away] (1X2), one tap to predict
Visual:  Team crests flanking the input area, clear which side is which
States:
  open:       Active form, deadline countdown visible
  locked:     Match started, prediction frozen, show what you picked
  revealed:   Match finished, show your pick vs actual, points animation
```

### Leaderboard row
```
Layout:     [Rank #] [Avatar] [Name] [Points] [Accuracy %] [Streak indicator]
Current user: highlighted with green left border accent
Movement:   ▲▼ arrows showing rank change since last matchday
```

### Pool card
```
Layout:     [Pool name] [Member count] [Your rank / total]
Status:     [Active predictions: 3/8] [Next deadline: 2h 15m]
Action:     Tap to enter pool view
```

### Button (primary)
```css
background: var(--yc-green);
color: #060b14;
font-weight: 600;
border-radius: 8px;
padding: 10px 20px;
transition: transform 150ms ease, filter 150ms ease;
hover: brightness(1.1), translateY(-1px);
active: scale(0.97);
disabled: opacity 0.4, cursor not-allowed;
```

### Button (secondary / ghost)
```css
background: transparent;
border: 1px solid var(--yc-border);
color: var(--yc-text-primary);
hover: border-color var(--yc-green-muted), color var(--yc-green);
```

### Live indicator
Red pulsing dot — used on live match cards and in navigation.
```css
.live-dot {
  width: 8px; height: 8px;
  background: var(--yc-live);
  border-radius: 50%;
  animation: pulse-live 2s ease-in-out infinite;
}
@keyframes pulse-live {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 68, 85, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(255, 68, 85, 0); }
}
```

### Skeleton loading
Every component that loads data must show a skeleton state, not a spinner.
```css
.skeleton {
  background: linear-gradient(90deg, var(--yc-bg-surface) 25%, var(--yc-bg-elevated) 50%, var(--yc-bg-surface) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 8px;
}
```

### Empty states
Never show a blank area. Every empty state needs:
1. An icon or illustration (Lucide icon, 48px, muted color)
2. A short message explaining why it's empty
3. A CTA if the user can take action (e.g., "Make your first prediction")

### Error states
Never show raw error text or stack traces. Every error state needs:
1. A friendly message ("Scores are temporarily unavailable")
2. A retry button if applicable
3. Graceful degradation — show cached/stale data with a "last updated" timestamp

## Motion

**General rules:**
- Duration: 150ms for micro (hover, press), 300ms for transitions (enter/exit), 500ms for reveals (score, points)
- Easing: `ease-out` for enters, `ease-in` for exits, `ease-in-out` for loops
- Only animate `transform` and `opacity`. Never animate layout properties (width, height, padding, margin).
- Respect `prefers-reduced-motion: reduce` — disable all non-essential animation.

**Key moments with premium motion:**
1. **Prediction submit** — card compresses slightly, checkmark scales in with spring, haptic-feel
2. **Points reveal** — number counts up from 0 to earned points, with color (green = good, red = 0)
3. **Leaderboard position change** — row slides to new position, rank number morphs
4. **Match goes live** — card border pulses green→red, "LIVE" badge fades in
5. **Goal scored** — score number scales up briefly, flash effect
6. **Countdown reaching zero** — last 60 seconds pulse with urgency (amber text)

**Page transitions:**
- Enter: fadeIn + translateY(8px→0), 300ms ease-out, staggered 50ms per child
- Exit: fadeOut, 200ms ease-in

## Responsive breakpoints

```
mobile:   < 640px    — single column, bottom tab nav, globe hidden
tablet:   640-1024px — two column, side nav possible, globe small
desktop:  > 1024px   — full layout, globe prominent, sidebar visible
```

Mobile is the primary design target. Start there, enhance for larger screens.

## Navigation

Bottom tab bar on mobile (5 items max):
```
[Home] [Matches] [Predict] [Leaderboard] [Profile]
```
- Active tab: green icon + label
- Inactive: muted icon, no label (icon only to save space)
- Live match badge: red dot on Matches tab when games are live

Top nav on desktop:
- Logo left, main navigation center, profile/language right
- Sticky on scroll with subtle backdrop blur

## RTL support (Arabic)

- Use `dir="rtl"` on `<html>` when Arabic is active.
- Use CSS logical properties: `margin-inline-start` not `margin-left`, `padding-inline-end` not `padding-right`.
- Tailwind RTL utilities: `rtl:` prefix.
- Score displays and numbers remain LTR even in RTL mode.
- Crests and match cards: home team is always on the leading side (left in LTR, right in RTL).

## Anti-patterns (things that make YancoCup feel primitive)

- Pure black backgrounds (`#000000` or `#0a0a0a`)
- Inconsistent border radius (mixing 8px, 12px, 16px randomly)
- Text directly on the page background without a card/container
- Spinners instead of skeleton loaders
- Missing empty states (blank white/dark areas)
- Raw error messages or "undefined" showing in the UI
- Misaligned elements (especially crest + team name pairs)
- Generic placeholder text ("Lorem ipsum", "Coming soon")
- Scrollable content with no scroll indicators
- Buttons without hover/active/disabled states
- Unresponsive touch targets (minimum 44px × 44px)
- Gradients that fight the green accent (especially purple or blue gradients)
- Too many competing glow effects — one glow source per viewport
- White or light backgrounds anywhere — this site is ALWAYS dark
