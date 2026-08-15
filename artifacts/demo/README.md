# Demo artifacts

`chani-outbound.execute.json` is **execute only** (public values + program vkey). `proof` is null until Groth16 runs.

Groth16 is requested from Modal via the Succinct network (`NETWORK_PRIVATE_KEY`), not proved in the browser:

```bash
NETWORK_PRIVATE_KEY=0x... modal run apps/modal/prove.py
```

A successful run writes `chani-outbound.groth16.json` here. Keep the execute json.
