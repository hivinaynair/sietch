# Demo artifacts

`chani-outbound.execute.json` is **execute only** (public values + program vkey). `proof` is null until Groth16 runs.

Groth16 needs Docker (≥16GB RAM) or `NETWORK_PRIVATE_KEY` (Succinct network), then:

```bash
export PATH="$HOME/.sp1/bin:$PATH"
cargo run -p sietch-prove --bin prove-one
```
