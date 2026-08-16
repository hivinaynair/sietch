# contracts

Foundry desk: two receipts, one settlement.

```bash
source "$HOME/.zshenv"
export PATH="$HOME/.foundry/bin:$PATH"
forge test --root contracts
```

Broadcast the clip on Base Sepolia (fake ETH). Receipts already exist in `artifacts/demo/`.

```bash
export PROGRAM_VKEY=0x00035e8be65b2881b5409b3238047ddd679c9cce04cb4140973e04e9ed3330cd
export CHANI_POLICY_HASH=0x3e9abaca0aad9ede81f4474766c846d8539f70688e1c8f521bbe1597874e3dc4
export PAUL_POLICY_HASH=0x3e9abaca0aad9ede81f4474766c846d8539f70688e1c8f521bbe1597874e3dc4
export PAUL_POLICY_HASH_V2=0x2a32391a76c35a36352b711f9152c0d0a340cd686850c8ef25fbb11c71b89e7b

forge script script/Deploy.s.sol --root contracts --rpc-url https://sepolia.base.org --broadcast
# then:
export DESK=0xF94822401F3DdEC9e53c4143A4eFEdF61488dFA7
forge script script/Clip.s.sol --root contracts --rpc-url https://sepolia.base.org --broadcast
```

The spent exhibit desk is `0xF94822401F3DdEC9e53c4143A4eFEdF61488dFA7`. A live walk needs a **fresh** T-bill and desk (same receipts, empty `usedTransfer`, 1 share on the desk, 0 on Paul’s books). From the repo root: `bun run rearm`. Then set `SIETCH_DESK_ADDRESS` + `SIETCH_FROM_BLOCK` + `SIETCH_CLERK_PRIVATE_KEY` on the web app. The click submits `settle()` / `publishInbound`.

`publishInbound` is callable by the deploy key (demo clerk). Production would leave `publisher` as `address(0)` so only `0x2222…` (Paul’s institution) can publish. We do not have that key.

Copy: instruct / deliver / settlement pending beneficiary policy / settled for Paul.
