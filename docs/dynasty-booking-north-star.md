# Dynasty Booking — North Star Handoff (Codex)

**Status:** Locked decisions from product grill (2026-05-23)  
**Purpose:** Single source of truth for Codex sessions migrating Next GM booking to the Dynasty desk pattern.

---

## Goal

Make **Dynasty booking UI** the visual north star for Next GM: full Dynasty skin over time, booking leads the wave. **Do not change game mechanics** — same `@game` rules, handlers, validation, and persistence.

---

## Locked decisions

| Topic | Decision |
|-------|----------|
| Visual scope | Full Dynasty skin everywhere eventually; **booking leads** |
| Mechanics | **Domain frozen** (`@game`, sim, persistence) + **interaction parity** (same player actions/outcomes as V2 today) |
| Repo strategy | **V2 = home**; **Dynasty repo = lab** for faster UI iteration |
| Production ship | **One screen at a time**; booking first (old/new visual seam on other screens is OK temporarily) |
| Screen order after booking | **Sprint-driven** — no fixed queue |
| Booking completion gate | **Finish booking interaction-complete before any other screen migrates** |
| Layout rule | **Desk skeleton** (left rail → center hero → right context → bottom strip) for **production/editing screens** only; Dashboard keeps its own 3-column HQ |
| Board vs setup | **Unified desk** replaces V2 board/setup mode toggle (same mutations, better IA) |
| Ticket #2 merge | **Hybrid A/B** — graft Dynasty wins onto existing V2 booking; do **not** full rewrite |
| Shell | **V2 top bar is standardized** — logo, KPI widgets, nav tabs are **out of scope**. All work is **content below the nav** |

---

## Shell boundary (critical)

The following are **already standardized in V2** and must **not** be modified by booking tickets:

- Broadcast header (logo, season/week, budget, fans, ranking, CTA widget)
- Horizontal nav tabs (`GameNav`)
- Theme class application on shell root (unless explicitly a separate shell ticket)

Dynasty `DynastyShell` in the lab repo is **reference only** for body panels — not for replacing V2 chrome.

---

## Codex guardrails (DO NOT)

1. **No `@game` changes** — scoring, readiness, smart rundown algorithm, segment validation, persistence, week advance, sim
2. **No new predicted pre-show outcomes** — grades, crowd heat, merch buzz, fan reaction, finance/title/rivalry movement forecasts
3. **No header/nav/shell edits** — work below nav only
4. **No other screen migrations** until booking is interaction-complete on V2
5. **No board/setup mode toggle** in the unified desk
6. **No duplicate handler implementations** — extract once, import everywhere
7. **No full booking rewrite** — hybrid merge only (see must-ship vs keep)

---

## Ticket sequence

Run these **sequentially across sessions** (lower risk), or as **one combined session** (see below).

### Combined session (Tickets #1–3 at once)

Use when you want Codex to execute the full migration in a single run. Work still happens in **phase order** — extract → merge → cleanup — but ships as one PR.

**When to use:** You have time for a large review; `npm run build` and manual booking QA ready after.

**When to split:** If the session hits context limits, stop after Phase 1 and resume with Ticket #2 stub.

#### Phase order (same session)

