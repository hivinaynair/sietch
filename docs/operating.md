# Operating the clip

The live page drives a real desk. State lives on chain, so the clip is shared: whoever clicks advances it for everyone.

- **Phase is derived from contract state** (`usedTransfer`, `policyHashOf`), not from a sliding event window, so a settled desk cannot read back as fresh.
- **Set `SIETCH_FROM_BLOCK`** to the desk's deploy block. Without it the event scan falls back to the deploy block recorded in `artifacts/demo/chain.json`.
- **A spent desk stays spent.** There is no recorded replay. Re-arm to walk it again.

## Re-arm

Re-arm deploys a **new** `TBill` and `Desk`, mints 1 share onto the desk, and stores the pointer on `ClipFactory`. Receipts bind vkey, orgs, token id, policy seals and transfer ids, **not** the desk address, so a new desk restores the clip without reproving. A new token is required because reusing the previous sTBILL would leave shares on Paul's books.

**On the live page.** **Re-arm** (next to Refresh) confirms "this spends gas, tops the clerk to 0.005 ETH, and starts a new desk," then `POST /api/clip/rearm` calls `factory.rearm()`. If the clerk cannot pay gas, the API asks Coinbase's Base Sepolia faucet (0.0001 ETH) and retries. Uses the same `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` / `CDP_WALLET_SECRET` as Metal. Books should read 1 on the desk and 0 on Paul's books. Refresh only re-reads chain; it does not rotate a spent desk.

**From this machine.** `bun run rearm` deploys the factory once, then later calls `rearm()` on it. Set `SIETCH_FACTORY_ADDRESS` on the web app (and Vercel) **once**. After that, website re-arm needs no env bump and no redeploy.

**Do not walk the desk** until you are ready to show the clip.
