# Read-Only Contract Value Profiles Planning v1

## 1) Why read-only contract/value context belongs next

The game loop is stable, and core systems are protected from major economic rewrites in this phase. The next safest lane for career depth is to introduce **read-only contract/value context** as a GM decision-support lens only.

This keeps the offline single-player feel intact:
- no new simulation rules
- no payroll enforcement
- no contract actions (sign/release/renew/free agency)
- no predictive finance promises

It increases player agency by making roster composition and talent pacing choices feel more intentional before booking, while keeping outcomes and fallout systems unchanged.

## 2) Player decision support this context should enable

The value profile layer should help with these in-session decisions:
- Which underused talents are still too valuable to risk in low-stakes bookings.
- Which expensive performers should be protected during injury/fatigue recovery windows.
- Which draft picks create long-term roster value concentration risk versus depth.
- Which rivalries can be protected or accelerated based on talent value profile.

It should not instruct the player to "must book" or "must spend" around a performer. It is a dossier signal, not a command system.

## 3) Safe existing data we can use now

Use read-only data already present in the project:
- `data/finance/roster_draft_and_contract_values_top_200_no_bonus_full_season_2026-05-16.csv`
  - includes `draftValueUsd`, `weeklyHireRateUsd`, `valueFormulaVersion`, and `valueNotes`.
- `src/game/financeCatalog.ts`
  - typed finance catalog access and parsed rows.
- Existing Top 200 roster/identity mapping
  - used to join values onto roster cards and wrestler profiles via existing identity keys.
- Existing finance summary/report fields
  - only when displayed as context, not as deterministic budget optimization.

No source-of-truth contract length, payroll cap, or active economics must be introduced in this lane.

## 4) Screens to surface first

Primary order (minimal lane):
1. **Wrestler Profile**
   - Add a value context block with 2–3 chips/labels and one short rationale line.
2. **Roster card (optional, only if it remains legible)**
   - Compact one-line tier pill or tiny color token near existing pressure/label areas.
3. **Finance screen (optional, contextual only)**
   - Add a short “talent value pressure” note block driven by aggregate read-only roster profile, not by hard constraints.

No new screens are added.

## 5) Labels / tiers to use without paywalling mechanics

Start with a safe, non-binding taxonomy:
- **Bargain Workhorse**
- **Rising Value**
- **Premium Draw**
- **Main Event Investment**
- **High-Cost Attraction**
- **Risky Spend**

Mapping approach:
- derive from `draftValueUsd` and `weeklyHireRateUsd` bands
- clamp to 5–6 values to avoid noise
- allow an explicit fallback label when data is missing (for future robustness)

Do not expose fine-grained salary promises or deterministic savings calculations.

## 6) How to avoid accounting/SaaS feel

- Use GM dossier language, not ledger math language.
- Present as scouting/strategic context, not optimization output.
- Show only concise, human labels and short rationale.
- Avoid dense tables, spreadsheets, filters that force a “resource allocator” loop.
- Keep the player anchored in broadcast/brand pressure terms even when showing value.

## 7) Preserve player agency

- Never auto-disable segments or force alternate booking paths based on value.
- Never require minimum/maximum value checks for booking, rostering, or show flow.
- Keep booking decisions available; value context only informs, never blocks.
- Ensure all suggestions are non-actionable hints and can be ignored.

## 8) Retrospective / contextual only (no prediction)

Keep all text and UI state read-only and retrospective/contextual:
- no predicted ROI, no projected week profit, no exact future injury/morale impacts
- no guaranteed reaction/grades tied to value tier
- no contract expiry or renewal probabilities
- no deterministic future availability warnings beyond what existing systems already compute

Any high-value signal tied to outcomes must remain a post-show readout context, not a forecast gate.

## 9) State / persistence risks

Risks:
- older saves without value profile linkage
- missing contract-value rows for draft/ranking edge cases
- null/partial data causing empty labels or inconsistent order

Mitigations:
- keep all profile display fields optional and defensive
- derive from existing roster/finance maps with tolerant fallbacks
- no additional required persisted state
- if data missing, show neutral context and continue gameplay unchanged

No save schema changes in this planning slice.

## 10) Migration / fallback

No migration required for this planning ticket because no persistent state is added.

Future implementation ticket should include optional migration/fallback behavior:
- safe default profile state for older/newer saves
- one-time warning fallback for unmapped wrestlers
- idempotent label generation so reads remain stable across catalog updates

## 11) Likely files a future ticket would touch

Expected future source surfaces:
- `src/game/financeCatalog.ts` (lookup/validation helpers for value rows)
- `src/game/top200DraftPool.ts` (if profile mapping is enriched in draft context)
- `src/game/types.ts` (optional typed profile label structures)
- `src/app/` booking/dashboard/wrestler profile components for presentational chips
- `src/styles.css` (minimal tokens/chips, no redesign)
- `src/game/` utilities for deterministic tier bucketing (pure helpers)

This planning ticket itself does not implement any of these files.

## 12) Acceptance tests for future implementation ticket

- Start New Game and reach Wrestler Profile without source changes to booking/booking outcomes.
- Wrestler Profile displays a value tier label for a sampled roster performer.
- Value labels appear as copy-only context (no booking restrictions).
- Roster cards optionally show a compact, non-blocking value signal when enabled.
- Finance screen context shows aggregate value pressure as one-line retrospective framing.
- Existing saves load and continue.
- Core loop remains: New Game → Dashboard → Booking → Run Show → Results → Week Review → Advance Week.
- Refresh persistence and Continue Career still function identically.
- No change in winner resolution, rivalry movement, title resolution, finance formula output, injury formulas, morale/fatigue/momentum, or save compatibility behavior.

## 13) Explicit out-of-scope

For this planning lane:
- No contract lengths, negotiation, signing/release, renewal, free agency, payroll enforcement, or rosters limits.
- No segment locking, booking locks, or segment gating from value tiers.
- No hard finance forecasting tied to individual talent.
- No new mechanics for morale, rivalry, injury, social, scoring, rivalry, or titles.
- No source migration changes in this ticket.
- No behavior changes to existing systems.

## Recommended first implementation slice after this plan

1. Add read-only value tier display to Wrestler Profile.
2. Optionally add a compact roster card token, only if it does not increase clutter.
3. Optionally add one minimal finance pressure line in existing finance context.
4. Keep all behavior behind non-breaking, display-only, no-persistence changes.