1. **Phase 1 — Extract** (Ticket #1): `src/booking/*` from `App.tsx`; verify behavior unchanged
2. **Phase 2 — Merge** (Ticket #2): Promote Dynasty components + `buildBookingModel` + `booking.css`; wire unified desk below nav
3. **Phase 3 — Cleanup** (Ticket #3): Delete dead `booking-command-*` UI/CSS; update this doc with final paths

#### Combined acceptance (all phases)

- [ ] All Ticket #1, #2, #3 acceptance items below
- [ ] Single booking code path in V2 (no legacy + Dynasty duplicate markup)
- [ ] `npm run build` passes
- [ ] Header/nav unchanged from pre-migration V2

---

### Ticket #1 — Extract booking mechanics (V2, no visual change)

**Goal:** Pull `BookingScreen` handlers and inline `SegmentComposer` out of `src/App.tsx` into shared modules. Behavior identical on `:5174`.

**Suggested targets:**

```
src/booking/
  bookingHandlers.ts      # or split by concern
  SegmentComposer.tsx     # extracted from App.tsx ~8201+
  bookingTypes.ts         # props/callback contracts
  index.ts
```

**Acceptance:**

- [ ] V2 booking at `:5174` behaves identically before/after (CRUD, smart rundown, run show, validation alerts)
- [ ] `App.tsx` BookingScreen reduced to thin wrapper importing extracted modules
- [ ] No CSS/markup changes intended in this ticket
- [ ] Build + existing QA harness pass

---

### Ticket #2 — Hybrid Dynasty merge (V2 body only, below nav)

**Goal:** Graft Dynasty lab wins onto V2 booking. Keep V2 editing controls where they are stronger. Unified desk (no mode toggle).

#### Must-ship from Dynasty lab

| Artifact | Dynasty source | Action |
|----------|----------------|--------|
| View model | `Dynasty/src/adapters/buildBookingModel.ts` | Promote to V2 (or shared path) |
| Segment rail | `BookingSegmentRail.tsx` | Wire to extracted handlers + selection state |
| Composer hero | `BookingComposerStage.tsx` | VS promo stage for selected segment |
| Status strip | `BookingStatusStrip.tsx` | Structural warnings/totals/balance only |
| Styles | `Dynasty/src/styles/booking.css` | Scope to booking body; no shell overrides |

#### Keep from V2 (post-extraction)

- `SegmentComposer` editing controls (duration, talent, stipulation, title/rivalry pickers)
- Readiness/risk panels if richer than Dynasty `BookingContextRail`
- Handler flow: smart rundown, run show, `getBookingReadiness` gates

#### Optional / fast-follow

- Dynasty roster snapshot in right rail (if V2 risk board sufficient)
- Further density CSS tuning

**Acceptance:**

- [ ] 1280×720 — no document scroll; contained panel scroll only
- [ ] Full segment CRUD parity with pre-extraction V2
- [ ] Unified desk: left rail selection updates center hero + editing surface
- [ ] No board/setup toggle
- [ ] Top header + nav unchanged from standardized V2
- [ ] No pre-show outcome prediction UI
- [ ] Brand theme accents via existing `broadcast-theme-*` / `--dynasty-accent-rgb`

---

### Ticket #3 — Cleanup + handoff package

**Goal:** One booking UI path; document pattern for next screens.

**Cleanup (A):**

- [ ] Remove dead V2 `booking-command-*` markup/CSS replaced by Dynasty pieces
- [ ] No duplicate booking components in `App.tsx`
- [ ] Dynasty lab updated to import from V2 shared modules (optional sync pass)

**Handoff (C):**

- [ ] Update this doc with final file paths after Tickets #1–2
- [ ] Update `next-gm-broadcast-ui` skill (or add `dynasty-north-star` skill) with desk pattern rules
- [ ] Add “next screen” ticket template (Dashboard, Results, etc.)

---

## Desk pattern (for future production screens)

Use on **Booking, Rivalries, Draft setup, Market** — not Dashboard HQ, not simple feeds (Calendar, Social).

```
┌─────────────────────────────────────────────────────────┐
│  V2 STANDARD SHELL (DO NOT TOUCH)                       │
│  header KPIs + nav tabs                                 │
├──────────┬──────────────────────────────┬───────────────┤
│ Left rail│ Center hero stage            │ Right context │
│ (list/   │ (selected object + primary   │ (readiness,   │
│  queue)  │  action / composer)          │  pressure)    │
├──────────┴──────────────────────────────┴───────────────┤
│ Bottom status strip (warnings, totals — structural only)│
└─────────────────────────────────────────────────────────┘
```

---

## Dynasty lab reference paths

| File | Role |
|------|------|
| `Next GM Dynasty/src/scenes/BookingScene.tsx` | Desk orchestration |
| `Next GM Dynasty/src/adapters/buildBookingModel.ts` | View model |
| `Next GM Dynasty/src/components/Booking*.tsx` | Rail, composer, context, strip |
| `Next GM Dynasty/src/styles/booking.css` | Desk layout + density |

## V2 production reference paths

| File | Role |
|------|------|
| `Next GM V2/src/App.tsx` | `BookingScreen`, inline `SegmentComposer` (extract in #1) |
| `Next GM V2/src/styles.booking-command.css` | Legacy booking styles ( prune in #3) |
| `Next GM V2/docs/ui/dynasty-migration-mvd.md` | Broader migration context |

---

## Validation checklist (every booking ticket)

- [ ] 1280×720 and 1100×720 — no horizontal scroll, no page scroll
- [ ] Pre-show / post-show information boundaries (`DESIGN.md`)
- [ ] Same save behavior after mutations
- [ ] Shell/header/nav pixel-stable vs before ticket
- [ ] Selected segment obvious within 2 seconds
- [ ] Doctrine: structural warnings only in status strip

---

## Codex prompts

### Combined (Tickets #1–3 at once) — recommended for one-shot

```
Read docs/dynasty-booking-north-star.md fully before coding.

Execute Phases 1–3 in one session (single PR):

PHASE 1 — EXTRACT (Ticket #1)
- Pull BookingScreen handlers + SegmentComposer out of src/App.tsx into src/booking/
- No visual/CSS changes in this phase; behavior must match current :5174 booking exactly
- App.tsx BookingScreen becomes a thin wrapper

PHASE 2 — HYBRID MERGE (Ticket #2)
- Work ONLY below the standardized V2 header + nav (do not touch shell)
- Promote from Next GM Dynasty lab:
  - buildBookingModel.ts → src/adapters/ or src/booking/
  - BookingSegmentRail, BookingComposerStage, BookingContextRail, BookingStatusStrip
  - booking.css (scoped to booking body)
- Hybrid rule: graft Dynasty must-ships; KEEP extracted SegmentComposer editing controls
- Unified desk: left rail + center hero + right context + bottom strip
- NO board/setup mode toggle
- NO pre-show outcome prediction UI

PHASE 3 — CLEANUP (Ticket #3)
- Remove dead booking-command markup/CSS replaced by Dynasty pieces
- Update docs/dynasty-booking-north-star.md with final file paths
- Optional: add pointer in Dynasty/docs/CODEX-BOOKING-HANDOFF.md

GUARDRAILS (entire session):
- No @game / sim / persistence changes
- No header, nav, or shell edits
- No duplicate handler logic — extract once, wire everywhere
- No other screen migrations

VALIDATE before finishing:
- npm run build
- 1280×720 booking: no page scroll, segment CRUD works, smart rundown + run show work
- Header/nav pixel-stable vs before
```

### Per-ticket (split across sessions)

```
Read docs/dynasty-booking-north-star.md first.

Ticket: [ #1 | #2 | #3 ]
Scope: [extract | hybrid merge | cleanup+doc]

Guardrails: no @game changes, no shell/header/nav edits, no pre-show outcome
prediction, work below nav only, hybrid merge not full rewrite.

Acceptance: see ticket section in north-star doc.
```
