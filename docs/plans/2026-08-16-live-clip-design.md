# Live clip

Date: 2026-08-16  
Status: implementing. The room stops being a player of `chain.json` and becomes a clerk for `Desk.sol`.

## What Loong should believe

The click spends. Same as Bare Metal moving USDC — except the asset is the T-bill share, and the gate is two receipts. Receipts are precomputed (the funded wallet). `settle()` / `publishInbound` run now.

## Shape

- Phase is derived from the desk: pending event, inbound hash, `SettledForPaul`.
- POST `/api/clip/advance` broadcasts the next write with the clerk key. The tab waits for the receipt.
- GET `/api/clip/state` returns phase, live tx hashes, Paul’s books.
- No clerk key → idle, control disarmed. `SIETCH_LIVE=0` forces that (e2e).
- Reset does not rewind the chain. Live: Refresh. One walk per desk.

## Fresh desk

Same four Groth16 files work on a new desk (`usedTransfer` empty, 1 share minted, inbound v1). Deploy before the meeting. The spent desk at `0xF948…` stays as the recorded exhibit.

Live desk (2026-08-16): `0x94D3B70Dff6c8e19F60d742372E08461bC959164`. T-bill `0xC106Ee271b7Baa1399F2D5c2F59F769A71d6355a`. Paul’s books start at 0. One walk. Redeploy to rehearse again.
