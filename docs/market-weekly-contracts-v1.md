# Market Weekly Board and Contract Loop v1

## Intent

Make Market feel like a weekly GM desk instead of a full free-agent database. Each week should present a small, fixed market window, real rival pressure, current-contract decisions, and clear prepaid contract math.

## Player Rules

- Market shows a weekly board of 0-6 superstars.
- The weekly board is generated deterministically for the active season/week and persists in the save.
- Week 1 receives a board when a new career starts.
- Advancing the week generates the next board.
- Reloading or Continue must not reshuffle the board.
- Signing a talent does not reshuffle the board.
- Player market actions lock after the current week's show has been run.
- The weekly board has no search, sort, or heavy filters.
- A quiet board week should still leave Market useful through renewals, releases, trade wire, office pressure, and transaction feed.

## Board Entry States

- Available: player can negotiate and sign if roster/cash/action locks allow.
- Signed by rival: row is greyed out, reveals the rival brand, and is not negotiable.
- Signed by player: row remains visible for the week after signing and is disabled.

Signed rival entries must reflect real CPU roster/contracts/transactions, not flavor-only rumor.

## Contracts

- Drafted wrestlers begin on a 52-week prepaid contract, which can extend past the current 50-week season cadence.
- Market signings use week-based negotiation.
- Player can select week length for market signings and renewals.
- Short contracts cost more per week; longer commitments reduce weekly ask.
- Cash is required up front.
- Full contract amount is paid when signing or renewing.
- No debt is allowed from signings or renewals.
- Releasing prepaid contracts gives no refund.
- Prepaid contracts should not be charged again as same-week transaction costs.
- Expiring contracts warn at 2 weeks remaining.
- Expired contracts leave immediately on Advance Week and use the same cleanup rules as release/trade for titles, rivalries, and current card slots.
- Renewals are handled from the current roster contract desk, not the weekly board.
- Renewals use steadier current-roster pricing, not external market volatility.

## CPU Rules

- CPU rivals obey budget constraints for signings and renewals.
- CPU claims from the weekly board add real roster members, contracts, free-agent claims, activity history, and market transactions.
- CPU renewals are deterministic and simpler than player negotiation.
- CPU should prioritize retaining stronger talent before signing new market talent.
- Greyed-out rival-signed board entries remain unavailable to the player unless later released/expired into the pool.

## Season Transition

- Contracts can carry across seasons.
- Starting a new season keeps contracted wrestlers.
- Wrestlers without active/expiring contracts do not carry forward.
- Start Next Season should not block if the roster is thin.
- Booking validation and market pressure handle roster recovery.

## Out of Scope

- Full offseason screen.
- Multi-season negotiation beyond week-count extension.
- Rival HQ screens or editable CPU booking.
- Complex accounting, debt, firing, progression locks, or sponsorships.
- Router, backend, database, or persistence replacement.
