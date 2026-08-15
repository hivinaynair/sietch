# Sietch prove on Modal

Modal **user** `hi-83670` (the account already on this laptop). CLI profile `thumper` is that user’s token. **Different app** from Thumper. Do not deploy this onto `thumper-worker`. Do not attach `thumper-secrets`.

Think of it like one Vercel login with two projects. Thumper’s worker is a 4GB Bun / yt-dlp job. Groth16 needs a fat, one-shot box. This file is that box. The public Sietch URL still only **verifies**.

```bash
# from sietch repo root (uses ~/.modal.toml profile `thumper` → user hi-83670)
# Groth16: Succinct network. Modal has no Docker daemon.
NETWORK_PRIVATE_KEY=0x... modal run apps/modal/prove.py
# or create a named secret (not thumper-secrets):
#   modal secret create sietch-prove NETWORK_PRIVATE_KEY=0x...
#   modal run apps/modal/prove.py
```

Paste the printed `publicValues` / `proof` / `programVKey` into `artifacts/demo/`. Then delete nothing on Thumper.

Key setup: [Succinct prover network quickstart](https://docs.succinct.xyz/docs/sp1/prover-network/quickstart) — `cast wallet new`, set `NETWORK_PRIVATE_KEY`, deposit PROVE.
