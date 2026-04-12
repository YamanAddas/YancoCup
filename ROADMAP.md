# YancoCup — Roadmap

> Priority order for World Cup 2026 launch (June 11) and beyond.
> Each phase builds on the previous. Don't skip phases.

---

## Phase 1: POLISH — Make it feel finished

**Goal:** Every screen should feel like a shipped product, not a work in progress. No broken states, no jank, no placeholder content.

### 1.1 State audit
Audit every component for these 5 states and fix any that are missing or broken:
- **Loading** — skeleton shimmer, not a spinner
- **Empty** — icon + message + CTA (never a blank area)
- **Populated** — the normal designed state
- **Error** — friendly message + retry + graceful fallback to cached data
- **Interactive** — hover, active, focus, disabled all designed

### 1.2 Typography pass
One global pass to enforce the type scale from STYLE.md:
- Consistent heading hierarchy everywhere
- Scores always in JetBrains Mono tabular-nums
- Captions and metadata in the correct secondary color
- No raw unstyled text anywhere

### 1.3 Spacing pass
One global pass to enforce the 4px grid:
- Cards: 16px padding mobile, 20px desktop
- Consistent gap between cards (12px mobile, 16px desktop)
- Section spacing: 32px mobile, 48px desktop
- No double margins, no inconsistent padding

### 1.4 Color reconciliation
Verify all components use design tokens from STYLE.md:
- Background layers: deep → surface → elevated
- Text hierarchy: primary → secondary → tertiary
- Accent usage: green for positive/active, red for live/loss, amber for draws/warnings
- No hardcoded hex values in component files

### 1.5 Mobile audit
Test every page at 375px width:
- Touch targets minimum 44px × 44px
- No horizontal overflow
- Readable text without zooming
- Bottom tab nav works correctly
- Prediction form completable without scrolling

### 1.6 Performance pass
- Globe: verify `frameloop="demand"`, hide below 640px
- Images: lazy load all crests below the fold
- Fonts: preload Space Grotesk 600 and Inter 400
- Bundle: code-split per route with React.lazy

---

## Phase 2: PREDICTIONS — Make the core loop addictive

**Goal:** Predicting should feel like placing a bet in a premium sportsbook — satisfying, fast, and dramatic.

### 2.1 Prediction urgency
- Countdown timer on match cards when kickoff < 2 hours
- Last 60 minutes: timer turns amber, subtle pulse
- Last 10 minutes: timer turns red, "PREDICT NOW" CTA becomes prominent
- After kickoff: card shows "LOCKED" state, your prediction visible but uneditable

### 2.2 Prediction flow optimization
- Full predict (exact score): two number inputs with +/- steppers, large tap targets
- Quick predict (1X2): three buttons [Home / Draw / Away], one tap to submit
- Success feedback: card compresses, checkmark springs in, subtle haptic-feel animation
- "Predict All" batch mode: swipe through today's matches, predict each one quickly

### 2.3 Points reveal ceremony
When a match finishes and the user returns:
- Score area shows actual result with brief flash animation
- Below it: "Your prediction: 2-1" → brief pause → points counter animates from 0 to earned points
- Color: green for any points, red for 0, gold for exact score (10 pts)
- If joker was used: "2x JOKER" badge flashes
- If streak continues: "+5 STREAK BONUS" animates in

### 2.4 Prediction card (shareable)
A beautiful image generated via Canvas API:
- Match info (teams, crests, competition)
- User's prediction vs actual result
- Points earned
- Streak indicator
- Pool rank if applicable
- YancoCup branding
- Share to WhatsApp, Telegram, Twitter, or download

### 2.5 Matchday recap (auto-generated)
After all matches in a matchday complete:
- Summary card for the user: "Today: 4/6 correct, +23 pts, up to #3 in your pool"
- Pool recap: "Pool standings after Matchday 2" with all members ranked
- Highlight moments: "Ahmad got the Upset Bonus! Sarah went 5 for 5!"
- Shareable as an image

### 2.6 Bracket prediction (World Cup)
- Before the knockout stage: let users predict the entire bracket
- Visual bracket that fills in as users pick winners
- Points for correctly predicting knockout match winners (with multipliers)
- Shareable "My Bracket" image

---

## Phase 3: SOCIAL — Make it sticky between matches

**Goal:** Users should have reasons to open YancoCup even when no match is live.

### 3.1 Pool chat enhancement
- Real-time chat is already there (Supabase Realtime)
- Add: reaction emojis on messages (👏 😂 🤡 🔥)
- Add: auto-posted system messages ("Match starting in 5 minutes!", "Ahmad just predicted Brazil 3-0!")
- Add: "Pin" important messages (pool admins only)

### 3.2 Pool rivalry
- When two users are close in standings, show "RIVALRY" badge
- Head-to-head comparison: prediction accuracy against each other
- "Challenge" a rival to a specific match prediction

### 3.3 Notification system
- Browser push notifications (already partially implemented)
- Notification types:
  - "Your match starts in 30 minutes — don't forget to predict!"
  - "Match finished! You earned 10 points (EXACT SCORE!)"
  - "Ahmad just overtook you in the pool leaderboard!"
  - "New pool invite from Sarah"
