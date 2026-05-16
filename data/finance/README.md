# Finance Catalogs

This folder owns the static finance-planning CSV catalogs for future finance model slices.

Current scope:
- Preserve the raw source catalogs in-repo.
- Keep the catalogs out of gameplay until an accepted implementation ticket wires a specific slice.
- Use `src/game/financeCatalog.ts` for typed parsing, static lookups, and Top 200 ID mapping validation.

These catalogs do not currently change setup, draft, booking, show results, finance reports, saves, or balance.
