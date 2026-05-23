# Top 200 Roster Dataset

Dataset date: 2026-05-16

The Top 200 roster dataset is the active default draft dataset for Next GM. The source pool contained 336 performers, and the prepared output contains 200 ranked performers.

For the active draft pool, game-eligible Top 200 performers are available by default, then `src/game/top200DraftPool.ts` applies a light source-brand cap so the draft board does not become dominated by one source roster. The active export also applies Madden-like stat distribution so prototype ratings have wider spread, rarer elite peaks, and clearer weaknesses while preserving the relative source order. Raw, SmackDown, NXT, and AEW are equal major brands from the start, and NXT is not treated as developmental by default.

The CSV files distinguish sourced information from derived estimates. Roster membership, gender division, availability when stated, public championship fields when stated, and video-game overall ratings when available are sourced anchors. Detailed GM-simulation attributes are derived estimates for prototype gameplay and should not be treated as official factual ratings.

Files:
- `active_draft_pool_2026-05-16.csv`: active in-game draft pool after source-brand caps and stat calibration (120 performers).
- `top_200_roster_attributes_2026-05-16.csv`: ranked Top 200 performer attributes and source URL columns.
- `top_200_selection_methodology_2026-05-16.csv`: selection formula, source row count, output row count, and brand counts.
- `sources_and_methodology_2026-05-16.csv`: source URLs and sourced-vs-derived methodology note.

Active import rule:
- Include performers with `game_eligible` set to `Yes`.
- Exclude performers marked not game eligible.
- Do not filter by `brand`.
- Apply the active source-brand cap in `src/game/top200DraftPool.ts`; the current cap limits AEW to its first 35 eligible ranked entries while keeping all current Raw, SmackDown, and NXT entries.
- Apply Madden-like stat distribution in `src/game/top200DraftPool.ts` before exporting the active draft pool; the CSV keeps the staged source-derived estimates.
- Map only the fields currently needed by the game state; keep broader source columns staged here for future bounded expansion.
