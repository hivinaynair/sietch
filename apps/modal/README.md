# Sietch prove on Modal

Same **account** as Thumper (`modal` CLI profile `thumper`). **Different app.** Do not deploy this onto `thumper-worker`. Do not attach `thumper-secrets`.

Thumper’s worker is a 4GB Bun / yt-dlp job. Groth16 needs a fat, one-shot box. This file is that box. The public Sietch URL still only **verifies**.

```bash
# from sietch repo root (uses your existing ~/.modal.toml)
modal run apps/modal/prove.py
```

Paste the printed `publicValues` / `proof` / `programVKey` into `artifacts/demo/`. Then delete nothing on Thumper.

If Groth16 still asks for Docker inside the container, we switch this image to include Docker or call Succinct’s network from Modal — still not your laptop.
