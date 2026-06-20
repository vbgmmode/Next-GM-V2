# Top 200 Roster Dataset

Dataset date: 2026-05-16

The Top 200 roster dataset is the active default draft dataset for Next GM. The source pool contained 336 performers, and the prepared output contains 200 ranked performers.

For the active draft pool, the source-balanced game-eligible Top 200 performers are available by default. Recalibrated exports carry `statCalibrationVersion` so runtime does not reapply the older Madden-like distribution pass. Raw, SmackDown, NXT, and AEW are equal major brands from the start, and NXT is not treated as developmental by default.

The CSV files distinguish sourced information from derived estimates. Roster membership, gender division, availability when stated, public championship fields when stated, and video-game overall ratings when available are sourced anchors. Detailed GM-simulation attributes are derived estimates for prototype gameplay and should not be treated as official factual ratings.

Files:
- `all_rosters_attributes_2026-05-16.csv`: canonical full source roster input for full-roster recalibration (336 performers). This file is required before replacing active roster artifacts.
- `active_draft_pool_2026-05-16.csv`: active in-game draft pool after stat calibration (200 performers).
- `top_200_draft_pool.generated.json`: active runtime draft pool imported by `src/game/top200DraftPool.ts` (200 performers).
- `top_200_superstar_ids.json`: minimal active draft-pool reference list with only `id` and `name`, sorted by draft rank.
- `top_200_roster_attributes_2026-05-16.csv`: ranked Top 200 performer attributes and source URL columns.
- `top_200_selection_methodology_2026-05-16.csv`: selection formula, source row count, output row count, and brand counts.
- `sources_and_methodology_2026-05-16.csv`: source URLs and sourced-vs-derived methodology note.

Source attributes versus game stats:
- `all_rosters_attributes_2026-05-16.csv` is the canonical source input. Its detailed attribute columns are calibration ingredients, not direct runtime fields.
- Columns `U:AZ` in the master source file remain source attributes. They include renewal risk, popularity components, in-ring components, promo components, fatigue/health inputs, morale/confidence inputs, and fit/style inputs.
- The recalibration script reads those source attributes and produces the visible runtime stats used by new games: `popularity`, `momentum`, `fatigue`, `morale`, `ringSkill`, and `promoSkill`.
- The game imports `top_200_draft_pool.generated.json`. It does not read the raw `U:AZ` source columns at runtime.
- In generated recalibrated CSV outputs, columns named `fatigue` and `morale` are calibrated game values. The original master source CSV preserves the raw input columns used to derive them.
- Runtime `matchRatings` are derived from the calibrated visible stats plus wrestler style/archetype through `src/game/matchRatings.ts`; they are not hand-authored in this roster pass.

Recalibration workflow:
- Run `npm run roster:recalibrate` only after restoring `all_rosters_attributes_2026-05-16.csv`.
- The recalibration tool writes report-first outputs under `data/rosters/recalibrated/`: full source, derived Top 200, derived active pool CSV/JSON, and a distribution/outlier report.
- Use `npm run roster:recalibrate:partial` only for local validation against the currently committed Top 200 file. Partial runs must not replace active gameplay data.
- To replace active artifacts after reviewing a full-source report, run `node scripts/recalibrateRosterStats.mjs --write-active`.

Current stat calibration targets:
- Active new games use a source-balanced Top 200: Raw, SmackDown, NXT, and AEW stay near parity while preserving open draft availability.
- Popularity is remapped with brand-aware bands so no source brand dominates the upper tier and NXT remains draft-viable. Current target averages keep NXT at least `76` while Raw, SmackDown, and AEW stay clustered in the high-70s.
- Ring skill, promo skill, momentum, morale, and fatigue are remapped after source scoring into playable draft-board distributions. Top 200 performers should be broadly draftable, with lower-card/prospect entries retaining growth room instead of collapsing into unusable ratings.
- Fatigue remains an inverted condition stat: higher values mean worse starting wear. It is intentionally low-centered at new-game start, with older, inactive, injury-risk, or recovery-limited performers allowed higher starting fatigue.

Active import rule:
- Include performers with `game_eligible` set to `Yes`.
- Exclude performers marked not game eligible.
- Do not filter by `brand`.
- Build the Top 200 as a source-balanced pool across Raw, SmackDown, NXT, and AEW; when a source brand has fewer eligible performers than its share, redistribute the shortfall across brands with available eligible rows.
- Include all 200 source-balanced performers in the active draft pool.
- Keep the runtime legacy stat distribution only as a fallback for old generated JSON without `statCalibrationVersion`.
- Map only the fields currently needed by the game state; keep broader source columns staged here for future bounded expansion.

Portrait assets:
- The active Top 200 portrait source order is `top_200_superstar_ids.json`: sheet order is left-to-right, top-to-bottom, 25 wrestlers per sheet.
- Generated source sheets are stored under `public/generated/top200-portrait-sheets/`; they are source atlases, not the runtime lookup path.
- Runtime superstar portraits live under `public/superstars/{portraitId}.png` as 234 x 234 square PNGs with visible gold frames and bottom name banners.
- `src/game/wrestlerPortraits.ts` maps wrestler ids to the runtime portrait filenames and owns any alias normalization, such as accent-safe file names.
- Portrait assignment does not alter save data, wrestler ids, draft order, or simulation state.
