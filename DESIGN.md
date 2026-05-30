# Next GM DESIGN.md

Canonical design contract for **player-facing UI work**. Read this before changing screens, layout, CSS, components, visual hierarchy, interaction states, or player-facing copy.

Next GM is a single-player wrestling GM game — not a generic web app. It should feel like running a televised brand from a live production command center, with tactical management clarity and a living universe that reacts **after** the player acts.

---

## How to use this file

| Who | Read |
|-----|------|
| **Agents (every UI ticket)** | [Agent Quick Contract](#agent-quick-contract) + the [Screen Contract](#screen-contracts) for the screen you are touching |
| **Humans / full audits** | Everything below, plus linked reference docs |
| **Visual tokens & layout detail** | [`docs/ui-broadcast-command-center-style.md`](docs/ui-broadcast-command-center-style.md) |
| **Product fantasy & taste** | [`docs/ui-ux-doctrine.md`](docs/ui-ux-doctrine.md) |
| **Repo behavior & verification** | [`AGENTS.md`](AGENTS.md) |
| **Implementation skill** | `next-gm-broadcast-ui` (Codex skill) |

---

## Agent Quick Contract

Non-negotiables. If a ticket conflicts with these, stop and ask.

### Feel

- Premium dark **sports broadcast command center** — franchise-mode clarity, draft-night tension, locker-room pressure.
- **Never** feel like: SaaS dashboard, admin panel, spreadsheet simulator, CRUD console with wrestling labels, marketing landing page, chatbot wrapper.
- Routine screens: tactical, fast, repeatable. Big moments (draft picks, title changes, PLEs, injuries, season review): **staged**, not flat data dumps.

### Player agency

- UI may warn, summarize, compare, and provide context. It must **not** decide for the player.
- Recommendations = staff input, not autopilot.

### Pre-show vs post-show (game integrity)

**Before Run Show**, show only current-state context, readiness, risk, and availability:

- May show: fatigue, morale risk, injury availability, title/rivalry context, card readiness, runtime, PLE timing, finance state, roster pressure.
- Must **not** show: predicted grades, fan reaction, social buzz, finance fallout, title outcomes, rivalry movement, morale changes, injury outcomes, or Open Challenge opponent identity.

**After resolution**, show consequences tied to resolved events — never invented offscreen story or pre-show buzz.

### Layout regions

Build every screen from command-center regions:

1. **Top HUD** — brand, GM, season, week, money, current show/mode, urgent status. Compact; brand accent as edge/glow/active cue.
2. **Primary stage** — main decision, selected object, or narrative beat.
3. **Side rail** — filters, nav, queues, pressure lists. Quieter than the stage.
4. **Tactical grid** — roster cards, segments, metrics, feeds, draft rows.
5. **Lower-third strip** — selected context, warnings, consequence framing.
6. **Bottom action bar** — Run Show, Advance Week, Confirm Pick, etc. when the screen is decision-heavy.
7. **Contained scroll panels** — long lists scroll **inside panels**, not the whole page.

Primary gameplay screens are **viewport-first**. Full-page scroll on a core screen is a design failure unless the active ticket explicitly allows it.

UI verification defaults to laptop/desktop viewports. Do **not** check mobile UI unless the active ticket explicitly asks for mobile behavior.

Do **not** add a duplicate bottom control-room footer rail unless the ticket asks for it.

### Visual system (summary)

- **Shape:** sharp rectangular panels, 0–8px radii, thin 1px borders, hard edges. No bubbly cards, soft SaaS surfaces, decorative blobs/orbs.
- **Color:** dark controlled base. Semantic status colors **always beat** brand skin color.
  - Red = heat, danger, blocked, injury pressure, rivalry intensity
  - Gold = prestige, championships, money, winners, premium moments
  - Green = healthy, ready, profit, success
  - Yellow/Orange = caution, fatigue, morale risk, incomplete card
  - Muted blue/cyan = neutral context, scouting
  - Brand skins (red, blue, gold, fight-gold) = HUD accent, active nav, selected state, CTA edge — **not** every panel or warning state
- **Typography:** display type for names/titles/headlines; UI type for controls/body; mono/data for stats/HUD. No negative letter-spacing, no viewport-scaled fonts, no tiny un hierarchy labels.
- **Density:** dense comparison screens are good; equal visual weight everywhere is bad. Metrics need interpretation, not just numbers.
- **Tokens:** use [`docs/ui/tokens/next-gm-brand-skins.tokens.yml`](docs/ui/tokens/next-gm-brand-skins.tokens.yml). No ad hoc colors/sizes unless the token system cannot express the role. Panel radii usually 0–3px; primary actions ~44px; panel padding ~12px.

### Interaction & motion

- Prefer: Select, Inspect, Assign, Confirm, Run Show, Book Segment, Advance Week, View Fallout, Start Next Season.
- Avoid: Submit, Config, Records, CRUD, Admin, Database.
- Every major action needs visible feedback (selected state, panel update, lower-third, feed item, consequence panel).
- Drag-and-drop must **never** be the only way to complete a core flow.
- Motion: short, purposeful, hierarchy-focused. Respect reduced-motion. No ambient animation that delays repeat management tasks.

### Assets

- Use real asset slots for portraits, belts, brand logos, show art, badges. CSS dummy portraits are not the production answer.
- Do not copy real-world logos, trademarks, or broadcast packages. Borrow category language, not protected assets.
- Do not add image assets, fonts, dependencies, or external services unless the ticket explicitly asks.

### Agent workflow

1. Read [`AGENTS.md`](AGENTS.md) and this file.
2. Read the [Screen Contract](#screen-contracts) for the screen you are changing.
3. Follow [`docs/ui-broadcast-command-center-style.md`](docs/ui-broadcast-command-center-style.md) and the brand skin tokens.
4. Start from existing screen patterns and the Brand HQ template (`docs/ui/screen-templates/brand-hq-command-center/index.html`).
5. Implement **only** the active ticket. Smallest clean change. No unrelated refactors.
6. Preserve deterministic simulation behavior unless explicitly asked to change it.
7. Verify UI work on laptop/desktop only unless mobile behavior is explicitly requested.
8. Keep the next player action obvious within **two seconds**.

### Default decision rule

When unsure: choose the option that feels more like a premium wrestling broadcast command center and less like a generic web dashboard.

Darken first. Add frame hierarchy before glow. Add useful context before decoration. Put consequences next to actions. Keep the player in charge.

---

## Screen Contracts

Each screen has one job. Match the contract for the screen you are building or redesigning.

### Title / Save Flow

**Purpose:** sell the wrestling GM fantasy before administration.

| Required | Avoid |
|----------|-------|
| Cinematic title-stage treatment | File-record UI |
| Franchise-save slots | Marketing-page hero layout |
| Continue / New Game / Reset Save | |
| Current career context when a save exists | |

### Setup / Contract Flow

**Purpose:** make the player feel hired, trusted, and under pressure.

| Required | Avoid |
|----------|-------|
| One emotional beat per step | Generic form wizard |
| Contract / rules / GM identity / brand / career preview / draft staged as career start | Admin setup language |
| Consequences framed as career identity, not hidden gameplay prediction | |
| Clear back/continue controls | |

### Brand HQ / Dashboard

**Purpose:** tell the player what needs attention next.

| Required | Avoid |
|----------|-------|
| Brand scoreboard | Passive chart dashboard |
| Next show focus | Equal-weight KPI cards |
| Urgent decisions | No obvious next action |
| Roster / champion / rivalry health | Duplicate bottom control-room footer rail |
| IWC pulse or world reaction | |
| Current show card or booking pressure | |
| Clear primary action | |

### Booking

**Purpose:** build a live television rundown.

| Required | Avoid |
|----------|-------|
| Segment list / rundown | Plain form builder |
| Selected segment composer | Prediction spam |
| Runtime target / current runtime | Hidden primary action |
| Broadcast heat gauge with green/yellow/red runtime zones | Red used before penalty risk |
| Production summary with planned cost, match/promo time share, and roster off-card coverage | Spreadsheet-like status strip |
| Talent / rivalry / title context | No selected segment hero |
| Rivalry coverage sized for five rivalries with compact matchup labels | Repeated off-card text that crowds names |
| Readiness and warnings | Predictive fallout language |
| Save / simulate / advance action clarity | |

**Pre-show rule:** readiness and risk warnings only.

### Results / Show Recap

**Purpose:** payoff and fallout.

| Required | Avoid |
|----------|-------|
| Broadcast recap headline | Dry summary |
| Show grade | No consequences |
| Segment / match ratings reel | Second competing operational headline recap |
| Focused Segment Receipt window from reel selection | Inline detail block that crowds the handoff |
| Fan / business impact | |
| Title / rivalry fallout | |
| IWC / social reaction | |
| Injuries / morale changes | |
| Compact GM handoff / next-week pressure | |
| Advance Week / Season Review action | |

### Show Recap Handoff

**Purpose:** close the weekly loop inside Show Recap before advancing.

| Required | Avoid |
|----------|-------|
| GM handoff | Invented offscreen story |
| What changed this week | |
| Roster fallout | |
| Title / rivalry updates | |
| Social buzz | |
| Next-week pressure | |
| Clear Advance Week / Season Review action | Full second recap screen |

Consequence language must be tied to **resolved events**.

### Draft

**Purpose:** televised war room under pressure.

| Required | Avoid |
|----------|-------|
| On-the-clock state | Static roster table only |
| Selected prospect hero | No rival pressure |
| Available talent board | No pick context |
| Rival brand flavor / pressure where state supports it | No budget tension |
| Budget pressure / readout | |
| Roster needs | |
| Scouting note | |
| Make selection CTA | |

Open draft availability is the default unless the ticket explicitly asks for restricted modes.

### Roster / Locker Room

**Purpose:** manage talent health, morale, contracts, momentum, and identity.

| Required | Avoid |
|----------|-------|
| Roster grid / table | Plain spreadsheet |
| Filters | No selected wrestler focus |
| Selected superstar workspace | No human / team consequences |
| Morale / fatigue / injury / chemistry / context | |
| Contract / cost context where state supports it | |
| Actions (rest, push, medical, manage) when implemented | |

### Wrestler Profile

**Purpose:** support GM decisions with character and history context.

| Required | Avoid |
|----------|-------|
| Wrestler identity and current status | Raw stat clutter without interpretation |
| TV history | Fabricated hidden truth |
| Pressure labels | Invented fallout |
| Championship / rivalry context | |
| Social mentions | |
| Concise GM read | |

### Championships

**Purpose:** manage prestige and title ecosystem.

| Required | Avoid |
|----------|-------|
| Belt / title cards | Text-only title list |
| Champion, prestige, reign length, defenses | No gold / prestige treatment |
| Contenders, title history, ecosystem health | No contender context |

Only **Match** title matches can change championships.

### Rivalries

**Purpose:** manage heat, story, stakes, and payoff.

| Required | Avoid |
|----------|-------|
| Active rivalry list | Generic relationship table |
| Selected rivalry spotlight | No heat trajectory |
| Heat / stakes / timeline | No payoff logic |
| Story composer, warnings, payoff target | No storyline identity |
| Movement explained retrospectively after resolved events | |

### Calendar

**Purpose:** orient the player on the road to PLE.

| Required | Avoid |
|----------|-------|
| Current week, go-home weeks, PLEs | Dumping ground for every alert |
| Completed shows, season milestones | |
| Clear next structural event | |

### Social / IWC

**Purpose:** living audience reaction after outcomes.

| Required | Avoid |
|----------|-------|
| Source / category labels | Pre-show buzz before reaction exists |
| Posts tied to actual resolved events | Infinite unstructured feed noise |
| Contained scroll | |
| Spicy but readable copy | |

### Finance

**Purpose:** clear, gamey, decision-focused money readout.

| Required | Avoid |
|----------|-------|
| Money, profit/loss, revenue, costs, pressure, trends | Accounting-software layout |
| Gold for value, green for positive, red for deficit/danger, yellow for caution | Complex projections unless requested |

### Season Review

**Purpose:** season-ending broadcast package and executive review.

| Required | Avoid |
|----------|-------|
| Actual gameplay history | Invented offscreen legacy |
| Season story summaries | Dry stat dump |
| Champions, rivalries, brand performance, finances | |
| Roster stories, social highlights | |
| Start Next Season action visible | |

---

## Hard No List

Do not ship:

- Generic SaaS dashboard or admin-form rhythm for creative actions
- Rounded bubbly cards, soft gradients, decorative blobs
- Pure brand-color wash across the whole screen
- Full-page scrolling on core game screens
- Emoji icons in production UI
- Placeholder art treated as final
- Unclamped text overflow or clipped panel content
- Empty panels with one stat; equal visual weight everywhere
- Mobile card-stack layout as the desktop game UI
- Prediction UI before the show resolves
- Hidden primary actions
- One-off CSS that should be a reusable token or component

---

## Review Checklist

Before considering UI work done:

**Vibe** — broadcast command center, not SaaS/admin. Console sports-management feel.

**Layout** — viewport-first; scroll in contained panels; one clear primary workspace; secondary panels quieter; next action obvious.

**Visual** — red as signal not wallpaper; gold for prestige; green for positive; yellow/orange for warning; panel tiers distinct; brand vs semantic color separation correct.

**Information** — what is selected, urgent, changed, actionable, and consequential?

**Production** — real asset slots; SVG/component icons; prestigious title treatment; no empty black boxes.

**Quality** — no clipped/overflowing text; no full-page scroll introduced; no CSS one-offs that belong in tokens.

Verification commands and smoke-test flows live in [`AGENTS.md`](AGENTS.md).

---

## Full reference docs

Use these for detail this file intentionally does not duplicate:

| Topic | Doc |
|-------|-----|
| Product fantasy & experience principles | [`docs/ui-ux-doctrine.md`](docs/ui-ux-doctrine.md) |
| Layout DNA, shape, color, typography, components, motion | [`docs/ui-broadcast-command-center-style.md`](docs/ui-broadcast-command-center-style.md) |
| Visual contract & booking workspace expectations | [`docs/playable-new-gm-mode-visual-design-contract.md`](docs/playable-new-gm-mode-visual-design-contract.md) |
| Brand skin tokens | [`docs/ui/tokens/next-gm-brand-skins.tokens.yml`](docs/ui/tokens/next-gm-brand-skins.tokens.yml) |
| Runnable screen template | [`docs/ui/screen-templates/brand-hq-command-center/index.html`](docs/ui/screen-templates/brand-hq-command-center/index.html) |
| Agent repo rules & build verification | [`AGENTS.md`](AGENTS.md) |
