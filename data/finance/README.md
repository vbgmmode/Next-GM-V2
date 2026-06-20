# Finance Catalogs

This folder owns the static finance CSV catalogs used by setup, draft, market, booking production, and finance-report readouts.

Current scope:
- Preserve the source/calibration catalogs in-repo.
- Use `src/game/financeCatalog.ts` for typed parsing, static lookups, and Top 200 ID mapping validation.
- Keep the Economy v5 roster-value catalog aligned to `data/rosters/top_200_draft_pool.generated.json`.

Economy v5 keeps the standard Money Based start at $2M while pricing a balanced 20-person opening roster with operating room for production, market decisions, and future support systems.
