# Demo artifacts

Four Groth16 receipts for the clip. The public page **verifies**; it does not prove.

| File | Seat | Result |
|---|---|---|
| `chani-outbound.groth16.json` | Chani’s institution · outbound | allowed |
| `paul-inbound-v1.groth16.json` | Paul’s institution · inbound v1 | denied |
| `chani-outbound-retry.groth16.json` | Chani’s institution · outbound | allowed |
| `paul-inbound-v2.groth16.json` | Paul’s institution · inbound v2 | allowed |

`*.execute.json` are execute-only (`proof: null`). Keep them.

`chain.json` is the Base Sepolia broadcast: desk `0xF948…dFA7`, tbill `0x66DD…7984`, then settle (pending) → publish inbound v2 → settle (for Paul). Paul’s institution (`0x2222…`) holds 1 share.

Guest token id in the receipts is `0x3333…3333`. The desk moves a deployed `sTBILL` and checks that id. Instant = two `verifyProof` calls, then transfer or not.
