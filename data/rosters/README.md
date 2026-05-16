# Top 200 Roster Dataset

Dataset date: 2026-05-16

The Top 200 roster dataset is the active default draft dataset for Next GM. The source pool contained 336 performers, and the prepared output contains 200 ranked performers.

For the active draft pool, all game-eligible Top 200 performers are available by default. Source or current brand does not restrict draft availability. Raw, SmackDown, NXT, and AEW are equal major brands from the start, and NXT is not treated as developmental by default.

The CSV files distinguish sourced information from derived estimates. Roster membership, gender division, availability when stated, public championship fields when stated, and video-game overall ratings when available are sourced anchors. Detailed GM-simulation attributes are derived estimates for prototype gameplay and should not be treated as official factual ratings.

Files:
- `top_200_roster_attributes_2026-05-16.csv`: ranked Top 200 performer attributes and source URL columns.
- `top_200_selection_methodology_2026-05-16.csv`: selection formula, source row count, output row count, and brand counts.
- `sources_and_methodology_2026-05-16.csv`: source URLs and sourced-vs-derived methodology note.

Active import rule:
- Include performers with `game_eligible` set to `Yes`.
- Exclude performers marked not game eligible.
- Do not filter by `brand` or `source_brand`.
- Map only the fields currently needed by the game state; keep broader source columns staged here for future bounded expansion.
