# contracts

Foundry desk: two receipts, one settlement.

```bash
source "$HOME/.zshenv"
export PATH="$HOME/.foundry/bin:$PATH"
forge test --root contracts
```

## Arming a live walk

A live walk needs a **fresh** T-bill and desk (same receipts, empty `usedTransfer`, 1 share on the
desk, 0 on Paul's books). Put `PRIVATE_KEY` in `contracts/.env`, then from the repo root:

```bash
bun run rearm
```

First run deploys `ClipFactory` — its constructor arms a desk. Later runs call `factory.rearm()`, so
the website pointer stays put: no Vercel env bump, no reprove. The script hardcodes the vkey and
policy hashes and writes the new addresses to `artifacts/demo/chain.json`.

Set `SIETCH_FACTORY_ADDRESS` on the web app once. The page reads `factory.desk()`; **Re-arm** rotates
the desk without a redeploy. The click submits `settle()` / `publishInbound` from the web app
(`apps/web/src/features/settlement/desk-live.ts`) — there is no longer a forge script for the clip.

`publishInbound` is callable by the deploy key (demo clerk). Production would leave `publisher` as
`address(0)` so only `0x2222…` (Paul's institution) can publish. We do not have that key.

The original one-shot exhibit desk was `0xF94822401F3DdEC9e53c4143A4eFEdF61488dFA7`, deployed by a
`Deploy.s.sol` / `Clip.s.sol` pair that `ClipFactory` replaced. Both scripts are in git history.

Copy: instruct / deliver / settlement pending beneficiary policy / settled for Paul.
