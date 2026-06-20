# Market Weekly Board and Contract Loop v1

## Intent

Make Market feel like a weekly GM desk instead of a full free-agent database. Each week should present a small, fixed market window, real rival pressure, focused free-agent negotiation, readable trade-wire pressure, and clear prepaid contract math.

## Player Rules

- Market shows a weekly board of 0-6 superstars.
- The weekly board is generated deterministically for the active season/week and persists in the save.
- Week 1 receives a board when a new career starts.
- Advancing the week generates the next board.
- Reloading or Continue must not reshuffle the board.
- Signing a talent does not reshuffle the board.
- Player market actions lock after the current week's show has been run.
- The weekly board has no search, sort, or heavy filters.
- A quiet board week should still leave Market useful through trade wire, office pressure, and transaction feed.
- Selecting board talent opens a centered deal window instead of using an always-visible inline workspace.
- The deal window stays open after a negotiation resolves so the accepted/declined result animation remains visible.
- Renewals and releases belong in the superstar/profile flow, not the Market Desk command board.

## Board Entry States

- Available: player can open the deal window, tune weekly money and contract weeks, then file one formal negotiation offer.
- Signed by rival: row is greyed out, reveals the rival brand, and is not negotiable.
- Signed by player: row remains visible for the week after signing and is disabled.
- Offer declined: row remains visible for the week, is disabled, and records the offer package/result metadata.

Signed rival entries must reflect real CPU roster/contracts/transactions, not flavor-only rumor.

## Contracts

- Drafted wrestlers begin on a 52-week prepaid contract, which can extend past the current 50-week season cadence.
- Market signings use a one-offer weekly negotiation.
- Player can select weekly salary and week length for free-agent market offers.
- Short contracts cost more per week; longer commitments reduce weekly ask.
- Cash is required up front.
- Full contract amount is paid only when a submitted free-agent offer is accepted.
- Declined free-agent offers cost no money and block a second offer for that talent until a future board outcome.
- No debt is allowed from signings.
- Releasing prepaid contracts gives no refund.
- Prepaid contracts should not be charged again as same-week transaction costs.
- Expiring contracts warn at 2 weeks remaining.
- Expired contracts leave immediately on Advance Week and use the same cleanup rules as release/trade for titles, rivalries, and current card slots.
- Renewals are handled from the current roster contract desk, not the weekly board.
- Renewals use steadier current-roster pricing, not external market volatility.

## Negotiation Read

- Each free agent has a deterministic negotiation personality derived from wrestler/source identity.
- Current personalities are Money First, Security Seeker, Spotlight Driven, Momentum Chaser, and Rival Leverage.
- The deal window shows qualitative reads only: Cold, Listening, Serious Interest, Near Agreement, or Deal Feels Ready.
- The player should not see exact acceptance percentages.
- Acceptance is based on weekly salary, contract weeks, personality weighting, roster role fit, brand momentum, and rival pressure.
- Accepted offers immediately add the wrestler, create a prepaid contract, deduct due-now money, mark the board entry signed by player, and show an accepted result animation.
- Declined offers deduct no money, record the package/result, mark the board entry unavailable, and show a declined result animation.

## Trade Wire

- Trade Wire remains part of Market Desk and uses deterministic rival-roster targets.
- Trade proposals compare outgoing player value against target value using popularity, momentum, best in-ring/promo skill, and contract cost.
- Rival need, rival GM style, and deterministic desk mood modify the trade read.
- UI shows qualitative trade reads only: Rival Wants This, Strong Fit, Workable, Long Shot, or No Traction.
- Accepted trades transfer both wrestlers and contracts, clean outgoing player references, charge the deterministic transaction fee, and show an accepted result animation.
- Rejected trades cost no money, write a transaction note, and show a declined result animation.

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