- User-configurable: which notifications to receive

### 3.4 Profile enhancement
- Prediction history: all past predictions with results
- Accuracy stats: overall, per competition, per team
- Best/worst predictions
- Badge collection (already exists — polish the display)
- Sharable profile card

### 3.5 Streak system
- Visual streak indicator on profile and leaderboard
- Streak types:
  - Correct result streak (consecutive correct W/D/L picks)
  - Exact score streak (rare, celebrated)
  - Participation streak (predicted every matchday)
- Streak at risk: "You have a 7-match streak — predict today to keep it!"

---

## Phase 4: MATCHDAY — Make live matches exciting

**Goal:** When a match is live, YancoCup should feel alive.

### 4.1 Live match card states
- Pre-match (> 2h): static card, kickoff time, venue
- Pre-match (< 2h): countdown, prediction CTA prominent
- Live: pulsing border, score updates, minute indicator, red LIVE dot
- Half-time: "HT" indicator, current score locked in
- Full-time: "FT" indicator, points reveal triggers if user predicted

### 4.2 Match detail page enhancement
- Overview tab: score, minute, key events (goals, cards, subs) as timeline
- Stats tab: possession, shots, corners (from football-data.org)
- Lineup tab: starting XI with formation diagram (if data available)
- Predictions tab: community consensus (H/D/A percentages), pool members' picks

### 4.3 Home page live section
- "LIVE NOW" section at the top when matches are in progress
- Compact live cards showing score + minute
- Tap to expand to full match detail

### 4.4 Match notifications
- Goal notifications: "⚽ GOAL! Brazil 1-0 Germany (Vinícius Jr. 23')"
- Red card notifications
- Full-time notifications: "FT: Brazil 2-1 Germany — You earned 5 points!"

---

## Phase 5: TEAM PAGES — Make them useful

**Goal:** Team pages should be the go-to place for fans following a specific team.

### 5.1 Team page v2 structure
- **Hero:** Team crest, name, competition, current form (W/D/L dots)
- **Next match:** Prominent card with prediction CTA + countdown
- **Recent results:** Last 5 matches with scores
- **Fixtures:** Upcoming matches list
- **Squad:** Player list (from football-data.org — names, positions, numbers)
- **News:** Team-filtered news feed (from AI news system)
- **Community predictions:** How YancoCup users collectively predict this team's matches

### 5.2 Follow teams
- Users can follow teams
- Following a team:
  - Prioritizes their matches on the home page
  - Sends notifications for their matches
  - Shows their news in the personalized feed

### 5.3 Team-colored accents
- When viewing a team page, the accent color subtly shifts to the team's primary color
- Applied via CSS custom property override on the page container
- Subtle — affects borders and glow, not buttons or text

---

## Phase 6: NEWS — Make it a supplement, not a destination

**Goal:** News should enrich the match experience, not be a standalone feature.

### 6.1 News integration points
- Team pages: 3-5 latest articles for that team
- Match detail: pre-match preview article (AI-generated from RSS)
- Competition overview: top stories for that competition
- Home page: "Headlines" section (3 cards max)

### 6.2 News quality pass
- AI rewrite quality check — ensure summaries are coherent, not gibberish
- Source attribution visible on every article
- "Last updated" timestamps
- Filter by language preference

---

## Phase 7: DEPTH — Nice to have, build if time allows

- Injury/suspension flags on team pages (if data available)
- Expected lineups before match (projected, clearly labeled)
- Historical H2H records on match detail page
- Transfer news section (seasonal)
- Competition bracket improvements (animated fills, prediction overlay)
- Advanced leaderboard filters (by matchday range, competition phase)
- Pool templates (different scoring configs for different styles)
- PWA: installable web app with offline support for cached data

---

## Innovation ideas (unique to YancoCup)

These are differentiators that no competitor offers:

### "Prediction Heatmap"
For each match, show a visual heatmap of all predictions. X-axis: home goals (0-5). Y-axis: away goals (0-5). Each cell is colored by how many users predicted that score. The actual result is highlighted. Shows crowd wisdom vs reality.

### "Upset Radar"
Before each matchday, highlight matches where the community is heavily favoring one side. Mark them as "potential upsets" if historical data suggests the underdog has a chance. Users who correctly predict upsets get bonus points + a special badge.

### "Prediction Confidence"
When predicting, users can optionally set a confidence level (🔥 Sure Thing / 🤔 Risky Call / 🎲 Wild Guess). This doesn't affect points but:
- Gets displayed next to the prediction in pool view
- Creates social moments ("You said 🔥 Sure Thing and got it completely wrong")
- Aggregate confidence becomes interesting data

### "Matchday Atmosphere"
On matchday, the home page background subtly shifts to reflect match intensity:
- No matches: calm, standard background
- Matches upcoming: slight energy, countdown elements visible
- Matches live: ambient glow intensifies, notification badges active
- All matches done: "Results" mode, recap cards prominent

### "The Wall of Shame / Fame"
A weekly feature showing:
- **Wall of Fame:** Best predictions of the week (exact scores, upset calls)
- **Wall of Shame:** Worst predictions (most overconfident wrong picks)
- Users can opt in/out. Humorous, social, shareable.
