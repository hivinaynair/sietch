# Demo artifacts

Four Groth16 receipts for the clip. The public page **verifies**; it does not prove.

| File | Seat | Result |
|---|---|---|
| `chani-outbound.groth16.json` | Chani’s institution · outbound | allowed |
| `paul-inbound-v1.groth16.json` | Paul’s institution · inbound v1 | denied |
| `chani-outbound-retry.groth16.json` | Chani’s institution · outbound | allowed |
| `paul-inbound-v2.groth16.json` | Paul’s institution · inbound v2 | allowed |

`*.execute.json` are execute-only (`proof: null`). Keep them.

`chain.json` is the Base Sepolia record for the **current** desk. `bun run rearm` rewrites it (new T-bill, new desk, empty clip). The share sits on the desk until someone walks the clip; Paul’s institution (`0x2222…`) holds 0.

Guest token id in the receipts is `0x3333…3333`. The desk moves a deployed `sTBILL` and checks that id. Instant = two `verifyProof` calls, then transfer or not.
