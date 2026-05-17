# Stipulation Metadata Planning v1

## 1) Why stipulation metadata belongs next

The current card simulation is stable with core match formats, title/rivalry flow, and diagnostic safety rails already in place.  
A stipulation metadata layer is the smallest next step because it can improve card communication and GM choice clarity without changing how outcomes are produced.

Priority for this phase:
- Preserve offline-playability and deterministic post-show fallout.
- Preserve the “consequence-after-run” doctrine in Booking.
- Improve pre-show framing and post-show clarity for special matches.
- Keep all changes read-oriented and metadata-first in this slice.

## 2) First safe stipulation variants

Start with two to three small entries:

1. **No Disqualification**
   - Lowest risk to route this in first.
   - Mostly advisory context in UI.
   - Easy to represent as risk/expectation metadata.

2. **Steel Cage**
- Strong broadcast-read value with simple metadata cues.
- Suitable as “special attraction” framing.
- No outcome branch is required for v1.

3. **Submission Match**
   - Useful for narrative variety and feud pacing.
   - Initially applied as style/risk metadata.
   - Winner resolution remains unchanged.

Implementation lane v1 remains metadata-only unless a later ticket explicitly upgrades one stipulation into mechanical behavior.

## 3) Metadata representation (no engine rewrite)

Use a lightweight, optional spec object attached to a match segment only:
- `stipulationId`: stable string key (e.g., `nostar`, `steel_cage`, `submission_match`)
- `stipulationLabel`: human label
- `stipulationTier`: `minor | signature | high_stakes`
- `presentationalRisk`: enum tags for advisory UI (`blowoff_style`, `rivalry_escalation`, `title_worthy`, `high_physical_risk`)
- `allowedMatchScope`: `singles | tag | any`
- `requiresTitleLane`: optional boolean if the match is intentionally presented as title-framed (future-use only)
- `notes`: non-prediction operational notes for pre-show context

All fields remain optional and non-blocking where possible so old saves and older code paths continue functioning even without the new data.

## 4) Match format attachment in v1

Use existing match format constraints to avoid format-specific outcome branching:

- `No Disqualification`
  - Allowed: singles matches, M020 tag matches
- `Steel Cage`
  - Allowed: singles matches, M020 tag matches
  - Presentation-only initially.
- `Submission Match`
  - Allowed: singles matches only in v1
  - Reason: safer for first pass to avoid team-level framing assumptions.

Do **not** introduce new match formats in this ticket.  
Keep stipulations as metadata overlays on existing formats.

## 5) Booking pre-show UI disclosure (no spoilers)

Pre-show booking may show only operational framing:
- higher physical risk
- blowoff-style match
- title-worthy presentation
- rivalry escalation flavor
- special attraction feel

Pre-show must not show:
- predicted grades
- predicted crowd reaction
- predicted finance impact
- predicted social reaction
- predicted rivalry movement
- predicted title outcome
- predicted injury outcome
- predicted morale impact

## 6) Results / Week Review post-show disclosure

Once the show resolves, add or keep read-only labels based on:
- selected stipulation + chosen participants
- actual segment result
- existing fallout/impact data already produced by the engine

Allowed post-show additions are descriptive and explanatory only, for example:
- “Cage booking generated a high-intensity lane and elevated story context.”
- “NoDQ lane carried a high-violence profile.”
- “Submission framing added a clear end-state contrast for this feud stage.”

Do not retrofit stipulation outcomes (e.g., disqualification logic, escape logic, submission-specific reversal logic) in v1.

## 7) Validation rules for v1

- Match must have one compatible format when stipulation is chosen.
- Prevent UI-only invalid pairings only:
  - disallow stipulation for formats outside its `allowedMatchScope`
  - prevent multiple conflicting stipulations on the same segment
  - prevent title-only-only flags from silently being implied by metadata
- Keep winner calculation logic untouched:
  - No new eligibility checks for post-result enforcement in v1.
- Keep defaults safe:
  - No stipulation = normal match behavior.

## 8) State/persistence risks

Primary risks are:
- missing values in older saves
- partial new metadata fields in legacy serialized segments
- UI reads over optional fields without null checks

Risk controls:
- Add fields as optional.
- Use default fallbacks and tolerant read paths.
- Never require stipulation metadata to run booking or simulation.
- Keep all derived/readout fields non-authoritative.

## 9) Migration/fallback behavior for older saves

No migration required in v1.
- Older saves without stipulation data should render exactly as current behavior.
- If a segment/entry lacks stipulation metadata, UI should treat it as default/no-stipulation.
- If malformed spec appears, silently ignore unsupported attributes and show safe defaults.

## 10) Files likely touched by a future implementation slice

Expected future ticket likely touches:
- `src/App.tsx` (Booking match metadata selectors/readout + optional results labels)
- `src/game/types.ts` (optional typings for match segment stipulation metadata)
- `src/game/matchFormatCatalog.ts` (if format compatibility gating is centralized there)
- `src/game/titleCatalog.ts` or `src/game/seed.ts` (if title-level defaults are introduced later)
- `src/styles.css` (new diagnostic/status chip styling)
- optional static data file for stipulation catalog

No source behavior changes in this planning slice.

## 11) Future implementation acceptance tests

- Existing saves load and continue.
- Booking for singles and M020 tag cards continues unchanged when no stipulation is selected.
- Pre-show UI can select/show allowed stipulations without predicted fallout.
- Invalid stipulation-format combinations are blocked in Booking UI.
- Multiple stipulations do not co-exist on one segment in first pass.
- Simulation results remain unchanged (existing winner/fallout behavior).
- Results and Week Review remain unchanged except safe descriptive text.
- Refresh persistence works across sessions.
- No new team objects, rankings, or title-engine rewrites required.
- Core playable loop remains: New Game/New setup → Draft Review → Dashboard → Booking → Run Show → Results → Week Review → Advance Week.

## 12) Explicit out-of-scope for v1

- complex stipulation-specific outcome logic
- blood/weapons/interference
- escape/submission math changes
- manager mechanics
- faction mechanics
- injury or morale/fatigue rewrites
- freebird rule or team-stat systems
- social generation expansion
- finance, scoring, rivalry, or title-rule rewrites
- match-format additions
- new screens
- persistence schema change or migration churn
- broad redesign of Booking, Results, or Week Review

## Recommended next smallest implementation slice after planning

After this planning document, the next smallest implementation ticket should be:
- **Stipulation Metadata Catalog + Booking selection scaffolding** for:
  - No Disqualification
  - Steel Cage  
  - Submission Match
- metadata-only attachment on existing singles and M020 matches, with strict format gating and no simulation changes.
