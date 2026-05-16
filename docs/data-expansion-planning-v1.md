# Data Expansion Planning v1

## Status

Phase 1 world-aliveness/read-only diagnostics is complete, and the project is entering **Data Expansion Planning v1**.

Recommended next step is planning gate, not implementation:

- No new datasets are added in this ticket.
- No gameplay mechanics are introduced in this ticket.
- No persistence/migration or simulation shape changes are introduced in this ticket.

## 1) Current Phase

Current phase: **Data Expansion Planning v1** (following completion of:
Rival Brand Foundation v1, Tag Team / Affiliation Foundation v1, Match Format Metadata Foundation v1,
PLE Readiness Checklist v1, Post-Show Cause Ledger v1, Title Scene Pressure v1,
Rivalry Payoff Window v1, Brand Pulse v1, and Non-Blocking Rival Draft Activity v1).

## 2) Why This Planning Gate Exists

This planning gate exists to prevent random content bloat and protect the solo loop:

- keep the loop stable (title → setup → draft → Week 1 → booking → run show → results → week review → advance)
- avoid accidental changes to scoring, simulation, persistence, or validation
- keep the product feeling like a premium wrestling GM broadcast command center rather than a content dump
- keep any future content changes bounded, reviewable, and reversible

## 3) Candidate Expansion Lanes

Evaluate these lanes before implementation:

- Wrestler identity/context expansion
- Social/IWC flavor expansion
- Finance/market flavor expansion
- Rivalry premise/story-beat text expansion
- Championship lineage/prestige flavor expansion
- Draft scouting/role labels
- Season archive/legacy flavor

## 4) Recommended First Expansion Lane

**Recommended first lane: Wrestler identity/context expansion.**

Rationale:

- It raises signal across Draft Night, Roster, Booking, Profiles, Rivalries, Championships, and social interpretation without modifying gameplay outcomes.
- It is bounded and reversible because it is mostly display-layer schema additions.
- It benefits player agency and flavor recognition while preserving deterministic simulation.

## 5) Proposed First-Pass Size Budget

For the first pass:

- Expand identity/context fields for existing roster entries only.
- **No new wrestlers.**
- Add only a small number of lightweight context fields (initially 4–6 total fields across the identity model).
- No new large flavor pools or bulk copy expansion.
- No mechanics attached to any new fields in first pass.

## 6) Allowed First-Pass Data Shape

Only non-mechanical context fields are allowed in Data Expansion v1, and only as metadata/display context:

- role/archetype
- alignment
- wrestling style
- promo style
- presentation hook
- career-stage label

No field in this lane must affect draft sort, booking validity, rivalry movement, title logic, social scoring, finance, injuries, morale, or simulation state.

## 7) Future Ticket File Boundaries (Suggested)

Likely file surface for a future bound implementation ticket:

- roster/data source file(s) for actor metadata
- type definitions for new identity fields
- targeted migration or migration fallback if saved snapshots need compatibility
- presentation surfaces only (Roster/Profile/Draft, if scoped)

No router, backend, or state-shape rewrite is part of this lane.

## 8) Explicitly Forbidden During Planning

The following are explicitly out of scope during this planning stage:

- No new wrestlers, tag booking, tag titles, CPU rival simulation, contracts/free agency, payroll enforcement, or venue selection.
- No new screens.
- No router, Tailwind, backend, cloud, auth, multiplayer, or multiplayer-like systems.
- No save-slot redesign.
- No scoring/finance/social/title/rivalry formula changes.
- No gameplay, persistence, or migration modifications.

## 9) Required Safeguards for the Eventual Implementation Ticket

When this planning is converted into implementation, require:

- legacy/missing-field fallbacks
- existing saves continue to load safely
- Top 200 draft pool remains stable
- booking validation unchanged
- simulation formulas unchanged
- no outcome spoilers before run show
- app typechecks and builds
- smoke test through New Game → Draft Review → Booking → Run Show → Results → Week Review → Advance Week loop

## 10) Recommended Next Bounded Slice

**Next slice: Wrestler Identity Context v1**

- Scope: display-only identity/context fields for existing roster entries only.
- Limits: no mechanics, no persistence changes beyond fallback-safe schema handling if needed, no simulation impact.
- Objective: increase roster intelligibility and flavor without changing match outcomes, booking permissions, or league dynamics.
